import { logger } from "@/lib/axiom/server";
import { inngest } from "@/lib/inngest";
import { db } from "@/lib/db";
import { documents } from "@/lib/schema";
import { eq } from "drizzle-orm";

export const ingestDocumentFn = inngest.createFunction(
  {
    id: "ingest-document",
    name: "Ingest Document",
    retries: 3,
    triggers: [{ event: "document/uploaded" as const }],
  },
  async ({ event, step }: { event: { data: { documentId: string; userId: string } }; step: { run: <T>(name: string, fn: () => Promise<T>) => Promise<T> } }) => {
    const { documentId, userId } = event.data;

    // Step 1: Mark as processing
    await step.run("mark-processing", async () => {
      await db
        .update(documents)
        .set({ status: "processing" })
        .where(eq(documents.id, documentId));
    });

    // Step 2: Run ingestion pipeline
    try {
      const result = await step.run("run-ingestion", async () => {
        const { ingestDocument } = await import("@/app/workflows/ingest");
        return ingestDocument({ documentId, userId });
      });

      // Step 3: Mark as ready
      await step.run("mark-ready", async () => {
        await db
          .update(documents)
          .set({ status: "ready", errorMessage: null })
          .where(eq(documents.id, documentId));
      });

      return result;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      // Mark as failed with the error message
      await step.run("mark-failed", async () => {
        await db
          .update(documents)
          .set({
            status: "failed",
            errorMessage,
          })
          .where(eq(documents.id, documentId));
      });
      logger.error("ingest.inngest_failed", {
        documentId,
        userId,
        error: errorMessage,
      });
      throw error; // Re-throw so Inngest can retry
    }
  }
);
