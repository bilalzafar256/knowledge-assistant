/**
 * Run the eval suite against the current RAG pipeline.
 *
 * Usage:
 *   node evals/run.mjs --label baseline
 *   node evals/run.mjs --label after-hybrid-search --concurrency 4
 *
 * Outputs:
 *   evals/runs/<timestamp>_<label>.json   (full per-question results)
 *   evals/runs/<timestamp>_<label>.md     (human summary)
 */
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { searchKnowledge } from "./lib/retrieve.mjs";
import { runChat } from "./lib/answer.mjs";
import {
  contextPrecision,
  answerFaithfulness,
  answerCorrectness,
  citationAccuracy,
} from "./lib/judges.mjs";
import { EVAL_USER_ID, CHAT_MODEL, EMBEDDING_MODEL, JUDGE_MODEL } from "./lib/env.mjs";

const __dir = dirname(fileURLToPath(import.meta.url));

// ── CLI args ──────────────────────────────────────────────────────────────────
const argv = process.argv.slice(2);
function arg(name, def) {
  const i = argv.indexOf(`--${name}`);
  return i === -1 ? def : argv[i + 1];
}
const LABEL = arg("label", "run");
const CONCURRENCY = parseInt(arg("concurrency", "2"), 10);
const TOP_K = parseInt(arg("topk", "5"), 10);
const RUN_ANSWERS = arg("no-answers", null) === null; // default ON, --no-answers disables

// ── Load golden set ───────────────────────────────────────────────────────────
const goldenPath = join(__dir, "golden", "golden-set.json");
const golden = JSON.parse(readFileSync(goldenPath, "utf8"));
console.log(
  `▸ Loaded ${golden.count} questions from golden set (generated ${golden.generatedAt})`
);
console.log(`▸ Label: ${LABEL} | concurrency: ${CONCURRENCY} | top-k: ${TOP_K}`);
console.log(`▸ Run answers + faithfulness/correctness: ${RUN_ANSWERS}`);

// ── Per-question eval ─────────────────────────────────────────────────────────
async function evalOne(q) {
  const t0 = Date.now();

  // Retrieval: get top-k reranked + raw vector candidates
  const retr = await searchKnowledge({
    query: q.question,
    userId: EVAL_USER_ID,
    priorMessages: [],
    limit: TOP_K,
  });

  // Recall: did expected chunk land in reranked top-k / candidate pool / pure-vector pool?
  // After hybrid: vectorCandidates = fused (RRF) candidates; pureVectorCandidates = vector-only.
  // For baseline runs, pureVectorCandidates may be empty (older retrieve.mjs).
  const rerankedIds = retr.rerankedTopK.map((r) => r.chunkId);
  const vectorIds = retr.vectorCandidates.map((r) => r.chunkId);
  const pureVectorIds = (retr.pureVectorCandidates ?? []).map((r) => r.chunkId);

  const rerankedRank = rerankedIds.indexOf(q.expected_chunk_id);
  const vectorRank = vectorIds.indexOf(q.expected_chunk_id);
  const pureVectorRank = pureVectorIds.indexOf(q.expected_chunk_id);

  const recallAtK = rerankedRank !== -1 ? 1 : 0;
  const recallVectorAt5 = vectorRank !== -1 && vectorRank < 5 ? 1 : 0;
  const recallVectorAt10 = vectorRank !== -1 && vectorRank < 10 ? 1 : 0;
  const recallPureVectorAt5 = pureVectorRank !== -1 && pureVectorRank < 5 ? 1 : 0;
  const recallPureVectorAt10 = pureVectorRank !== -1 && pureVectorRank < 10 ? 1 : 0;
  const mrr = rerankedRank !== -1 ? 1 / (rerankedRank + 1) : 0;
  const mrrVector = vectorRank !== -1 ? 1 / (vectorRank + 1) : 0;
  const mrrPureVector = pureVectorRank !== -1 ? 1 / (pureVectorRank + 1) : 0;

  // Context precision (LLM judge on reranked top-k)
  const ctxP = await contextPrecision({
    question: q.question,
    retrievedChunks: retr.rerankedTopK,
  });

  // Answer generation + judges
  let answer = null;
  let faithfulness = null;
  let correctness = null;
  let citation = null;
  let chatRun = null;

  if (RUN_ANSWERS) {
    chatRun = await runChat({ userId: EVAL_USER_ID, userQuery: q.question });
    answer = chatRun.answer;
    // Faithfulness must judge against ALL chunks the model saw, not just the last step's.
    // Dedupe by chunkId so we don't double-count repeated chunks across multi-step searches.
    const seen = new Set();
    const allChunks = [];
    for (const step of chatRun.retrieved) {
      for (const c of step.rerankedTopK) {
        if (seen.has(c.chunkId)) continue;
        seen.add(c.chunkId);
        allChunks.push(c);
      }
    }
    const judgeContext = allChunks.length > 0 ? allChunks : retr.rerankedTopK;
    faithfulness = await answerFaithfulness({ answer, retrievedChunks: judgeContext });
    correctness = await answerCorrectness({
      question: q.question,
      answer,
      referenceText: q.source_chunk_content,
    });
    citation = citationAccuracy({ answer, expectedDocTitle: q.expected_document_title });
  }

  return {
    id: q.id,
    question: q.question,
    expected_document_title: q.expected_document_title,
    retrieval: {
      synthesized_query: retr.searchQuery,
      reranked_rank: rerankedRank,
      vector_rank: vectorRank,
      pure_vector_rank: pureVectorRank,
      recall_at_k: recallAtK,
      recall_vector_at_5: recallVectorAt5,
      recall_vector_at_10: recallVectorAt10,
      recall_pure_vector_at_5: recallPureVectorAt5,
      recall_pure_vector_at_10: recallPureVectorAt10,
      mrr_reranked: mrr,
      mrr_vector: mrrVector,
      mrr_pure_vector: mrrPureVector,
      context_precision: ctxP.score,
      context_precision_note: ctxP.rationale,
      reranked_titles: retr.rerankedTopK.map((r) => r.documentTitle),
    },
    answer: RUN_ANSWERS
      ? {
          text: answer,
          faithfulness: faithfulness.score,
          faithfulness_note: faithfulness.rationale,
          correctness: correctness.score,
          correctness_note: correctness.rationale,
          citation: citation.score,
          citation_note: citation.rationale,
          input_tokens: chatRun.inputTokens,
          output_tokens: chatRun.outputTokens,
          latency_ms: chatRun.latencyMs,
          steps_used: chatRun.stepsUsed,
        }
      : null,
    eval_latency_ms: Date.now() - t0,
  };
}

// ── Concurrency runner ────────────────────────────────────────────────────────
async function runPool(items, n, fn) {
  const results = new Array(items.length);
  let cursor = 0;
  async function worker() {
    while (true) {
      const i = cursor++;
      if (i >= items.length) return;
      try {
        results[i] = await fn(items[i], i);
        process.stdout.write(
          `  [${i + 1}/${items.length}] ${items[i].id} ✓ (recall@k=${results[i].retrieval.recall_at_k}, mrr=${results[i].retrieval.mrr_reranked.toFixed(2)})\n`
        );
      } catch (e) {
        console.error(`  [${i + 1}] ${items[i].id} failed:`, e.message);
        results[i] = { id: items[i].id, error: e.message };
      }
    }
  }
  await Promise.all(Array.from({ length: n }, worker));
  return results;
}

const startedAt = new Date();
const perQuestion = await runPool(golden.questions, CONCURRENCY, evalOne);

// ── Aggregate ─────────────────────────────────────────────────────────────────
function avg(nums) {
  const xs = nums.filter((x) => typeof x === "number" && !Number.isNaN(x));
  return xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0;
}

const ok = perQuestion.filter((r) => r && !r.error);

const agg = {
  questions_total: golden.questions.length,
  questions_evaluated: ok.length,
  recall_at_k_reranked: avg(ok.map((r) => r.retrieval.recall_at_k)),
  recall_vector_at_5: avg(ok.map((r) => r.retrieval.recall_vector_at_5)),
  recall_vector_at_10: avg(ok.map((r) => r.retrieval.recall_vector_at_10)),
  recall_pure_vector_at_5: avg(ok.map((r) => r.retrieval.recall_pure_vector_at_5 ?? 0)),
  recall_pure_vector_at_10: avg(ok.map((r) => r.retrieval.recall_pure_vector_at_10 ?? 0)),
  mrr_reranked: avg(ok.map((r) => r.retrieval.mrr_reranked)),
  mrr_vector: avg(ok.map((r) => r.retrieval.mrr_vector)),
  mrr_pure_vector: avg(ok.map((r) => r.retrieval.mrr_pure_vector ?? 0)),
  context_precision: avg(ok.map((r) => r.retrieval.context_precision)),
};

if (RUN_ANSWERS) {
  agg.faithfulness = avg(ok.map((r) => r.answer?.faithfulness));
  agg.correctness = avg(ok.map((r) => r.answer?.correctness));
  agg.citation = avg(ok.map((r) => r.answer?.citation));
  agg.avg_latency_ms = Math.round(avg(ok.map((r) => r.answer?.latency_ms)));
  agg.total_input_tokens = ok.reduce((s, r) => s + (r.answer?.input_tokens ?? 0), 0);
  agg.total_output_tokens = ok.reduce((s, r) => s + (r.answer?.output_tokens ?? 0), 0);
  // gpt-4o ≈ $2.50/MTok in, $10/MTok out (2026 list). Adjust if pricing changed.
  agg.estimated_cost_usd =
    (agg.total_input_tokens / 1e6) * 2.5 + (agg.total_output_tokens / 1e6) * 10;
}

const finishedAt = new Date();

const fullResult = {
  label: LABEL,
  startedAt: startedAt.toISOString(),
  finishedAt: finishedAt.toISOString(),
  durationSec: Math.round((finishedAt - startedAt) / 1000),
  config: {
    userId: EVAL_USER_ID,
    chatModel: CHAT_MODEL,
    embeddingModel: EMBEDDING_MODEL,
    judgeModel: JUDGE_MODEL,
    topK: TOP_K,
    concurrency: CONCURRENCY,
    ranAnswers: RUN_ANSWERS,
  },
  goldenSet: {
    generatedAt: golden.generatedAt,
    count: golden.count,
  },
  summary: agg,
  perQuestion,
};

// ── Write outputs ─────────────────────────────────────────────────────────────
mkdirSync(join(__dir, "runs"), { recursive: true });
const stamp = startedAt.toISOString().replace(/[:.]/g, "-").slice(0, 19);
const base = `${stamp}_${LABEL}`;
const jsonPath = join(__dir, "runs", `${base}.json`);
const mdPath = join(__dir, "runs", `${base}.md`);

writeFileSync(jsonPath, JSON.stringify(fullResult, null, 2));

const md = renderMarkdown(fullResult);
writeFileSync(mdPath, md);

console.log(`\n✓ Wrote ${jsonPath}`);
console.log(`✓ Wrote ${mdPath}`);
console.log(`\n${md.split("\n").slice(0, 60).join("\n")}`);

// ── Markdown renderer ─────────────────────────────────────────────────────────
function pct(x) {
  return (x * 100).toFixed(1) + "%";
}
function renderMarkdown(r) {
  const s = r.summary;
  const lines = [];
  lines.push(`# Eval run: \`${r.label}\``);
  lines.push("");
  lines.push(`- **Started:** ${r.startedAt}`);
  lines.push(`- **Duration:** ${r.durationSec}s`);
  lines.push(`- **Chat model:** \`${r.config.chatModel}\``);
  lines.push(`- **Embedding model:** \`${r.config.embeddingModel}\``);
  lines.push(`- **Judge model:** \`${r.config.judgeModel}\``);
  lines.push(`- **Top-K:** ${r.config.topK}`);
  lines.push(
    `- **Golden set:** ${r.goldenSet.count} questions (generated ${r.goldenSet.generatedAt})`
  );
  lines.push("");
  lines.push("## Retrieval");
  lines.push("| Metric | Value |");
  lines.push("| --- | --- |");
  lines.push(`| Recall@${r.config.topK} (after rerank) | **${pct(s.recall_at_k_reranked)}** |`);
  lines.push(`| Recall@5 (candidate pool) | ${pct(s.recall_vector_at_5)} |`);
  lines.push(`| Recall@10 (candidate pool) | ${pct(s.recall_vector_at_10)} |`);
  lines.push(`| Recall@5 (pure vector — diagnostic) | ${pct(s.recall_pure_vector_at_5 ?? 0)} |`);
  lines.push(`| Recall@10 (pure vector — diagnostic) | ${pct(s.recall_pure_vector_at_10 ?? 0)} |`);
  lines.push(`| MRR (reranked) | ${s.mrr_reranked.toFixed(3)} |`);
  lines.push(`| MRR (candidate pool) | ${s.mrr_vector.toFixed(3)} |`);
  lines.push(`| MRR (pure vector — diagnostic) | ${(s.mrr_pure_vector ?? 0).toFixed(3)} |`);
  lines.push(`| Context precision | ${pct(s.context_precision)} |`);
  lines.push("");
  if (r.config.ranAnswers) {
    lines.push("## Answer quality");
    lines.push("| Metric | Value |");
    lines.push("| --- | --- |");
    lines.push(`| Faithfulness | **${pct(s.faithfulness)}** |`);
    lines.push(`| Correctness | **${pct(s.correctness)}** |`);
    lines.push(`| Citation accuracy | ${pct(s.citation)} |`);
    lines.push(`| Avg latency | ${s.avg_latency_ms} ms |`);
    lines.push(`| Total input tokens | ${s.total_input_tokens.toLocaleString()} |`);
    lines.push(`| Total output tokens | ${s.total_output_tokens.toLocaleString()} |`);
    lines.push(`| Estimated cost | $${s.estimated_cost_usd.toFixed(4)} |`);
    lines.push("");
  }
  lines.push("## Per-question");
  lines.push("| ID | Recall@k | MRR | CtxP | Faith | Corr | Cite | Question |");
  lines.push("| --- | :---: | :---: | :---: | :---: | :---: | :---: | --- |");
  for (const q of r.perQuestion) {
    if (q.error) {
      lines.push(`| ${q.id} | — | — | — | — | — | — | _error: ${q.error}_ |`);
      continue;
    }
    const a = q.answer ?? {};
    lines.push(
      `| ${q.id} | ${q.retrieval.recall_at_k} | ${q.retrieval.mrr_reranked.toFixed(2)} | ${q.retrieval.context_precision.toFixed(2)} | ${a.faithfulness?.toFixed(2) ?? "—"} | ${a.correctness?.toFixed(2) ?? "—"} | ${a.citation?.toFixed(2) ?? "—"} | ${q.question.slice(0, 80).replace(/\|/g, "\\|")} |`
    );
  }
  return lines.join("\n");
}
