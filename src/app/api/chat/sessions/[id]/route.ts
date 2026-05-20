import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { chatSessions, chatMessages } from "@/lib/schema";
import { and, eq, asc } from "drizzle-orm";

export const runtime = "nodejs";

type RouteContext = { params: Promise<{ id: string }> };

// ── GET /api/chat/sessions/[id] — Get session + messages ─────────────────────
export async function GET(_request: NextRequest, { params }: RouteContext) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;

  const [session] = await db
    .select()
    .from(chatSessions)
    .where(and(eq(chatSessions.id, id), eq(chatSessions.userId, userId)));

  if (!session) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const messages = await db
    .select()
    .from(chatMessages)
    .where(and(eq(chatMessages.sessionId, id), eq(chatMessages.userId, userId)))
    .orderBy(asc(chatMessages.createdAt));

  return NextResponse.json({ session, messages });
}

// ── DELETE /api/chat/sessions/[id] — Delete session (cascades messages) ──────
export async function DELETE(_request: NextRequest, { params }: RouteContext) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;

  await db
    .delete(chatSessions)
    .where(and(eq(chatSessions.id, id), eq(chatSessions.userId, userId)));

  return NextResponse.json({ success: true });
}

// ── PATCH /api/chat/sessions/[id] — Update session (title / pinned) ──────────
export async function PATCH(request: NextRequest, { params }: RouteContext) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const body = (await request.json()) as { title?: string; pinned?: boolean };

  const patch: Record<string, unknown> = { updatedAt: new Date() };
  if (body.title !== undefined) {
    if (!body.title.trim()) return NextResponse.json({ error: "Title is required" }, { status: 422 });
    patch.title = body.title.trim();
  }
  if (body.pinned !== undefined) patch.pinned = body.pinned;

  const [updated] = await db
    .update(chatSessions)
    .set(patch)
    .where(and(eq(chatSessions.id, id), eq(chatSessions.userId, userId)))
    .returning();

  return NextResponse.json({ session: updated });
}
