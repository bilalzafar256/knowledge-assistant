<div align="center">

# 🧠 Company Knowledge Assistant

### Upload your documents. Ask anything. Get answers grounded in **your** content — with citations, never invented.

A production-grade **RAG** application built on the 2026 Vercel stack. It retrieves the most relevant passages from your knowledge base via **hybrid search** (vector + keyword), reranks them, and answers with citations — grounded strictly in your documents.

<br/>

![Next.js 16](https://img.shields.io/badge/Next.js-16-000000?logo=nextdotjs&logoColor=white)
![React 19](https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=black)
![TypeScript](https://img.shields.io/badge/TypeScript-5.8-3178C6?logo=typescript&logoColor=white)
![Vercel AI SDK v6](https://img.shields.io/badge/Vercel%20AI%20SDK-v6-000000?logo=vercel&logoColor=white)
![Anthropic Claude](https://img.shields.io/badge/Claude-sonnet--4--6%20%C2%B7%20haiku--4--5-D97757?logo=anthropic&logoColor=white)
![Google Gemini Embeddings](https://img.shields.io/badge/Gemini-embeddings%201536d-4285F4?logo=google&logoColor=white)
![Neon Postgres](https://img.shields.io/badge/Neon-Postgres-00E599?logo=postgresql&logoColor=white)
![pgvector](https://img.shields.io/badge/pgvector-1536d-4169E1)
![Drizzle ORM](https://img.shields.io/badge/Drizzle-ORM-C5F74F?logo=drizzle&logoColor=black)
![Clerk](https://img.shields.io/badge/Clerk-Auth-6C47FF?logo=clerk&logoColor=white)
![Arcjet](https://img.shields.io/badge/Arcjet-Security-FF5A1F)
![Inngest](https://img.shields.io/badge/Inngest-Jobs-000000?logo=inngest&logoColor=white)
![Tailwind v4](https://img.shields.io/badge/Tailwind-v4-06B6D4?logo=tailwindcss&logoColor=white)
![pnpm](https://img.shields.io/badge/pnpm-10-F69220?logo=pnpm&logoColor=white)

</div>

---

## ✨ Overview

The Knowledge Assistant lets a team upload its internal documents and query them in natural language. Instead of guessing, the assistant **retrieves** the passages most relevant to each question and answers **only** from that evidence — the system prompt forbids it from inventing numbers, dates, or names that aren't in the retrieved chunks. Every answer is streamed with citations back to its source.

### Features

- **Grounded RAG chat** — streams cited answers; the system prompt forbids inventing numbers, dates, or names not present in retrieved chunks.
- **Hybrid retrieval** — pgvector cosine + Postgres full-text (BM25-style) fused with Reciprocal Rank Fusion, then reranked.
- **Conversation-aware search** — follow-up questions are rewritten into standalone queries using chat history.
- **Multi-format ingestion** — PDF, DOC/DOCX, XLS/XLSX, JPG/PNG (OCR via Claude Sonnet vision), TXT, MD, JSON (up to 50 MB).
- **Chat sessions** — multiple threads with full history, auto-titling, pin, inline rename, and public read-only share links.
- **Cost tracking** — every query's full-pipeline LLM spend (synthesis + embedding + rerank + answer) is priced, persisted per message, and shown as a live per-session total in chat plus total/top-spender breakdowns on the dashboard.
- **Collections** — group documents into folders.
- **Background ingestion** — large docs index in an Inngest job with a `pending → processing → ready/failed` status the UI polls.
- **Per-user RAG settings** — tunable chunk size and overlap.
- **Tenant isolation** — every query is scoped by `userId`.
- **Security-first routes** — Clerk auth + Arcjet (shield, bot detection, rate limits) + CSRF on every mutating route, with an audit log of key actions.
- **Observability** — structured logs and AI-call traces to Axiom (console fallback in dev).

---

## 🧰 Tech Stack at a Glance

The badges above are the quick glance; the table is the detail.

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 16 (App Router, React 19, TypeScript) |
| AI | Vercel AI SDK v6 (streaming, tool calls, `UIMessage` protocol) |
| Models | Anthropic Claude — sonnet-4-6 (chat + image OCR), haiku-4-5 (query synthesis + rerank fallback) · Google gemini-embedding-001 (1536-d, embeddings) |
| Reranker | Cohere Rerank 3.5 (optional; falls back to claude-haiku-4-5) |
| Database | Neon (Postgres + pgvector) via Drizzle ORM |
| Auth | Clerk |
| Security | Arcjet (shield, bot detection, rate limiting) + Origin-based CSRF checks |
| Ingestion | Inngest (event-driven queue with retries; inline fallback) |
| UI | shadcn/ui + Tailwind CSS v4 |
| Observability | Axiom (logs + OpenTelemetry traces) |
| Package manager | pnpm |

---

## 🚀 Getting Started

### Prerequisites

- Node.js 20+ and pnpm (`npm install -g pnpm`)
- A [Neon](https://neon.tech) Postgres database
- A [Clerk](https://clerk.com) application
- An [Arcjet](https://arcjet.com) site
- An [Anthropic](https://console.anthropic.com) API key (chat, parsing, synthesis, rerank)
- A [Google AI Studio](https://aistudio.google.com/apikey) API key (embeddings — free tier; also powers the eval judge)

### 1. Install

```bash
pnpm install
```

### 2. Configure environment

```bash
cp .env.local.example .env.local
```

Fill in the required values:

| Variable | Required | Where to get it |
|----------|----------|----------------|
| `DATABASE_URL` | ✅ | Neon → Connection String (include `?sslmode=require`) |
| `ANTHROPIC_API_KEY` | ✅ | console.anthropic.com/settings/keys (`sk-ant-…`) |
| `GOOGLE_GENERATIVE_AI_API_KEY` | ✅ | aistudio.google.com/apikey (`AIza…`, embeddings) |
| `OPENAI_API_KEY` | optional | platform.openai.com/api-keys — retained only as an embedding fallback; **not required** (generation runs on Claude, embeddings + eval judge on Gemini) |
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | ✅ | Clerk Dashboard → API Keys (`pk_…`) |
| `CLERK_SECRET_KEY` | ✅ | Clerk Dashboard → API Keys (`sk_…`) |
| `ARCJET_KEY` | ✅ | app.arcjet.com → Sites → API Keys (`ajkey_…`) |
| `NEXT_PUBLIC_APP_URL` | ✅ | App origin (used to build share links); `http://localhost:3000` in dev |
| `COHERE_API_KEY` | optional | dashboard.cohere.com — enables Cohere reranking |
| `INNGEST_EVENT_KEY` / `INNGEST_SIGNING_KEY` | prod | app.inngest.com → App → Keys (without them, ingestion runs inline) |
| `AXIOM_TOKEN` / `AXIOM_DATASET` | optional | axiom.co — logs/traces (console fallback if unset) |
| `OPEN_RAGBENCH_USER_ID` | eval | Isolation label for the Open RAG Benchmark corpus (defaults to `user_open_ragbench_eval`) |
| `TELEGRAM_*` / `GITHUB_PAT` / `GITHUB_REPO` | optional | Dev-only Telegram → PR bot (see below) |

Env vars are validated by Zod at startup (`src/lib/env.ts`) — a missing or malformed required var aborts the server with a clear message.

### 3. Set up the database

```bash
pnpm db:migrate
```

This runs `scripts/db-migrate.mjs`, applying every file in `drizzle/` in order and recording them in `drizzle.__drizzle_migrations`. The initial migration enables the `vector` extension and creates all tables plus the pgvector `ivfflat` index — no manual SQL needed for a fresh Neon database.

> Do **not** use `pnpm db:push` (deprecated — it bypasses migration history). To change the schema, edit `src/lib/schema.ts`, run `pnpm db:generate`, then `pnpm db:migrate`.

### 4. Run

```bash
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000).

### 5. (Optional) Inngest dev server for background jobs

Without Inngest keys, ingestion runs inline in the API request (races a 55 s timeout). To process documents in the background with retries locally:

```bash
npx inngest-cli@latest dev
```

This starts the Inngest dev server at `http://localhost:8288` and auto-discovers your app at `http://localhost:3000/api/inngest`. Set `INNGEST_EVENT_KEY` / `INNGEST_SIGNING_KEY` to connect to Inngest Cloud instead.

---

## 🏛️ Architecture

- **[`SYSTEM_ARCHITECTURE.md`](./SYSTEM_ARCHITECTURE.md)** — system topology + runtime Mermaid diagrams, the directory blueprint, and core-subsystem deep dives.
- **[`PROJECT_PLAN.md`](./PROJECT_PLAN.md)** — the authoritative architecture reference: full schema, migration manifest, API table, security model, and conventions.

---

## 🔎 How Retrieval Works

On each chat turn (`src/lib/ai.ts` → `createSearchKnowledgeTool`):

1. **Query synthesis** — claude-haiku-4-5 rewrites the latest message into a standalone search query using recent history (falls back to the raw query on error).
2. **Embed** — the query is embedded with Google gemini-embedding-001 (1536-d, `RETRIEVAL_QUERY` task type).
3. **Hybrid search** — one SQL CTE runs pgvector cosine similarity and Postgres `tsvector` lexical ranking in parallel, then fuses them with **Reciprocal Rank Fusion** (k=60) into ~15 candidates. See `drizzle/0005_hybrid_search.sql`.
4. **Rerank** — Cohere Rerank 3.5 (if `COHERE_API_KEY` is set) or a claude-haiku-4-5 scoring call trims to the top ~3.
5. **Answer** — claude-sonnet-4-6 streams a grounded, cited response.

Query synthesis and reranking both **degrade gracefully** — any failure falls back so the chat never breaks.

---

## 📊 RAG Evals

The pipeline is evaluated against **Vectara's Open RAG Benchmark** (1,000 arXiv papers, 3,045 expert Q&A pairs spanning text, tables, and figures). Because the ground truth is public, results are comparable to other RAG systems. The harness in `evals/` mirrors production retrieval/answer logic (Claude Sonnet answers, Gemini embeddings) and grades with a **cross-family judge** (`gemini-2.5-flash`, a different model family than the generator, to avoid self-preference bias). It reports Recall@k, MRR, context precision, faithfulness, correctness, citation accuracy, latency, and token cost — broken down by modality and question type. Runs are committed under `evals/benchmarks/open-ragbench/runs/`. Launch thresholds and current status: **`docs/GO_LIVE_READINESS.md`**. See `PROJECT_PLAN.md` → "RAG Evals" for details.

---

## 📈 Observability

Logs, traces, and uncaught errors ship to [Axiom](https://axiom.co); without `AXIOM_TOKEN` everything falls back to `console`, so local dev needs no signup.

- Every API request (method, path, status, duration, userId) via `withAxiom`.
- Chat completions (token usage, finish reason) via `logger.info("chat.completion", …)`.
- `streamText` calls as OpenTelemetry spans (model, latency, tokens). **Prompts and completions are never recorded** (`recordInputs/Outputs: false`).
- Route Handler / Server Component errors via `onRequestError` in `src/instrumentation.ts`.

To add logging in a new route: import `{ logger, withAxiom }` from `@/lib/axiom/server`, wrap the handler with `withAxiom`, and call `logger.info("event.name", { … })`.

---

## 🔐 Security Model

- **Auth** — every API route checks Clerk `auth()` and returns 401 if unauthenticated.
- **Tenant isolation** — every DB query filters on `userId`; users can never read another tenant's rows.
- **Arcjet** — shield + bot detection on all routes; chat limited to 20 req/min/user, uploads to 50/hr + 200/day per user, and 100 req/min/IP at the middleware layer.
- **CSRF** — mutating routes validate the `Origin` header via `isCsrfSafe()`.
- **Content sanitization** — extracted document text is stripped of null bytes and control chars before chunking (mitigates indirect prompt injection).
- **Audit log** — uploads, deletes, and chat messages are recorded with IP and user-agent.
- **Env validation** — Zod aborts startup on missing/invalid secrets.

---

## 🤖 Telegram → PR Bot (optional, dev-only)

Message a Telegram bot and a PR appears on GitHub. `POST /api/telegram/webhook` (verifies a shared secret + chat-id allowlist) classifies the message and fires a `repository_dispatch` that drives GitHub Actions workflows — plan → code → PR — persisting state in a `telegram_tasks` table. The Actions can push task branches and open PRs into `dev` but never push to `main`/`dev`. The webhook returns `503` when its env vars are unset, so the rest of the app works without it. Full flow and setup in `PROJECT_PLAN.md`.

---

## 🛠️ Scripts

| Command | Description |
|---------|-------------|
| `pnpm dev` | Dev server (Turbopack) |
| `pnpm build` / `pnpm start` | Production build / serve |
| `pnpm lint` | ESLint |
| `pnpm type-check` | `tsc --noEmit` |
| `pnpm db:generate` | Generate a Drizzle migration from schema changes |
| `pnpm db:migrate` | Apply pending migrations to Neon |
| `pnpm db:studio` | Drizzle Studio GUI |
| `pnpm eval:ragbench:download` | Download Vectara Open RAG Benchmark (~743 MB) |
| `pnpm eval:ragbench:ingest` | Bulk-load the benchmark corpus into Neon |
| `pnpm eval:ragbench:golden -- --sample 2000` | Build a stratified golden set |
| `pnpm eval:ragbench:run -- --label baseline` | Run the eval against the benchmark |
| `pnpm eval:ragbench:report` | Render `REPORT.md` from the latest run |

> There is **no unit test suite**. Verify changes with `pnpm type-check` + `pnpm lint`, and measure retrieval/answer quality with the eval harness.

---

## ☁️ Deployment

Deploy to Vercel. Set every required env var from `.env.local.example` in your project settings; `DATABASE_URL` must point to your Neon string with `?sslmode=require`. For background ingestion in production, set the Inngest keys and (if Vercel Deployment Protection is on) `VERCEL_AUTOMATION_BYPASS_SECRET`.
