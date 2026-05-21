/**
 * Axiom client — server-side only.
 *
 * Returns `null` when AXIOM_TOKEN is not configured so the logger and
 * tracer can gracefully fall back to console-only output in local dev.
 */
import { Axiom } from "@axiomhq/js";

const token = process.env.AXIOM_TOKEN;
const dataset = process.env.AXIOM_DATASET ?? "";

export const axiomClient = token ? new Axiom({ token }) : null;
export const axiomDataset = dataset;
export const axiomEnabled = Boolean(token && dataset);
