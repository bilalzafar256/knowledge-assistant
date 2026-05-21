// Variant of telegram-save-plan.mjs for when the planner returned
// `# QUESTIONS` instead of a plan. Stores the questions text, flips
// status to 'awaiting_clarification', and sends them to Telegram with
// a single Cancel button (the user replies with text to answer).
//
// Env vars: DATABASE_URL, BOT_TOKEN, TASK_ID, CHAT_ID

import { readFileSync } from "node:fs";
import { neon } from "@neondatabase/serverless";

const { DATABASE_URL, BOT_TOKEN, TASK_ID, CHAT_ID } = process.env;

if (!DATABASE_URL || !BOT_TOKEN || !TASK_ID || !CHAT_ID) {
  console.error("Missing one of DATABASE_URL, BOT_TOKEN, TASK_ID, CHAT_ID");
  process.exit(1);
}

const short = TASK_ID.slice(0, 8);
const questionsMd = readFileSync("plan.md", "utf8").trim();

const sql = neon(DATABASE_URL);
await sql`
  UPDATE telegram_tasks
     SET plan_markdown = ${questionsMd},
         status = 'awaiting_clarification',
         updated_at = NOW()
   WHERE id = ${TASK_ID}::uuid
`;

const MAX_BODY = 3500;
let body = questionsMd;
if (body.length > MAX_BODY) body = body.slice(0, MAX_BODY) + "\n\n…(truncated)";

const text = [
  `❓ *Clarifications needed* · task \`${short}\``,
  "",
  body,
  "",
  "_Reply with your answers in one message, or cancel below._",
].join("\n");

const replyMarkup = {
  inline_keyboard: [
    [{ text: "❌ Cancel", callback_data: `tg:cancel:${TASK_ID}` }],
  ],
};

async function send(useMarkdown) {
  return fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: CHAT_ID,
      text,
      ...(useMarkdown ? { parse_mode: "Markdown" } : {}),
      reply_markup: replyMarkup,
    }),
  });
}

let res = await send(true);
if (!res.ok) {
  console.error("Markdown send failed:", res.status, await res.text());
  res = await send(false);
  if (!res.ok) {
    console.error("Plain send also failed:", res.status, await res.text());
    process.exit(1);
  }
}

console.log("Questions saved + Telegram message sent.");
