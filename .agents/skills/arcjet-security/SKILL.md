---
name: arcjet-security
description: The security chain for this repo — per-surface Arcjet clients, shield/bot/rate-limits, and the CSRF Origin check on mutating routes. Use when adding a route handler or changing rate limits.
---

# Arcjet + CSRF security chain (this repo)

## When to use
Any new/changed route handler, or tuning rate limits / bot rules.

## The chain (every route honors it)
1. Middleware (`src/proxy.ts`) runs Clerk auth + Arcjet on all routes (base `aj`: shield + bot detection + 100/min per IP, before auth).
2. The handler re-checks `auth()` (see `clerk-auth`) **and** calls the appropriate Arcjet client's `.protect()` again at route level.
3. Mutating POST routes also call `isCsrfSafe()` (`src/lib/csrf.ts`, Origin validation) before any logic.

## Per-surface clients (`src/lib/arcjet.ts`)
- `chatAj` — 20/min token bucket, keyed by `userId` (chat).
- `uploadAj` — 50/hr + 200/day per user (uploads).
- `aj` — base shield/bot client used by middleware.

## Anchors
- `src/lib/arcjet.ts`, `src/lib/csrf.ts`, `src/proxy.ts`
- CSRF-guarded routes: `/api/chat`, `/api/documents`, `/api/workflows/ingest`

## Gotchas
- `sanitizeText()` strips null bytes/control chars from ingested content — keep it in the ingest path to mitigate indirect prompt injection.
- Pick the client that matches the surface; don't reuse `chatAj` for uploads.
