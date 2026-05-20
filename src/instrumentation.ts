/**
 * Next.js instrumentation hook — runs once on server startup before any
 * request is handled. Used here to validate all environment variables early
 * so the server crashes immediately (with a clear message) rather than at
 * runtime when the first request hits a missing var.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    await import("@/lib/env");
    warnIfInngestNotConfigured();
  }
}

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
