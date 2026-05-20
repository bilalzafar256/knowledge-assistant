import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { aj } from "@/lib/arcjet";
import { db } from "@/lib/db";
import { chatSessions, chatMessages } from "@/lib/schema";
import { eq, desc, sql } from "drizzle-orm";
// Sessions are ordered: pinned first, then by last activity

export const runtime = "nodejs";

// ── GET /api/chat/sessions — List sessions for authenticated user ─────────────
export async function GET(request: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const decision = await aj.protect(request);
  if (decision.isDenied()) {
    return NextResponse.json({ error: "Request denied." }, { status: 403 });
  }

  const sessions = await db
    .select({
      id: chatSessions.id,
      title: chatSessions.title,
      pinned: chatSessions.pinned,
      isShared: chatSessions.isShared,
      shareId: chatSessions.shareId,
      createdAt: chatSessions.createdAt,
      updatedAt: chatSessions.updatedAt,
      messageCount: sql<number>`count(${chatMessages.id})`,
    })
    .from(chatSessions)
    .leftJoin(chatMessages, eq(chatMessages.sessionId, chatSessions.id))
    .where(eq(chatSessions.userId, userId))
    .groupBy(
      chatSessions.id, chatSessions.title, chatSessions.pinned,
      chatSessions.isShared, chatSessions.shareId,
      chatSessions.createdAt, chatSessions.updatedAt
    )
    .orderBy(desc(chatSessions.pinned), desc(chatSessions.updatedAt));

  return NextResponse.json({ sessions });
}

// ── POST /api/chat/sessions — Create a new session ───────────────────────────
export async function POST(request: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const decision = await aj.protect(request);
  if (decision.isDenied()) {
    return NextResponse.json({ error: "Request denied." }, { status: 403 });
  }

  const [session] = await db
    .insert(chatSessions)
    .values({ userId, title: "New Chat" })
    .returning();

  return NextResponse.json({ session }, { status: 201 });
}
