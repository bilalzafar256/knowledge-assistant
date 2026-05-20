// Variant of telegram-save-plan.mjs for when the planner returned
// `# QUESTIONS` instead of a plan. Stores the questions text in
// plan_markdown (re-used as a generic "last planner output" column),
// flips status to 'awaiting_clarification', and sends the questions
// to Telegram with a single Cancel button.
//
// Env vars: DATABASE_URL, BOT_TOKEN, TASK_ID, CHAT_ID

import { readFileSync } from "node:fs";
import { neon } from "@neondatabase/serverless";

const { DATABASE_URL, BOT_TOKEN, TASK_ID, CHAT_ID } = process.env;

if (!DATABASE_URL || !BOT_TOKEN || !TASK_ID || !CHAT_ID) {
  console.error("Missing one of DATABASE_URL, BOT_TOKEN, TASK_ID, CHAT_ID");
  process.exit(1);
}

const questionsMd = readFileSync("plan.md", "utf8").trim();

const sql = neon(DATABASE_URL);
await sql`
  UPDATE telegram_tasks
     SET plan_markdown = ${questionsMd},
         status = 'awaiting_clarification',
         updated_at = NOW()
   WHERE id = ${TASK_ID}::uuid
`;

const MAX = 3500;
const header = `❓ I need a couple of clarifications before planning. Reply with your answers (one message is fine).\n\n`;
let body = questionsMd;
if (body.length > MAX) {
  body = body.slice(0, MAX) + "\n\n…(truncated)";
}
const text = header + body;

const replyMarkup = {
  inline_keyboard: [
    [{ text: "❌ Cancel", callback_data: `tg:cancel:${TASK_ID}` }],
  ],
};

const res = await fetch(
  `https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`,
  {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: CHAT_ID,
      text,
      reply_markup: replyMarkup,
    }),
  },
);

if (!res.ok) {
  console.error("Telegram sendMessage failed:", res.status, await res.text());
  process.exit(1);
}

console.log("Questions saved + Telegram message sent.");
