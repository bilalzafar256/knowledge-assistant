/**
 * Server-side structured logger.
 *
 * Routes through Axiom when AXIOM_TOKEN/AXIOM_DATASET are set; falls back
 * to pretty-printed console output in dev. Wrap Route Handlers with
 * `withAxiom` to get request-scoped context (method, path, status, duration)
 * attached to every log line emitted during that request.
 */
import { Logger, AxiomJSTransport, ConsoleTransport, type Transport } from "@axiomhq/logging";
import { createAxiomRouteHandler, nextJsFormatters } from "@axiomhq/nextjs";
import { axiomClient, axiomDataset, axiomEnabled } from "./axiom";

const isProd = process.env.NODE_ENV === "production";
const consoleTransport = new ConsoleTransport({ prettyPrint: !isProd });

const transports: [Transport, ...Transport[]] = (() => {
  if (axiomEnabled && axiomClient) {
    const axiomTransport = new AxiomJSTransport({ axiom: axiomClient, dataset: axiomDataset });
    return isProd ? [axiomTransport] : [axiomTransport, consoleTransport];
  }
  return [consoleTransport];
})();

export const logger = new Logger({
  transports,
  formatters: nextJsFormatters,
});

export const withAxiom = createAxiomRouteHandler(logger);
