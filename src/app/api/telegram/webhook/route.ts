import { NextRequest, NextResponse } from "next/server";
import { env } from "@/lib/env";
import { db } from "@/lib/db";
import { telegramTasks } from "@/lib/schema";
import { eq } from "drizzle-orm";
import { classifyMessage } from "@/lib/telegram-classifier";

export const runtime = "nodejs";

async function sendTelegram(chatId: number, text: string) {
  if (!env.TELEGRAM_BOT_TOKEN) return;
  await fetch(
    `https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/sendMessage`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, text }),
    },
  );
}

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
  const message = body.message;
  if (!message?.text) return NextResponse.json({ ok: true });

  const chatId: number = message.chat.id;
  const text: string = message.text;

  if (String(chatId) !== env.TELEGRAM_CHAT_ID) {
    return NextResponse.json({ ok: true });
  }

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
    return NextResponse.json({ error: "insert failed" }, { status: 500 });
  }

  let classification;
  try {
    classification = await classifyMessage(text);
  } catch (err) {
    console.error("[telegram] classifier failed", err);
    await db
      .update(telegramTasks)
      .set({ status: "cancelled", updatedAt: new Date() })
      .where(eq(telegramTasks.id, task.id));
    await sendTelegram(
      chatId,
      "Couldn't read your message (classifier error). Try again in a moment.",
    );
    return NextResponse.json({ error: "classifier failed" }, { status: 500 });
  }

  if (classification.kind === "discussion") {
    await db
      .update(telegramTasks)
      .set({
        kind: "discussion",
        status: "done",
        updatedAt: new Date(),
      })
      .where(eq(telegramTasks.id, task.id));

    await sendTelegram(
      chatId,
      classification.reply?.trim() ||
        "(I classified that as a question but didn't produce a reply — try rephrasing.)",
    );
    return NextResponse.json({ ok: true });
  }

  await db
    .update(telegramTasks)
    .set({
      kind: "requirement",
      status: "awaiting_plan",
      updatedAt: new Date(),
    })
    .where(eq(telegramTasks.id, task.id));

  await sendTelegram(
    chatId,
    `📝 Got it: "${text}"\n\nClassified as a code change. Plan-building step is coming in phase 3 — for now this task is saved and ready.`,
  );

  return NextResponse.json({ ok: true });
}
