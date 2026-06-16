/**
 * Ingest CUAD (Contract Understanding Atticus Dataset) contracts into Neon as a
 * SECOND, enterprise-domain eval surface (commercial contracts) alongside the
 * arXiv Open RAG Benchmark. CC-BY 4.0 — © The Atticus Project.
 *
 * Mirrors the production ingestion pipeline (structure-aware chunking →
 * Anthropic Contextual Retrieval → Gemini embeddings → insert), exactly like
 * evals/benchmarks/open-ragbench/ingest.mjs, so CUAD numbers are comparable.
 *
 * Each CUAD contract (SQuAD `data[].paragraphs[0].context`) becomes one document
 * in the isolated tenant `user_cuad_eval`. Clause questions + answer spans drive
 * the golden set (see import-golden.mjs).
 *
 * Usage:
 *   node evals/benchmarks/cuad/ingest.mjs              # all contracts in test.json
 *   node evals/benchmarks/cuad/ingest.mjs --limit 100  # first 100 (200-doc-scale parity)
 *   node evals/benchmarks/cuad/ingest.mjs --reset      # wipe + reingest
 */
import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { sql } from "../../lib/db.mjs";
import { embedBatch, generateChunkContext } from "../../lib/ai.mjs";
import { EMBEDDING_MODEL } from "../../lib/env.mjs";

const __dir = dirname(fileURLToPath(import.meta.url));
const DATA_FILE = join(__dir, "data", "test.json");

const argv = process.argv.slice(2);
function arg(name, def) {
  const i = argv.indexOf(`--${name}`);
  return i === -1 ? def : argv[i + 1];
}
const flag = (name) => argv.includes(`--${name}`);
const LIMIT = arg("limit", null) ? parseInt(arg("limit"), 10) : null;
const RESET = flag("reset");
const CHUNK_SIZE = 500;
const CHUNK_OVERLAP = 50;
const EMBED_BATCH = 20;
const CONTEXT_BATCH = 20;
const INSERT_BATCH = 50;
// Isolated tenant — clean up with: DELETE FROM documents WHERE user_id='user_cuad_eval'
const USER_ID = process.env.CUAD_USER_ID || "user_cuad_eval";

// CUAD titles are filenames (Party_date_form_..._AgreementType). Store the
// human-readable agreement-type segment so retrieved chunks carry a citable
// title (citation accuracy). Keep the raw filename in metadata for traceability.
const cleanTitle = (raw) => {
  const seg = (raw.split("_").pop() || raw).replace(/\s+/g, " ").trim();
  return seg.length >= 3 ? seg : raw;
};

if (!existsSync(DATA_FILE)) {
  console.error(`✗ ${DATA_FILE} not found.`);
  console.error("  Download: curl -sL https://github.com/TheAtticusProject/cuad/raw/main/data.zip -o evals/benchmarks/cuad/data/data.zip && (cd evals/benchmarks/cuad/data && unzip -o data.zip)");
  process.exit(1);
}

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

// ── Optional reset ────────────────────────────────────────────────────────────
if (RESET) {
  console.log(`▸ --reset: deleting existing CUAD docs for ${USER_ID}…`);
  const r = await sql`DELETE FROM documents WHERE user_id = ${USER_ID} RETURNING id`;
  console.log(`  removed ${r.length} documents`);
}

// ── Load contracts ──────────────────────────────────────────────────────────
const cuad = JSON.parse(readFileSync(DATA_FILE, "utf8"));
let contracts = cuad.data ?? [];
if (LIMIT) contracts = contracts.slice(0, LIMIT);

// Resume-safe: skip contracts already ingested (by title) for this tenant.
const existingRows = await sql`
  SELECT metadata->>'cuad_title' AS t
  FROM documents
  WHERE user_id = ${USER_ID} AND metadata->>'benchmark' = 'cuad'
`;
const existing = new Set(existingRows.map((r) => r.t).filter(Boolean));
if (existing.size > 0) {
  const before = contracts.length;
  contracts = contracts.filter((c) => !existing.has(c.title));
  console.log(`▸ Skipping ${before - contracts.length} already-ingested contracts (resume mode)`);
}
console.log(`▸ Ingesting ${contracts.length} CUAD contracts for ${USER_ID}`);

let totalDocs = 0;
let totalChunks = 0;
let totalEmbedTokens = 0;
let totalContextualized = 0;
let totalCacheReadTokens = 0;
let totalCacheCreationTokens = 0;
const startTime = Date.now();

for (let i = 0; i < contracts.length; i++) {
  const contract = contracts[i];
  const title = contract.title ?? `contract_${i}`;
  const context = contract.paragraphs?.[0]?.context ?? "";
  if (!context.trim()) {
    console.warn(`  · ${title}: empty context, skipping`);
    continue;
  }

  const [docRow] = await sql`
    INSERT INTO documents (user_id, title, content, file_type, file_size, status, metadata)
    VALUES (
      ${USER_ID}, ${cleanTitle(title).slice(0, 500)}, ${context}, ${"txt"},
      ${Buffer.byteLength(context, "utf8")}, ${"ready"},
      ${JSON.stringify({ benchmark: "cuad", cuad_title: title })}::jsonb
    )
    RETURNING id
  `;
  const documentId = docRow.id;
  totalDocs++;

  const pieces = chunkText(context);
  const chunks = pieces.map((content) => ({ content, contextualized: null }));
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
  buildCtx(0, await generateChunkContext(context, chunks[0].content, onMeta));
  for (let b = 1; b < chunks.length; b += CONTEXT_BATCH) {
    const slice = chunks.slice(b, b + CONTEXT_BATCH);
    const ctxs = await Promise.all(
      slice.map((c) => generateChunkContext(context, c.content, onMeta))
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
        JSON.stringify({ benchmark: "cuad", cuad_title: title })
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
    `\r  [${i + 1}/${contracts.length}] docs=${totalDocs} chunks=${totalChunks} elapsed=${elapsed}s   `
  );
}

console.log();
const elapsedMin = ((Date.now() - startTime) / 60000).toFixed(1);
console.log(`✓ Ingested ${totalDocs} contracts, ${totalChunks} chunks in ${elapsedMin} min`);
console.log(
  `  Contextualized ${totalContextualized}/${totalChunks} chunks · ` +
    `cache read ${totalCacheReadTokens.toLocaleString()} tok / created ${totalCacheCreationTokens.toLocaleString()} tok`
);
console.log(`  Approx embedding tokens: ${totalEmbedTokens.toLocaleString()} ` +
  `(~$${((totalEmbedTokens / 1e6) * 0.15).toFixed(2)} @ ${EMBEDDING_MODEL})`);
