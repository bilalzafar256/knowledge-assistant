import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { documents } from "@/lib/schema";
import { eq, and } from "drizzle-orm";

export const runtime = "nodejs";

type RouteParams = { params: Promise<{ id: string }> };

// ── GET /api/documents/[id]/status — Lightweight status poll ─────────────────
export async function GET(_request: NextRequest, { params }: RouteParams) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  const [doc] = await db
    .select({ status: documents.status, errorMessage: documents.errorMessage })
    .from(documents)
    .where(and(eq(documents.id, id), eq(documents.userId, userId)));

  if (!doc) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json(doc);
}
