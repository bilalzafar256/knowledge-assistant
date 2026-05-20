/**
 * db-migrate.mjs
 *
 * Applies any pending Drizzle migrations to the database.
 * Migrations are tracked in the `drizzle.__drizzle_migrations` table so each
 * SQL file is only ever executed once.
 *
 * Usage:
 *   pnpm db:migrate
 *
 * For a brand-new database:
 *   pnpm db:migrate         ← runs migration 0000 (and all subsequent ones)
 *
 * For an existing database that was set up with drizzle-kit push:
 *   pnpm db:baseline        ← marks migration 0000 as applied without running it
 *   pnpm db:migrate         ← runs any migrations after 0000
 */

import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import { migrate } from "drizzle-orm/neon-http/migrator";
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
const db = drizzle(sql);

console.log("Running migrations…");

await migrate(db, {
  migrationsFolder: join(__dir, "../drizzle"),
});

console.log("✓ Migrations complete");
