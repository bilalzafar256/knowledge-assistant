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
const OUT_PATH = join(__dir, "REPORT.md");

const argv = process.argv.slice(2);
function arg(name) {
  const i = argv.indexOf(`--${name}`);
  return i === -1 ? null : argv[i + 1];
}

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

// ── Plain-language interpretation ─────────────────────────────────────────────
const recallPct = s.recall_at_k_reranked * 100;
const fabPct = s.faithfulness != null ? (1 - s.faithfulness) * 100 : null;
const avgLatencyS = s.avg_latency_ms != null ? (s.avg_latency_ms / 1000).toFixed(1) : "—";
const costPerQ = s.estimated_cost_usd != null
  ? (s.estimated_cost_usd / per.length).toFixed(4)
  : "—";

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

lines.push("## What this means");
lines.push("");
lines.push(`- For every ${run.config.topK} results we surface, the **correct passage is present ${pct(s.recall_at_k_reranked, 0)}** of the time.`);
if (fabPct != null) {
  lines.push(`- The system **fabricates content in ≈${fabPct.toFixed(1)}%** of answers (1 − faithfulness).`);
}
lines.push(`- On average, the correct chunk ranks at position **${s.mrr_reranked > 0 ? (1 / s.mrr_reranked).toFixed(1) : "—"}**.`);
lines.push("");

if (byModality.length > 0) {
  lines.push("## Where it shines, where it struggles");
  lines.push("");
  lines.push("### By modality");
  lines.push("Question stratified by what the question *requires*: text, a table, an image, or several.");
  lines.push("");
  lines.push("| Modality | Count | Recall@k | MRR | Faith | Corr |");
  lines.push("| --- | ---: | ---: | ---: | ---: | ---: |");
  for (const r of byModality) {
    lines.push(
      `| ${r.key} | ${r.count} | ${pct(r.recall)} | ${num(r.mrr, 3)} | ${pct(r.faith)} | ${pct(r.corr)} |`
    );
  }
  lines.push("");
  lines.push("### By query type");
  lines.push("");
  lines.push("- **extractive** — answer is a span of text from the source");
  lines.push("- **abstractive** — answer synthesises or paraphrases across the source");
  lines.push("");
  lines.push("| Type | Count | Recall@k | MRR | Faith | Corr |");
  lines.push("| --- | ---: | ---: | ---: | ---: | ---: |");
  for (const r of byType) {
    lines.push(
      `| ${r.key} | ${r.count} | ${pct(r.recall)} | ${num(r.mrr, 3)} | ${pct(r.faith)} | ${pct(r.corr)} |`
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
lines.push(`| Reranker | Cohere Rerank 3.5 (with gpt-4o-mini fallback) |`);
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
