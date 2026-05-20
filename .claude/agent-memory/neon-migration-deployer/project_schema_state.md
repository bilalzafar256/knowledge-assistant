---
name: project-schema-state
description: Current schema state after fresh DB rebuild — tables, extensions, migration files, and deployment pattern
metadata:
  type: project
---

The Neon database was rebuilt from scratch on 2026-05-20 after the previous instance was deleted. All three migrations were applied via `pnpm db:migrate` to an empty database.

**Migrations applied (in order):**
- `0000_petite_mockingbird.sql` — creates audit_logs, chat_messages, chat_sessions, document_chunks (with `embedding vector(1536)`), documents + all FK constraints and btree indexes
- `0001_complex_queen_noir.sql` — creates rag_settings table
- `0002_collections.sql` — creates collections table, adds `collection_id` FK column to documents

**Tables present:** audit_logs, chat_messages, chat_sessions, collections, document_chunks, documents, rag_settings

**Extensions:** pgvector v0.8.0 (required — must be enabled BEFORE running migration 0000, as that migration uses `vector(1536)` but does not run `CREATE EXTENSION`)

**Critical deployment note:** pgvector must be enabled manually before `pnpm db:migrate` on any fresh Neon DB. Migration 0000 will fail without it.

**Why:** The migration SQL files do not include `CREATE EXTENSION IF NOT EXISTS vector` — the extension must be pre-created on the Neon branch.

**How to apply:** Whenever rebuilding on a fresh Neon DB, always run `CREATE EXTENSION IF NOT EXISTS vector` first, then `pnpm db:migrate`. Never run `db:baseline` on a fresh empty DB — it marks migrations as applied without executing them.
