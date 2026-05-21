import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { aj } from "@/lib/arcjet";
import { logger } from "@/lib/axiom/server";
import { isCsrfSafe } from "@/lib/csrf";
import { db } from "@/lib/db";
import { documents, documentChunks } from "@/lib/schema";
import { eq, and } from "drizzle-orm";
import { logAudit } from "@/lib/audit";

export const runtime = "nodejs";

type RouteParams = { params: Promise<{ id: string }> };

// ── GET /api/documents/[id] ──────────────────────────────────────────────────
export async function GET(request: NextRequest, { params }: RouteParams) {
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

  const { id } = await params;

  // 3. Fetch document — filter by userId for tenant isolation
  try {
    const [doc] = await db
      .select()
      .from(documents)
      .where(and(eq(documents.id, id), eq(documents.userId, userId)));

    if (!doc) {
      return NextResponse.json({ error: "Document not found" }, { status: 404 });
    }

    // Fetch chunks for this document
    const chunks = await db
      .select({
        id: documentChunks.id,
        chunkIndex: documentChunks.chunkIndex,
        content: documentChunks.content,
        metadata: documentChunks.metadata,
        createdAt: documentChunks.createdAt,
      })
      .from(documentChunks)
      .where(
        and(
          eq(documentChunks.documentId, id),
          eq(documentChunks.userId, userId)
        )
      );

    return NextResponse.json({ document: doc, chunks });
  } catch (error) {
    logger.error("api.documents.get_failed", {
      userId,
      documentId: id,
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json(
      { error: "Failed to fetch document" },
      { status: 500 }
    );
  }
}

// ── PATCH /api/documents/[id] — Assign / unassign collection ─────────────────
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  if (!isCsrfSafe(request)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const decision = await aj.protect(request);
  if (decision.isDenied()) {
    return NextResponse.json({ error: "Request denied." }, { status: 403 });
  }

  const { id } = await params;

  let body: { collectionId?: string | null };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  try {
    const [updated] = await db
      .update(documents)
      .set({ collectionId: body.collectionId ?? null, updatedAt: new Date() })
      .where(and(eq(documents.id, id), eq(documents.userId, userId)))
      .returning({ id: documents.id, collectionId: documents.collectionId });

    if (!updated) {
      return NextResponse.json({ error: "Document not found" }, { status: 404 });
    }

    return NextResponse.json({ document: updated });
  } catch (error) {
    logger.error("api.documents.patch_failed", {
      userId,
      documentId: id,
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json({ error: "Failed to update document" }, { status: 500 });
  }
}

// ── DELETE /api/documents/[id] ───────────────────────────────────────────────
export async function DELETE(request: NextRequest, { params }: RouteParams) {
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

  const { id } = await params;

  // 3. Delete — ON DELETE CASCADE handles chunks automatically
  try {
    const [deleted] = await db
      .delete(documents)
      .where(and(eq(documents.id, id), eq(documents.userId, userId)))
      .returning({ id: documents.id, title: documents.title });

    if (!deleted) {
      return NextResponse.json({ error: "Document not found" }, { status: 404 });
    }

    void logAudit({
      userId,
      action: "document.delete",
      resourceType: "document",
      resourceId: deleted.id,
      metadata: { title: deleted.title },
      request,
    });

    return NextResponse.json({ deleted });
  } catch (error) {
    logger.error("api.documents.delete_failed", {
      userId,
      documentId: id,
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json(
      { error: "Failed to delete document" },
      { status: 500 }
    );
  }
}
