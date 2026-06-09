---
name: nextjs-app-router
description: Next.js 16 App Router conventions for this repo — RSC by default, client islands, route handlers, and the proxy.ts middleware quirk. Use when adding pages, layouts, or API routes.
---

# Next.js 16 App Router (this repo)

## When to use
Adding or changing anything under `src/app/**` — pages, layouts, `loading`/`error` boundaries, or API route handlers.

## Rules
- **Server Components by default.** Add `"use client"` only where interactivity is required (forms, hooks, event handlers). Keep data fetching in RSC.
- **Middleware is named `proxy.ts`, not `middleware.ts`** (`src/proxy.ts`). It runs Clerk auth + Arcjet on every route. Don't create a `middleware.ts`.
- **Route handlers** live at `src/app/api/<path>/route.ts` and export `GET`/`POST`/`PATCH`/`DELETE`. Every handler must honor the two invariants (see `clerk-auth`, `arcjet-security`).
- **Boundaries:** colocate `loading.tsx` and `error.tsx` with route segments (see `src/app/dashboard/chat/`). `error.tsx` must be a client component.
- **Wrap handlers with `withAxiom`** and emit `logger.info("event.name", {...})` (see `observability-axiom-otel`).

## Anchors
- Pages/layouts: `src/app/dashboard/**`, `src/app/(auth)/**`, `src/app/share/[shareId]/`
- Route handlers: `src/app/api/**` (14 routes)
- Middleware: `src/proxy.ts`
- Boot hook: `src/instrumentation.ts`

## Gotchas
- Import `env` from `@/lib/env`; never read `process.env` directly in app code.
- Dynamic params are async in Next 16 — `await params` in route handlers.
