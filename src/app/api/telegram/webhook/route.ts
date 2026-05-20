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

const shortId = (id: string) => id.slice(0, 8);

// ── Telegram helpers ─────────────────────────────────────────────────────────

async function tg(method: string, payload: unknown) {
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

async function sendText(
  chatId: number | string,
  text: string,
  opts: { markdown?: boolean } = {},
) {
  return tg("sendMessage", {
    chat_id: chatId,
    text,
    ...(opts.markdown ? { parse_mode: "Markdown" } : {}),
  });
}

async function answerCallback(callbackId: string, text?: string) {
  await tg("answerCallbackQuery", { callback_query_id: callbackId, text });
}

// ── GitHub dispatch ──────────────────────────────────────────────────────────

async function dispatchWorkflow(
  eventType: string,
  payload: Record<string, unknown>,
): Promise<boolean> {
  const repo = env.GITHUB_REPO ?? "bilalzafar256/knowledge-assistant";
  const res = await fetch(`https://api.github.com/repos/${repo}/dispatches`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.GITHUB_PAT}`,
      Accept: "application/vnd.github+json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      event_type: eventType,
      client_payload: payload,
    }),
  });
  if (!res.ok) {
    console.error("[telegram] dispatch failed", eventType, res.status, await res.text());
  }
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

  if (body.callback_query) {
    await handleCallback(body.callback_query);
    return NextResponse.json({ ok: true });
  }

  const message = body.message;
  if (!message?.text) return NextResponse.json({ ok: true });

  const chatId: number = message.chat.id;
  const text: string = message.text;

  if (String(chatId) !== env.TELEGRAM_CHAT_ID) {
    return NextResponse.json({ ok: true });
  }

  if (text.startsWith("/cancel")) {
    await handleCancel(String(chatId));
    return NextResponse.json({ ok: true });
  }
  if (text.startsWith("/status")) {
    await handleStatus(String(chatId));
    return NextResponse.json({ ok: true });
  }
  if (text.startsWith("/help") || text.startsWith("/start")) {
    await handleHelp(chatId);
    return NextResponse.json({ ok: true });
  }

  const active = await getActiveTask(String(chatId));
  if (active) {
    if (
      active.status === "awaiting_plan_approval" ||
      active.status === "awaiting_clarification" ||
      active.status === "awaiting_code_approval"
    ) {
      await handleFeedback(active.id, chatId, text, active.status);
    } else {
      await sendText(
        chatId,
        `⏳ Task \`${shortId(active.id)}\` is busy (status: \`${active.status}\`).\n\nReply when prompted, or send /cancel to abort.`,
        { markdown: true },
      );
    }
    return NextResponse.json({ ok: true });
  }

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

  await db
    .update(telegramTasks)
    .set({ kind: "requirement", status: "planning", updatedAt: new Date() })
    .where(eq(telegramTasks.id, task.id));

  const ok = await dispatchWorkflow("plan-task", {
    task_id: task.id,
    chat_id: chatId,
    message: text,
    revision_notes: "",
  });

  if (!ok) {
    await setStatus(task.id, "cancelled");
    await sendText(chatId, "⚠️ Failed to start the planning workflow.");
    return;
  }

  await sendText(
    chatId,
    `📝 *Got it* · task \`${shortId(task.id)}\`\n\nClassified as a code change. Planning now…`,
    { markdown: true },
  );
}

async function handleFeedback(
  taskId: string,
  chatId: number,
  text: string,
  previousStatus: TelegramTaskStatus,
) {
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
      : previousStatus === "awaiting_code_approval"
        ? "Code revision"
        : "Plan revision";
  const labeled = `[${label}]\n${text}`;
  const existing = Array.isArray(task.revisionNotes) ? task.revisionNotes : [];
  const updatedNotes = [...existing, labeled];

  // Code revisions re-dispatch the code workflow; everything else replans.
  const nextStatus: TelegramTaskStatus =
    previousStatus === "awaiting_code_approval" ? "coding" : "planning";
  const eventType =
    previousStatus === "awaiting_code_approval" ? "code-task" : "plan-task";

  await db
    .update(telegramTasks)
    .set({
      revisionNotes: updatedNotes,
      status: nextStatus,
      updatedAt: new Date(),
    })
    .where(eq(telegramTasks.id, taskId));

  const ok = await dispatchWorkflow(eventType, {
    task_id: taskId,
    chat_id: chatId,
    message: task.originalMessage,
    revision_notes: updatedNotes.join("\n\n---\n\n"),
  });

  if (!ok) {
    await setStatus(taskId, previousStatus);
    await sendText(chatId, "⚠️ Failed to start the follow-up workflow.");
    return;
  }

  const ack =
    previousStatus === "awaiting_clarification"
      ? "📝 Got your answers. Planning…"
      : previousStatus === "awaiting_code_approval"
        ? "✏️ Got the revision. Updating code…"
        : "✏️ Got the revision. Re-planning…";
  await sendText(chatId, `${ack} · task \`${shortId(taskId)}\``, { markdown: true });
}

async function handleCallback(cb: {
  id: string;
  data?: string;
  message?: { chat: { id: number } };
  from?: { id: number };
}) {
  await answerCallback(cb.id);

  const data = cb.data ?? "";
  const chatId = cb.message?.chat.id;
  if (!chatId || String(chatId) !== env.TELEGRAM_CHAT_ID) return;

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
  const short = shortId(taskId);

  // ── Approve ───────────────────────────────────────────────────────────────
  if (action === "approve") {
    if (task.status === "awaiting_plan_approval") {
      await setStatus(taskId, "coding");
      const ok = await dispatchWorkflow("code-task", {
        task_id: taskId,
        chat_id: chatId,
      });
      if (!ok) {
        await setStatus(taskId, "awaiting_plan_approval");
        await sendText(chatId, `⚠️ Failed to start coding · task \`${short}\``, { markdown: true });
        return;
      }
      await sendText(
        chatId,
        `✅ *Plan approved* · task \`${short}\`\n\nStarting the coding workflow now.`,
        { markdown: true },
      );
      return;
    }
    if (task.status === "awaiting_code_approval") {
      await setStatus(taskId, "creating_pr");
      const ok = await dispatchWorkflow("pr-task", {
        task_id: taskId,
        chat_id: chatId,
      });
      if (!ok) {
        await setStatus(taskId, "awaiting_code_approval");
        await sendText(chatId, `⚠️ Failed to open PR · task \`${short}\``, { markdown: true });
        return;
      }
      await sendText(
        chatId,
        `✅ *Diff approved* · task \`${short}\`\n\nOpening the PR now.`,
        { markdown: true },
      );
      return;
    }
    await sendText(
      chatId,
      `Buttons no longer apply — task is in status \`${task.status}\`.`,
      { markdown: true },
    );
    return;
  }

  // ── Revise ────────────────────────────────────────────────────────────────
  if (action === "revise") {
    if (
      task.status !== "awaiting_plan_approval" &&
      task.status !== "awaiting_code_approval"
    ) {
      await sendText(
        chatId,
        `Buttons no longer apply — task is in status \`${task.status}\`.`,
        { markdown: true },
      );
      return;
    }
    const what =
      task.status === "awaiting_code_approval" ? "code" : "plan";
    await sendText(
      chatId,
      `✏️ *Revise* · task \`${short}\`\n\nReply with what should change in the ${what}. Send /cancel to abort.`,
      { markdown: true },
    );
    return;
  }

  // ── Cancel ────────────────────────────────────────────────────────────────
  if (action === "cancel") {
    await setStatus(taskId, "cancelled");
    await sendText(chatId, `❌ *Cancelled* · task \`${short}\``, { markdown: true });
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
  await sendText(
    chatId,
    `❌ *Cancelled* · task \`${shortId(active.id)}\` (was \`${active.status}\`)`,
    { markdown: true },
  );
}

async function handleStatus(chatId: string) {
  const active = await getActiveTask(chatId);
  if (!active) {
    await sendText(chatId, "No active task.");
    return;
  }
  const ageMs = Date.now() - new Date(active.createdAt).getTime();
  const mins = Math.round(ageMs / 60000);
  const lines = [
    `📊 *Task status* · \`${shortId(active.id)}\``,
    "",
    `*Status:* \`${active.status}\``,
    `*Age:* ${mins}m`,
    `*Original:* ${active.originalMessage}`,
  ];
  if (active.branchName) lines.push(`*Branch:* \`${active.branchName}\``);
  if (active.prUrl) lines.push(`*PR:* ${active.prUrl}`);
  await sendText(chatId, lines.join("\n"), { markdown: true });
}

async function handleHelp(chatId: number) {
  const text = [
    `👋 *Telegram → PR bot*`,
    "",
    "Send any message. I'll either:",
    "• Answer it (if it's a question)",
    "• Plan it → code it → open a PR (if it's a code change)",
    "",
    "*Commands*",
    "• /status — show the current task",
    "• /cancel — abort the active task",
    "• /help — show this message",
  ].join("\n");
  await sendText(chatId, text, { markdown: true });
}
