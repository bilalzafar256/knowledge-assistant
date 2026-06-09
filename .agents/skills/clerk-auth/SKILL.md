---
name: clerk-auth
description: Clerk authentication patterns for this repo — middleware protection plus the mandatory per-route auth() re-check and 401. Use when adding or securing any route handler or protected page.
---

# Clerk Auth (this repo)

## When to use
Any new API route handler, protected page, or anything that reads the current user.

## Rules
- **Two-layer auth.** `src/proxy.ts` runs Clerk on all routes, but every API handler MUST independently re-check:
  ```ts
  import { auth } from "@clerk/nextjs/server";
  const { userId } = await auth();
  if (!userId) return new Response("Unauthorized", { status: 401 });
  ```
- **`userId` flows into every DB query.** It is the tenant key — see `drizzle-neon-pgvector` for the isolation rule. Never trust a `userId` from the request body; only the one from `auth()`.
- **Protected pages** are gated by the middleware; server components can call `auth()`/`currentUser()` directly.
- Redirect URLs are configured via `NEXT_PUBLIC_CLERK_*` env vars — keep `/sign-in`, `/sign-up`, `/dashboard`.

## Anchors
- Middleware: `src/proxy.ts`
- Auth route group: `src/app/(auth)/sign-in`, `sign-up`
- Every handler under `src/app/api/**`

## Gotchas
- Public routes (`/`, `/share/[shareId]`, webhooks) must be explicitly allowed in the middleware matcher.
- The Telegram webhook is auth'd by a shared secret, not Clerk — don't add `auth()` there.
