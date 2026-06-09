---
name: vercel-ai-sdk-rag
description: The RAG retrieval pipeline and Vercel AI SDK v6 patterns for this repo — query synthesis, hybrid search + RRF, reranking, grounded streamText, and graceful degradation. Use when touching retrieval or the chat answer loop.
---

# Vercel AI SDK v6 + RAG (this repo)

## When to use
Editing `src/lib/ai.ts`, the chat route, or anything in the retrieval/answer path.

## The pipeline (`createSearchKnowledgeTool` in `src/lib/ai.ts`)
1. `synthesizeSearchQuery()` — gpt-4o-mini rewrites a follow-up into a standalone query (fallback: raw query).
2. `generateEmbedding()` — text-embedding-3-small (1536-d).
3. **Hybrid search in one SQL CTE** — pgvector cosine + Postgres `tsvector` BM25-style lexical, fused via **Reciprocal Rank Fusion (k=60)** → ~15 candidates. See `drizzle/0005_hybrid_search.sql`.
4. `rerankChunks()` — Cohere Rerank 3.5 if `COHERE_API_KEY`, else gpt-4o-mini scoring → top ~3.
5. `streamText` (gpt-4o) with `searchKnowledge` as a tool, `stopWhen: stepCountIs(5)`, temp 0.3.

## Hard rules
- **Graceful degradation is a design rule.** Query synthesis and reranking MUST fall back silently on error so chat never breaks. Preserve this.
- **`SYSTEM_PROMPT` is strict about grounding** — answer only from retrieved chunks; never invent numbers/dates/names. Treat edits as behavior-affecting.
- Import from `ai` / `@ai-sdk/openai` / `@ai-sdk/react`. Chat uses `useChat` + `toUIMessageStreamResponse` (v6 `UIMessage` protocol).

## Keep the eval mirror in sync
If you change retrieval or the answer loop, update `evals/lib/retrieve.mjs` (↔ `lib/ai.ts`) and `evals/lib/answer.mjs` (↔ `api/chat/route.ts`) so benchmarks stay comparable.

## Anchors
- `src/lib/ai.ts`, `src/app/api/chat/route.ts`, `drizzle/0005_hybrid_search.sql`, `evals/lib/{retrieve,answer}.mjs`
