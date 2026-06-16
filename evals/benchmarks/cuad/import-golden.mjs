/**
 * Build a golden set from CUAD for evals/run.mjs.
 *
 * CUAD is SQuAD-format clause-extraction QA over commercial contracts. For each
 * answerable question (is_impossible=false with a non-empty answer span), we:
 *   - resolve the contract → its ingested document,
 *   - locate the CHUNK whose content contains the answer span (→ expected_chunk_id,
 *     which evals/run.mjs already supports for recall matching), and
 *   - use the answer span as the correctness reference.
 *
 * Run AFTER ingest.mjs (needs the chunks in the DB to locate answer spans).
 * Stratified by clause category so the sample spans CUAD's 41 clause types.
 *
 * Usage:
 *   node evals/benchmarks/cuad/import-golden.mjs --sample 100
 */
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { sql } from "../../lib/db.mjs";

const __dir = dirname(fileURLToPath(import.meta.url));
const DATA_FILE = join(__dir, "data", "test.json");
const GOLDEN_DIR = join(__dir, "golden");
const USER_ID = process.env.CUAD_USER_ID || "user_cuad_eval";

const argv = process.argv.slice(2);
function arg(name, def) {
  const i = argv.indexOf(`--${name}`);
  return i === -1 ? def : argv[i + 1];
}
const SAMPLE = arg("sample", null) ? parseInt(arg("sample"), 10) : null;
const SEED = parseInt(arg("seed", "42"), 10);

const norm = (s) => s.replace(/\s+/g, " ").trim().toLowerCase();
// CUAD questions read: ... related to "Category" that should be reviewed ...
const categoryOf = (q) => {
  const m = q.match(/related to "([^"]+)"/);
  return m ? m[1] : "other";
};
// Fairness fix: CUAD titles are filenames (Party_date_form_..._AgreementType).
// Cite-ability needs the human-readable agreement-type segment.
const cleanTitle = (raw) => {
  const seg = (raw.split("_").pop() || raw).replace(/\s+/g, " ").trim();
  return seg.length >= 3 ? seg : raw;
};

const cuad = JSON.parse(readFileSync(DATA_FILE, "utf8"));

// ── Resolve ingested CUAD documents + their chunks ──────────────────────────
const docRows = await sql`
  SELECT id, title FROM documents
  WHERE user_id = ${USER_ID} AND metadata->>'benchmark' = 'cuad'
`;
const titleToDoc = new Map(docRows.map((r) => [r.title, r.id]));
console.log(`▸ ${titleToDoc.size} ingested CUAD documents`);
if (titleToDoc.size === 0) {
  console.error("✗ No CUAD documents in Neon. Run: node evals/benchmarks/cuad/ingest.mjs first.");
  process.exit(1);
}

const chunkRows = await sql`
  SELECT id, document_id, chunk_index, content FROM document_chunks
  WHERE user_id = ${USER_ID}
`;
// document_id → [{id, content(normalized), chunk_index}] sorted by index
const chunksByDoc = new Map();
for (const r of chunkRows) {
  if (!chunksByDoc.has(r.document_id)) chunksByDoc.set(r.document_id, []);
  chunksByDoc.get(r.document_id).push({
    id: r.id,
    chunkIndex: r.chunk_index,
    contentNorm: norm(r.content),
  });
}

// ── Join questions → answer-bearing chunk ───────────────────────────────────
const enriched = [];
let noChunk = 0;
for (const contract of cuad.data ?? []) {
  const docId = titleToDoc.get(contract.title);
  if (!docId) continue; // contract not ingested (subset)
  const docChunks = chunksByDoc.get(docId) ?? [];
  for (const qa of contract.paragraphs?.[0]?.qas ?? []) {
    if (qa.is_impossible) continue;
    const ans = qa.answers?.[0]?.text?.trim();
    if (!ans) continue;
    const ansNorm = norm(ans);
    // Locate the chunk that contains the answer span (whitespace-normalized).
    const hit = docChunks.find((c) => c.contentNorm.includes(ansNorm));
    if (!hit) {
      noChunk++;
      continue; // answer span split across chunks / not found — skip for clean recall
    }
    enriched.push({
      qid: qa.id,
      question: qa.question,
      docId,
      docTitle: contract.title,
      chunkId: hit.id,
      answer: ans,
      category: categoryOf(qa.question),
    });
  }
}
console.log(`▸ ${enriched.length} answerable questions mapped to a chunk (${noChunk} skipped: span not in a single chunk)`);

// ── Stratified sampling by clause category ──────────────────────────────────
function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
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
  const buckets = new Map();
  for (const e of enriched) {
    if (!buckets.has(e.category)) buckets.set(e.category, []);
    buckets.get(e.category).push(e);
  }
  sampled = [];
  for (const [, items] of buckets) {
    shuffle(items);
    const take = Math.max(1, Math.round((items.length / enriched.length) * SAMPLE));
    sampled.push(...items.slice(0, take));
  }
  shuffle(sampled);
  sampled = sampled.slice(0, SAMPLE);
  const dist = new Map();
  for (const s of sampled) dist.set(s.category, (dist.get(s.category) ?? 0) + 1);
  console.log(`▸ Stratified sample of ${sampled.length} across ${dist.size} clause categories`);
}

// ── Emit golden-set.json (run.mjs shape; matched via expected_chunk_id) ──────
const questions = sampled.map((s, i) => ({
  id: `q_${i + 1}`,
  // Keep CUAD's original clause-search prompt. A "What does this contract say
  // about X?" reformulation was trialled and BACKFIRED — "this contract" is
  // ambiguous across a multi-contract corpus, so the model refused ("no document
  // shared"). The verbose template reads as a search directive and works better.
  question: s.question,
  expected_document_id: s.docId,
  // Recall is matched by answer-span presence (any chunk containing the clause),
  // which is fairer than one exact chunk for clause extraction. chunk_id kept for trace.
  expected_answer_text: s.answer,
  expected_chunk_id: s.chunkId,
  expected_document_title: cleanTitle(s.docTitle),
  expected_answer_excerpt: s.answer,
  source_chunk_content: s.answer,
  benchmark: {
    query_uuid: s.qid,
    type: "extractive", // CUAD clause extraction is extractive
    source: "text",
    category: s.category,
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
      source: "TheAtticusProject/cuad (CC-BY 4.0)",
      seed: SEED,
      count: questions.length,
      questions,
    },
    null,
    2
  )
);
console.log(`✓ Wrote ${questions.length} questions → ${outPath}`);
