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
| UI | shadcn/ui + Tailwind CSS v4 |
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
| `drizzle/0000_petite_mockingbird.sql` | Full initial schema (all core tables + ivfflat index) |
| `drizzle/0001_complex_queen_noir.sql` | Adds `rag_settings` table |
| `drizzle/0002_collections.sql` | Adds `collections` table + `collection_id` FK on `documents` |
| `scripts/db-migrate.mjs` | Runs pending Drizzle migrations against Neon |
| `scripts/db-baseline.mjs` | Brownfield helper — registers existing SQL files without re-running them. Do not run on a fresh empty DB. |

> **Note — pgvector prerequisite:** `0000_petite_mockingbird.sql` uses `vector(1536)` but does not `CREATE EXTENSION vector`. On any fresh Neon branch, run `CREATE EXTENSION IF NOT EXISTS vector;` before `pnpm db:migrate`, or the first migration will fail. See README §4.

**Last full rebuild:** 2026-05-20 — schema dropped and rebuilt against a new Neon instance after the previous database was deleted. All three migrations applied via `pnpm db:migrate`; pgvector v0.8.0 enabled manually beforehand.

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

---

## Pages

| Route | Type | Description |
|---|---|---|
| `/` | Server | Landing page — hero, 6 feature cards, CTA |
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
  └─ pgvector cosine search      ← fetch 3× candidates (max 15)
  └─ rerankChunks()              ← single gpt-4o-mini call scores all candidates
  └─ top-N chunks → LLM context  ← streamed response with source citations
```

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
