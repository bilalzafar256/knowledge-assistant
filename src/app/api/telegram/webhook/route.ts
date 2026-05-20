import { NextRequest, NextResponse } from "next/server";
import { env } from "@/lib/env";
import { db } from "@/lib/db";
import { telegramTasks, type TelegramTaskStatus } from "@/lib/schema";
import { eq, and, notInArray, desc } from "drizzle-orm";
import { classifyMessage } from "@/lib/telegram-classifier";

export const runtime = "nodejs";

const TERMINAL_STATUSES: TelegramTaskStatus[] = [
  "discussion",
  "done",
  "cancelled",
];

// ── Telegram helpers ─────────────────────────────────────────────────────────

async function tg(method: string, payload: unknown): Promise<Response | null> {
  if (!env.TELEGRAM_BOT_TOKEN) return null;
  return fetch(
    `https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/${method}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    },
  );
}

async function sendText(chatId: number | string, text: string) {
  await tg("sendMessage", { chat_id: chatId, text });
}

async function answerCallback(callbackId: string, text?: string) {
  await tg("answerCallbackQuery", { callback_query_id: callbackId, text });
}

// ── GitHub dispatch ──────────────────────────────────────────────────────────

async function dispatchPlanTask(args: {
  taskId: string;
  chatId: number;
  message: string;
  revisionNotes?: string;
}): Promise<boolean> {
  const repo = env.GITHUB_REPO ?? "bilalzafar256/knowledge-assistant";
  const res = await fetch(`https://api.github.com/repos/${repo}/dispatches`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.GITHUB_PAT}`,
      Accept: "application/vnd.github+json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      event_type: "plan-task",
      client_payload: {
        task_id: args.taskId,
        chat_id: args.chatId,
        message: args.message,
        revision_notes: args.revisionNotes ?? "",
      },
    }),
  });
  return res.ok;
}

// ── DB helpers ───────────────────────────────────────────────────────────────

async function getActiveTask(chatId: string) {
  const rows = await db
    .select()
    .from(telegramTasks)
    .where(
      and(
        eq(telegramTasks.chatId, chatId),
        notInArray(telegramTasks.status, TERMINAL_STATUSES),
      ),
    )
    .orderBy(desc(telegramTasks.createdAt))
    .limit(1);
  return rows[0] ?? null;
}

async function setStatus(taskId: string, status: TelegramTaskStatus) {
  await db
    .update(telegramTasks)
    .set({ status, updatedAt: new Date() })
    .where(eq(telegramTasks.id, taskId));
}

// ── Main handler ─────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  if (
    !env.TELEGRAM_BOT_TOKEN ||
    !env.TELEGRAM_CHAT_ID ||
    !env.TELEGRAM_WEBHOOK_SECRET ||
    !env.GITHUB_PAT
  ) {
    return NextResponse.json(
      { error: "telegram bot not configured" },
      { status: 503 },
    );
  }

  const secret = req.headers.get("x-telegram-bot-api-secret-token");
  if (secret !== env.TELEGRAM_WEBHOOK_SECRET) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const body = await req.json();

  // ── Branch 1: button press (callback_query) ────────────────────────────────
  if (body.callback_query) {
    await handleCallback(body.callback_query);
    return NextResponse.json({ ok: true });
  }

  // ── Branch 2: regular message ──────────────────────────────────────────────
  const message = body.message;
  if (!message?.text) return NextResponse.json({ ok: true });

  const chatId: number = message.chat.id;
  const text: string = message.text;

  if (String(chatId) !== env.TELEGRAM_CHAT_ID) {
    return NextResponse.json({ ok: true });
  }

  // Slash commands take priority over everything else.
  if (text.startsWith("/cancel")) {
    await handleCancel(String(chatId));
    return NextResponse.json({ ok: true });
  }
  if (text.startsWith("/status")) {
    await handleStatus(String(chatId));
    return NextResponse.json({ ok: true });
  }

  // If there's an active task, this message is either feedback for the
  // planner (revision or clarification answer) or a "wait" notice.
  const active = await getActiveTask(String(chatId));
  if (active) {
    if (
      active.status === "awaiting_plan_approval" ||
      active.status === "awaiting_clarification"
    ) {
      await handleRevision(active.id, chatId, text, active.status);
    } else {
      await sendText(
        chatId,
        `⏳ A task is already in progress (status: ${active.status}). Reply when prompted, or use /cancel to abort.`,
      );
    }
    return NextResponse.json({ ok: true });
  }

  // Otherwise: classify a brand-new request.
  await handleNewMessage(chatId, text);
  return NextResponse.json({ ok: true });
}

// ── Handlers ─────────────────────────────────────────────────────────────────

async function handleNewMessage(chatId: number, text: string) {
  const inserted = await db
    .insert(telegramTasks)
    .values({
      chatId: String(chatId),
      originalMessage: text,
      status: "classifying",
    })
    .returning({ id: telegramTasks.id });
  const task = inserted[0];
  if (!task) {
    await sendText(chatId, "⚠️ Could not save your message (DB insert failed).");
    return;
  }

  let classification;
  try {
    classification = await classifyMessage(text);
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : String(err);
    console.error("[telegram] classifier failed:", errMsg, err);
    await setStatus(task.id, "cancelled");
    await sendText(chatId, `⚠️ Classifier error: ${errMsg.slice(0, 200)}`);
    return;
  }

  if (classification.kind === "discussion") {
    await db
      .update(telegramTasks)
      .set({ kind: "discussion", status: "done", updatedAt: new Date() })
      .where(eq(telegramTasks.id, task.id));
    await sendText(
      chatId,
      classification.reply?.trim() ||
        "(Classified as a question but no reply was produced — try rephrasing.)",
    );
    return;
  }

  // requirement → kick off planning
  await db
    .update(telegramTasks)
    .set({ kind: "requirement", status: "planning", updatedAt: new Date() })
    .where(eq(telegramTasks.id, task.id));

  const ok = await dispatchPlanTask({
    taskId: task.id,
    chatId,
    message: text,
  });

  if (!ok) {
    await setStatus(task.id, "cancelled");
    await sendText(chatId, "⚠️ Failed to start the planning workflow.");
    return;
  }

  await sendText(chatId, `📝 Got it. Starting plan for: "${text}"`);
}

async function handleRevision(
  taskId: string,
  chatId: number,
  text: string,
  previousStatus: TelegramTaskStatus,
) {
  // Append the user's feedback (revision OR clarification answer) and
  // re-dispatch the planner with the accumulated notes as context.
  const [task] = await db
    .select({
      originalMessage: telegramTasks.originalMessage,
      revisionNotes: telegramTasks.revisionNotes,
    })
    .from(telegramTasks)
    .where(eq(telegramTasks.id, taskId));

  if (!task) {
    await sendText(chatId, "⚠️ Couldn't load the task.");
    return;
  }

  const label =
    previousStatus === "awaiting_clarification"
      ? "User answers"
      : "Revision feedback";
  const labeled = `[${label}]\n${text}`;

  const existing = Array.isArray(task.revisionNotes) ? task.revisionNotes : [];
  const updatedNotes = [...existing, labeled];

  await db
    .update(telegramTasks)
    .set({
      revisionNotes: updatedNotes,
      status: "planning",
      updatedAt: new Date(),
    })
    .where(eq(telegramTasks.id, taskId));

  const ok = await dispatchPlanTask({
    taskId,
    chatId,
    message: task.originalMessage,
    revisionNotes: updatedNotes.join("\n\n---\n\n"),
  });

  if (!ok) {
    await setStatus(taskId, previousStatus);
    await sendText(chatId, "⚠️ Failed to start the planning workflow.");
    return;
  }

  await sendText(
    chatId,
    previousStatus === "awaiting_clarification"
      ? "📝 Got it. Planning…"
      : "✏️ Got the revision. Re-planning…",
  );
}

async function handleCallback(cb: {
  id: string;
  data?: string;
  message?: { chat: { id: number } };
  from?: { id: number };
}) {
  await answerCallback(cb.id); // acknowledge instantly

  const data = cb.data ?? "";
  const chatId = cb.message?.chat.id;
  if (!chatId || String(chatId) !== env.TELEGRAM_CHAT_ID) return;

  // Expected format: tg:<action>:<task_id>
  const [prefix, action, taskId] = data.split(":");
  if (prefix !== "tg" || !action || !taskId) return;

  const [task] = await db
    .select()
    .from(telegramTasks)
    .where(eq(telegramTasks.id, taskId));
  if (!task) {
    await sendText(chatId, "⚠️ Task not found.");
    return;
  }
  if (task.status !== "awaiting_plan_approval") {
    await sendText(
      chatId,
      `Task is in status '${task.status}' — buttons no longer apply.`,
    );
    return;
  }

  if (action === "approve") {
    // Phase 5 placeholder — we'll wire up the code workflow next.
    await setStatus(taskId, "coding");
    await sendText(
      chatId,
      "✅ Plan approved. Coding workflow is Phase 5 — not built yet. Task parked at status='coding'.",
    );
    return;
  }

  if (action === "revise") {
    await sendText(
      chatId,
      "✏️ Type your revision now (just send a message). To abort: /cancel.",
    );
    return;
  }

  if (action === "cancel") {
    await setStatus(taskId, "cancelled");
    await sendText(chatId, "❌ Task cancelled.");
    return;
  }
}

async function handleCancel(chatId: string) {
  const active = await getActiveTask(chatId);
  if (!active) {
    await sendText(chatId, "Nothing to cancel.");
    return;
  }
  await setStatus(active.id, "cancelled");
  await sendText(chatId, `❌ Cancelled task (was status='${active.status}').`);
}

async function handleStatus(chatId: string) {
  const active = await getActiveTask(chatId);
  if (!active) {
    await sendText(chatId, "No active task.");
    return;
  }
  // Use raw count for "open since" simplicity
  const ageMs = Date.now() - new Date(active.createdAt).getTime();
  const mins = Math.round(ageMs / 60000);
  await sendText(
    chatId,
    `Active task ${active.id.slice(0, 8)} — status='${active.status}' — opened ${mins}m ago.\n\nOriginal: "${active.originalMessage}"`,
  );
}
