import { config } from "dotenv";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __dir = dirname(fileURLToPath(import.meta.url));
config({ path: join(__dir, "../../.env.local") });

function require(name) {
  if (!process.env[name]) {
    console.error(`✗ ${name} is not set in .env.local`);
    process.exit(1);
  }
  return process.env[name];
}

// ⚠️  The eval harness ingests the benchmark corpus (~440 MB for Open RAG Bench)
//     into whatever DATABASE_URL points at, under tenant OPEN_RAGBENCH_USER_ID.
//     This is the SAME var the app uses — running evals against a shared/free-tier
//     Neon project will fill its storage and 500 real uploads. Point DATABASE_URL
//     at a throwaway Neon branch for eval runs, and clean up the eval tenant after:
//       DELETE FROM documents WHERE user_id='user_open_ragbench_eval'; VACUUM FULL document_chunks;
export const DATABASE_URL = require("DATABASE_URL");
export const OPENAI_API_KEY = require("OPENAI_API_KEY");
export const COHERE_API_KEY = process.env.COHERE_API_KEY || null;
export const OPEN_RAGBENCH_USER_ID =
  process.env.OPEN_RAGBENCH_USER_ID || "user_open_ragbench_eval";

// Mirror src/lib/ai.ts
export const CHAT_MODEL = "gpt-4o";
export const EMBEDDING_MODEL = "text-embedding-3-small";
export const JUDGE_MODEL = "gpt-4o-mini";
export const COHERE_RERANK_MODEL = "rerank-v3.5";
