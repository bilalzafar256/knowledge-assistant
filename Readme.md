# Company Knowledge Assistant

A production-grade AI assistant that answers questions from your company's internal knowledge base. Upload documents, and the assistant retrieves relevant context via vector search to give accurate, cited answers.

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 16+ (App Router, TypeScript) |
| AI | Vercel AI SDK v6 (streaming, tools, RAG) |
| Database | Neon (Postgres + pgvector) via Drizzle ORM |
| Auth | Clerk (RBAC) |
| Security | Arcjet (rate limiting, bot detection, prompt injection shield) |
| UI | shadcn/ui + Tailwind CSS v4 |
| Package Manager | pnpm |

## Features

- **RAG-powered chat** — streams answers with citations from uploaded documents
- **Chat sessions** — multiple independent conversations with full history, like ChatGPT
- **Pinned conversations** — pin important chats to the top of the sidebar; pin/unpin with one click
- **Conversation export** — download as Markdown or print/save as PDF with styled formatting
- **Shared conversation links** — generate a public read-only URL; revoke sharing at any time
- **Usage dashboard** — 4 stat cards: Documents, Knowledge Chunks, Conversations, Messages Sent
- **Bulk document upload** — drag multiple files at once; each file parses in parallel with per-file status chips; editable title per file before indexing
- **Document search & filter** — live title search, file-type group filter pills with count badges, and sort (Newest, Oldest, A→Z, Z→A, Largest)
- **Tenant isolation** — all DB queries are scoped by `userId`; users only see their own data
- **Security-first API routes** — every route chains Clerk auth + Arcjet protection (shield + bot detection + 10/hr token bucket + 50/day fixed window)
- **Background ingestion (Inngest)** — large documents are indexed in a background job; `status` badge shows `Pending → Indexing → Indexed` in the document list; UI polls until complete
- **Vercel Analytics + Speed Insights** — zero-config page view and Web Vitals tracking
- **Audit log** — every document upload/delete is recorded in `audit_logs` with `userId`, action, resource, IP, and user-agent
- **Responsive dashboard** — works on mobile and desktop with a collapsible sidebar nav
- **Inline session rename** — hover to rename any conversation with Enter/Escape support
- **Keyboard shortcuts** — `⌘K` new chat, `⌘↵` send message, `Escape` dismiss confirmations

## Project Structure

```
src/
├── app/
│   ├── (auth)/                    # Clerk sign-in / sign-up pages
│   ├── share/[shareId]/           # Public read-only shared conversation page
│   ├── api/
│   │   ├── chat/
│   │   │   ├── route.ts           # POST — streaming RAG chat (persists messages)
│   │   │   └── sessions/
│   │   │       ├── route.ts       # GET/POST — list and create chat sessions
│   │   │       └── [id]/
│   │   │           ├── route.ts   # GET/DELETE/PATCH — session CRUD (title, pinned)
│   │   │           └── share/route.ts  # POST/DELETE — generate/revoke share link
│   │   ├── inngest/route.ts           # Inngest serve handler (GET/POST/PUT)
│   │   ├── documents/
│   │   │   ├── route.ts           # GET/POST — list and create documents
│   │   │   ├── [id]/route.ts      # DELETE — single document
│   │   │   └── parse/route.ts     # POST — server-side file text extraction
│   │   └── workflows/ingest/      # POST — document chunking + embedding pipeline
│   ├── dashboard/
│   │   ├── chat/
│   │   │   ├── layout.tsx         # Chat layout with sessions sidebar
│   │   │   ├── page.tsx           # Empty state / mobile sessions list
│   │   │   └── [sessionId]/       # Per-session chat page with history
│   │   ├── documents/
│   │   │   ├── page.tsx           # Document library
│   │   │   ├── upload/            # Upload form
│   │   │   └── [id]/              # Document + chunks viewer
│   │   ├── settings/              # Profile & account settings
│   │   ├── layout.tsx             # Dashboard shell (auth, sidebar)
│   │   └── page.tsx               # Overview with stats
│   └── page.tsx                   # Landing page
├── components/
│   ├── ui/                        # shadcn/ui primitives
│   ├── chat-actions.tsx           # Export (Markdown/PDF) + share popover
│   ├── document-list.tsx          # Search, filter pills, sort, ingestion status badge
│   ├── chat-interface.tsx         # Chat UI (streaming, sources, optimistic)
│   ├── chat-sessions-sidebar.tsx  # Sessions list with rename/pin/delete/Cmd+K
│   ├── dashboard-shell.tsx        # Mobile-responsive layout shell
│   ├── delete-document-button.tsx # Inline confirm with Escape support
│   ├── document-list.tsx          # Search, filter pills, sort dropdown
│   ├── document-upload.tsx        # Multi-format file upload
│   └── sidebar-nav.tsx            # Primary navigation
└── lib/
    ├── ai.ts             # OpenAI client, system prompt, RAG tool
    ├── arcjet.ts         # Arcjet clients (chat, upload: token bucket + fixed window)
    ├── audit.ts          # logAudit() — fire-and-forget audit log writer
    ├── db.ts             # Neon + Drizzle client (lazy-initialized)
    ├── inngest.ts        # Inngest client + event type definitions
    ├── schema.ts         # documents (+ status), document_chunks, chat_sessions, chat_messages, audit_logs
    └── utils.ts          # cn(), timeAgo(), formatFileSize(), truncate()
```

## Getting Started

### 1. Prerequisites

- Node.js 20+
- pnpm (`npm install -g pnpm`)
- A [Neon](https://neon.tech) database with pgvector enabled
- A [Clerk](https://clerk.com) application
- An [Arcjet](https://arcjet.com) site
- An [OpenAI](https://platform.openai.com) API key

### 2. Install dependencies

```bash
pnpm install
```

### 3. Configure environment variables

```bash
cp .env.local.example .env.local
```

Fill in all values in `.env.local`:

| Variable | Where to get it |
|----------|----------------|
| `DATABASE_URL` | Neon → Project Settings → Connection String |
| `OPENAI_API_KEY` | platform.openai.com/api-keys |
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | Clerk Dashboard → API Keys |
| `CLERK_SECRET_KEY` | Clerk Dashboard → API Keys |
| `ARCJET_KEY` | app.arcjet.com → Sites → API Keys |
| `INNGEST_EVENT_KEY` | app.inngest.com → App → Keys |
| `INNGEST_SIGNING_KEY` | app.inngest.com → App → Keys |

### 4. Set up the database

Apply all migrations against your Neon connection string:

```bash
pnpm db:migrate
```

This runs `scripts/db-migrate.mjs`, which applies every file in `drizzle/` in order and records them in `drizzle.__drizzle_migrations`. The initial migration creates the `vector` extension, all tables, and the ivfflat index on `document_chunks.embedding` — no manual SQL is required for a fresh Neon database.

Do not use `pnpm db:push` (deprecated — it bypasses the migration history).

### 5. Run the development server

```bash
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000).

### 6. (Optional) Run the Inngest dev server for background jobs

Inngest handles long-running document ingestion. Without it, ingestion runs inline (blocking, 55 s timeout). To enable retries and background processing locally:

```bash
npx inngest-cli@latest dev
```

This starts the Inngest dev server at `http://localhost:8288`. It auto-discovers your Next.js app at `http://localhost:3000/api/inngest`. You can watch job progress and replay failed events from the Inngest dashboard at that URL.

Set `INNGEST_EVENT_KEY` and `INNGEST_SIGNING_KEY` in `.env.local` to connect to the Inngest cloud dashboard instead.

## Available Scripts

| Command | Description |
|---------|-------------|
| `pnpm dev` | Start dev server with Turbopack |
| `pnpm build` | Production build |
| `pnpm start` | Start production server |
| `pnpm lint` | Run ESLint |
| `pnpm type-check` | Run TypeScript compiler check |
| `pnpm db:generate` | Generate Drizzle migration files |
| `pnpm db:migrate` | Apply pending migrations to Neon |
| `pnpm db:studio` | Open Drizzle Studio (DB GUI) |
| `npx inngest-cli@latest dev` | Start Inngest local dev server (background jobs) |

## Deployment

Deploy to Vercel with one click. Set all environment variables from `.env.local.example` in your Vercel project settings. `DATABASE_URL` must point to your Neon connection string with `?sslmode=require`.

## Security Model

- **Authentication**: Every API route calls `auth()` from Clerk and returns `401` if the user is not signed in.
- **Rate limiting**: The chat endpoint enforces 20 requests/minute per user via Arcjet token bucket.
- **Prompt injection**: Arcjet shield mode is active on all routes to detect and block injection attempts.
- **Tenant isolation**: All database queries include a `userId` filter — users cannot access each other's documents or chunks.
