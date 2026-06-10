# Knowledge Assistant — Project Plan

> A production-grade RAG application: upload documents, query them in natural language, get grounded and cited answers. Built on the 2026 Vercel stack. This document is the authoritative architecture reference — keep it current after major changes.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 16 — App Router, React 19, TypeScript, Server Components |
| AI | Vercel AI SDK v6 — `streamText`, tool calls, `UIMessage` protocol |
| Models | claude-sonnet-4-6 (chat + image OCR) · claude-haiku-4-5 (query synthesis + rerank fallback + Telegram classifier) · Google gemini-embedding-001, 1536-d (embeddings) |
| Reranker | Cohere Rerank 3.5 (optional `COHERE_API_KEY`); claude-haiku-4-5 fallback |
| Database | Neon (Postgres + pgvector) via Drizzle ORM (`neon-http`) |
| Auth | Clerk |
| Security | Arcjet (shield, bot detection, rate limits) + Origin-based CSRF |
| Background jobs | Inngest (event queue, retries: 3; inline fallback) |
| Observability | Axiom (logs) + OpenTelemetry (AI-call traces) |
| UI | shadcn/ui + Tailwind CSS v4 |
| Package manager | pnpm |

---

## Architecture Principles

- **Security first** — middleware enforces Clerk auth + Arcjet on every request; each route handler re-checks `auth()` and `protect()`, and mutating routes add a CSRF Origin check before any logic runs.
- **Tenant isolation** — every DB query filters by `userId`. `document_chunks.userId` is denormalized so retrieval scopes by tenant without a join.
- **Server Components by default** — `"use client"` only where interactivity is required.
- **Graceful degradation** — query synthesis and reranking fall back silently on error; the chat flow never breaks. Inngest, Cohere, and Axiom are all optional and degrade to inline/fallback/console.
- **Validated config** — `src/lib/env.ts` (Zod) fails fast at startup, triggered via `src/instrumentation.ts`.
- **Versioned migrations** — `pnpm db:generate` → `pnpm db:migrate`; never `drizzle-kit push`.

---

## Project Layout

```
src/
├── app/
│   ├── (auth)/sign-in, sign-up        # Clerk-hosted auth pages
│   ├── dashboard/                     # App (auth-gated): overview, chat, documents, settings
│   │   ├── chat/[sessionId]/          # Per-session chat UI
│   │   ├── documents/[id], /upload    # Library, detail+chunks, multi-file upload
│   │   └── settings/                  # Profile · Knowledge Base · Security/Activity
│   ├── share/[shareId]/               # Public read-only shared conversation
│   ├── workflows/ingest.ts            # The ingestion function (chunk → embed → upsert)
│   └── api/                           # Route handlers (see API table)
├── components/                        # chat-*, document-*, collections-*, settings-*, ui/ (shadcn)
├── inngest/ingest-document.ts         # Inngest function wrapping ingestion + status transitions
├── lib/                               # env, db, schema, ai, arcjet, audit, csrf, inngest, file-parser, utils, axiom/
├── instrumentation.ts                 # Boot hook: env validation, OTel tracer, onRequestError
└── proxy.ts                           # Next.js middleware (Clerk + Arcjet) — note the proxy.ts name
evals/                                 # RAG eval harness + Open RAG Benchmark
drizzle/                               # Generated migration SQL (applied by scripts/db-migrate.mjs)
.agents/skills/                        # Specialist skills (Next.js, Clerk, Neon) + Telegram-bot coder
.github/                               # Telegram → PR workflows + scripts
```

---

## Database Schema (`src/lib/schema.ts`)

| Table | Purpose | Key columns |
|---|---|---|
| `collections` | Document folders | `userId`, `name`, `color` |
| `documents` | Uploaded doc text + metadata | `userId`, `collectionId` (FK, set null), `title`, `content`, `fileType`, `status` (`pending`/`processing`/`ready`/`failed`), `errorMessage` |
| `document_chunks` | Vector chunks (N per document) | `documentId` (cascade), `userId` (denormalized), `content`, `chunkIndex`, `embedding vector(1536)`, plus generated `content_tsv` + GIN index (raw SQL) |
| `chat_sessions` | Conversation threads | `userId`, `title` (auto from first msg), `pinned`, `isShared`, `shareId` (unique) |
| `chat_messages` | Persisted history | `sessionId` (cascade), `userId`, `role` (`user`/`assistant`), `content` |
| `rag_settings` | Per-user chunking | `userId` (unique), `chunkSize` (500), `chunkOverlap` (50) |
| `audit_logs` | Append-only action log | `userId`, `action`, `resourceType`, `resourceId`, `ipAddress`, `userAgent` |
| `telegram_tasks` | Telegram-bot state machine | `chatId`, `status`, `kind`, `planMarkdown`, `branchName`, `diffSummary`, `prUrl`, `mainPrUrl`, `revisionNotes`, `telegramMessageIds` |

The pgvector `ivfflat` index on `embedding` and the `content_tsv` generated column + GIN index live in raw SQL migrations (`0000`, `0005`), not in `schema.ts`.

### Migrations (`drizzle/`)

| File | Description |
|---|---|
| `0000_petite_mockingbird.sql` | `CREATE EXTENSION vector` + full initial schema + ivfflat index |
| `0001_complex_queen_noir.sql` | `rag_settings` |
| `0002_collections.sql` | `collections` + `documents.collection_id` |
| `0003_material_freak.sql` | `telegram_tasks` |
| `0004_main_pr_url.sql` | `telegram_tasks.main_pr_url` |
| `0005_hybrid_search.sql` | `content_tsv` generated column + GIN index for lexical search |

`scripts/db-migrate.mjs` applies every file in order; `scripts/db-baseline.mjs` is a brownfield helper that registers existing files without re-running (do not use on a fresh DB).

---

## API Routes

| Method | Route | Description |
|---|---|---|
| POST | `/api/chat` | Stream a grounded RAG answer; CSRF + Arcjet (chat); persists user/assistant messages, auto-titles session |
| GET/POST | `/api/chat/sessions` | List / create chat sessions |
| GET/PATCH/DELETE | `/api/chat/sessions/[id]` | Get, rename/pin, or delete a session |
| POST/DELETE | `/api/chat/sessions/[id]/share` | Generate / revoke a public share link |
| GET/POST | `/api/documents` | List / upload a document (parse + trigger ingestion) |
| GET/PATCH/DELETE | `/api/documents/[id]` | Fetch, reassign collection, or delete |
| GET | `/api/documents/[id]/status` | Ingestion status poll (`{ status, errorMessage }`) |
| POST | `/api/documents/parse` | Server-side text extraction |
| GET/POST | `/api/collections` | List / create collections |
| PATCH/DELETE | `/api/collections/[id]` | Rename / delete a collection |
| GET/PUT | `/api/settings/rag` | Read / upsert per-user chunk settings |
| POST | `/api/workflows/ingest` | Trigger ingestion (sends Inngest event; inline fallback) |
| GET/POST/PUT | `/api/inngest` | Inngest serve handler |
| POST | `/api/telegram/webhook` | Telegram bot — verify secret + sender, fire `repository_dispatch` |

---

## Pages

| Route | Description |
|---|---|
| `/` | Landing page |
| `/sign-in`, `/sign-up` | Clerk auth |
| `/dashboard` | Overview — stat cards (documents, chunks, conversations, messages) |
| `/dashboard/chat`, `/dashboard/chat/[sessionId]` | Chat list / per-session interface |
| `/dashboard/documents`, `/[id]`, `/upload` | Library (search/filter/sort), detail + chunks, multi-file upload |
| `/dashboard/settings` | Tabbed: Profile · Knowledge Base (chunk settings) · Security/Activity (audit log) |
| `/share/[shareId]` | Public read-only conversation |

---

## Core Library (`src/lib/`)

| File | Responsibility |
|---|---|
| `env.ts` | Zod validation of all env vars; fails fast at startup |
| `db.ts` | Lazy `neon-http` Drizzle client behind a Proxy (`db.*` works anywhere) |
| `schema.ts` | All tables, relations, inferred types |
| `ai.ts` | Anthropic + Google + OpenAI clients, models, `SYSTEM_PROMPT`, `generateEmbedding` (Google Gemini), `synthesizeSearchQuery`, `rerankChunks`, `createSearchKnowledgeTool` (the hybrid-search SQL) |
| `arcjet.ts` | `chatAj` (20/min, by userId), `uploadAj` (50/hr + 200/day), base `aj` |
| `csrf.ts` | `isCsrfSafe()` — Origin header validation |
| `audit.ts` | `logAudit()` — fire-and-forget insert into `audit_logs` |
| `inngest.ts` | Inngest client + `document/uploaded` event type |
| `file-parser.ts` | `extractText()` for PDF (pdf-parse), DOC/DOCX (mammoth), XLS/XLSX (xlsx), JPG/PNG (claude-sonnet-4-6 vision), text/md/json; accepted types + 50 MB cap |
| `utils.ts` | `cn`, `formatFileSize`, `timeAgo`, `truncate`, `sanitizeText`, `chunkText` (word-window, ~4 chars/token) |
| `axiom/` | `axiom.ts` (client), `server.ts` (`logger` + `withAxiom`), `otel.ts` (tracer → OTLP) |

---

## RAG Pipeline

### Ingestion

```
Upload (UI)
  └─ POST /api/documents/parse     → extractText() from the file buffer
  └─ POST /api/documents           → save document (status: pending), log audit
  └─ POST /api/workflows/ingest    → send `document/uploaded` to Inngest (inline fallback, 55 s)

Inngest: ingest-document (retries: 3)  [src/inngest/ingest-document.ts]
  ├─ status → processing
  ├─ ingestDocument()              [src/app/workflows/ingest.ts]
  │    ├─ fetch document (scoped by userId)
  │    ├─ load per-user rag_settings (chunkSize / chunkOverlap)
  │    ├─ sanitizeText() → chunkText()
  │    ├─ generateEmbedding() × N  (batched 20, parallel within batch)
  │    ├─ delete existing chunks   (idempotent re-index)
  │    └─ insert chunks + embeddings (batched 50)
  └─ status → ready  (or failed + errorMessage; re-throws so Inngest retries)
```

The UI polls `GET /api/documents/[id]/status` until `ready`. Re-indexing reuses the same pipeline via the re-index button.

### Query

```
synthesizeSearchQuery()   claude-haiku-4-5 rewrites the follow-up as a standalone query (fallback: raw query)
generateEmbedding()       embed the synthesized query (Google gemini-embedding-001, 1536-d)
Hybrid retrieval          one SQL CTE, tenant-scoped by userId:
   ├─ vector_hits           pgvector cosine top-N (semantic)
   ├─ bm25_hits             ts_rank_cd on content_tsv via GIN (lexical)
   └─ RRF fusion            Σ 1 / (60 + rank_i) → ~15 fused candidates
rerankChunks()            Cohere Rerank 3.5 if COHERE_API_KEY, else claude-haiku-4-5 scoring → top ~3
streamText (sonnet-4-6)   searchKnowledge tool, stopWhen stepCountIs(5), temperature 0.3
```

`SYSTEM_PROMPT` in `ai.ts` is strict about grounding: answer only from retrieved chunks; never infer numbers/dates/names that aren't present; say so when the chunks don't contain the asked detail.

---

## RAG Evals (Open RAG Benchmark)

Evaluated against **Vectara's Open RAG Benchmark** (`vectara/open_ragbench`) — 1,000 arXiv papers and 3,045 expert Q&A pairs across text, tables, and figures. Public ground truth makes results comparable across RAG systems. Run manually before/after pipeline changes (not in CI).

```
evals/
├── lib/  env · db · ai (AI SDK client: Gemini embeddings + Claude generation) · retrieve (mirrors lib/ai.ts) · answer (mirrors api/chat) · judges (cross-family LLM-as-judge on gemini-2.5-flash)
├── run.mjs                         runs over a golden set, writes timestamped JSON + MD
└── benchmarks/open-ragbench/
    ├── download.mjs  ingest.mjs  import-golden.mjs  run.mjs  report.mjs
    ├── data/         (gitignored, ~743 MB)
    ├── golden/golden-set.json      questions with expected (doc_id, section_id)
    ├── runs/<timestamp>_<label>.{json,md}
    └── REPORT.md                   committed headline numbers
```

**Stack under test** — `claude-sonnet-4-6` answers, `gemini-embedding-001` embeddings, Cohere rerank (Claude Haiku fallback) — i.e. the production pipeline. Grading uses a **cross-family judge** (`gemini-2.5-flash`, different family than the generator → no self-preference bias; thinking disabled so the JSON output isn't starved). Launch thresholds + current go-live status live in **`docs/GO_LIVE_READINESS.md`** (the canonical threshold source; `report.mjs` mirrors it).

**Metrics** — retrieval: Recall@k (reranked + candidate pool + pure-vector diagnostic), MRR, context precision. Answer: faithfulness, correctness, citation accuracy, latency, token cost. Auto-broken-down by modality (`text`/`text-image`/`text-table`/`text-table-image`) and type (`extractive`/`abstractive`).

**Ground-truth matching** — the chunker tags each chunk's `metadata.section_id` at ingest; a retrieval hit is scored when any retrieved chunk's `(documentId, section_id)` matches the expected pair.

**Isolation** — benchmark docs live under `OPEN_RAGBENCH_USER_ID` (default `user_open_ragbench_eval`) so they don't mix with other corpora. Note this is *logical* (tenant) isolation only: the harness writes to the same `DATABASE_URL` as the app. The full corpus is ~440 MB (37k+ chunks × `vector(1536)` embeddings) and **will exceed Neon's 512 MB free-tier limit**, causing live uploads to 500 with `could not extend file because project size limit ... exceeded`. Run evals against a throwaway Neon branch, or tear the tenant down afterward:

```sql
DELETE FROM documents WHERE user_id='user_open_ragbench_eval';  -- cascades to chunks
VACUUM FULL document_chunks;  -- reclaim space; plain VACUUM won't shrink the files
```

Run cycle:
```
pnpm eval:ragbench:download
pnpm eval:ragbench:ingest
pnpm eval:ragbench:golden -- --sample 2000
pnpm eval:ragbench:run -- --label baseline
pnpm eval:ragbench:report
```

---

## Telegram → PR Bot (dev-only)

A side channel for issuing code-change requests over Telegram. Not user-facing. Task state persists in `telegram_tasks` so one request moves across multiple workflow runs.

```
Telegram message
  └─ POST /api/telegram/webhook        verify x-telegram-bot-api-secret-token + chat.id allowlist
       └─ classify → repository_dispatch (plan-task | code-task | pr-task)

GitHub Actions (one workflow per event_type):
  telegram-plan.yml  → Claude Code Plan subagent → plan.md / questions.md → Telegram (Approve/Revise/Cancel)
  telegram-code.yml  → coder skill writes the diff → push branch → Telegram (Approve & open PR / Revise / Cancel)
  telegram-pr.yml    → open PR into dev, save URL, mark task done, notify Telegram
```

`.github/scripts/telegram-*.mjs` handle the Neon ↔ Telegram glue. **Security boundaries:** webhook secret + chat-id allowlist (both must match); fine-grained PAT scoped to one repo with `Contents: RW`; Actions push task branches and open PRs but never push to `main`/`dev` (human review required). All Telegram/GitHub env vars are optional in the Next.js app — the webhook returns `503` if any are missing.

---

## Security Model

| Layer | Mechanism |
|---|---|
| Authentication | Clerk `auth()` on every route (401 if absent); middleware `auth.protect()` on protected routes |
| Authorization | All DB queries filtered by `userId` — no cross-tenant access |
| Rate limit (chat) | Arcjet token bucket — 20/min per user |
| Rate limit (uploads) | Arcjet token bucket 50/hr + fixed window 200/day per user |
| Rate limit (edge) | Middleware Arcjet — 100/min per IP, before auth |
| Bot detection | Arcjet `detectBot` (allows search engines, monitors, previews) |
| Prompt injection | Arcjet shield on all routes + `sanitizeText()` on ingested content |
| CSRF | `isCsrfSafe()` Origin check on mutating routes (`/api/chat`, `/api/documents`, `/api/workflows/ingest`) |
| Audit trail | `audit_logs` captures uploads, deletes, chat messages with IP + user-agent |
| Config | Zod env validation aborts startup on missing/invalid secrets |

---

## Observability

Logs, traces, and uncaught errors ship to **Axiom**; without `AXIOM_TOKEN` everything falls back to `console`.

| Source | How |
|---|---|
| Per-request log (method, path, status, duration, userId) | `withAxiom` route wrapper |
| Structured app events (`logger.info(...)`) | `@axiomhq/logging` via `lib/axiom/server.ts` |
| Uncaught Route Handler / RSC errors | `onRequestError` in `instrumentation.ts` |
| AI SDK spans (model, latency, tokens) | `experimental_telemetry` on `streamText` → OTLP exporter registered in `instrumentation.ts` |

**Privacy default:** `recordInputs: false, recordOutputs: false` — prompts and completions are never sent off-server; only metadata, token counts, and latency are traced.

---

## Conventions for Contributors

- Import `env` from `lib/env.ts`; never read `process.env` directly in app code.
- Wrap new route handlers with `withAxiom`; check `auth()`, the relevant Arcjet client, and (for mutations) `isCsrfSafe()`.
- Every new query must include a `userId` predicate.
- Change retrieval/answer logic in `lib/ai.ts` and the corresponding `evals/lib/*` mirror together, so benchmarks stay comparable.
- Schema changes: edit `schema.ts` → `pnpm db:generate` → `pnpm db:migrate`. Raw-SQL features (indexes, generated columns) go in a hand-written migration.
- No test suite — verify with `pnpm type-check` + `pnpm lint` and the eval harness.

---

## TODO / Known Gaps

- **No automated tests** — no unit/integration/E2E coverage; quality is gated by type-check, lint, and manual evals.
- **Evals are manual** — not wired into CI.
- Most `drizzle/` migration SQL is generated locally; confirm the migration set matches your environment before deploying to a fresh database.
