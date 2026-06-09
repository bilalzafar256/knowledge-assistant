---
name: drizzle-neon-pgvector
description: Neon Postgres + pgvector + Drizzle ORM for this repo — schema edits, the generate/migrate flow (never push), raw-SQL vector/tsvector features, and the userId tenant-isolation rule. Use for any DB or schema change.
---

# Drizzle + Neon + pgvector (this repo)

## When to use
Editing `src/lib/schema.ts`, writing queries, or adding migrations.

## Tenant isolation (non-negotiable)
- **Every query filters by `userId`.** No exceptions — a query that could read across users is a bug.
- `document_chunks.userId` is **denormalized** so retrieval scopes by tenant without a join. Preserve this when adding chunk queries.

## Migration flow
- Edit `src/lib/schema.ts` → `pnpm db:generate` → `pnpm db:migrate`.
- **Never `pnpm db:push`** (deprecated — bypasses migration history).
- `scripts/db-migrate.mjs` applies every file in `drizzle/` in order and records it in `drizzle.__drizzle_migrations`.
- Raw-SQL features (pgvector `ivfflat` index, `content_tsv` generated column + GIN index) live in **hand-written** migrations (`0000`, `0005`), not in `schema.ts`.

## Client
- `src/lib/db.ts` is a lazy `neon-http` Drizzle client behind a Proxy — `import { db } from "@/lib/db"` works anywhere.

## Anchors
- Schema: `src/lib/schema.ts` · Client: `src/lib/db.ts`
- Migrations: `drizzle/0000`–`0005` · Scripts: `scripts/db-{migrate,baseline}.mjs`

## Gotchas
- Embeddings are `vector(1536)` (text-embedding-3-small). Keep dimension in sync if you change the model.
- `db-baseline.mjs` is brownfield-only (register without re-running) — never on a fresh DB.
