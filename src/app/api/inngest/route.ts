import { serve } from "inngest/next";
import { inngest } from "@/lib/inngest";
import { ingestDocumentFn } from "@/inngest/ingest-document";

export const { GET, POST, PUT } = serve({
  client: inngest,
  functions: [ingestDocumentFn],
});
