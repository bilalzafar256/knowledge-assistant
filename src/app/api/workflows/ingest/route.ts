import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { uploadAj } from "@/lib/arcjet";
import { isCsrfSafe } from "@/lib/csrf";
import { inngest } from "@/lib/inngest";

export const runtime = "nodejs";

export interface IngestWorkflowPayload {
  documentId: string;
  userId: string;
}

// ── POST /api/workflows/ingest — Enqueue document ingestion via Inngest ───────
export async function POST(request: NextRequest) {
  // 0. CSRF
  if (!isCsrfSafe(request)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // 1. Auth
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // 2. Arcjet
  const decision = await uploadAj.protect(request, { userId, requested: 1 });
  if (decision.isDenied()) {
    if (decision.reason.isRateLimit()) {
      return NextResponse.json(
        { error: "Rate limit exceeded for document ingestion." },
        { status: 429 }
      );
    }
    return NextResponse.json({ error: "Request denied." }, { status: 403 });
  }

  // 3. Parse body
  let body: { documentId?: string };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const { documentId } = body;
  if (!documentId) {
    return NextResponse.json({ error: "documentId is required" }, { status: 422 });
  }

  // 4. Send Inngest event (background job)
  try {
    await inngest.send({
      name: "document/uploaded",
      data: { documentId, userId },
    });

    return NextResponse.json({
      message: "Ingestion queued",
      documentId,
      mode: "background",
    });
  } catch (error) {
    // Inngest unavailable — fall back to inline processing (dev / cold start)
    console.warn("[ingest] Inngest unavailable, running inline:", error);
    try {
      const { ingestDocument } = await import("@/app/workflows/ingest");

      // Race the inline ingest against a 55s timeout (Vercel's limit is ~60s)
      const INLINE_TIMEOUT_MS = 55_000;
      const timeoutPromise = new Promise<never>((_, reject) =>
        setTimeout(
          () => reject(new Error("Ingestion timeout: document too large for inline processing. Use Inngest for background processing.")),
          INLINE_TIMEOUT_MS
        )
      );

      await Promise.race([ingestDocument({ documentId, userId }), timeoutPromise]);

      return NextResponse.json({
        message: "Document ingested inline (Inngest fallback)",
        documentId,
        mode: "inline",
      });
    } catch (inlineError) {
      const isTimeout =
        inlineError instanceof Error &&
        inlineError.message.startsWith("Ingestion timeout");

      console.error("[ingest] Inline ingestion failed:", inlineError);
      return NextResponse.json(
        {
          error: isTimeout
            ? "Document is too large to process inline. Configure INNGEST_EVENT_KEY and INNGEST_SIGNING_KEY to enable background processing."
            : "Failed to ingest document",
          documentId,
          mode: "inline",
        },
        { status: isTimeout ? 202 : 500 }
      );
    }
  }
}
