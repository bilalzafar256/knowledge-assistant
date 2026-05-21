import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { aj } from "@/lib/arcjet";
import { logger } from "@/lib/axiom/server";
import { isCsrfSafe } from "@/lib/csrf";
import { db } from "@/lib/db";
import { collections } from "@/lib/schema";
import { eq, asc } from "drizzle-orm";
import type { NewCollection } from "@/lib/schema";

export const runtime = "nodejs";

// ── GET /api/collections — List collections for authenticated user ────────────
export async function GET(request: NextRequest) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const decision = await aj.protect(request);
  if (decision.isDenied()) {
    return NextResponse.json({ error: "Request denied." }, { status: 403 });
  }

  try {
    const rows = await db
      .select()
      .from(collections)
      .where(eq(collections.userId, userId))
      .orderBy(asc(collections.name));

    return NextResponse.json({ collections: rows });
  } catch (error) {
    logger.error("api.collections.list_failed", {
      userId,
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json({ error: "Failed to fetch collections" }, { status: 500 });
  }
}

// ── POST /api/collections — Create a collection ──────────────────────────────
export async function POST(request: NextRequest) {
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

  let body: { name?: string; description?: string; color?: string };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const { name, description, color = "#6366f1" } = body;

  if (!name?.trim()) {
    return NextResponse.json({ error: "Name is required" }, { status: 422 });
  }

  try {
    const newCollection: NewCollection = {
      userId,
      name: name.trim(),
      description: description?.trim() ?? null,
      color,
    };

    const [created] = await db.insert(collections).values(newCollection).returning();
    if (!created) throw new Error("Insert returned no rows");

    return NextResponse.json({ collection: created }, { status: 201 });
  } catch (error) {
    logger.error("api.collections.create_failed", {
      userId,
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json({ error: "Failed to create collection" }, { status: 500 });
  }
}
