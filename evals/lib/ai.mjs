/**
 * AI SDK client for the eval harness — mirrors src/lib/ai.ts transport.
 *
 * Generation (chat / query synthesis / rerank / LLM judges) → Anthropic Claude.
 * Embeddings (corpus + query) → Google Gemini gemini-embedding-001 @ 1536-d.
 *
 * This replaces the old OpenAI-only client so eval numbers reflect the
 * production stack (commit 6989407: "move generation to Claude, embeddings to
 * Google Gemini"). The AI SDK handles 429/503 retries with exponential backoff
 * internally via `maxRetries`.
 */
import { createAnthropic } from "@ai-sdk/anthropic";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { embed as aiEmbed, embedMany, generateText } from "ai";
import {
  ANTHROPIC_API_KEY,
  GOOGLE_GENERATIVE_AI_API_KEY,
  EMBEDDING_MODEL,
  EMBEDDING_DIMENSIONS,
  SYNTHESIS_MODEL,
} from "./env.mjs";

export const anthropic = createAnthropic({ apiKey: ANTHROPIC_API_KEY });
export const google = createGoogleGenerativeAI({
  apiKey: GOOGLE_GENERATIVE_AI_API_KEY,
});

// Re-export so call sites can `generateText({ model: anthropic(MODEL), ... })`.
export { generateText };

/**
 * Embed a single text via Gemini. Mirrors src/lib/ai.ts generateEmbedding:
 * truncated to 1536-d (Matryoshka) to fit the vector(1536) column, with
 * asymmetric taskType (RETRIEVAL_QUERY for searches, RETRIEVAL_DOCUMENT for
 * stored chunks). Unlike production (maxRetries:0 — fail-fast on the hot path)
 * the eval harness retries, since a bulk run shouldn't die on a transient 429.
 */
export async function embed(text, taskType = "RETRIEVAL_QUERY") {
  const { embedding } = await aiEmbed({
    model: google.embeddingModel(EMBEDDING_MODEL),
    value: text.replace(/\n/g, " "),
    maxRetries: 5,
    providerOptions: {
      google: { outputDimensionality: EMBEDDING_DIMENSIONS, taskType },
    },
  });
  return embedding;
}

/**
 * Embed a batch of texts in one Gemini request. Used by the corpus ingester;
 * stored chunks are typed RETRIEVAL_DOCUMENT to match production ingestion.
 */
export async function embedBatch(texts, taskType = "RETRIEVAL_DOCUMENT") {
  const { embeddings } = await embedMany({
    model: google.embeddingModel(EMBEDDING_MODEL),
    values: texts.map((t) => t.replace(/\n/g, " ")),
    maxRetries: 5,
    providerOptions: {
      google: { outputDimensionality: EMBEDDING_DIMENSIONS, taskType },
    },
  });
  return embeddings;
}

// Mirrors src/lib/ai.ts → generateChunkContext (Anthropic Contextual Retrieval).
// Keep in lockstep (CLAUDE.md parity rule).
const MAX_DOC_CONTEXT_CHARS = 100_000;
const CHUNK_CONTEXT_PROMPT = (chunk) =>
  `Here is the chunk we want to situate within the whole document:\n` +
  `<chunk>\n${chunk}\n</chunk>\n\n` +
  `Please give a short, succinct context to situate this chunk within the overall ` +
  `document for the purposes of improving search retrieval of the chunk. Answer only ` +
  `with the succinct context and nothing else.`;

/**
 * Generate a context snippet for `chunk` situated in `documentText`, with the
 * document sent as a prompt-cached block. Returns null on error/empty (caller
 * embeds the raw chunk). `onCacheMeta` receives cache token counts for logging.
 */
export async function generateChunkContext(documentText, chunk, onCacheMeta) {
  try {
    const doc = documentText.slice(0, MAX_DOC_CONTEXT_CHARS);
    const { text, usage, providerMetadata } = await generateText({
      model: anthropic(SYNTHESIS_MODEL),
      messages: [
        {
          role: "user",
          content: [
            {
              type: "text",
              text: `<document>\n${doc}\n</document>`,
              providerOptions: { anthropic: { cacheControl: { type: "ephemeral" } } },
            },
            { type: "text", text: CHUNK_CONTEXT_PROMPT(chunk) },
          ],
        },
      ],
      maxOutputTokens: 200,
      temperature: 0,
      maxRetries: 5,
    });
    // Cache-read tokens are on the normalized usage; creation on provider metadata.
    onCacheMeta?.({
      cacheReadTokens: usage?.cachedInputTokens ?? 0,
      cacheCreationTokens: providerMetadata?.anthropic?.cacheCreationInputTokens ?? 0,
    });
    const ctx = (text ?? "").trim();
    return ctx.length > 0 ? ctx : null;
  } catch {
    return null;
  }
}

/**
 * Robust JSON parse — strips ```json fences and finds the first {...} block.
 * Claude sometimes wraps JSON in prose or fences despite "JSON only" prompts.
 */
export function parseJsonLoose(text) {
  let s = text.trim();
  if (s.startsWith("```")) {
    s = s.replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/, "");
  }
  const start = s.indexOf("{");
  const end = s.lastIndexOf("}");
  if (start !== -1 && end !== -1) s = s.slice(start, end + 1);
  return JSON.parse(s);
}
