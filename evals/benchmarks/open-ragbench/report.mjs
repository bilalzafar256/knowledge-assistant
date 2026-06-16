/**
 * Render a shareable effectiveness report from the latest Open RAG Benchmark run.
 *
 * Reads the most recent JSON in `evals/benchmarks/open-ragbench/runs/` (or a
 * specific file via --run <path>) and writes:
 *
 *   evals/benchmarks/open-ragbench/REPORT.md
 *
 * Pure synthesis — no LLM calls, no DB queries.
 *
 * Usage:
 *   node evals/benchmarks/open-ragbench/report.mjs
 *   node evals/benchmarks/open-ragbench/report.mjs --run evals/benchmarks/open-ragbench/runs/2026-05-21T12-00-00_ragbench-baseline.json
 */
import { readFileSync, readdirSync, writeFileSync, statSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join, resolve } from "node:path";

const __dir = dirname(fileURLToPath(import.meta.url));
const RUNS_DIR = join(__dir, "runs");

const argv = process.argv.slice(2);
function arg(name) {
  const i = argv.indexOf(`--${name}`);
  return i === -1 ? null : argv[i + 1];
}
const outArg = arg("out");
const OUT_PATH = outArg
  ? (outArg.startsWith("/") ? outArg : resolve(__dir, outArg))
  : join(__dir, "REPORT.md");

function findLatestRun() {
  if (!existsSync(RUNS_DIR)) return null;
  const files = readdirSync(RUNS_DIR)
    .filter((f) => f.endsWith(".json"))
    .map((f) => ({ f, t: statSync(join(RUNS_DIR, f)).mtimeMs }))
    .sort((a, b) => b.t - a.t);
  return files[0] ? join(RUNS_DIR, files[0].f) : null;
}

const runPath = arg("run") ? resolve(arg("run")) : findLatestRun();
if (!runPath) {
  console.error(`✗ No run JSON found in ${RUNS_DIR}. Run: pnpm eval:ragbench:run`);
  process.exit(1);
}

const run = JSON.parse(readFileSync(runPath, "utf8"));
const s = run.summary;
const per = run.perQuestion.filter((q) => q && !q.error);
const withBench = per.filter((q) => q.benchmark);

function pct(x, d = 1) {
  return x == null || Number.isNaN(x) ? "—" : `${(x * 100).toFixed(d)}%`;
}
function num(x, d = 2) {
  return x == null || Number.isNaN(x) ? "—" : x.toFixed(d);
}

// ── Per-modality + per-type breakdown ────────────────────────────────────────
function group(items, keyFn) {
  const out = new Map();
  for (const it of items) {
    const k = keyFn(it) ?? "unknown";
    if (!out.has(k)) out.set(k, []);
    out.get(k).push(it);
  }
  return out;
}
function aggregate(items) {
  const n = items.length || 1;
  return {
    count: items.length,
    recall: items.reduce((s, q) => s + (q.retrieval?.recall_at_k ?? 0), 0) / n,
    mrr: items.reduce((s, q) => s + (q.retrieval?.mrr_reranked ?? 0), 0) / n,
    cp: items.reduce((s, q) => s + (q.retrieval?.context_precision ?? 0), 0) / n,
    faith: items.reduce((s, q) => s + (q.answer?.faithfulness ?? 0), 0) / n,
    corr: items.reduce((s, q) => s + (q.answer?.correctness ?? 0), 0) / n,
  };
}
const byModality = [...group(withBench, (q) => q.benchmark?.source).entries()]
  .map(([k, xs]) => ({ key: k, ...aggregate(xs) }))
  .sort((a, b) => b.count - a.count);
const byType = [...group(withBench, (q) => q.benchmark?.type).entries()]
  .map(([k, xs]) => ({ key: k, ...aggregate(xs) }))
  .sort((a, b) => b.count - a.count);

// ── Diagnostic: where correctness leaks (recall hit vs miss) ──────────────────
// The single most actionable decomposition. Correctness has two independent
// failure modes: (1) retrieval missed → the answer can't be right, and (2)
// retrieval hit but the answer was still weak. Separating them tells us whether
// to invest in retrieval or in the answer/chunk-quality step. Only meaningful
// when answers were generated.
const answered = withBench.filter((q) => q.answer != null);
const recallHits = answered.filter((q) => (q.retrieval?.recall_at_k ?? 0) === 1);
const recallMisses = answered.filter((q) => (q.retrieval?.recall_at_k ?? 0) === 0);
// "Hit-but-weak": retrieval surfaced the right section yet correctness < 0.5.
// With section-level recall matching, this is the signature of the fact-bearing
// CHUNK not ranking — a chunking / chunk-context problem, not a noise problem.
const WEAK_THRESHOLD = 0.5;
const hitButWeak = recallHits.filter((q) => (q.answer?.correctness ?? 0) < WEAK_THRESHOLD);

// ── Plain-language interpretation ─────────────────────────────────────────────
const fabPct = s.faithfulness != null ? (1 - s.faithfulness) * 100 : null;
const avgLatencyS = s.avg_latency_ms != null ? (s.avg_latency_ms / 1000).toFixed(1) : "—";
const costPerQ = s.estimated_cost_usd != null
  ? (s.estimated_cost_usd / per.length).toFixed(4)
  : "—";

// ── Verdict tiers ─────────────────────────────────────────────────────────────
//
// SINGLE SOURCE OF TRUTH: docs/GO_LIVE_READINESS.md → "Thresholds (canonical)".
// `strong` here equals the strict go-live GATE for each metric, so 🟢 means
// "meets the launch gate"; 🟡 is a below-gate pilot floor. The Open RAG
// Benchmark publishes no official cutoffs — these are our chosen strict bars
// for a grounding-strict product. Keep these numbers in lockstep with the
// canonical doc.
// `hard: true` = a launch-blocking gate (must meet `strong` to ship to GA).
// Soft metrics are targets, not blockers. Mirrors docs/GO_LIVE_READINESS.md §1a.
const TIERS = [
  { key: "recall_at_k_reranked", label: "Recall@5",       fmt: pct,  strong: 0.85, acceptable: 0.70, hard: true },
  { key: "mrr_reranked",         label: "MRR",            fmt: (x) => num(x, 3), strong: 0.70, acceptable: 0.50 },
  { key: "context_precision",    label: "Context prec.",  fmt: pct,  strong: 0.65, acceptable: 0.45 },
  { key: "faithfulness",         label: "Faithfulness",   fmt: pct,  strong: 0.90, acceptable: 0.75, hard: true },
  { key: "correctness",          label: "Correctness",    fmt: pct,  strong: 0.85, acceptable: 0.65, hard: true },
  { key: "citation",             label: "Citation acc.",  fmt: pct,  strong: 0.90, acceptable: 0.70, hard: true },
];
function tier(metric, value) {
  if (value == null || Number.isNaN(value)) return { name: "—", marker: "·" };
  if (value >= metric.strong) return { name: "Meets gate", marker: "🟢" };
  if (value >= metric.acceptable) return { name: "Below gate (pilot)", marker: "🟡" };
  return { name: "Needs work", marker: "🔴" };
}
const verdicts = TIERS
  .filter((m) => s[m.key] != null)
  .map((m) => ({ ...m, value: s[m.key], ...tier(m, s[m.key]) }));
const needsWorkCount = verdicts.filter((v) => v.name === "Needs work").length;
// Launch decision is driven by HARD gates, not a tier tally: GA requires every
// hard gate to meet its threshold; a hard gate below pilot floor blocks even beta.
const hardVerdicts = verdicts.filter((v) => v.hard);
const hardGatesMet = hardVerdicts.every((v) => v.value >= v.strong);
const hardGateNeedsWork = hardVerdicts.some((v) => v.name === "Needs work");
const overall = hardGatesMet && needsWorkCount === 0
  ? { name: "GA-ready (single domain — confirm on enterprise set)", marker: "🟢" }
  : hardGateNeedsWork
  ? { name: "Needs work before production — a launch-blocking gate is below floor", marker: "🔴" }
  : { name: "Conditional GO — beta only (a hard gate is below its launch threshold)", marker: "🟡" };

// ── Render ────────────────────────────────────────────────────────────────────
const lines = [];
lines.push("# How effective is this RAG system?");
lines.push("");
lines.push(`> Run: \`${run.label}\` · Generated ${new Date(run.finishedAt).toISOString().slice(0, 10)}`);
lines.push("");
lines.push("This report measures the production RAG pipeline against **Vectara's Open RAG Benchmark** — 1,000 arXiv papers with 3,045 expert-written question-answer pairs spanning text, tables, and figures. Unlike a synthetic eval, the questions are written by humans and the ground truth is published, so results are directly comparable to other RAG systems benchmarked on the same set.");
lines.push("");

lines.push("## Headline numbers");
lines.push("");
lines.push(`- **Questions evaluated:** ${per.length} (of ${run.goldenSet.count} sampled)`);
lines.push(`- **Recall@${run.config.topK}** — fraction of queries where the right section appears in the top ${run.config.topK} results: **${pct(s.recall_at_k_reranked)}**`);
lines.push(`- **MRR (Mean Reciprocal Rank)** — how high the right section ranks on average: **${num(s.mrr_reranked, 3)}**`);
lines.push(`- **Context precision** — fraction of returned chunks judged relevant: **${pct(s.context_precision)}**`);
if (run.config.ranAnswers) {
  lines.push(`- **Faithfulness** — fraction of answers grounded in the retrieved context: **${pct(s.faithfulness)}**`);
  lines.push(`- **Correctness** — semantic match against the benchmark's reference answer: **${pct(s.correctness)}**`);
  lines.push(`- **Citation accuracy** — fraction of answers that name the source document: **${pct(s.citation)}**`);
  lines.push(`- **Avg latency:** ${avgLatencyS}s per query · **Cost per query:** $${costPerQ}`);
}
lines.push("");

lines.push("## Verdict");
lines.push("");
lines.push(`${overall.marker} **Overall: ${overall.name}**`);
lines.push("");
lines.push("Scored against the **canonical strict go-live gates** defined in `docs/GO_LIVE_READINESS.md` (the single source of truth). The Open RAG Benchmark publishes no official cutoffs — these are our chosen strict bars for a grounding-strict product. **Gate ≥** is the launch threshold; **Pilot ≥** is a below-gate floor that's acceptable for a limited beta.");
lines.push("");
lines.push("| Metric | Value | Status | Gate ≥ | Pilot ≥ |");
lines.push("| --- | ---: | :---: | ---: | ---: |");
for (const v of verdicts) {
  lines.push(`| ${v.label} | ${v.fmt(v.value)} | ${v.marker} ${v.name} | ${v.fmt(v.strong)} | ${v.fmt(v.acceptable)} |`);
}
lines.push("");
lines.push("Legend: 🟢 Meets gate (launch-grade) · 🟡 Below gate (beta-only) · 🔴 Needs work.");
lines.push("");

lines.push("## What this means");
lines.push("");
lines.push(`- For every ${run.config.topK} results we surface, the **correct passage is present ${pct(s.recall_at_k_reranked, 0)}** of the time.`);
if (fabPct != null) {
  lines.push(`- The system **fabricates content in ≈${fabPct.toFixed(1)}%** of answers (1 − faithfulness).`);
}
lines.push(`- On average, the correct chunk ranks at position **${s.mrr_reranked > 0 ? (1 / s.mrr_reranked).toFixed(1) : "—"}**.`);
lines.push("");

// ── Diagnostic section: correctness decomposition ─────────────────────────────
if (run.config.ranAnswers && answered.length > 0) {
  const aHit = aggregate(recallHits);
  const aMiss = aggregate(recallMisses);
  lines.push("## Diagnostic: where correctness leaks");
  lines.push("");
  lines.push("Correctness fails in two independent ways. Splitting by whether retrieval found the right section tells us where to invest — retrieval vs the answer/chunk-quality step.");
  lines.push("");
  lines.push("| Slice | Count | Correctness | Faithfulness | Context prec. |");
  lines.push("| --- | ---: | ---: | ---: | ---: |");
  lines.push(`| Retrieval **hit** | ${aHit.count} | ${pct(aHit.corr)} | ${pct(aHit.faith)} | ${pct(aHit.cp)} |`);
  lines.push(`| Retrieval **miss** | ${aMiss.count} | ${pct(aMiss.corr)} | ${pct(aMiss.faith)} | ${pct(aMiss.cp)} |`);
  lines.push("");
  const hitCorr = aggregate(hitButWeak);
  lines.push(
    `**Hit-but-weak:** ${hitButWeak.length} of ${recallHits.length} retrieval hits still scored correctness < ${WEAK_THRESHOLD} ` +
      `(their context precision ${pct(hitCorr.cp)} vs all-hits ${pct(aHit.cp)}). ` +
      `When these two precisions are close, noise is **not** the cause — with section-level recall matching, it points to the fact-bearing chunk not ranking (a chunking / chunk-context problem).`
  );
  lines.push("");
}

if (byModality.length > 0) {
  lines.push("## Where it shines, where it struggles");
  lines.push("");
  lines.push("### By modality");
  lines.push("Question stratified by what the question *requires*: text, a table, an image, or several.");
  lines.push("");
  lines.push("| Modality | Count | Recall@k | MRR | Ctx prec. | Faith | Corr |");
  lines.push("| --- | ---: | ---: | ---: | ---: | ---: | ---: |");
  for (const r of byModality) {
    lines.push(
      `| ${r.key} | ${r.count} | ${pct(r.recall)} | ${num(r.mrr, 3)} | ${pct(r.cp)} | ${pct(r.faith)} | ${pct(r.corr)} |`
    );
  }
  lines.push("");
  lines.push("### By query type");
  lines.push("");
  lines.push("- **extractive** — answer is a span of text from the source");
  lines.push("- **abstractive** — answer synthesises or paraphrases across the source");
  lines.push("");
  lines.push("| Type | Count | Recall@k | MRR | Ctx prec. | Faith | Corr |");
  lines.push("| --- | ---: | ---: | ---: | ---: | ---: | ---: |");
  for (const r of byType) {
    lines.push(
      `| ${r.key} | ${r.count} | ${pct(r.recall)} | ${num(r.mrr, 3)} | ${pct(r.cp)} | ${pct(r.faith)} | ${pct(r.corr)} |`
    );
  }
  lines.push("");
}

lines.push("## Pipeline under test");
lines.push("");
lines.push("| Layer | Component |");
lines.push("| --- | --- |");
lines.push(`| Chat model | \`${run.config.chatModel}\` |`);
lines.push(`| Embedding model | \`${run.config.embeddingModel}\` |`);
lines.push(`| Judge model (LLM-as-a-judge) | \`${run.config.judgeModel}\` |`);
lines.push(`| Retrieval | Hybrid (pgvector cosine + Postgres BM25) fused via Reciprocal Rank Fusion |`);
lines.push(`| Reranker | Cohere Rerank 3.5 (with Claude Haiku fallback) |`);
lines.push(`| Top-K | ${run.config.topK} |`);
lines.push("");

lines.push("## Caveats");
lines.push("");
lines.push("- **Domain:** arXiv research papers only. Performance on enterprise documents (contracts, policies, internal wikis) may differ — that's a separate eval surface.");
lines.push("- **Sampling:** stratified by modality so smaller samples still exercise tables and figures. See `golden/golden-set.json` for the exact subset.");
lines.push("- **Image content:** the dataset ships images as base64 blobs which we do not OCR — image-modality questions retrieve via surrounding text only.");
lines.push("- **Section granularity:** the benchmark's ground truth is at section level. We tag every chunk with its `section_id` in metadata and score a hit if any chunk from the right section lands in the top-k.");
lines.push("");

lines.push("## How to reproduce");
lines.push("");
lines.push("```bash");
lines.push("pnpm eval:ragbench:download    # ~743 MB to evals/benchmarks/open-ragbench/data/");
lines.push("pnpm eval:ragbench:ingest      # ~3–5 min, ~$5 in embeddings");
lines.push("pnpm eval:ragbench:golden -- --sample 2000");
lines.push("pnpm eval:ragbench:run -- --label ragbench-baseline --concurrency 4");
lines.push("pnpm eval:ragbench:report");
lines.push("```");
lines.push("");

lines.push(`Full run artifacts: \`${runPath.split("/").slice(-3).join("/")}\` and the sibling \`.md\` file.`);

writeFileSync(OUT_PATH, lines.join("\n"));
console.log(`✓ Wrote ${OUT_PATH}`);
console.log(`  Source run: ${runPath}`);
