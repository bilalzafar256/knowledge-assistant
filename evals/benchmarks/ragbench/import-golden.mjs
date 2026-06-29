/**
 * Build a golden set from RAGBench for evals/run.mjs.
 *
 * RAGBench gives, per example: a `question`, its gold `documents` (passages), a
 * reference `response`, and sentence-level relevance labels
 * (`all_relevant_sentence_keys` + `documents_sentences`). For each example we:
 *   - take the gold relevant sentence(s) as the recall NEEDLE (→ expected_answer_text,
 *     which run.mjs already matches by substring — sentence-grounded recall, like
 *     CUAD's answer-span match but at sentence granularity),
 *   - resolve the passage that sentence lives in → its ingested document
 *     (→ expected_document_id, via the doc_hash recorded at ingest), and
 *   - use the reference `response` as the correctness reference (→ source_chunk_content).
 *
 * Run AFTER ingest.mjs (needs the chunks in the DB to locate the needle's chunk).
 * Stratified by config so the sample spans every ingested domain.
 *
 * A relevance key like "1b" encodes: document index 1, sentence "b". We pick the
 * LONGEST relevant sentence as the needle (most distinctive for substring match).
 *
 * Usage:
 *   node evals/benchmarks/ragbench/import-golden.mjs --sample 150
 *   node evals/benchmarks/ragbench/import-golden.mjs --configs tatqa,techqa --split test
 */
import { readFileSync, writeFileSync, mkdirSync, readdirSync, existsSync } from "node:fs";
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { sql } from "../../lib/db.mjs";

const __dir = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = join(__dir, "data");
const GOLDEN_DIR = join(__dir, "golden");
const USER_ID = process.env.RAGBENCH_USER_ID || "user_ragbench_eval";

const argv = process.argv.slice(2);
function arg(name, def) {
  const i = argv.indexOf(`--${name}`);
  return i === -1 ? def : argv[i + 1];
}
const SPLIT = arg("split", "test");
const CONFIGS = arg("configs", null);
const SAMPLE = arg("sample", null) ? parseInt(arg("sample"), 10) : null;
const SEED = parseInt(arg("seed", "42"), 10);

const DOMAIN = {
  tatqa: "finance", finqa: "finance",
  techqa: "support", emanual: "support", delucionqa: "support",
  covidqa: "biomedical", pubmedqa: "biomedical",
  hotpotqa: "general", msmarco: "general", expertqa: "general", hagrid: "general",
  cuad: "legal",
};
const TABLE_CONFIGS = new Set(["tatqa", "finqa"]);

const norm = (s) => (s ?? "").replace(/\s+/g, " ").trim().toLowerCase();
const hashOf = (s) => createHash("sha1").update(s).digest("hex").slice(0, 16);
// Must reproduce ingest.mjs → titleFor exactly so citation can match the title.
const titleFor = (config, content) => {
  const slug = content.replace(/\s+/g, " ").trim().split(" ").slice(0, 7).join(" ");
  return `[${config}] ${slug}`.slice(0, 500);
};

// ── Load cached configs ───────────────────────────────────────────────────────
if (!existsSync(DATA_DIR)) {
  console.error(`✗ ${DATA_DIR} not found. Run download.mjs first.`);
  process.exit(1);
}
const wanted = CONFIGS ? CONFIGS.split(",").map((s) => s.trim()) : null;
const files = readdirSync(DATA_DIR)
  .filter((f) => f.endsWith(`-${SPLIT}.json`))
  .filter((f) => !wanted || wanted.includes(f.replace(`-${SPLIT}.json`, "")));
if (files.length === 0) {
  console.error(`✗ No cached data for split=${SPLIT}. Run download.mjs.`);
  process.exit(1);
}

// ── Resolve ingested passages (doc_hash → doc-id) + their chunks ──────────────
const docRows = await sql`
  SELECT id, metadata->>'doc_hash' AS h FROM documents
  WHERE user_id = ${USER_ID} AND metadata->>'benchmark' = 'ragbench'
`;
const hashToDoc = new Map(docRows.map((r) => [r.h, r.id]));
console.log(`▸ ${hashToDoc.size} ingested RAGBench documents`);
if (hashToDoc.size === 0) {
  console.error("✗ No RAGBench documents in Neon. Run ingest.mjs first.");
  process.exit(1);
}

const chunkRows = await sql`
  SELECT id, document_id, content FROM document_chunks WHERE user_id = ${USER_ID}
`;
const chunksByDoc = new Map();
for (const r of chunkRows) {
  if (!chunksByDoc.has(r.document_id)) chunksByDoc.set(r.document_id, []);
  chunksByDoc.get(r.document_id).push({ id: r.id, contentNorm: norm(r.content) });
}

// ── Resolve a relevance key ("1b") → { docIdx, text } from documents_sentences ─
// documents_sentences = list[doc] of list[sentence] of [key, text].
function sentenceForKey(documentsSentences, key) {
  for (let d = 0; d < documentsSentences.length; d++) {
    for (const pair of documentsSentences[d] ?? []) {
      if (pair?.[0] === key) return { docIdx: d, text: pair[1] ?? "" };
    }
  }
  return null;
}

// ── Join questions → gold sentence → ingested chunk ───────────────────────────
const enriched = [];
let skippedNoKey = 0;
let skippedNoDoc = 0;
for (const f of files) {
  const config = f.replace(`-${SPLIT}.json`, "");
  const { rows } = JSON.parse(readFileSync(join(DATA_DIR, f), "utf8"));
  for (const row of rows) {
    const keys = row.all_relevant_sentence_keys ?? [];
    const response = (row.response ?? "").trim();
    if (!Array.isArray(keys) || keys.length === 0 || !response) {
      skippedNoKey++;
      continue;
    }
    // Resolve every relevant key, pick the LONGEST sentence as the recall needle.
    const resolved = keys
      .map((k) => sentenceForKey(row.documents_sentences ?? [], k))
      .filter((r) => r && r.text && r.text.trim().length > 0);
    if (resolved.length === 0) {
      skippedNoKey++;
      continue;
    }
    resolved.sort((a, b) => b.text.length - a.text.length);
    const needle = resolved[0];

    // The passage that sentence belongs to → ingested document (by hash).
    const passage = (row.documents?.[needle.docIdx] ?? "").trim();
    if (!passage) {
      skippedNoDoc++;
      continue;
    }
    const docId = hashToDoc.get(hashOf(passage));
    if (!docId) {
      skippedNoDoc++; // passage not ingested (sampled out)
      continue;
    }

    // Locate the chunk containing the needle (trace only; recall match is by substring).
    const docChunks = chunksByDoc.get(docId) ?? [];
    const needleNorm = norm(needle.text);
    const hit = docChunks.find((c) => c.contentNorm.includes(needleNorm));

    const wordCount = response.split(/\s+/).filter(Boolean).length;
    enriched.push({
      qid: row.id,
      question: row.question,
      docId,
      docTitle: titleFor(config, passage),
      chunkId: hit?.id ?? null,
      needle: needle.text.trim(),
      response,
      config,
      domain: DOMAIN[config] ?? "general",
      source: TABLE_CONFIGS.has(config) ? "table" : "text",
      // Heuristic: short references read as extractive (factoid), long as abstractive.
      type: wordCount <= 20 ? "extractive" : "abstractive",
    });
  }
}
console.log(
  `▸ ${enriched.length} questions mapped to a gold passage ` +
    `(${skippedNoKey} skipped: no usable relevance key/response, ${skippedNoDoc} skipped: passage not ingested)`
);
if (enriched.length === 0) {
  console.error("✗ Nothing mapped. Did you ingest the same --configs/--split?");
  process.exit(1);
}

// ── Stratified sampling by config ─────────────────────────────────────────────
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
    if (!buckets.has(e.config)) buckets.set(e.config, []);
    buckets.get(e.config).push(e);
  }
  sampled = [];
  for (const [, items] of buckets) {
    shuffle(items);
    const take = Math.max(1, Math.round((items.length / enriched.length) * SAMPLE));
    sampled.push(...items.slice(0, take));
  }
  shuffle(sampled);
  sampled = sampled.slice(0, SAMPLE);
}
const dist = new Map();
for (const s of sampled) dist.set(s.config, (dist.get(s.config) ?? 0) + 1);
console.log(`▸ Sample of ${sampled.length} across configs: ${[...dist.entries()].map(([k, v]) => `${k}=${v}`).join(", ")}`);

// ── Emit golden-set.json (run.mjs shape; recall matched via expected_answer_text) ─
const questions = sampled.map((s, i) => ({
  id: `q_${i + 1}`,
  question: s.question,
  expected_document_id: s.docId,
  // Recall = any retrieved chunk in the gold doc containing the gold sentence.
  expected_answer_text: s.needle,
  expected_chunk_id: s.chunkId,
  expected_document_title: s.docTitle,
  expected_answer_excerpt: s.needle,
  // Correctness reference is RAGBench's reference response (not the evidence span).
  source_chunk_content: s.response,
  benchmark: {
    query_uuid: s.qid,
    type: s.type,
    source: s.source,
    domain: s.domain,
    config: s.config,
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
      source: "galileo-ai/ragbench (per-source licenses; see dataset card)",
      split: SPLIT,
      seed: SEED,
      count: questions.length,
      questions,
    },
    null,
    2
  )
);
console.log(`✓ Wrote ${questions.length} questions → ${outPath}`);
