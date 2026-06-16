/**
 * Convert Vectara Open RAG Benchmark Q&A files into a golden set compatible
 * with `evals/run.mjs`.
 *
 * - Reads pre-written human Q&A (no LLM generation).
 * - Ground truth is (doc_id, section_id) — stored as `expected_section_id`,
 *   which `evals/run.mjs` uses for section-level recall matching.
 * - Stratified sampling across modality (text | text-image | text-table |
 *   text-table-image) and type (abstractive | extractive) so smaller
 *   samples still exercise every facet of the benchmark.
 *
 * Usage:
 *   node evals/benchmarks/open-ragbench/import-golden.mjs                # all
 *   node evals/benchmarks/open-ragbench/import-golden.mjs --sample 2000  # stratified subset
 *   node evals/benchmarks/open-ragbench/import-golden.mjs --limit 20     # quick smoke test
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { sql } from "../../lib/db.mjs";
import { OPEN_RAGBENCH_USER_ID } from "../../lib/env.mjs";

const __dir = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = join(__dir, "data");
const GOLDEN_DIR = join(__dir, "golden");
const USER_ID = OPEN_RAGBENCH_USER_ID;

const argv = process.argv.slice(2);
function arg(name, def) {
  const i = argv.indexOf(`--${name}`);
  return i === -1 ? def : argv[i + 1];
}
const SAMPLE = arg("sample", null) ? parseInt(arg("sample"), 10) : null;
const LIMIT = arg("limit", null) ? parseInt(arg("limit"), 10) : null;
const SEED = parseInt(arg("seed", "42"), 10);

for (const f of ["queries.json", "qrels.json", "answers.json"]) {
  if (!existsSync(join(DATA_DIR, f))) {
    console.error(`✗ Missing ${f}. Run: pnpm eval:ragbench:download`);
    process.exit(1);
  }
}

const queries = JSON.parse(readFileSync(join(DATA_DIR, "queries.json"), "utf8"));
const qrels = JSON.parse(readFileSync(join(DATA_DIR, "qrels.json"), "utf8"));
const answers = JSON.parse(readFileSync(join(DATA_DIR, "answers.json"), "utf8"));

console.log(`▸ Loaded ${Object.keys(queries).length} queries / ${Object.keys(qrels).length} qrels / ${Object.keys(answers).length} answers`);

// ── Resolve paper_id → documents.id by querying Neon for ingested benchmark docs
const docRows = await sql`
  SELECT id, title, metadata
  FROM documents
  WHERE user_id = ${USER_ID}
    AND metadata->>'benchmark' = 'open_ragbench'
`;
const paperIdToDoc = new Map();
for (const r of docRows) {
  const paperId = r.metadata?.paper_id;
  if (paperId) paperIdToDoc.set(paperId, { id: r.id, title: r.title });
}
console.log(`▸ Resolved ${paperIdToDoc.size} ingested benchmark documents`);

if (paperIdToDoc.size === 0) {
  console.error("✗ No benchmark documents found in Neon. Run: pnpm eval:ragbench:ingest");
  process.exit(1);
}

// ── Join queries × qrels × answers, filter to ingested docs ─────────────────
const enriched = [];
for (const [qid, q] of Object.entries(queries)) {
  const rel = qrels[qid];
  if (!rel?.doc_id) continue;
  const doc = paperIdToDoc.get(rel.doc_id);
  if (!doc) continue; // paper not ingested (e.g. running on a smoke subset)
  const answer = answers[qid] ?? "";
  enriched.push({
    qid,
    question: q.query,
    type: q.type ?? "unknown",
    source: q.source ?? "text",
    docId: doc.id,
    docTitle: doc.title,
    paperId: rel.doc_id,
    sectionId: String(rel.section_id),
    answer,
  });
}
console.log(`▸ ${enriched.length} questions have ingested ground-truth docs`);

// ── Stratified sampling ──────────────────────────────────────────────────────
function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rng = mulberry32(SEED);
function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

let sampled = enriched;
if (SAMPLE && SAMPLE < enriched.length) {
  // Stratify by `source` (modality) — that's the most important axis for
  // diagnosing where the pipeline struggles. Within each stratum, take a
  // proportional slice.
  const buckets = new Map();
  for (const e of enriched) {
    if (!buckets.has(e.source)) buckets.set(e.source, []);
    buckets.get(e.source).push(e);
  }
  sampled = [];
  for (const [, items] of buckets) {
    shuffle(items);
    const take = Math.max(1, Math.round((items.length / enriched.length) * SAMPLE));
    sampled.push(...items.slice(0, take));
  }
  shuffle(sampled);
  sampled = sampled.slice(0, SAMPLE);
  // Report stratum distribution
  const dist = new Map();
  for (const s of sampled) dist.set(s.source, (dist.get(s.source) ?? 0) + 1);
  console.log(`▸ Stratified sample of ${sampled.length}:`);
  for (const [k, v] of dist) console.log(`    ${k}: ${v}`);
}

if (LIMIT) {
  shuffle(sampled);
  sampled = sampled.slice(0, LIMIT);
  console.log(`▸ Limited to ${sampled.length} for smoke test`);
}

// ── Emit golden-set.json in the shape evals/run.mjs expects ──────────────────
const questions = sampled.map((s, i) => ({
  id: `q_${i + 1}`,
  question: s.question,
  expected_document_id: s.docId,
  expected_section_id: s.sectionId,
  expected_document_title: s.docTitle,
  expected_answer_excerpt: s.answer,
  source_chunk_content: s.answer, // used by answerCorrectness as reference
  benchmark: {
    query_uuid: s.qid,
    paper_id: s.paperId,
    type: s.type,
    source: s.source,
  },
}));

mkdirSync(GOLDEN_DIR, { recursive: true });
const outPath = join(GOLDEN_DIR, "golden-set.json");
writeFileSync(
  outPath,
  JSON.stringify(
    {
      generatedAt: new Date().toISOString(),
      userId: USER_ID,
      source: "vectara/open_ragbench",
      seed: SEED,
      count: questions.length,
      questions,
    },
    null,
    2
  )
);

console.log(`✓ Wrote ${questions.length} questions → ${outPath}`);
