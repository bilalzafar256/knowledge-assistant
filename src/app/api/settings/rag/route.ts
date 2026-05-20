import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { ragSettings } from "@/lib/schema";
import { eq } from "drizzle-orm";

export const runtime = "nodejs";

const CHUNK_SIZE_MIN = 100;
const CHUNK_SIZE_MAX = 2000;
const CHUNK_OVERLAP_MIN = 0;
const CHUNK_OVERLAP_MAX = 300;

// ── GET /api/settings/rag ─────────────────────────────────────────────────────
export async function GET(_req: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const [row] = await db
    .select()
    .from(ragSettings)
    .where(eq(ragSettings.userId, userId));

  // Return defaults if not yet configured
  return NextResponse.json({
    chunkSize: row?.chunkSize ?? 500,
    chunkOverlap: row?.chunkOverlap ?? 50,
  });
}

// ── PUT /api/settings/rag ─────────────────────────────────────────────────────
export async function PUT(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: { chunkSize?: number; chunkOverlap?: number };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const chunkSize = Number(body.chunkSize);
  const chunkOverlap = Number(body.chunkOverlap);

  if (
    !Number.isInteger(chunkSize) ||
    chunkSize < CHUNK_SIZE_MIN ||
    chunkSize > CHUNK_SIZE_MAX
  ) {
    return NextResponse.json(
      { error: `chunkSize must be between ${CHUNK_SIZE_MIN} and ${CHUNK_SIZE_MAX}` },
      { status: 422 }
    );
  }
  if (
    !Number.isInteger(chunkOverlap) ||
    chunkOverlap < CHUNK_OVERLAP_MIN ||
    chunkOverlap > CHUNK_OVERLAP_MAX ||
    chunkOverlap >= chunkSize
  ) {
    return NextResponse.json(
      { error: `chunkOverlap must be between ${CHUNK_OVERLAP_MIN} and ${CHUNK_OVERLAP_MAX} and less than chunkSize` },
      { status: 422 }
    );
  }

  await db
    .insert(ragSettings)
    .values({ userId, chunkSize, chunkOverlap })
    .onConflictDoUpdate({
      target: ragSettings.userId,
      set: { chunkSize, chunkOverlap, updatedAt: new Date() },
    });

  return NextResponse.json({ chunkSize, chunkOverlap });
}
