# Knowledge Assistant — Project Plan

> A production-grade RAG application that lets teams upload documents and query them in natural language. Built on the 2026 Vercel stack.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 16+ — App Router, TypeScript, Server Components |
| AI | Vercel AI SDK v6 — streaming, tool calls, `UIMessage` protocol |
| Models | GPT-4o (chat) · text-embedding-3-small (embeddings) · GPT-4o-mini (query synthesis + re-ranking) |
| Database | Neon (Postgres + pgvector) via Drizzle ORM |
| Auth | Clerk — RBAC, session management, `currentUser()` server helper |
| Security | Arcjet — shield, bot detection, token bucket + fixed window rate limiting |
| Background Jobs | Inngest — event-driven ingestion queue with retries |
| Analytics | Vercel Analytics + Speed Insights |
| UI | shadcn/ui + Tailwind CSS v4 · Geist + Geist Mono (next/font/google) |
| Package Manager | pnpm |

---

## Architecture Principles

- **Security first** — every API route chains `auth()` (Clerk) then `protect()` (Arcjet) before any logic runs
- **Tenant isolation** — every database query is filtered by `userId`; no cross-user data leakage is possible
- **Server Components by default** — client components are used only where interactivity is strictly required
- **Graceful degradation** — query synthesis and re-ranking both fall back silently on error; the main chat flow never breaks
- **Versioned migrations** — Drizzle `generate` → `db-migrate.mjs`; no `drizzle-kit push` in production

---

## Database Schema

### `documents`
Stores uploaded document text and metadata, scoped to a user.

| Column | Type | Notes |
|---|---|---|
| id | uuid PK | |
| user_id | text | Tenant key — all queries filter on this |
| collection_id | uuid FK | nullable → `collections.id` SET NULL on delete |
| title | text | Original filename |
| content | text | Full extracted text |
| file_type | text | pdf · docx · xlsx · jpg · png · txt · md · json |
| file_size | integer | Bytes |
| status | enum | `pending` → `processing` → `ready` \| `failed` |
| error_message | text | Populated on ingestion failure |
| metadata | jsonb | Extra extraction info |
| created_at / updated_at | timestamp | |

---

### `document_chunks`
Vector chunks derived from documents. One document produces N chunks.

| Column | Type | Notes |
|---|---|---|
| id | uuid PK | |
| document_id | uuid FK | Cascade delete |
| user_id | text | Denormalized for query efficiency |
| content | text | Raw chunk text |
| chunk_index | integer | Position within parent document |
| embedding | vector(1536) | text-embedding-3-small output |
| metadata | jsonb | title, index, total chunks, char count |

Index: `ivfflat` on `embedding` using cosine distance operator.

---

### `chat_sessions`
One row per conversation thread.

| Column | Type | Notes |
|---|---|---|
| id | uuid PK | |
| user_id | text | |
| title | text | Auto-set from first message (≤ 60 chars) |
| pinned | boolean | Pinned sessions float to top of sidebar |
| is_shared | boolean | Public share enabled |
| share_id | text unique | Token for public `/share/[shareId]` URL |
| created_at / updated_at | timestamp | `updated_at` bumped on every message |

---

### `chat_messages`
Persisted message history linked to a session.

| Column | Type | Notes |
|---|---|---|
| id | uuid PK | |
| session_id | uuid FK | Cascade delete |
| user_id | text | |
| role | enum | `user` \| `assistant` |
| content | text | |
| created_at | timestamp | |

---

### `rag_settings`
Per-user chunking configuration. One row per user (upsert on change).

| Column | Type | Default |
|---|---|---|
| user_id | text unique | |
| chunk_size | integer | 500 |
| chunk_overlap | integer | 50 |
| updated_at | timestamp | |

---

### `audit_logs`
Append-only log of significant actions. Fire-and-forget via `logAudit()`.

| Column | Type | Notes |
|---|---|---|
| id | uuid PK | |
| user_id | text | |
| action | text | `document.upload` · `document.delete` · `chat.message` |
| resource_type | text | `document` · `chat_session` |
| resource_id | text | |
| metadata | jsonb | e.g. `{ messageLength, fileSize }` |
| ip_address | text | Extracted from `x-forwarded-for` |
| user_agent | text | |
| created_at | timestamp | |

---

## Migrations

| File | Description |
|---|---|
| `drizzle/0000_petite_mockingbird.sql` | Enables `vector` extension + full initial schema (all core tables + ivfflat index) |
| `drizzle/0001_complex_queen_noir.sql` | Adds `rag_settings` table |
| `drizzle/0002_collections.sql` | Adds `collections` table + `collection_id` FK on `documents` |
| `scripts/db-migrate.mjs` | Runs pending Drizzle migrations against Neon |
| `scripts/db-baseline.mjs` | Brownfield helper — registers existing SQL files without re-running them. Do not run on a fresh empty DB. |

> Migration SQL is generated locally via `pnpm db:generate` and never checked in — `.gitignore` line 20 excludes `drizzle/`. The migration filenames above are illustrative of the current local state, not artefacts you will find in a fresh clone.

**Last full rebuild:** 2026-05-20 — schema dropped and rebuilt against a new Neon instance after the previous database was deleted. All three migrations applied via `pnpm db:migrate`. `CREATE EXTENSION IF NOT EXISTS vector;` was added to the top of `0000_petite_mockingbird.sql` afterwards so future fresh databases no longer need a manual pgvector enable step before migrating.

---

## API Routes

| Method | Route | Description |
|---|---|---|
| POST | `/api/chat` | Stream AI response. Runs Arcjet shield + rate limit. Persists messages. |
| GET | `/api/chat/sessions` | List all sessions for the authenticated user |
| POST | `/api/chat/sessions` | Create a new chat session |
| GET/PATCH/DELETE | `/api/chat/sessions/[id]` | Get, rename, or delete a session |
| POST | `/api/chat/sessions/[id]/share` | Generate or revoke a public share link |
| GET | `/api/documents` | List documents for the user |
| POST | `/api/documents` | Upload + parse a document, trigger ingestion |
| GET/PATCH/DELETE | `/api/documents/[id]` | Fetch, update collection assignment, or delete a document |
| GET/POST | `/api/collections` | List or create collections |
| PATCH/DELETE | `/api/collections/[id]` | Rename or delete a collection |
| GET | `/api/documents/[id]/status` | Ingestion status poll endpoint (`{ status, errorMessage }`) |
| POST | `/api/documents/parse` | Server-side text extraction (PDF, DOCX, XLSX, images) |
| POST | `/api/workflows/ingest` | Trigger ingestion — sends Inngest event, falls back to inline |
| POST | `/api/inngest` | Inngest webhook handler (`serve`) |
| GET/PUT | `/api/settings/rag` | Read or upsert per-user chunk settings |
| POST | `/api/telegram/webhook` | Telegram bot webhook — verifies secret + sender, fires `repository_dispatch` |

---

## Pages

| Route | Type | Description |
|---|---|---|
| `/` | Server | Case-study landing page — hero w/ chat screenshot, eval-stats strip, problem statement, architecture diagram, 5 deep-dive sections (hybrid retrieval, reranking, evals, security, ingestion), product screenshot grid, Telegram-bot bonus, tech stack, "Book a call" CTA → `#contact` |
| `/sign-in` · `/sign-up` | Server | Clerk-hosted auth pages |
| `/dashboard` | Server | Overview — 4 stat cards (Docs, Chunks, Conversations, Messages) |
| `/dashboard/chat` | Server | Chat list on mobile; redirects to last session on desktop |
| `/dashboard/chat/[sessionId]` | Server | Full chat interface for a specific session |
| `/dashboard/documents` | Server | Document list with sort, filter, and count badges |
| `/dashboard/documents/upload` | Server | Multi-file upload with per-file progress + status polling |
| `/dashboard/documents/[id]` | Server | Document detail — full content + all chunks |
| `/dashboard/settings` | Server | Tabbed settings: Profile · Knowledge Base · Security |
| `/share/[shareId]` | Server | Public read-only view of a shared conversation |

---

## Key Components

| Component | Description |
|---|---|
| `chat-interface.tsx` | Full chat UI — `useChat` hook, streaming messages, source citations panel, thinking indicator |
| `chat-sessions-sidebar.tsx` | Pinned + recent sessions list, inline rename, new chat button |
| `chat-actions.tsx` | Per-session actions: pin, share link, export (Markdown + Print/PDF), delete |
| `document-upload.tsx` | Drag-and-drop multi-file uploader with parallel parse, sequential upload, ingestion status polling |
| `document-list.tsx` | Sortable (Newest/Oldest/A–Z/Largest) + filterable document list with type-count badges |
| `rag-settings-form.tsx` | Chunk size / overlap sliders with 4 presets (Default · Legal · Code · Dense Knowledge) |
| `settings-tabs.tsx` | Tabbed settings shell — Profile, Knowledge Base, Security |
| `dashboard-shell.tsx` | App shell with sidebar nav, mobile hamburger drawer |
| `sidebar-nav.tsx` | Navigation links + user avatar + keyboard shortcut hints |

---

## Core Library

| File | Responsibility |
|---|---|
| `lib/env.ts` | Zod validation of all env vars at startup — fails fast with a clear error box |
| `lib/db.ts` | Neon HTTP + WebSocket Drizzle client |
| `lib/schema.ts` | All table definitions, types, and relations |
| `lib/ai.ts` | OpenAI client, models, system prompt, `generateEmbedding`, `synthesizeSearchQuery`, `rerankChunks`, `createSearchKnowledgeTool` |
| `lib/arcjet.ts` | Arcjet client — shield + detectBot + token bucket (chat) + fixed window (uploads) |
| `lib/audit.ts` | `logAudit()` — fire-and-forget insert into `audit_logs` |
| `lib/inngest.ts` | Inngest client + `DocumentUploadedEvent` type |
| `lib/file-parser.ts` | Server-side extractors for PDF, DOCX, XLSX, images (OCR), plain text |
| `lib/utils.ts` | `chunkText()` — token-aware sliding window chunker |
| `src/instrumentation.ts` | Next.js startup hook — imports `env` to trigger validation before first request |

---

## Helper Scripts & Agent Skills

Both directories are load-bearing for the Telegram → PR pipeline. The scripts run inside the GitHub Actions workflows. Planning is delegated to Claude Code's built-in `Plan` subagent (read-only software-architect persona); only the `coder` step still loads a custom SKILL.md.

### `.github/scripts/`

| File | Responsibility |
|---|---|
| `telegram-save-plan.mjs` | Persists `plan.md` to `telegram_tasks.plan_markdown`, flips status to `awaiting_plan_approval`, sends the plan to Telegram with Approve / Revise / Cancel buttons |
| `telegram-save-questions.mjs` | Variant of the above for when the planner returned `# QUESTIONS` — stores the questions, flips status to `awaiting_clarification`, posts with a Cancel button |
| `telegram-load-task-branch.mjs` | Loads an approved task from Neon, allocates a branch if needed, emits `branch` / `plan` / `revision_notes` / `message` for the coder step |
| `telegram-save-diff.mjs` | Persists branch + diff summary, flips status to `awaiting_code_approval`, posts the diff to Telegram with Approve & open PR / Revise / Cancel buttons |
| `telegram-no-changes.mjs` | Coder ran but produced no diff — parks the task back at `awaiting_plan_approval` and notifies Telegram |
| `telegram-open-pr.mjs` | Opens a PR from the task branch into `dev`, saves the URL, marks the task `done`, notifies Telegram |

### `.agents/skills/`

| Skill | Purpose |
|---|---|
| `coder/` | Implements an already-approved plan as a minimal diff — runs inside `telegram-code.yml` |
| `find-skills/` | Helps discover and install additional agent skills from the open ecosystem |
| `nextjs-developer/` | Specialist for Next.js 14+ App Router work (route handlers, RSC, middleware, deployment) |
| `nextjs-app-router-fundamentals/` | Guide for App Router basics, layouts, metadata, Pages-Router migration |
| `nextjs-app-router-patterns/` | Advanced patterns — streaming, parallel routes, advanced data fetching |
| `nextjs-best-practices/` | Server Components, data fetching, routing principles |
| `nextjs-react-typescript/` | TypeScript + Next.js + Shadcn/Radix/Tailwind reference |
| `neon-postgres/` | Neon serverless Postgres reference (connection methods, auth, CLI, Platform API) |
| `clerk-nextjs-patterns/` | Advanced Clerk patterns — middleware, Server Actions, caching |

---

## RAG Pipeline

```
Upload
  └─ /api/documents/parse        ← extract text from file
  └─ /api/documents              ← save document, set status = pending
  └─ /api/workflows/ingest       ← send document/uploaded event to Inngest

Background (Inngest)
  └─ ingest-document function    ← retries: 3
       ├─ mark status = processing
       ├─ load per-user rag_settings (chunkSize, chunkOverlap)
       ├─ chunkText() → N overlapping segments
       ├─ generateEmbedding() × N  (batched, 20 per batch)
       ├─ DELETE existing chunks (idempotent)
       ├─ INSERT new chunks + embeddings (batched, 50 per insert)
       └─ mark status = ready  (or failed on error)

Chat query
  └─ synthesizeSearchQuery()     ← gpt-4o-mini rewrites follow-up as standalone query
  └─ generateEmbedding()         ← embed the synthesized query
  └─ Hybrid retrieval (single SQL CTE):
       ├─ vector_hits             ← pgvector cosine top-N (semantic)
       ├─ bm25_hits               ← ts_rank_cd on content_tsv (lexical, via GIN index)
       └─ RRF fusion              ← Σ 1 / (60 + rank_i)  → fused top 15 candidates
  └─ rerankChunks()              ← single gpt-4o-mini call scores all candidates
  └─ top-N chunks → LLM context  ← streamed response with source citations
```

**Hybrid search note:** `content_tsv` is a `tsvector GENERATED ALWAYS AS (to_tsvector('english', content)) STORED` column on `document_chunks`, kept in sync by Postgres. GIN index `chunks_content_tsv_idx` makes lookup constant-time. Vector and BM25 results are fused in-database via Reciprocal Rank Fusion (k=60) inside one query, so retrieval latency stays ~same as pure vector. See `0005_hybrid_search.sql`.

---

## RAG Evals (offline harness)

Lightweight CLI-only eval suite under `evals/`. Not wired into CI yet — invoked manually before/after pipeline changes to compare versions.

```
evals/
├── lib/
│   ├── env.mjs           ← loads .env.local, exposes DATABASE_URL/OPENAI_API_KEY/model names
│   ├── db.mjs            ← Neon serverless client
│   ├── openai.mjs        ← OpenAI client wrapped with 429-aware retry + backoff
│   ├── retrieve.mjs      ← mirrors src/lib/ai.ts: synthesizeSearchQuery → embed → vector search → rerank
│   ├── answer.mjs        ← mirrors src/app/api/chat/route.ts: gpt-4o w/ searchKnowledge tool, multi-step loop
│   └── judges.mjs        ← LLM-as-judge: contextPrecision, faithfulness, correctness; deterministic citation check
├── generate-golden.mjs   ← samples chunks, asks gpt-4o-mini to write Q&A whose answer is in chunk
├── run.mjs               ← runs eval over golden set with concurrency, writes timestamped JSON + MD
├── golden/golden-set.json      ← generated Q&A pairs (regen anytime; can be hand-curated)
└── runs/<timestamp>_<label>.{json,md}   ← per-run artifacts, committed for diffing
```

**Metrics:**
- Retrieval: `recall_at_k_reranked`, `recall_vector_at_5/10` (candidate pool), `recall_pure_vector_at_5/10` (diagnostic), `mrr_reranked`, `mrr_vector`, `mrr_pure_vector`, `context_precision`
- Answer (when `--no-answers` not set): `faithfulness`, `correctness`, `citation`, `avg_latency_ms`, `total_input/output_tokens`, `estimated_cost_usd`

**Run cycle:** `pnpm eval:generate` (once) → `pnpm eval:run -- --label baseline` → make changes → `pnpm eval:run -- --label <experiment>` → diff the two MD files.

### Run history (25 synthetic Q&A, 24 docs / 37 chunks)

| Run | Recall@5 rerank | MRR rerank | Ctx prec | Faith | Corr | Cite | Latency | Cost |
|---|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|
| `baseline` — pure vector, k=5, original prompt | 100% | 0.770 | 28.0% | 60% | 98% | 100% | 6.3 s | $0.247 |
| `hybrid-search` — + vector+BM25 RRF fusion | 100% | 0.737 | 28.8% | 64% | 100% | 100% | 7.3 s | $0.250 |
| `limit3-strict-prompt` — + k=3, strict grounding prompt | 100% | 0.731 | **31.2%** | 64% | 96% | 96% | **4.2 s** | **$0.202** |
| `cohere-rerank` — + Cohere Rerank 3.5 (vs gpt-4o-mini) | 100% | **0.860** | 28.8% | 64% | 96% | 96% | 4.4 s | $0.202 |

**Read of run 3:** Real wins — latency −33%, cost −18%, context precision +3.2pp. The strict grounding prompt only fixed 1 of 10 baseline faithfulness failures (q_12 ARR target). gpt-4o continues to fabricate specific numbers/specs even when told not to (q_6 interest rate, q_9 salary, q_11 expense, q_25 home-office specs). The remaining faithfulness ceiling appears to be a mix of (a) gpt-4o's training to be "helpful" by filling in plausible specifics and (b) the faithfulness judge being strict about paraphrased restatements.

**Read of run 4 (Cohere):** Reranker swap moved MRR from 0.731 → **0.860** (+18%). 6 questions now have the right chunk at rank #1 that previously sat at rank 2-4 (q_2, q_3, q_10, q_11, q_19, q_23). This is the largest single-change improvement so far. Recall@5 already at 100%, so that's unchanged; faithfulness/correctness unaffected because the right chunk was always *somewhere* in the top-K, just not first. The remaining MRR gap (1.0 − 0.86) is questions where Cohere correctly identified the right document but multiple chunks from that doc compete for top spot.

**Caveat:** the run used a Cohere trial key (10 RPM cap), which triggered ~2 graceful fallbacks to gpt-4o-mini mid-run. With a production key, MRR would likely be marginally higher.

**Next levers** if you want to push faithfulness above 64%: swap chat model (Claude Sonnet 4.6 with prompt caching is typically more obedient about grounding), or loosen the faithfulness judge to flag only contradictions, not paraphrasing.

### Reranker

`rerankChunks` in `src/lib/ai.ts` and `evals/lib/retrieve.mjs` use Cohere Rerank 3.5 when `COHERE_API_KEY` is set, otherwise fall back to a gpt-4o-mini scoring call. The Cohere path is now the default in production.

### Open RAG Benchmark (external, human-written)

To complement the small synthetic set above, the pipeline is also evaluated against **Vectara's Open RAG Benchmark** (`vectara/open_ragbench` on Hugging Face) — 1,000 arXiv papers (400 with Q&A + 600 hard negatives) and 3,045 expert-written question–answer pairs spanning text, tables, and figures.

```
evals/benchmarks/open-ragbench/
├── data/                         ← BEIR files from HF (gitignored, ~743 MB)
├── download.mjs                  ← idempotent fetcher (queries/qrels/answers + corpus)
├── ingest.mjs                    ← bulk-load corpus into Neon; chunks tag `section_id` in metadata
├── import-golden.mjs             ← convert benchmark Q&A → golden-set.json (stratified sampling)
├── run.mjs                       ← wrapper around evals/run.mjs (benchmark-targeted defaults)
├── report.mjs                    ← generate shareable REPORT.md from latest run
├── golden/golden-set.json        ← imported questions with `expected_section_id` ground truth
├── runs/<timestamp>_<label>.{json,md}
└── REPORT.md                     ← human-readable effectiveness summary (committed)
```

**Ground-truth matching:** the benchmark labels each query with `(doc_id, section_id)`. Our chunker splits a section into N chunks, so we tag every chunk's `metadata.section_id` at ingest time. `evals/run.mjs` then scores a hit when any retrieved chunk's `(documentId, section_id)` matches the expected pair. The synthetic chunk-level matching path is preserved for backward compatibility.

**Tenant isolation:** benchmark docs live under `OPEN_RAGBENCH_USER_ID` (separate from the regular eval user) so the existing 25-question baselines remain comparable.

**Run cycle:**
```
pnpm eval:ragbench:download        # ~743 MB to evals/benchmarks/open-ragbench/data/
pnpm eval:ragbench:ingest          # ~3–5 min, ~$5 in embeddings
pnpm eval:ragbench:golden -- --sample 2000
pnpm eval:ragbench:run -- --label ragbench-baseline --concurrency 4
pnpm eval:ragbench:report          # writes REPORT.md
```

The run output includes two extra breakdown tables — by modality (`text` / `text-image` / `text-table` / `text-table-image`) and by query type (`extractive` / `abstractive`) — so we can see exactly where the pipeline weakens on mixed-modality content.

---

## Telegram → PR Bot

A dev-only side channel for issuing code-change requests over Telegram. Not user-facing. Task state is persisted to a `telegram_tasks` table in Neon so a single conversation can move through `awaiting_clarification → awaiting_plan_approval → awaiting_code_approval → done` across multiple workflow runs.

```
Telegram message
  └─ POST /api/telegram/webhook                     ← verify x-telegram-bot-api-secret-token
       ├─ check chat.id ∈ allowlist                  ← TELEGRAM_CHAT_ID
       ├─ classifyMessage() (lib/telegram-classifier) → plan | code | pr
       └─ POST .../dispatches with one of:
            • event_type: plan-task                  ← new request or revise-plan
            • event_type: code-task                  ← user approved a plan
            • event_type: pr-task                    ← user approved the diff

GitHub Actions — three workflows, one per event_type:

.github/workflows/telegram-plan.yml          (on: repository_dispatch [plan-task])
  └─ Claude Code `Plan` subagent  → plan.md  (or questions.md)
       • read-only software-architect persona; tools: Read/Grep/Glob
       • first line is `# PLAN` or `# QUESTIONS` — routes the next step
  └─ telegram-save-plan.mjs / telegram-save-questions.mjs
       → Neon row updated, Telegram message sent with Approve / Revise / Cancel

.github/workflows/telegram-code.yml          (on: repository_dispatch [code-task])
  └─ telegram-load-task-branch.mjs           ← pulls approved plan from Neon, picks branch
  └─ coder skill                             ← writes the diff
  └─ git commit + push (or telegram-no-changes.mjs if empty)
  └─ telegram-save-diff.mjs                  ← Neon updated, diff summary sent with
                                               Approve & open PR / Revise / Cancel

.github/workflows/telegram-pr.yml            (on: repository_dispatch [pr-task])
  └─ telegram-open-pr.mjs                    ← gh pr create --base dev, save URL,
                                               mark task done, notify Telegram
```

**Env vars** (all optional in the Next.js app; webhook returns 503 if missing):
`TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID`, `TELEGRAM_WEBHOOK_SECRET`, `GITHUB_PAT`, `GITHUB_REPO`, `DATABASE_URL` (the workflows themselves read/write `telegram_tasks` via `DATABASE_URL`).

**GitHub secrets:** `ANTHROPIC_API_KEY`, `TELEGRAM_BOT_TOKEN`, `DATABASE_URL`, plus a PAT with PR-create rights for `telegram-pr.yml`.

**Security boundaries:**
- Telegram webhook secret + `chat.id` allowlist — both must match.
- Fine-grained PAT scoped to a single repo with `Contents: RW` only.
- Actions can push to task branches but never to `main` or `dev`; PRs require human review.

---

## Security Model

| Layer | Mechanism |
|---|---|
| Authentication | Clerk `auth()` — every route returns 401 if no valid session |
| Authorisation | All DB queries include `userId` predicate — no row is accessible across tenants |
| Rate limiting (chat) | Arcjet token bucket — sustained throughput limit per user |
| Rate limiting (uploads) | Arcjet fixed window — 50 uploads per user per day |
| Bot detection | Arcjet `detectBot` — blocks automated clients on the chat endpoint |
| Prompt injection | Arcjet shield on chat endpoint |
| Audit trail | `audit_logs` captures every upload, delete, and chat message with IP + user agent |
| Env validation | Zod schema at startup — missing or malformed secrets abort the server before serving traffic |

---

## TODO — Gaps & Incomplete Items

These are things that are either missing, partially wired, or need attention before the app is fully production-ready. Unlike the Roadmap (which is new features), this section tracks what should already work but doesn't yet.

---

### Configuration — Not Yet Done

| Item | Status | What's missing / done |
|---|---|---|
| **Inngest keys not set** | ✅ Fixed | Startup warning in `instrumentation.ts` names missing keys and explains the inline fallback. `.env.local.example` marks keys as required for production and documents the `VERCEL_AUTOMATION_BYPASS_SECRET` Deployment Protection step. |
| **`NEXT_PUBLIC_APP_URL` not set in production** | ✅ Fixed | `ChatActions` now accepts `appUrl` from the server component and uses `env.NEXT_PUBLIC_APP_URL` to build the canonical share URL. No more `window.location.origin`. |
| **No `.env.local.example` reference in README** | ✅ Fixed | README now has a complete getting-started section with `cp .env.local.example .env.local` and a step-by-step environment table. |

---

### Features — Partially Built

| Item | Status | Notes |
|---|---|---|
| **Share links** | ✅ Fixed | `ChatActions` now uses the server-provided `appUrl` (from `env.NEXT_PUBLIC_APP_URL`) instead of `window.location.origin`. |
| **Document re-index** | ✅ Done | `ReindexDocumentButton` added to document detail page. Calls `POST /api/workflows/ingest` and shows a toast on success/failure. |
| **Ingestion fallback** | ✅ Fixed | Inline fallback now races against a 55 s timeout. Returns `202` with a descriptive error when the document is too large for inline processing, instead of silently timing out. |

---

### Missing Polish

| Item | Status | Notes |
|---|---|---|
| **Empty state — new user** | ✅ Done | `ChatInterface` now accepts `hasDocuments` prop. When false and the chat is empty, an onboarding card with an Upload CTA is shown instead of the suggested-questions grid. |
| **Empty state — no search results** | ✅ Done | Document list already shows a "No documents match your filters" card; AI response already explains when no chunks are found. |
| **Error boundary** | ✅ Done | `error.tsx` added to `dashboard/`, `dashboard/chat/`, and `dashboard/documents/` with branded recovery UI. |
| **Loading skeletons** | ✅ Done | `loading.tsx` added to `dashboard/`, `dashboard/documents/`, `dashboard/chat/`, and `dashboard/settings/`. |
| **Mobile — document detail** | ✅ Done | Improved responsive padding, font sizes, and `break-words` on content/chunks for small screens. |
| **Toast notifications** | ✅ Done | `toast.tsx`, `toaster.tsx`, and `use-toast` hook added. `<Toaster>` mounted in root layout. Re-index button uses toasts; hook available app-wide. |

---

### Security & Compliance Gaps

| Item | Status | Notes |
|---|---|---|
| **No CSRF protection on API routes** | ✅ Done | `lib/csrf.ts` implements `isCsrfSafe()` (Origin header validation). Applied to `POST /api/chat`, `POST /api/documents`, and `POST /api/workflows/ingest`. |
| **File content not sanitised** | ✅ Done | `sanitizeText()` added to `lib/utils.ts`. Called in `app/workflows/ingest.ts` before chunking — strips null bytes and non-printable control chars. |
| **Audit log not queryable** | ✅ Done | Activity tab added to Settings page. Fetches the user's 50 most recent audit log entries server-side and renders them with action icons, resource labels, timestamps, and IP addresses. |
| **Rate limit keys not namespaced** | ✅ Done | `proxy.ts` (middleware) already applies IP-based Arcjet rate limiting (100 req/min per IP) before Clerk auth — covers unauthenticated probing. Route-level clients use userId. |

---

### Developer Experience

| Item | Status | Notes |
|---|---|---|
| **No tests** | Open | Zero test coverage — excluded from this sprint. |
| **No local Inngest dev server docs** | ✅ Done | README now documents `npx inngest-cli@latest dev` with a full explanation of how it connects to the Next.js app. |
| **`scripts/migrate.mjs` is a raw-SQL duplicate** | ✅ Done | Removed. `db-migrate.mjs` is the canonical migration runner. |

---

## Roadmap

### Near Term
- [x] **Shareable chat links UI** — Share popover in `ChatActions` with generate/revoke/copy; URL uses canonical `NEXT_PUBLIC_APP_URL`
- [ ] **Suggested starter questions** — auto-generate 3 questions from uploaded docs on empty chat state
- [x] **Chat export** — download conversation as Markdown or print/save as PDF with styled formatting
- [x] **Re-index document** — `ReindexDocumentButton` added to document detail page

### Medium Term
- [x] **Document collections / folders** — group documents by project or team
- [ ] **Hybrid search** — combine pgvector cosine similarity with Postgres `tsvector` full-text (BM25)
- [ ] **Usage analytics page** — charts for query volume, top documents, active sessions over time
- [ ] **API access** — REST endpoint so external tools can query the knowledge base

### Longer Term
- [ ] **Team workspaces** — multiple users sharing one knowledge base with RBAC
- [ ] **Slack bot integration** — answer questions directly from Slack via webhook
- [ ] **Google Drive / Notion sync** — auto-ingest from external sources
- [ ] **E2E tests** — Playwright suite for upload → ingest → chat → share flow

### Tooling / DX
- [x] **Telegram → PR bot** — message the bot, Claude Code runs in GitHub Actions and opens a PR. See "Telegram → PR Bot" section above.
