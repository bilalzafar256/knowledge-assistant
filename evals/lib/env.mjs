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
// Generation runs on Anthropic Claude; embeddings on Google Gemini — mirrors
// the production stack in src/lib/ai.ts (commit 6989407). OPENAI_API_KEY is no
// longer required; it's only kept as an optional embedding fallback.
export const ANTHROPIC_API_KEY = require("ANTHROPIC_API_KEY");
export const GOOGLE_GENERATIVE_AI_API_KEY = require("GOOGLE_GENERATIVE_AI_API_KEY");
export const OPENAI_API_KEY = process.env.OPENAI_API_KEY || null;
export const COHERE_API_KEY = process.env.COHERE_API_KEY || null;
export const OPEN_RAGBENCH_USER_ID =
  process.env.OPEN_RAGBENCH_USER_ID || "user_open_ragbench_eval";

// Mirror src/lib/ai.ts — keep these in lockstep with production model choices.
export const CHAT_MODEL = "claude-sonnet-4-6"; // user-facing grounded answers
export const SYNTHESIS_MODEL = "claude-haiku-4-5"; // standalone-query rewrite
export const RERANK_MODEL = "claude-haiku-4-5"; // LLM rerank scoring fallback
export const EMBEDDING_MODEL = "gemini-embedding-001"; // Google — embeddings
export const EMBEDDING_DIMENSIONS = 1536; // matches document_chunks.embedding vector(1536)
// Judge model is eval-only (not production). Claude Haiku keeps it on the same
// key + cheap. NOTE: judging Claude answers with Claude introduces mild
// same-family self-preference bias — flagged in the run report.
export const JUDGE_MODEL = "claude-haiku-4-5";
export const COHERE_RERANK_MODEL = "rerank-v3.5";
