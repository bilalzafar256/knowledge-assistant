/**
 * Next.js instrumentation hook — runs once on server startup before any
 * request is handled. Wires up:
 *   1. Env var validation (fail fast on missing config).
 *   2. OpenTelemetry tracer → Axiom (no-op if AXIOM_TOKEN is unset).
 *   3. Inngest config warning.
 *
 * Also exports `onRequestError` so uncaught errors in any Route Handler,
 * Server Action, or Server Component are forwarded to Axiom with full
 * stack + request context.
 */
import { logger } from "@/lib/axiom/server";
import { createOnRequestError } from "@axiomhq/nextjs";

export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    await import("@/lib/env");
    const { registerTracing } = await import("@/lib/axiom/otel");
    registerTracing();
    warnIfInngestNotConfigured();
  }
}

export const onRequestError = createOnRequestError(logger);

function warnIfInngestNotConfigured() {
  const hasEventKey = Boolean(process.env.INNGEST_EVENT_KEY);
  const hasSigningKey = Boolean(process.env.INNGEST_SIGNING_KEY);

  if (!hasEventKey || !hasSigningKey) {
    const missing = [
      !hasEventKey && "INNGEST_EVENT_KEY",
      !hasSigningKey && "INNGEST_SIGNING_KEY",
    ]
      .filter(Boolean)
      .join(", ");

    console.warn(
      `\n⚠  Inngest not configured (${missing} missing).\n` +
      `   Document ingestion will run inline (blocking, 55 s timeout).\n` +
      `   Large documents may time out. Set these keys to enable background processing with retries.\n` +
      `   See: https://app.inngest.com → Select app → Keys\n`
    );
  }
}
