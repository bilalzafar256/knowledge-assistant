# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

Company Knowledge Assistant — a production-grade RAG app. Users upload documents (PDF/DOCX/XLSX/images/text); the assistant answers questions grounded strictly in retrieved chunks, with citations. Built on the 2026 Vercel stack.

## Core Instructions

- **Skills**: Use the specialized skills in `.agents/skills/` (Next.js App Router, Clerk, Neon, etc.). These also back the Telegram → PR pipeline.
- **Docs are load-bearing**: After any major implementation or architectural decision, update `PROJECT_PLAN.md` (state/architecture) and `Readme.md` (user-facing setup). `PROJECT_PLAN.md` is the most complete and current architecture reference — read it first when orienting. `SYSTEM_ARCHITECTURE.md` holds the system diagrams (Mermaid topology + runtime flows) and the directory blueprint.

## Documentation Maintenance Rule

> Note: the GitHub readme is committed as `Readme.md` (that casing) — references to `README.md` below mean that file.

- `SYSTEM_ARCHITECTURE.md` and `README.md` are the strict structural sources of truth.
- Whenever any feature implementation, migration, or refactor alters core data paths, system boundaries, API contracts, or project dependencies, you MUST automatically update the corresponding sections and Mermaid diagrams in these files as part of the task completion.

## Commands

```bash
pnpm dev              # Next.js dev server (Turbopack)
pnpm build            # Production build
pnpm lint             # ESLint (eslint-config-next)
pnpm type-check       # tsc --noEmit — run this to verify types; there are no unit tests
pnpm db:generate      # Generate a Drizzle migration from schema.ts changes
pnpm db:migrate       # Apply pending migrations to Neon (scripts/db-migrate.mjs)
pnpm db:studio        # Drizzle Studio GUI
npx inngest-cli@latest dev   # Local Inngest dev server for background ingestion
```

There is **no test suite** — verification is `pnpm type-check` + `pnpm lint`, plus the RAG eval harness (`pnpm eval:ragbench:*`, see `PROJECT_PLAN.md` → "RAG Evals"). Do **not** run `pnpm db:push` (deprecated — bypasses migration history). Migration SQL under `drizzle/` is gitignored and generated locally; `db:migrate` applies every file in order and records it in `drizzle.__drizzle_migrations`.

## Architecture

Tech stack: Next.js 16 (App Router, RSC) · Vercel AI SDK v6 · Anthropic Claude (claude-sonnet-4-6 chat + image OCR, claude-haiku-4-5 for query synthesis + rerank fallback + Telegram classifier) · Google gemini-embedding-001 @ 1536-d (embeddings) · Neon Postgres + pgvector via Drizzle ORM · Clerk auth · Arcjet security · Inngest ingestion · shadcn/ui + Tailwind v4 · pnpm.

### Two cross-cutting invariants (every route must honor both)

1. **Auth + security chain**: middleware (`src/proxy.ts` — note: this is the Next.js middleware, named `proxy.ts` not `middleware.ts`) runs Clerk auth + Arcjet on all routes. API route handlers then re-check `auth()` from `@clerk/nextjs/server` (401 if absent) and call the appropriate Arcjet client's `.protect()` again at the route level. POST routes that mutate also call `isCsrfSafe()` (`lib/csrf.ts`, Origin validation).
2. **Tenant isolation**: every DB query is filtered by `userId`. `document_chunks.userId` is denormalized specifically so retrieval can scope by tenant without a join. Never write a query that could read across users.

### RAG retrieval pipeline (`src/lib/ai.ts` → `createSearchKnowledgeTool`)

The single most important file. Flow on each chat query:
1. `synthesizeSearchQuery()` — claude-haiku-4-5 rewrites a follow-up into a standalone query using conversation history (falls back to the raw query on error).
2. `generateEmbedding()` — embeds the synthesized query.
3. **Hybrid search in one SQL CTE**: pgvector cosine (`vector_hits`) + Postgres `tsvector` BM25-style lexical (`bm25_hits` over the generated `content_tsv` column with GIN index), fused via Reciprocal Rank Fusion (k=60) → top ~15 candidates. See `drizzle/0005_hybrid_search.sql`.
4. `rerankChunks()` — Cohere Rerank 3.5 if `COHERE_API_KEY` is set, else a claude-haiku-4-5 scoring call; trims to top-N (default 3).
5. Chunks → claude-sonnet-4-6 via `streamText` with `searchKnowledge` as a tool (`stopWhen: stepCountIs(5)`).

**Graceful degradation is a design rule**: query synthesis and reranking both fall back silently on error so the main chat flow never breaks. Preserve this when editing.

The system prompt (`SYSTEM_PROMPT` in `ai.ts`) is intentionally strict about grounding — the model must answer only from retrieved chunks and must refuse to invent numbers/dates/names. Treat changes to it as behavior-affecting.

### Ingestion pipeline

`POST /api/documents` saves the doc (`status: pending`) → `/api/workflows/ingest` sends a `document/uploaded` Inngest event. `src/inngest/ingest-document.ts` (retries: 3) drives status `processing → ready|failed` and calls `ingestDocument()` in `src/app/workflows/ingest.ts`, which: loads per-user `rag_settings` (chunkSize/overlap) → `sanitizeText()` → `chunkText()` → batched embeddings (20/batch) → idempotent delete + re-insert chunks (50/insert). If Inngest keys are unset, ingestion falls back to **inline** processing racing a 55 s timeout. The UI polls `GET /api/documents/[id]/status` until `ready`.

### Data model (`src/lib/schema.ts`)

`collections` → `documents` → `document_chunks` (embedding `vector(1536)` + generated `content_tsv`); `chat_sessions` → `chat_messages`; `rag_settings` (per-user chunking); `audit_logs` (fire-and-forget via `logAudit()`); `telegram_tasks` (state machine for the bot). The pgvector `ivfflat` index and the `content_tsv` generated column + GIN index are created in raw SQL migrations (`0000`, `0005`), not in `schema.ts`.

### Env, DB client, observability

- `src/lib/env.ts` — Zod-validated env, imported via `src/instrumentation.ts` so a missing/malformed var fails fast at boot. Import `env` from here; never read `process.env` directly. Optional vars (`COHERE_API_KEY`, Inngest keys, Telegram/GitHub, Axiom) degrade gracefully when unset.
- `src/lib/db.ts` — lazy `neon-http` Drizzle client behind a Proxy; `db.*` works anywhere.
- Logging/tracing → Axiom via `logger` + `withAxiom` from `@/lib/axiom/server`. Wrap new route handlers with `withAxiom` and use `logger.info("event.name", {...})`. Falls back to `console` without `AXIOM_TOKEN`. AI telemetry records metadata/tokens only — never prompts/completions (`recordInputs/Outputs: false`).

### Telegram → PR bot (dev-only, optional)

`POST /api/telegram/webhook` (verifies secret + chat-id allowlist) classifies a message and fires a `repository_dispatch` that drives three GitHub Actions workflows (`telegram-plan.yml` / `telegram-code.yml` / `telegram-pr.yml`), persisting progress in `telegram_tasks`. Actions can push task branches and open PRs into `dev` but never push to `main`/`dev`. Not user-facing; the webhook returns 503 when its env vars are unset so the rest of the app keeps working. Full state machine in `PROJECT_PLAN.md`.

## Conventions

- **Server Components by default**; add `"use client"` only where interactivity is required.
- Arcjet clients are per-surface (`lib/arcjet.ts`): `chatAj` (20/min token bucket, keyed by userId), `uploadAj` (50/hr + 200/day), base `aj`. The middleware `aj` rate-limits by IP (100/min) before auth.
- Import the AI SDK from `ai` / `@ai-sdk/anthropic` (generation) / `@ai-sdk/google` (embeddings) / `@ai-sdk/react` (v6 `UIMessage` protocol; chat uses `useChat` + `toUIMessageStreamResponse`). `@ai-sdk/openai` is retained only as an optional embedding fallback.
- The `evals/` harness mirrors production retrieval/answer logic (`evals/lib/retrieve.mjs` ↔ `lib/ai.ts`, `evals/lib/answer.mjs` ↔ `api/chat/route.ts`). If you change retrieval or the answer loop, update the eval mirror to keep benchmarks comparable.
