import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { aj } from "@/lib/arcjet";
import { logger } from "@/lib/axiom/server";
import { isCsrfSafe } from "@/lib/csrf";
import { db } from "@/lib/db";
import { collections } from "@/lib/schema";
import { eq, and } from "drizzle-orm";

export const runtime = "nodejs";

type RouteParams = { params: Promise<{ id: string }> };

// ── PATCH /api/collections/[id] — Rename / update a collection ───────────────
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

  let body: { name?: string; description?: string; color?: string };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const updates: Partial<{ name: string; description: string | null; color: string; updatedAt: Date }> = {
    updatedAt: new Date(),
  };
  if (body.name !== undefined) {
    const name = body.name.trim();
    if (!name) return NextResponse.json({ error: "Name cannot be empty" }, { status: 422 });
    updates.name = name;
  }
  if (body.description !== undefined) {
    updates.description = body.description.trim() || null;
  }
  if (body.color !== undefined) {
    updates.color = body.color;
  }

  try {
    const [updated] = await db
      .update(collections)
      .set(updates)
      .where(and(eq(collections.id, id), eq(collections.userId, userId)))
      .returning();

    if (!updated) {
      return NextResponse.json({ error: "Collection not found" }, { status: 404 });
    }

    return NextResponse.json({ collection: updated });
  } catch (error) {
    logger.error("api.collections.patch_failed", {
      userId,
      collectionId: id,
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json({ error: "Failed to update collection" }, { status: 500 });
  }
}

// ── DELETE /api/collections/[id] — Delete a collection ───────────────────────
export async function DELETE(request: NextRequest, { params }: RouteParams) {
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

  try {
    // Documents with this collection_id will have it SET NULL (FK constraint)
    const [deleted] = await db
      .delete(collections)
      .where(and(eq(collections.id, id), eq(collections.userId, userId)))
      .returning({ id: collections.id });

    if (!deleted) {
      return NextResponse.json({ error: "Collection not found" }, { status: 404 });
    }

    return NextResponse.json({ deleted });
  } catch (error) {
    logger.error("api.collections.delete_failed", {
      userId,
      collectionId: id,
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json({ error: "Failed to delete collection" }, { status: 500 });
  }
}
