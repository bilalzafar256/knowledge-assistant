---
name: inngest-ingestion
description: The background document-ingestion pipeline for this repo — Inngest job with retries, the inline 55s fallback, and the pending→processing→ready/failed state machine. Use when changing ingestion or document status.
---

# Inngest ingestion (this repo)

## When to use
Editing the ingestion job, document status transitions, or the chunk/embed/upsert flow.

## Flow
- `POST /api/documents` saves the doc (`status: pending`) → `POST /api/workflows/ingest` sends a `document/uploaded` Inngest event.
- `src/inngest/ingest-document.ts` (retries: 3) drives status `processing → ready|failed` and calls `ingestDocument()`.
- `ingestDocument()` (`src/app/workflows/ingest.ts`): load per-user `rag_settings` (chunkSize/overlap) → `sanitizeText()` → `chunkText()` → **batched embeddings (20/batch)** → idempotent **delete + re-insert** chunks (50/insert).
- **Inline fallback:** if Inngest keys are unset, ingestion runs inline racing a **55 s timeout**.
- The UI polls `GET /api/documents/[id]/status` until `ready`.

## Rules
- On failure: set `status: failed` + `errorMessage`, then **re-throw** so Inngest retries.
- Re-indexing reuses the same pipeline (idempotent delete-then-insert) via the re-index button.

## Anchors
- `src/inngest/ingest-document.ts`, `src/app/workflows/ingest.ts`
- `src/lib/inngest.ts` (client + `document/uploaded` event type), `src/app/api/inngest/route.ts` (serve handler)

## Local dev
`npx inngest-cli@latest dev` → dev server at `http://localhost:8288`, auto-discovers `/api/inngest`.
