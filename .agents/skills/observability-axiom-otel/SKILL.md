---
name: observability-axiom-otel
description: Logging and tracing for this repo — withAxiom route wrapper, structured logger, OpenTelemetry AI spans, and the no-prompts/completions privacy default. Use when adding logging or instrumenting a route.
---

# Observability — Axiom + OpenTelemetry (this repo)

## When to use
Adding logging to a route, or instrumenting AI calls / errors.

## How to log in a new route
```ts
import { logger, withAxiom } from "@/lib/axiom/server";
export const POST = withAxiom(async (req) => {
  // ...
  logger.info("event.name", { userId, /* metadata only */ });
});
```
- `withAxiom` records method, path, status, duration, userId per request.
- Use dotted event names (`chat.completion`, `document.ingested`).

## Privacy default (do not break)
- AI telemetry records **metadata/tokens/latency only** — `recordInputs: false, recordOutputs: false`. **Never** log prompts or completions off-server.

## Pieces
- `src/lib/axiom/axiom.ts` — client · `server.ts` — `logger` + `withAxiom` · `otel.ts` — tracer → OTLP.
- `src/instrumentation.ts` registers the OTel tracer and `onRequestError` (uncaught Route Handler / RSC errors).
- AI SDK spans come from `experimental_telemetry` on `streamText`.

## Fallback
Without `AXIOM_TOKEN`, everything falls back to `console` — local dev needs no signup.
