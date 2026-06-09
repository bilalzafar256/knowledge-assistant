/**
 * Typed, validated environment variables.
 *
 * Import `env` instead of accessing `process.env` directly so that:
 *  1. Missing / malformed vars fail fast with a clear message at startup.
 *  2. All callers get proper TypeScript types (no `string | undefined`).
 *
 * This module only runs server-side (Node.js / Edge runtime).
 * Do NOT import it from client components.
 */
import { z } from "zod";

// ── Schema ────────────────────────────────────────────────────────────────────

const envSchema = z.object({
  // ── Database ───────────────────────────────────────────────────────────────
  DATABASE_URL: z
    .string({ required_error: "DATABASE_URL is required" })
    .url("DATABASE_URL must be a valid PostgreSQL connection URL (e.g. postgresql://user:pass@host/db)"),

  // ── Anthropic (chat, document parsing, query synthesis, rerank fallback) ────
  ANTHROPIC_API_KEY: z
    .string({ required_error: "ANTHROPIC_API_KEY is required" })
    .startsWith("sk-ant-", "ANTHROPIC_API_KEY must start with 'sk-ant-'"),

  // ── Google Gemini (embeddings — gemini-embedding-001 @ 1536-d) ──────────────
  GOOGLE_GENERATIVE_AI_API_KEY: z
    .string({ required_error: "GOOGLE_GENERATIVE_AI_API_KEY is required" })
    .min(1, "GOOGLE_GENERATIVE_AI_API_KEY must not be empty"),

  // ── OpenAI (eval harness only — app no longer uses it at runtime) ───────────
  OPENAI_API_KEY: z
    .string({ required_error: "OPENAI_API_KEY is required" })
    .min(1, "OPENAI_API_KEY must not be empty"),

  // ── Cohere (optional — reranker; falls back to Claude Haiku if absent) ──────
  COHERE_API_KEY: z.string().optional(),

  // ── Clerk ──────────────────────────────────────────────────────────────────
  NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: z
    .string({ required_error: "NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY is required" })
    .startsWith("pk_", "NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY must start with 'pk_'"),

  CLERK_SECRET_KEY: z
    .string({ required_error: "CLERK_SECRET_KEY is required" })
    .startsWith("sk_", "CLERK_SECRET_KEY must start with 'sk_'"),

  // ── Arcjet ─────────────────────────────────────────────────────────────────
  ARCJET_KEY: z
    .string({ required_error: "ARCJET_KEY is required" })
    .startsWith("ajkey_", "ARCJET_KEY must start with 'ajkey_'"),

  // ── App ────────────────────────────────────────────────────────────────────
  NEXT_PUBLIC_APP_URL: z
    .string()
    .url("NEXT_PUBLIC_APP_URL must be a valid URL")
    .default("http://localhost:3000"),

  NODE_ENV: z
    .enum(["development", "production", "test"])
    .default("development"),

  // ── Inngest (optional — falls back to inline processing if absent) ─────────
  INNGEST_EVENT_KEY: z.string().optional(),
  INNGEST_SIGNING_KEY: z.string().optional(),

  // ── Telegram → GitHub PR bot (optional — only needed for /api/telegram/webhook) ─
  TELEGRAM_BOT_TOKEN: z.string().optional(),
  TELEGRAM_CHAT_ID: z.string().optional(),
  TELEGRAM_WEBHOOK_SECRET: z.string().optional(),
  GITHUB_PAT: z.string().optional(),
  GITHUB_REPO: z.string().optional(),
});

// ── Validation ────────────────────────────────────────────────────────────────

function formatZodError(error: z.ZodError): string {
  const lines = error.issues.map((issue) => {
    const key = issue.path.join(".");
    return `  ✗  ${key}: ${issue.message}`;
  });
  return lines.join("\n");
}

function validateEnv() {
  const result = envSchema.safeParse(process.env);

  if (!result.success) {
    const message = formatZodError(result.error);
    const banner =
      `\n╔══════════════════════════════════════════════════════╗\n` +
      `║        Missing / invalid environment variables        ║\n` +
      `╚══════════════════════════════════════════════════════╝\n` +
      `${message}\n\n` +
      `  → Copy .env.local.example to .env.local and fill in the values.\n`;
    console.error(banner);
    throw new Error("Invalid environment variables — see log above.");
  }

  return result.data;
}

// ── Export ────────────────────────────────────────────────────────────────────

export const env = validateEnv();
export type Env = typeof env;
