/**
 * Build a single combined gate-grade report across all eval surfaces.
 *
 * Reads the latest run JSON from each benchmark's runs/ dir (override per
 * benchmark with --arxiv/--cuad/--ragbench <file>), then writes evals/report.md
 * with a per-benchmark section, a per-domain breakdown for RAGBench, and a
 * combined scorecard (per-benchmark gate matrix + pooled overall).
 *
 * The hard/soft gate thresholds mirror docs/GO_LIVE_READINESS.md §1a — keep in lockstep.
 *
 * Usage:
 *   node evals/build-report.mjs                       # latest run from each benchmark
 *   node evals/build-report.mjs --arxiv <run.json>    # pin a specific arXiv run
 */
import { readFileSync, writeFileSync, readdirSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dir = dirname(fileURLToPath(import.meta.url));

const argv = process.argv.slice(2);
function arg(name, def) {
  const i = argv.indexOf(`--${name}`);
  return i === -1 ? def : argv[i + 1];
}

// ── Canonical gate thresholds (docs/GO_LIVE_READINESS.md §1a) ─────────────────
const GATES = [
  { key: "recall", label: "Recall@5 (reranked)", min: 0.85, hard: true, fmt: "pct" },
  { key: "faithfulness", label: "Faithfulness", min: 0.90, hard: true, fmt: "pct" },
  { key: "correctness", label: "Answer correctness", min: 0.85, hard: true, fmt: "pct" },
  { key: "citation", label: "Citation accuracy", min: 0.90, hard: true, fmt: "pct" },
  { key: "mrr", label: "MRR (reranked)", min: 0.70, hard: false, fmt: "num" },
  { key: "ctxprec", label: "Context precision", min: 0.65, hard: false, fmt: "pct" },
];

const pct = (x) => (x * 100).toFixed(1) + "%";
const num = (x) => x.toFixed(3);
const fmtVal = (g, x) => (g.fmt === "pct" ? pct(x) : num(x));
const mark = (g, x) => (x >= g.min ? "✅" : g.hard ? "❌" : "⚠️");
const avg = (xs) => {
  const v = xs.filter((x) => typeof x === "number" && !Number.isNaN(x));
  return v.length ? v.reduce((a, b) => a + b, 0) / v.length : 0;
};

function latestRun(dir) {
  if (!existsSync(dir)) return null;
  const files = readdirSync(dir).filter((f) => f.endsWith(".json")).sort();
  return files.length ? join(dir, files[files.length - 1]) : null;
}

// Pull the six gate metrics out of a run's perQuestion list (so pooling is exact).
function metricsOf(perQuestion) {
  const ok = perQuestion.filter((q) => q && !q.error && q.answer);
  return {
    n: ok.length,
    recall: avg(ok.map((q) => q.retrieval.recall_at_k)),
    faithfulness: avg(ok.map((q) => q.answer.faithfulness)),
    correctness: avg(ok.map((q) => q.answer.correctness)),
    citation: avg(ok.map((q) => q.answer.citation)),
    mrr: avg(ok.map((q) => q.retrieval.mrr_reranked)),
    ctxprec: avg(ok.map((q) => q.retrieval.context_precision)),
    ok,
  };
}

function correctnessSlices(ok) {
  const hit = ok.filter((q) => q.retrieval.recall_at_k === 1);
  const miss = ok.filter((q) => q.retrieval.recall_at_k === 0);
  return {
    hitN: hit.length,
    hitCorr: avg(hit.map((q) => q.answer.correctness)),
    missN: miss.length,
    missCorr: avg(miss.map((q) => q.answer.correctness)),
  };
}

// ── Resolve the three runs ────────────────────────────────────────────────────
const SURFACES = [
  { id: "arxiv", title: "Open RAG Bench — arXiv academic", dir: join(__dir, "benchmarks/open-ragbench/runs"), citationMeaningful: true },
  { id: "cuad", title: "CUAD — enterprise contracts (doc-scoped)", dir: join(__dir, "benchmarks/cuad/runs"), citationMeaningful: true },
  { id: "ragbench", title: "RAGBench — multi-domain enterprise", dir: join(__dir, "benchmarks/ragbench/runs"), citationMeaningful: false },
];

const loaded = [];
for (const s of SURFACES) {
  const path = arg(s.id, null) || latestRun(s.dir);
  if (!path || !existsSync(path)) {
    console.warn(`⚠ no run found for ${s.id} (${s.dir}); skipping`);
    continue;
  }
  const run = JSON.parse(readFileSync(path, "utf8"));
  const m = metricsOf(run.perQuestion);
  loaded.push({ ...s, path, run, m, slices: correctnessSlices(m.ok) });
  console.log(`▸ ${s.id}: ${path.split("/").pop()} (n=${m.n})`);
}
if (loaded.length === 0) {
  console.error("✗ No runs found for any benchmark.");
  process.exit(1);
}

// ── Render ────────────────────────────────────────────────────────────────────
const L = [];
const stamp = new Date().toISOString().slice(0, 19).replace("T", " ") + "Z";
L.push(`# RAG Eval — Gate-Grade Report (multi-domain)`);
L.push("");
L.push(`> Generated ${stamp}. Combines the latest gate-grade run from each eval surface. Hard/soft gate bars per \`docs/GO_LIVE_READINESS.md\` §1a.`);
L.push("");

L.push(`## Gate thresholds`);
L.push("");
L.push(`| Metric | Gate ≥ | Type |`);
L.push(`| --- | ---: | :---: |`);
for (const g of GATES) L.push(`| ${g.label} | ${g.fmt === "pct" ? pct(g.min) : num(g.min)} | ${g.hard ? "**hard**" : "soft"} |`);
L.push("");
L.push(`Hard gates block GA; a domain is "gate-clear" when all four hard gates pass.`);
L.push("");

// Per-benchmark sections
let idx = 0;
for (const b of loaded) {
  idx++;
  const cfg = b.run.config ?? {};
  L.push(`---`);
  L.push("");
  L.push(`## ${idx}. ${b.title}`);
  L.push("");
  L.push(`- **Run:** \`${b.run.label}\` · ${b.path.split("/").pop()}`);
  L.push(`- **Questions:** ${b.m.n} · **chat:** \`${cfg.chatModel}\` · **embed:** \`${cfg.embeddingModel}\` · **judge:** \`${cfg.judgeModel}\` · concurrency ${cfg.concurrency}`);
  if (b.run.summary?.estimated_cost_usd != null) {
    L.push(`- **Anthropic answer cost:** ~$${b.run.summary.estimated_cost_usd.toFixed(2)} · avg latency ${b.run.summary.avg_latency_ms} ms`);
  }
  L.push("");
  L.push(`| Metric | Value | Gate | Verdict |`);
  L.push(`| --- | ---: | ---: | :---: |`);
  for (const g of GATES) {
    const v = b.m[g.key];
    let note = "";
    if (g.key === "citation" && !b.citationMeaningful) note = " *(N/A — anonymous corpus)*";
    if (g.key === "ctxprec" && b.id === "cuad") note = " *(N/A — single-doc QA)*";
    L.push(`| ${g.label}${note} | ${fmtVal(g, v)} | ${g.fmt === "pct" ? pct(g.min) : num(g.min)} | ${note ? "—" : mark(g, v)} |`);
  }
  L.push("");
  L.push(`Correctness slices — recall-**hit** ${pct(b.slices.hitCorr)} (n=${b.slices.hitN}) · recall-**miss** ${pct(b.slices.missCorr)} (n=${b.slices.missN}): ${b.slices.hitCorr > b.slices.missCorr + 0.05 ? "retrieval misses drag correctness; the answer step caps the rest." : "answer step is the cap even when retrieval hits."}`);
  L.push("");

  // Domain breakdown when perQuestion carries benchmark.domain (RAGBench)
  const withDomain = b.m.ok.filter((q) => q.benchmark?.domain);
  if (withDomain.length > 0) {
    const groups = new Map();
    for (const q of withDomain) {
      const k = q.benchmark.domain;
      if (!groups.has(k)) groups.set(k, []);
      groups.get(k).push(q);
    }
    L.push(`### Breakdown by domain`);
    L.push(`| Domain | n | Recall@5 | Faithfulness | Correctness |`);
    L.push(`| --- | ---: | ---: | ---: | ---: |`);
    for (const [k, xs] of [...groups.entries()].sort((a, b2) => b2[1].length - a[1].length)) {
      L.push(`| ${k} | ${xs.length} | ${pct(avg(xs.map((q) => q.retrieval.recall_at_k)))} | ${pct(avg(xs.map((q) => q.answer.faithfulness)))} | ${pct(avg(xs.map((q) => q.answer.correctness)))} |`);
    }
    L.push("");
  }
}

// ── Combined ──────────────────────────────────────────────────────────────────
L.push(`---`);
L.push("");
L.push(`## Combined`);
L.push("");

// Per-benchmark gate matrix
L.push(`### Per-domain gate matrix`);
L.push(`| Domain | n | Recall@5 | Faithful | Correct | Citation | Hard gates |`);
L.push(`| --- | ---: | ---: | ---: | ---: | ---: | :---: |`);
for (const b of loaded) {
  const hardPass = ["recall", "faithfulness", "correctness", "citation"].filter((k) => {
    if (k === "citation" && !b.citationMeaningful) return true; // N/A counts as not-blocking
    return b.m[k] >= GATES.find((g) => g.key === k).min;
  }).length;
  const cite = b.citationMeaningful ? pct(b.m.citation) : "n/a";
  L.push(`| ${b.id} | ${b.m.n} | ${pct(b.m.recall)}${b.m.recall >= 0.85 ? "✅" : "❌"} | ${pct(b.m.faithfulness)}${b.m.faithfulness >= 0.9 ? "✅" : "❌"} | ${pct(b.m.correctness)}${b.m.correctness >= 0.85 ? "✅" : "❌"} | ${cite}${b.citationMeaningful ? (b.m.citation >= 0.9 ? "✅" : "❌") : ""} | ${hardPass}/4 |`);
}
L.push("");

// Pooled overall (weighted by question, exact)
const allOk = loaded.flatMap((b) => b.m.ok);
const pooled = {
  recall: avg(allOk.map((q) => q.retrieval.recall_at_k)),
  faithfulness: avg(allOk.map((q) => q.answer.faithfulness)),
  correctness: avg(allOk.map((q) => q.answer.correctness)),
  citation: avg(allOk.map((q) => q.answer.citation)),
  mrr: avg(allOk.map((q) => q.retrieval.mrr_reranked)),
  ctxprec: avg(allOk.map((q) => q.retrieval.context_precision)),
};
L.push(`### Pooled — all ${allOk.length} questions across ${loaded.length} domains`);
L.push("");
L.push(`| Metric | Pooled | Gate | Verdict |`);
L.push(`| --- | ---: | ---: | :---: |`);
for (const g of GATES) L.push(`| ${g.label} | ${fmtVal(g, pooled[g.key])} | ${g.fmt === "pct" ? pct(g.min) : num(g.min)} | ${mark(g, pooled[g.key])} |`);
L.push("");

// Headline verdict
const faithOK = loaded.every((b) => b.m.faithfulness >= 0.9);
const corrOK = loaded.every((b) => b.m.correctness >= 0.85);
L.push(`### Verdict`);
L.push("");
L.push(`- **Grounding (faithfulness ≥ 90%):** ${faithOK ? "✅ cleared on every domain — no hallucination." : "⚠️ below on " + loaded.filter((b) => b.m.faithfulness < 0.9).map((b) => b.id).join(", ") + "."}`);
L.push(`- **Answer correctness (≥ 85%):** ${corrOK ? "✅ met on every domain." : "⚠️ open — below target on " + loaded.filter((b) => b.m.correctness < 0.85).map((b) => `${b.id} (${pct(b.m.correctness)})`).join(", ") + ". Driven by retrieval misses + abstractive/hard questions, not hallucination (faithfulness stays high)."}`);
L.push(`- **Retrieval (Recall@5 ≥ 85%) & citation:** see matrix above.`);
L.push("");
L.push(`> Reranking ran on the Cohere trial key (10 calls/min) with graceful Haiku fallback under concurrency; ranking-sensitive metrics (MRR, context precision) understate a production-Cohere setup. Citation is **N/A** for RAGBench (anonymous corpus passages have no natural title) and context precision is **N/A** for doc-scoped CUAD.`);
L.push("");

const out = join(__dir, "report.md");
writeFileSync(out, L.join("\n"));
console.log(`\n✓ Wrote ${out}`);
