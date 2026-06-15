// ── LLM cost pricing ──────────────────────────────────────────────────────────
//
// Single source of truth for per-model prices and the cost math used to attribute
// USD spend to each chat query. Update the rate tables here if model pricing
// changes — nothing else in the app hardcodes a price.
//
// A chat query fires up to 4 model calls: query synthesis (Haiku), embedding
// (Gemini), rerank (Haiku or Cohere), and the final grounded answer (Sonnet).
// Each call reports its usage via a CostSink; sumCost() prices the lot.

/** USD per 1,000,000 tokens, by model id. */
const TOKEN_PRICES: Record<string, { input: number; output: number }> = {
  "claude-sonnet-4-6": { input: 3.0, output: 15.0 },
  "claude-haiku-4-5": { input: 1.0, output: 5.0 },
  "gemini-embedding-001": { input: 0.15, output: 0 },
};

/** USD per call, for models priced per-request rather than per-token (e.g. Cohere rerank). */
const PER_CALL_PRICES: Record<string, number> = {
  "rerank-v3.5": 0.002, // ~$2 per 1,000 searches
};

export type UsageEntry = {
  model: string;
  inputTokens?: number;
  outputTokens?: number;
  /** Number of flat-priced calls (for per-request models like Cohere rerank). */
  calls?: number;
};

/** Coerces a possibly-undefined/NaN token count to a finite number (0 otherwise). */
function finite(n: number | undefined): number {
  return typeof n === "number" && Number.isFinite(n) ? n : 0;
}

/** Prices a single usage entry in USD. Unknown models contribute 0. */
export function costForEntry(e: UsageEntry): number {
  const tokenPrice = TOKEN_PRICES[e.model];
  const tokenCost = tokenPrice
    ? (finite(e.inputTokens) * tokenPrice.input +
        finite(e.outputTokens) * tokenPrice.output) /
      1_000_000
    : 0;
  const callCost = finite(e.calls) * (PER_CALL_PRICES[e.model] ?? 0);
  return tokenCost + callCost;
}

/** Sums the USD cost of many usage entries. */
export function sumCost(entries: UsageEntry[]): number {
  return entries.reduce((acc, e) => acc + costForEntry(e), 0);
}

/** A function the RAG pipeline calls to report one model call's usage. */
export type CostSink = (e: UsageEntry) => void;

/**
 * Per-request accumulator. Pass `.sink` into the RAG pipeline; read `.entries`
 * (or `.total()`) once the request completes.
 */
export function createCostAccumulator() {
  const entries: UsageEntry[] = [];
  const sink: CostSink = (e) => {
    entries.push(e);
  };
  return {
    entries,
    sink,
    total: () => sumCost(entries),
  };
}
