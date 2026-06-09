import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { aj } from "@/lib/arcjet";
import { logger } from "@/lib/axiom/server";
import {
  extractText,
  isSupportedType,
  MAX_FILE_SIZE,
} from "@/lib/file-parser";

export const runtime = "nodejs";
// Images sent to Vision API may take a few seconds
export const maxDuration = 30;

/**
 * POST /api/documents/parse
 * Accepts multipart/form-data with a single `file` field.
 * Returns { text: string, wordCount: number }
 */
export async function POST(request: NextRequest) {
  // 1. Auth
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // 2. Arcjet
  const decision = await aj.protect(request);
  if (decision.isDenied()) {
    return NextResponse.json({ error: "Request denied." }, { status: 403 });
  }

  // 3. Parse multipart form
  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json({ error: "Invalid form data" }, { status: 400 });
  }

  const file = formData.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "No file provided" }, { status: 422 });
  }

  // 4. Validate size and type
  if (file.size > MAX_FILE_SIZE) {
    return NextResponse.json(
      { error: `File exceeds maximum size of ${MAX_FILE_SIZE / 1024 / 1024}MB` },
      { status: 413 }
    );
  }

  const mimeType = file.type;
  if (!isSupportedType(mimeType)) {
    return NextResponse.json(
      { error: `Unsupported file type: ${mimeType}` },
      { status: 415 }
    );
  }

  // 5. Extract text — stream progress to the client as newline-delimited JSON.
  // Each line is one event: { stage, ... }. The handler returns immediately with
  // the stream; stages flush as extraction proceeds so the UI can show real steps.
  const isImage = mimeType === "image/jpeg" || mimeType === "image/png";
  const encoder = new TextEncoder();

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (event: Record<string, unknown>) =>
        controller.enqueue(encoder.encode(JSON.stringify(event) + "\n"));

      try {
        send({ stage: "reading" });
        const buffer = Buffer.from(await file.arrayBuffer());

        send({ stage: "extracting", vision: isImage });
        const text = await extractText(buffer, mimeType, file.name);
        const wordCount = text.split(/\s+/).filter(Boolean).length;

        send({ stage: "done", text, wordCount });
      } catch (error) {
        logger.error("api.documents.parse_failed", {
          userId,
          fileName: file.name,
          mimeType,
          error: error instanceof Error ? error.message : String(error),
        });
        send({
          stage: "error",
          error:
            error instanceof Error
              ? error.message
              : "Failed to extract text from file",
        });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "application/x-ndjson; charset=utf-8",
      "Cache-Control": "no-store",
      // Disable proxy/Nginx buffering so each line flushes immediately.
      "X-Accel-Buffering": "no",
    },
  });
}
