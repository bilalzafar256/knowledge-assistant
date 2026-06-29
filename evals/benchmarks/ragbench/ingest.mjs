/**
 * Ingest RAGBench passages into Neon as the THIRD eval surface — a multi-domain
 * enterprise haystack (finance / IT-support / biomedical / general).
 *
 * Mirrors the production ingestion pipeline (structure-aware chunking →
 * Anthropic Contextual Retrieval → Gemini embeddings → insert), exactly like
 * evals/benchmarks/cuad/ingest.mjs, so RAGBench numbers are comparable.
 *
 * Unit of ingestion = one UNIQUE passage (a `documents[i]` string), deduped by
 * content hash across every example/config. Each becomes one document in the
 * isolated tenant `user_ragbench_eval`. A question's gold passages are resolved
 * back by hash in import-golden.mjs, so the corpus is a realistic haystack where
 * each question must find its own passages among distractors from other domains.
 *
 * Run download.mjs first. Resume-safe: skips passages whose hash is already in.
 *
 * Usage:
 *   node evals/benchmarks/ragbench/ingest.mjs                      # all cached configs
 *   node evals/benchmarks/ragbench/ingest.mjs --configs tatqa,techqa
 *   node evals/benchmarks/ragbench/ingest.mjs --split validation
 *   node evals/benchmarks/ragbench/ingest.mjs --reset             # wipe + reingest
 */
import { readFileSync, existsSync, readdirSync } from "node:fs";
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { sql } from "../../lib/db.mjs";
import { embedBatch, generateChunkContext } from "../../lib/ai.mjs";
import { EMBEDDING_MODEL } from "../../lib/env.mjs";

const __dir = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = join(__dir, "data");

const argv = process.argv.slice(2);
function arg(name, def) {
  const i = argv.indexOf(`--${name}`);
  return i === -1 ? def : argv[i + 1];
}
const flag = (name) => argv.includes(`--${name}`);
const SPLIT = arg("split", "test");
const CONFIGS = arg("configs", null);
const RESET = flag("reset");
const CHUNK_SIZE = 500;
const CHUNK_OVERLAP = 50;
const EMBED_BATCH = 20;
const CONTEXT_BATCH = 20;
const INSERT_BATCH = 50;
// Isolated tenant — clean up with: DELETE FROM documents WHERE user_id='user_ragbench_eval'
const USER_ID = process.env.RAGBENCH_USER_ID || "user_ragbench_eval";

const hashOf = (s) => createHash("sha1").update(s).digest("hex").slice(0, 16);
// Untitled corpus passages need a citable, human-readable title. Use the domain
// config + a short slug of the leading words. (Citation accuracy is a weak metric
// for an anonymous corpus — noted in the run report, like ctx-precision for CUAD.)
const titleFor = (config, content) => {
  const slug = content.replace(/\s+/g, " ").trim().split(" ").slice(0, 7).join(" ");
  return `[${config}] ${slug}`.slice(0, 500);
};

// ── Chunker (byte-identical to src/lib/utils.ts → chunkText). Keep in lockstep. ─
function chunkText(text, chunkSize = CHUNK_SIZE, overlap = CHUNK_OVERLAP) {
  const wordsPerChunk = Math.floor(chunkSize * 0.75);
  const overlapWords = Math.floor(overlap * 0.75);
  const wordCount = (s) => s.split(/\s+/).filter(Boolean).length;

  const units = [];
  for (const para of text.split(/\n\s*\n/)) {
    const trimmed = para.trim();
    if (!trimmed) continue;
    const sentences = trimmed.match(/[^.!?]+(?:[.!?]+(?=\s|$)|$)/g) ?? [trimmed];
    for (const s of sentences) {
      const sent = s.trim();
      if (sent) units.push(sent);
    }
  }

  const chunks = [];
  let current = [];
  let currentWords = 0;
  const flush = () => {
    const joined = current.join(" ").trim();
    if (joined) chunks.push(joined);
  };

  for (const sent of units) {
    const w = wordCount(sent);
    if (w > wordsPerChunk) {
      flush();
      current = [];
      currentWords = 0;
      const words = sent.split(/\s+/).filter(Boolean);
      for (let i = 0; i < words.length; i += wordsPerChunk) {
        chunks.push(words.slice(i, i + wordsPerChunk).join(" "));
      }
      continue;
    }
    if (currentWords + w > wordsPerChunk && current.length > 0) {
      flush();
      const overlapSents = [];
      let ow = 0;
      for (let i = current.length - 1; i >= 0; i--) {
        const sw = wordCount(current[i]);
        if (ow + sw > overlapWords) break;
        overlapSents.unshift(current[i]);
        ow += sw;
      }
      current = overlapSents;
      currentWords = ow;
    }
    current.push(sent);
    currentWords += w;
  }
  flush();
  return chunks;
}

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
  console.error(`✗ No cached data for split=${SPLIT}${wanted ? ` configs=${wanted}` : ""}. Run download.mjs.`);
  process.exit(1);
}

// ── Optional reset ────────────────────────────────────────────────────────────
if (RESET) {
  console.log(`▸ --reset: deleting existing RAGBench docs for ${USER_ID}…`);
  const r = await sql`DELETE FROM documents WHERE user_id = ${USER_ID} RETURNING id`;
  console.log(`  removed ${r.length} documents`);
}

// ── Collect unique passages (hash → {content, config}) ────────────────────────
const passages = new Map(); // hash → { content, config }
for (const f of files) {
  const config = f.replace(`-${SPLIT}.json`, "");
  const { rows } = JSON.parse(readFileSync(join(DATA_DIR, f), "utf8"));
  for (const row of rows) {
    for (const doc of row.documents ?? []) {
      const content = (doc ?? "").trim();
      if (!content) continue;
      const h = hashOf(content);
      if (!passages.has(h)) passages.set(h, { content, config });
    }
  }
}
console.log(`▸ ${passages.size} unique passages across ${files.length} configs (split=${SPLIT})`);

// Resume-safe: skip passages already ingested (by doc_hash) for this tenant.
const existingRows = await sql`
  SELECT metadata->>'doc_hash' AS h
  FROM documents
  WHERE user_id = ${USER_ID} AND metadata->>'benchmark' = 'ragbench'
`;
const existing = new Set(existingRows.map((r) => r.h).filter(Boolean));
let toIngest = [...passages.entries()].filter(([h]) => !existing.has(h));
if (existing.size > 0) {
  console.log(`▸ Skipping ${passages.size - toIngest.length} already-ingested passages (resume mode)`);
}
console.log(`▸ Ingesting ${toIngest.length} passages for ${USER_ID}`);

let totalDocs = 0;
let totalChunks = 0;
let totalEmbedTokens = 0;
let totalContextualized = 0;
let totalCacheReadTokens = 0;
let totalCacheCreationTokens = 0;
const startTime = Date.now();

for (let i = 0; i < toIngest.length; i++) {
  const [docHash, { content, config }] = toIngest[i];

  const [docRow] = await sql`
    INSERT INTO documents (user_id, title, content, file_type, file_size, status, metadata)
    VALUES (
      ${USER_ID}, ${titleFor(config, content)}, ${content}, ${"txt"},
      ${Buffer.byteLength(content, "utf8")}, ${"ready"},
      ${JSON.stringify({ benchmark: "ragbench", config, doc_hash: docHash })}::jsonb
    )
    RETURNING id
  `;
  const documentId = docRow.id;
  totalDocs++;

  const pieces = chunkText(content);
  const chunks = pieces.map((c) => ({ content: c, contextualized: null }));
  if (chunks.length === 0) continue;

  // Contextual Retrieval: warm cache on chunk 0, then batched fan-out.
  const onMeta = (m) => {
    totalCacheReadTokens += m.cacheReadTokens;
    totalCacheCreationTokens += m.cacheCreationTokens;
  };
  const buildCtx = (idx, ctx) => {
    if (ctx) {
      chunks[idx].contextualized = `${ctx}\n\n${chunks[idx].content}`;
      totalContextualized++;
    }
  };
  buildCtx(0, await generateChunkContext(content, chunks[0].content, onMeta));
  for (let b = 1; b < chunks.length; b += CONTEXT_BATCH) {
    const slice = chunks.slice(b, b + CONTEXT_BATCH);
    const ctxs = await Promise.all(
      slice.map((c) => generateChunkContext(content, c.content, onMeta))
    );
    ctxs.forEach((ctx, j) => buildCtx(b + j, ctx));
  }

  // Embed contextualized text when present, else raw content.
  const embeddings = [];
  for (let b = 0; b < chunks.length; b += EMBED_BATCH) {
    const batch = chunks.slice(b, b + EMBED_BATCH);
    const texts = batch.map((c) => c.contextualized ?? c.content);
    const vecs = await embedBatch(texts);
    embeddings.push(...vecs);
    totalEmbedTokens += texts.reduce((s, t) => s + Math.ceil(t.length / 4), 0);
  }

  // Bulk insert (contextualized_content included; chunk_index is the answer-locator key)
  for (let b = 0; b < chunks.length; b += INSERT_BATCH) {
    const batchChunks = chunks.slice(b, b + INSERT_BATCH);
    const batchVecs = embeddings.slice(b, b + INSERT_BATCH);
    const placeholders = [];
    const params = [];
    batchChunks.forEach((c, j) => {
      const off = j * 7;
      placeholders.push(
        `($${off + 1}::uuid, $${off + 2}::text, $${off + 3}::text, $${off + 4}::text, $${off + 5}::int, $${off + 6}::vector, $${off + 7}::jsonb, NOW())`
      );
      params.push(
        documentId,
        USER_ID,
        c.content,
        c.contextualized,
        b + j,
        `[${batchVecs[j].join(",")}]`,
        JSON.stringify({ benchmark: "ragbench", config, doc_hash: docHash })
      );
    });
    const stmt =
      `INSERT INTO document_chunks ` +
      `(document_id, user_id, content, contextualized_content, chunk_index, embedding, metadata, created_at) ` +
      `VALUES ${placeholders.join(", ")}`;
    await sql(stmt, params);
    totalChunks += batchChunks.length;
  }

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(0);
  process.stdout.write(
    `\r  [${i + 1}/${toIngest.length}] docs=${totalDocs} chunks=${totalChunks} elapsed=${elapsed}s   `
  );
}

console.log();
const elapsedMin = ((Date.now() - startTime) / 60000).toFixed(1);
console.log(`✓ Ingested ${totalDocs} passages, ${totalChunks} chunks in ${elapsedMin} min`);
console.log(
  `  Contextualized ${totalContextualized}/${totalChunks} chunks · ` +
    `cache read ${totalCacheReadTokens.toLocaleString()} tok / created ${totalCacheCreationTokens.toLocaleString()} tok`
);
console.log(`  Approx embedding tokens: ${totalEmbedTokens.toLocaleString()} ` +
  `(~$${((totalEmbedTokens / 1e6) * 0.15).toFixed(2)} @ ${EMBEDDING_MODEL})`);
