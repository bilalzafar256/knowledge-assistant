/**
 * Vercel Workflow: Document Ingestion Pipeline
 *
 * Steps:
 *   1. Fetch document from Neon by documentId + userId
 *   2. Chunk the text into ~500-token segments with overlap
 *   3. Generate OpenAI embeddings for each chunk (batched)
 *   4. Upsert chunks + embeddings into document_chunks table
 *
 * Designed to be called by:
 *   - Vercel Workflows runtime (production)
 *   - Direct function call (inline fallback / local dev)
 */

import { db } from "@/lib/db";
import { documents, documentChunks, ragSettings } from "@/lib/schema";
import { eq, and } from "drizzle-orm";
import { generateEmbeddings, generateChunkContext } from "@/lib/ai";
import { logger } from "@/lib/axiom/server";
import { chunkText, sanitizeText } from "@/lib/utils";
import type { NewDocumentChunk } from "@/lib/schema";

export interface IngestInput {
  documentId: string;
  userId: string;
}

export interface IngestResult {
  documentId: string;
  chunkCount: number;
  embeddingsGenerated: number;
  durationMs: number;
}

// Maximum chunks to embed in a single batch to avoid timeout
const EMBEDDING_BATCH_SIZE = 20;

// Chunks to contextualize concurrently (after the first, which warms the prompt
// cache). Matches the embedding batch size to bound concurrent Haiku calls.
const CONTEXT_BATCH_SIZE = 20;

// Default chunk configuration (used when no user settings exist)
const DEFAULT_CHUNK_TOKENS = 500;
const DEFAULT_CHUNK_OVERLAP_TOKENS = 50;

/**
 * Main ingestion function — can be called directly or wrapped in a Vercel Workflow.
 */
export async function ingestDocument(input: IngestInput): Promise<IngestResult> {
  const startMs = Date.now();
  const { documentId, userId } = input;

  logger.info("ingest.starting", { documentId, userId });

  // ── Step 1: Fetch document ─────────────────────────────────────────────────
  const [doc] = await db
    .select({
      id: documents.id,
      title: documents.title,
      content: documents.content,
    })
    .from(documents)
    .where(
      and(eq(documents.id, documentId), eq(documents.userId, userId))
    );

  if (!doc) {
    throw new Error(
      `Document not found: ${documentId} (userId: ${userId})`
    );
  }

  logger.info("ingest.document_fetched", {
    documentId,
    title: doc.title,
    contentLength: doc.content.length,
  });

  // ── Step 2: Load per-user chunk settings ──────────────────────────────────
  const [userSettings] = await db
    .select({ chunkSize: ragSettings.chunkSize, chunkOverlap: ragSettings.chunkOverlap })
    .from(ragSettings)
    .where(eq(ragSettings.userId, userId));

  const chunkTokens = userSettings?.chunkSize ?? DEFAULT_CHUNK_TOKENS;
  const chunkOverlapTokens = userSettings?.chunkOverlap ?? DEFAULT_CHUNK_OVERLAP_TOKENS;

  logger.info("ingest.chunk_settings", { documentId, chunkTokens, chunkOverlapTokens });

  // ── Step 3: Sanitize and chunk the text ───────────────────────────────────
  const sanitizedContent = sanitizeText(doc.content);
  const rawChunks = chunkText(sanitizedContent, chunkTokens, chunkOverlapTokens);

  if (rawChunks.length === 0) {
    throw new Error(`Document has no content to chunk: ${documentId}`);
  }

  logger.info("ingest.text_chunked", {
    documentId,
    chunkCount: rawChunks.length,
  });

  // ── Step 3.5: Contextualize chunks (Anthropic Contextual Retrieval) ─────────
  // For each chunk, generate a short snippet situating it in the whole document,
  // then embed/index the combined text. The document is prompt-cached, so we run
  // the FIRST chunk alone (to warm the cache) before fanning the rest out in
  // batches that read the warm cache. On failure a chunk's context is null and
  // we fall back to embedding the raw chunk (graceful degradation).
  const contextualizedChunks: Array<string | null> = new Array(rawChunks.length).fill(null);
  let cacheReadTokens = 0;
  let cacheCreationTokens = 0;
  let contextualizedCount = 0;

  if (rawChunks.length > 0) {
    const onMeta = (m: { cacheReadTokens: number; cacheCreationTokens: number }) => {
      cacheReadTokens += m.cacheReadTokens;
      cacheCreationTokens += m.cacheCreationTokens;
    };
    const buildContextualized = (idx: number, ctx: string | null) => {
      if (ctx) {
        contextualizedChunks[idx] = `${ctx}\n\n${rawChunks[idx]}`;
        contextualizedCount++;
      }
    };

    // First chunk alone — warms the document prompt cache.
    const firstChunk = rawChunks[0];
    if (firstChunk !== undefined) {
      buildContextualized(0, await generateChunkContext(sanitizedContent, firstChunk, onMeta));
    }

    // Remaining chunks — batched fan-out against the warm cache.
    for (let start = 1; start < rawChunks.length; start += CONTEXT_BATCH_SIZE) {
      const end = Math.min(start + CONTEXT_BATCH_SIZE, rawChunks.length);
      const ctxBatch = await Promise.all(
        rawChunks
          .slice(start, end)
          .map((chunk) => generateChunkContext(sanitizedContent, chunk, onMeta))
      );
      ctxBatch.forEach((ctx, j) => buildContextualized(start + j, ctx));
    }
  }

  logger.info("ingest.contextualized", {
    documentId,
    chunkCount: rawChunks.length,
    contextualizedCount, // chunks that got context; rest fall back to raw
    cacheReadTokens,
    cacheCreationTokens, // cacheReadTokens > 0 confirms prompt caching is working
  });

  // ── Step 4: Generate embeddings in batches ─────────────────────────────────
  // Embed the contextualized text when available, else the raw chunk. Each batch
  // is ONE Gemini request (embedMany) instead of one-request-per-chunk, so we
  // stay well under the free-tier embedding rate limit; batches run sequentially
  // and retry transient 429s (see generateEmbeddings). This mirrors the eval
  // ingester so app and benchmark vectors match (CLAUDE.md parity rule).
  const allEmbeddings: Array<{ index: number; embedding: number[] }> = [];

  for (let batchStart = 0; batchStart < rawChunks.length; batchStart += EMBEDDING_BATCH_SIZE) {
    const batchEnd = Math.min(batchStart + EMBEDDING_BATCH_SIZE, rawChunks.length);
    const batchTexts = rawChunks
      .slice(batchStart, batchEnd)
      .map((chunk, idx) => contextualizedChunks[batchStart + idx] ?? chunk);

    logger.info("ingest.embedding_batch", {
      documentId,
      batchStart,
      batchEnd,
      batchSize: batchTexts.length,
    });

    const batchEmbeddings = await generateEmbeddings(batchTexts, "RETRIEVAL_DOCUMENT");
    batchEmbeddings.forEach((embedding, idx) => {
      allEmbeddings.push({ index: batchStart + idx, embedding });
    });
  }

  logger.info("ingest.embeddings_complete", {
    documentId,
    count: allEmbeddings.length,
  });

  // ── Step 5: Upsert chunks to Neon ─────────────────────────────────────────
  // Delete existing chunks first (idempotent re-indexing)
  await db
    .delete(documentChunks)
    .where(
      and(
        eq(documentChunks.documentId, documentId),
        eq(documentChunks.userId, userId)
      )
    );

  // Build insert records
  const chunkRecords: NewDocumentChunk[] = rawChunks.map((content, idx) => {
    const embeddingEntry = allEmbeddings.find((e) => e.index === idx);
    return {
      documentId,
      userId,
      content,
      // Stored so BM25 (content_tsv = COALESCE(contextualized_content, content))
      // indexes the context too; the answer model still reads `content`.
      contextualizedContent: contextualizedChunks[idx],
      chunkIndex: idx,
      embedding: embeddingEntry?.embedding ?? null,
      metadata: {
        documentTitle: doc.title,
        chunkIndex: idx,
        totalChunks: rawChunks.length,
        charCount: content.length,
      },
    };
  });

  // Insert in batches to avoid hitting Neon's parameter limit
  const INSERT_BATCH = 50;
  for (let i = 0; i < chunkRecords.length; i += INSERT_BATCH) {
    const batch = chunkRecords.slice(i, i + INSERT_BATCH);
    await db.insert(documentChunks).values(batch);
  }

  const durationMs = Date.now() - startMs;

  logger.info("ingest.complete", {
    documentId,
    chunkCount: rawChunks.length,
    embeddingsGenerated: allEmbeddings.length,
    durationMs,
  });

  return {
    documentId,
    chunkCount: rawChunks.length,
    embeddingsGenerated: allEmbeddings.length,
    durationMs,
  };
}

// ── Vercel Workflow export ─────────────────────────────────────────────────

// When deployed on Vercel Workflows, this file is the workflow definition.
// The workflow runner calls the default export with the payload.
export default async function workflowHandler(payload: IngestInput): Promise<IngestResult> {
  return ingestDocument(payload);
}
