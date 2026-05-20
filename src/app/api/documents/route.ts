import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { uploadAj } from "@/lib/arcjet";
import { isCsrfSafe } from "@/lib/csrf";
import { db } from "@/lib/db";
import { documents } from "@/lib/schema";
import { eq, desc } from "drizzle-orm";
import type { NewDocument } from "@/lib/schema";
import { logAudit } from "@/lib/audit";

export const runtime = "nodejs";

// ── GET /api/documents — List documents for authenticated user ───────────────
export async function GET(request: NextRequest) {
  // 1. Auth
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // 2. Arcjet
  const decision = await uploadAj.protect(request, { userId, requested: 0 });
  if (decision.isDenied()) {
    return NextResponse.json({ error: "Request denied." }, { status: 403 });
  }

  // 3. Query — always filter by userId
  try {
    const docs = await db
      .select({
        id: documents.id,
        title: documents.title,
        fileType: documents.fileType,
        fileSize: documents.fileSize,
        metadata: documents.metadata,
        createdAt: documents.createdAt,
        updatedAt: documents.updatedAt,
      })
      .from(documents)
      .where(eq(documents.userId, userId))
      .orderBy(desc(documents.createdAt));

    return NextResponse.json({ documents: docs });
  } catch (error) {
    console.error("[GET /api/documents]", error);
    return NextResponse.json(
      { error: "Failed to fetch documents" },
      { status: 500 }
    );
  }
}

// ── POST /api/documents — Create a document record ──────────────────────────
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
        { error: "Upload limit reached. Please try again later." },
        { status: 429 }
      );
    }
    return NextResponse.json({ error: "Request denied." }, { status: 403 });
  }

  // 3. Parse body
  let body: { title?: string; content?: string; fileType?: string; fileSize?: number; metadata?: Record<string, unknown> };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const { title, content, fileType = "text", fileSize, metadata = {} } = body;

  if (!title?.trim()) {
    return NextResponse.json({ error: "Title is required" }, { status: 422 });
  }
  if (!content?.trim()) {
    return NextResponse.json({ error: "Content is required" }, { status: 422 });
  }
  if (content.length > 2_000_000) {
    return NextResponse.json(
      { error: "Content exceeds maximum size of 2MB" },
      { status: 422 }
    );
  }

  // 4. Insert document
  try {
    const newDoc: NewDocument = {
      userId,
      title: title.trim(),
      content: content.trim(),
      fileType,
      fileSize: fileSize ?? content.length,
      metadata,
    };

    const [created] = await db.insert(documents).values(newDoc).returning();
    if (!created) throw new Error("Insert returned no rows");

    // Audit log
    void logAudit({
      userId,
      action: "document.upload",
      resourceType: "document",
      resourceId: created.id,
      metadata: { title: created.title, fileType: created.fileType },
      request,
    });

    return NextResponse.json({ document: created }, { status: 201 });
  } catch (error) {
    console.error("[POST /api/documents]", error);
    return NextResponse.json(
      { error: "Failed to create document" },
      { status: 500 }
    );
  }
}
