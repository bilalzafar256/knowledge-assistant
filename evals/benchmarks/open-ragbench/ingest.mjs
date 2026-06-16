/**
 * Bulk-load Open RAG Benchmark corpus into Neon (documents + document_chunks).
 *
 * Mirrors the production ingestion pipeline (chunkText → embed → insert) but
 * bypasses the API + Inngest path — for 1k arXiv papers that path would take
 * hours and consume the per-user rate-limit budget.
 *
 * Section provenance is preserved in `document_chunks.metadata`:
 *   { section_id, section_index, paper_id, benchmark: "open_ragbench" }
 *
 * This lets `evals/run.mjs` measure section-level recall against the
 * benchmark's (doc_id, section_id) ground truth.
 *
 * Usage:
 *   node evals/benchmarks/open-ragbench/ingest.mjs              # all downloaded papers
 *   node evals/benchmarks/open-ragbench/ingest.mjs --limit 5    # first 5 (for smoke test)
 *   node evals/benchmarks/open-ragbench/ingest.mjs --reset      # wipe + reingest
 */
import { readdirSync, readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { sql } from "../../lib/db.mjs";
import { embedBatch, generateChunkContext } from "../../lib/ai.mjs";
import { OPEN_RAGBENCH_USER_ID, EMBEDDING_MODEL } from "../../lib/env.mjs";

const __dir = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = join(__dir, "data");
const CORPUS_DIR = join(DATA_DIR, "corpus");

// ── CLI args ──────────────────────────────────────────────────────────────────
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
const USER_ID = OPEN_RAGBENCH_USER_ID;

if (!existsSync(CORPUS_DIR)) {
  console.error(`✗ Corpus directory not found: ${CORPUS_DIR}`);
  console.error("  Run: pnpm eval:ragbench:download");
  process.exit(1);
}

// ── Optional reset ────────────────────────────────────────────────────────────
if (RESET) {
  console.log(`▸ --reset: deleting existing benchmark docs for ${USER_ID}…`);
  // chunks cascade-delete with documents
  const r = await sql`DELETE FROM documents WHERE user_id = ${USER_ID} RETURNING id`;
  console.log(`  removed ${r.length} documents`);
}

// ── Chunker (byte-identical algorithm to src/lib/utils.ts → chunkText) ─────────
// Structure-aware: packs whole sentences (by paragraph) up to the budget, never
// breaks mid-sentence, carries whole-sentence overlap. Keep in lockstep with
// src/lib/utils.ts (CLAUDE.md parity rule).
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

/**
 * Flatten a benchmark section into plain text. The raw section may reference
 * tables and images via placeholders that vary by paper; rather than guess
 * the placeholder syntax we append all tables (as markdown) and image markers
 * to the end of the section text. This keeps retrieval signal for table /
 * image queries without depending on exact placeholder resolution.
 */
function flattenSection(section, _paperId, _sectionIndex) {
  let text = (section.text ?? "").trim();

  const tables = section.tables ?? {};
  const tableMd = Object.entries(tables)
    .map(([id, md]) => `\n\n[Table ${id}]\n${md}`)
    .join("");

  const images = section.images ?? {};
  const imageMarkers = Object.keys(images)
    .map((id) => `[Figure ${id}]`)
    .join(" ");

  return [text, tableMd, imageMarkers ? `\n\n${imageMarkers}` : ""]
    .filter(Boolean)
    .join("");
}

// Stored chunks are embedded as RETRIEVAL_DOCUMENT (asymmetric typing) to match
// production ingestion; search queries use RETRIEVAL_QUERY. embedBatch is the
// shared Gemini helper from evals/lib/ai.mjs.

// ── Discover papers ───────────────────────────────────────────────────────────
let files = readdirSync(CORPUS_DIR).filter((f) => f.endsWith(".json"));
if (LIMIT) files = files.slice(0, LIMIT);

// Skip papers whose paper_id is already in the DB for this user. Lets a
// crashed run be resumed without --reset (which wipes everything).
const existingRows = await sql`
  SELECT metadata->>'paper_id' AS paper_id
  FROM documents
  WHERE user_id = ${USER_ID}
    AND metadata->>'benchmark' = 'open_ragbench'
`;
const existingPaperIds = new Set(existingRows.map((r) => r.paper_id).filter(Boolean));
if (existingPaperIds.size > 0) {
  const before = files.length;
  files = files.filter((f) => !existingPaperIds.has(f.replace(/\.json$/, "")));
  console.log(`▸ Skipping ${before - files.length} already-ingested papers (resume mode)`);
}
console.log(`▸ Ingesting ${files.length} papers for user ${USER_ID}`);

// ── Per-paper ingestion ───────────────────────────────────────────────────────
let totalDocs = 0;
let totalChunks = 0;
let totalEmbedTokens = 0;
let totalContextualized = 0;
let totalCacheReadTokens = 0;
let totalCacheCreationTokens = 0;
const startTime = Date.now();

for (let i = 0; i < files.length; i++) {
  const file = files[i];
  const paperPath = join(CORPUS_DIR, file);
  let paper;
  try {
    paper = JSON.parse(readFileSync(paperPath, "utf8"));
  } catch (e) {
    console.warn(`  ✗ ${file}: ${e.message}`);
    continue;
  }

  const paperId = paper.id ?? file.replace(/\.json$/, "");
  const title = paper.title ?? paperId;
  const sections = Array.isArray(paper.sections) ? paper.sections : [];
  if (sections.length === 0) {
    console.warn(`  · ${paperId}: no sections, skipping`);
    continue;
  }

  // Flatten each section independently so chunks retain their section_id.
  // Section IDs in qrels.json are stringified integer indices.
  const sectionTexts = sections.map((s, idx) => ({
    sectionId: String(idx),
    sectionIndex: idx,
    text: flattenSection(s, paperId, idx),
  }));

  const fullDocContent = sectionTexts
    .map((s) => `## Section ${s.sectionIndex}\n\n${s.text}`)
    .join("\n\n");

  // Insert document row (status=ready since we're handling chunks here)
  const [docRow] = await sql`
    INSERT INTO documents (user_id, title, content, file_type, file_size, status, metadata)
    VALUES (
      ${USER_ID},
      ${title.slice(0, 500)},
      ${fullDocContent},
      ${"pdf"},
      ${Buffer.byteLength(fullDocContent, "utf8")},
      ${"ready"},
      ${JSON.stringify({
        benchmark: "open_ragbench",
        paper_id: paperId,
        categories: paper.categories ?? [],
        abstract: paper.abstract ?? null,
      })}::jsonb
    )
    RETURNING id
  `;
  const documentId = docRow.id;
  totalDocs++;

  // Build all chunks across all sections, each tagged with its section_id.
  const allChunks = [];
  for (const s of sectionTexts) {
    if (!s.text.trim()) continue;
    const pieces = chunkText(s.text);
    for (let ci = 0; ci < pieces.length; ci++) {
      allChunks.push({
        content: pieces[ci],
        sectionId: s.sectionId,
        sectionIndex: s.sectionIndex,
      });
    }
  }

  if (allChunks.length === 0) {
    console.warn(`  · ${paperId}: produced 0 chunks`);
    continue;
  }

  // Contextual Retrieval: situate each chunk in the full document (prompt-cached
  // doc block; first chunk warms the cache, rest fan out in batches). Mirrors
  // src/app/workflows/ingest.ts. Falls back to raw content on failure.
  for (let i = 0; i < allChunks.length; i++) allChunks[i].contextualized = null;
  const onMeta = (m) => {
    totalCacheReadTokens += m.cacheReadTokens;
    totalCacheCreationTokens += m.cacheCreationTokens;
  };
  const buildCtx = (idx, ctx) => {
    if (ctx) {
      allChunks[idx].contextualized = `${ctx}\n\n${allChunks[idx].content}`;
      totalContextualized++;
    }
  };
  buildCtx(0, await generateChunkContext(fullDocContent, allChunks[0].content, onMeta));
  for (let b = 1; b < allChunks.length; b += CONTEXT_BATCH) {
    const slice = allChunks.slice(b, b + CONTEXT_BATCH);
    const ctxs = await Promise.all(
      slice.map((c) => generateChunkContext(fullDocContent, c.content, onMeta))
    );
    ctxs.forEach((ctx, j) => buildCtx(b + j, ctx));
  }

  // Embed the contextualized text when available, else the raw content.
  const embeddings = [];
  for (let b = 0; b < allChunks.length; b += EMBED_BATCH) {
    const batch = allChunks.slice(b, b + EMBED_BATCH);
    const texts = batch.map((c) => c.contextualized ?? c.content);
    const vecs = await embedBatch(texts);
    embeddings.push(...vecs);
    totalEmbedTokens += texts.reduce((s, t) => s + Math.ceil(t.length / 4), 0);
  }

  // Bulk-insert chunks (50 rows per statement, multi-row VALUES)
  for (let b = 0; b < allChunks.length; b += INSERT_BATCH) {
    const batchChunks = allChunks.slice(b, b + INSERT_BATCH);
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
        c.contextualized, // null → COALESCE falls back to content for BM25
        b + j,
        `[${batchVecs[j].join(",")}]`,
        JSON.stringify({
          benchmark: "open_ragbench",
          paper_id: paperId,
          section_id: c.sectionId,
          section_index: c.sectionIndex,
        })
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
    `\r  [${i + 1}/${files.length}] docs=${totalDocs} chunks=${totalChunks} elapsed=${elapsed}s   `
  );
}

console.log();
const elapsedMin = ((Date.now() - startTime) / 60000).toFixed(1);
console.log(`✓ Ingested ${totalDocs} documents, ${totalChunks} chunks in ${elapsedMin} min`);
console.log(
  `  Contextualized ${totalContextualized}/${totalChunks} chunks · ` +
    `cache read ${totalCacheReadTokens.toLocaleString()} tok / created ${totalCacheCreationTokens.toLocaleString()} tok ` +
    `(cache read > 0 ⇒ prompt caching is working)`
);
console.log(`  Approx embedding tokens: ${totalEmbedTokens.toLocaleString()}`);
console.log(`  Approx embedding cost: $${((totalEmbedTokens / 1e6) * 0.15).toFixed(2)} ` +
  `(${EMBEDDING_MODEL} @ ~$0.15/MTok)`);
