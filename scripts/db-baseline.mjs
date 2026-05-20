/**
 * db-baseline.mjs
 *
 * Marks the initial migration (0000) as already applied WITHOUT running it.
 * Run this once on any database that was set up before migrations were introduced
 * (i.e., via drizzle-kit push or the raw migrate.mjs script).
 *
 * After running this, use `pnpm db:migrate` for all future schema changes.
 *
 * Usage:
 *   pnpm db:baseline
 */

import { neon } from "@neondatabase/serverless";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { config } from "dotenv";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __dir = dirname(fileURLToPath(import.meta.url));
config({ path: join(__dir, "../.env.local") });

if (!process.env.DATABASE_URL) {
  console.error("✗  DATABASE_URL is not set in .env.local");
  process.exit(1);
}

const sql = neon(process.env.DATABASE_URL);

// Read the journal to get the migration timestamp (used as created_at)
const journal = JSON.parse(
  readFileSync(join(__dir, "../drizzle/meta/_journal.json"), "utf8")
);

// Process each migration entry and mark them as applied
for (const entry of journal.entries) {
  const migrationPath = join(__dir, `../drizzle/${entry.tag}.sql`);
  const migrationSql = readFileSync(migrationPath, "utf8");
  const hash = createHash("sha256").update(migrationSql).digest("hex");
  const folderMillis = entry.when;

  // Ensure the tracking schema + table exist
  await sql`CREATE SCHEMA IF NOT EXISTS drizzle`;
  await sql`
    CREATE TABLE IF NOT EXISTS drizzle.__drizzle_migrations (
      id SERIAL PRIMARY KEY,
      hash text NOT NULL,
      created_at bigint
    )
  `;

  // Skip if this migration is already tracked
  const existing = await sql`
    SELECT id FROM drizzle.__drizzle_migrations
    WHERE hash = ${hash}
  `;

  if (existing.length > 0) {
    console.log(`  → ${entry.tag}: already baselined, skipping`);
    continue;
  }

  await sql`
    INSERT INTO drizzle.__drizzle_migrations (hash, created_at)
    VALUES (${hash}, ${folderMillis})
  `;
  console.log(`  ✓ ${entry.tag}: marked as applied`);
}

console.log("\n✓ Baseline complete — run `pnpm db:migrate` for future migrations");
