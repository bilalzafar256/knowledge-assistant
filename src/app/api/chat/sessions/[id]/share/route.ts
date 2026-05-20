import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { chatSessions } from "@/lib/schema";
import { and, eq } from "drizzle-orm";

export const runtime = "nodejs";

type RouteContext = { params: Promise<{ id: string }> };

function generateShareId(): string {
  const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
  return Array.from({ length: 12 }, () =>
    chars[Math.floor(Math.random() * chars.length)]
  ).join("");
}

// ── POST — Enable sharing, return share URL ───────────────────────────────────
export async function POST(_request: NextRequest, { params }: RouteContext) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;

  // Check ownership
  const [session] = await db
    .select({ id: chatSessions.id, shareId: chatSessions.shareId })
    .from(chatSessions)
    .where(and(eq(chatSessions.id, id), eq(chatSessions.userId, userId)));

  if (!session) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Reuse existing shareId or generate a new one
  const shareId = session.shareId ?? generateShareId();

  await db
    .update(chatSessions)
    .set({ isShared: true, shareId })
    .where(eq(chatSessions.id, id));

  return NextResponse.json({ shareId });
}

// ── DELETE — Revoke sharing ───────────────────────────────────────────────────
export async function DELETE(_request: NextRequest, { params }: RouteContext) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;

  await db
    .update(chatSessions)
    .set({ isShared: false })
    .where(and(eq(chatSessions.id, id), eq(chatSessions.userId, userId)));

  return NextResponse.json({ success: true });
}
