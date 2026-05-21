/**
 * OpenTelemetry tracer registration.
 *
 * Registers a global NodeTracerProvider that exports spans to Axiom over
 * OTLP/HTTP. Once registered, the Vercel AI SDK's `experimental_telemetry`
 * option picks up the global tracer automatically — no explicit `tracer`
 * field needed on each call.
 *
 * Called from `instrumentation.ts` once per server boot.
 */
import { OTLPTraceExporter } from "@opentelemetry/exporter-trace-otlp-http";
import { resourceFromAttributes } from "@opentelemetry/resources";
import { NodeTracerProvider, SimpleSpanProcessor } from "@opentelemetry/sdk-trace-node";
import { ATTR_SERVICE_NAME } from "@opentelemetry/semantic-conventions";

export function registerTracing() {
  const token = process.env.AXIOM_TOKEN;
  const dataset = process.env.AXIOM_DATASET;
  const host = process.env.AXIOM_HOST ?? "api.axiom.co";

  if (!token || !dataset) {
    return;
  }

  const provider = new NodeTracerProvider({
    resource: resourceFromAttributes({
      [ATTR_SERVICE_NAME]: "knowledge-assistant",
    }),
    spanProcessors: [
      new SimpleSpanProcessor(
        new OTLPTraceExporter({
          url: `https://${host}/v1/traces`,
          headers: {
            Authorization: `Bearer ${token}`,
            "X-Axiom-Dataset": dataset,
          },
        })
      ),
    ],
  });

  provider.register();
}
