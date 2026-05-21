import { auth } from "@clerk/nextjs/server";
import { streamText, convertToModelMessages, stepCountIs } from "ai";
import type { UIMessage } from "ai";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { chatAj } from "@/lib/arcjet";
import { isCsrfSafe } from "@/lib/csrf";
import { openai, CHAT_MODEL, SYSTEM_PROMPT, createSearchKnowledgeTool, type ConversationMessage } from "@/lib/ai";
import { logAudit } from "@/lib/audit";
import { logger, withAxiom } from "@/lib/axiom/server";
import { db } from "@/lib/db";
import { chatSessions, chatMessages } from "@/lib/schema";
import { and, eq } from "drizzle-orm";

export const runtime = "nodejs";
export const maxDuration = 60;

export const POST = withAxiom(async (request: NextRequest) => {
  // ── 0. CSRF check ────────────────────────────────────────────────────────
  if (!isCsrfSafe(request)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // ── 1. Clerk Authentication ──────────────────────────────────────────────
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // ── 2. Arcjet Security (rate limiting + shield + bot detection) ──────────
  const decision = await chatAj.protect(request, {
    userId,
    requested: 1,
  });

  if (decision.isDenied()) {
    if (decision.reason.isRateLimit()) {
      return NextResponse.json(
        { error: "Too many requests. Please wait before sending another message.", code: "RATE_LIMITED" },
        { status: 429 }
      );
    }
    if (decision.reason.isBot()) {
      return NextResponse.json(
        { error: "Automated requests are not permitted.", code: "BOT_DETECTED" },
        { status: 403 }
      );
    }
    if (decision.reason.isShield()) {
      return NextResponse.json(
        { error: "Your request was blocked. Please check your input and try again.", code: "SHIELD_BLOCKED" },
        { status: 403 }
      );
    }
    return NextResponse.json({ error: "Request denied.", code: "DENIED" }, { status: 403 });
  }

  // ── 3. Parse request body ────────────────────────────────────────────────
  let messages: UIMessage[];
  let sessionId: string | undefined;
  try {
    const body = (await request.json()) as { messages?: UIMessage[]; sessionId?: string };
    messages = body.messages ?? [];
    sessionId = body.sessionId;
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  if (!messages.length) {
    return NextResponse.json({ error: "Messages are required" }, { status: 400 });
  }

  // ── 4. Persist user message + auto-title session ──────────────────────────
  let userContent = "";
  if (sessionId) {
    const lastMsg = messages[messages.length - 1];
    if (lastMsg?.role === "user") {
      userContent = lastMsg.parts
        .filter((p): p is { type: "text"; text: string } => p.type === "text")
        .map((p) => p.text)
        .join("");

      // Save user message
      await db.insert(chatMessages).values({
        sessionId,
        userId,
        role: "user",
        content: userContent,
      });

      // Audit log
      void logAudit({
        userId,
        action: "chat.message",
        resourceType: "chat_session",
        resourceId: sessionId,
        metadata: { messageLength: userContent.length },
        request,
      });

      // Auto-title session on first message
      const [session] = await db
        .select({ title: chatSessions.title })
        .from(chatSessions)
        .where(and(eq(chatSessions.id, sessionId), eq(chatSessions.userId, userId)));

      if (session?.title === "New Chat" && userContent.trim()) {
        const title =
          userContent.trim().slice(0, 60) +
          (userContent.trim().length > 60 ? "…" : "");
        await db
          .update(chatSessions)
          .set({ title, updatedAt: new Date() })
          .where(eq(chatSessions.id, sessionId));
      } else {
        // Always bump updatedAt so session rises to top
        await db
          .update(chatSessions)
          .set({ updatedAt: new Date() })
          .where(eq(chatSessions.id, sessionId));
      }
    }
  }

  // ── 5. Stream AI response with RAG tool ──────────────────────────────────

  // Build conversation history for query synthesis (all messages except the last user message)
  const priorMessages: ConversationMessage[] = messages
    .slice(0, -1)
    .flatMap((m) => {
      if (m.role !== "user" && m.role !== "assistant") return [];
      const text = m.parts
        .filter((p): p is { type: "text"; text: string } => p.type === "text")
        .map((p) => p.text)
        .join("");
      return text ? [{ role: m.role as "user" | "assistant", content: text }] : [];
    });

  const result = streamText({
    model: openai(CHAT_MODEL),
    system: SYSTEM_PROMPT,
    messages: await convertToModelMessages(messages),
    tools: {
      searchKnowledge: createSearchKnowledgeTool(userId, priorMessages),
    },
    stopWhen: stepCountIs(5),
    temperature: 0.3,
    experimental_telemetry: {
      isEnabled: true,
      functionId: "chat.stream",
      recordInputs: false,
      recordOutputs: false,
      metadata: {
        userId,
        sessionId: sessionId ?? "anonymous",
      },
    },
    async onFinish({ text, usage, finishReason }) {
      logger.info("chat.completion", {
        userId,
        sessionId,
        finishReason,
        inputTokens: usage.inputTokens,
        outputTokens: usage.outputTokens,
      });

      // Persist assistant response
      if (sessionId && text) {
        await db.insert(chatMessages).values({
          sessionId,
          userId,
          role: "assistant",
          content: text,
        });
      }
    },
    onError({ error }) {
      logger.error("chat.stream_error", {
        userId,
        sessionId,
        error: error instanceof Error ? error.message : String(error),
      });
    },
  });

  return result.toUIMessageStreamResponse();
});
