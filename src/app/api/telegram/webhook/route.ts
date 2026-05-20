import { NextRequest, NextResponse } from 'next/server';
import { env } from '@/lib/env';

export const runtime = 'nodejs';

async function sendTelegram(chatId: number, text: string) {
  if (!env.TELEGRAM_BOT_TOKEN) return;
  await fetch(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, text }),
  });
}

export async function POST(req: NextRequest) {
  if (
    !env.TELEGRAM_BOT_TOKEN ||
    !env.TELEGRAM_CHAT_ID ||
    !env.TELEGRAM_WEBHOOK_SECRET ||
    !env.GITHUB_PAT
  ) {
    return NextResponse.json({ error: 'telegram bot not configured' }, { status: 503 });
  }

  const secret = req.headers.get('x-telegram-bot-api-secret-token');
  if (secret !== env.TELEGRAM_WEBHOOK_SECRET) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const body = await req.json();
  const message = body.message;
  if (!message?.text) return NextResponse.json({ ok: true });

  const chatId: number = message.chat.id;
  const text: string = message.text;

  if (String(chatId) !== env.TELEGRAM_CHAT_ID) {
    return NextResponse.json({ ok: true });
  }

  const repo = env.GITHUB_REPO ?? 'bilalzafar256/knowledge-assistant';
  const ghRes = await fetch(`https://api.github.com/repos/${repo}/dispatches`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${env.GITHUB_PAT}`,
      Accept: 'application/vnd.github+json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      event_type: 'telegram-task',
      client_payload: { message: text, chat_id: chatId },
    }),
  });

  if (!ghRes.ok) {
    await sendTelegram(chatId, `Failed to start job (${ghRes.status}).`);
    return NextResponse.json({ error: 'github failed' }, { status: 500 });
  }

  await sendTelegram(chatId, `Working on: "${text}"\nI'll send the PR link when ready.`);
  return NextResponse.json({ ok: true });
}
