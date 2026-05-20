// Reads plan.md, writes it to telegram_tasks.plan_markdown, sets status to
// 'awaiting_plan_approval', and sends the plan to Telegram with an inline
// keyboard (Approve / Revise / Cancel).
//
// Env vars: DATABASE_URL, BOT_TOKEN, TASK_ID, CHAT_ID, WARNINGS (optional)

import { readFileSync } from "node:fs";
import { neon } from "@neondatabase/serverless";

const { DATABASE_URL, BOT_TOKEN, TASK_ID, CHAT_ID, WARNINGS } = process.env;

if (!DATABASE_URL || !BOT_TOKEN || !TASK_ID || !CHAT_ID) {
  console.error("Missing one of DATABASE_URL, BOT_TOKEN, TASK_ID, CHAT_ID");
  process.exit(1);
}

const planMarkdown = readFileSync("plan.md", "utf8").trim();

// 1. Persist plan to DB
const sql = neon(DATABASE_URL);
await sql`
  UPDATE telegram_tasks
     SET plan_markdown = ${planMarkdown},
         status = 'awaiting_plan_approval',
         updated_at = NOW()
   WHERE id = ${TASK_ID}::uuid
`;

// 2. Send to Telegram with inline keyboard
//    Telegram caps message text at 4096 chars — truncate if needed.
const MAX = 3500;
const warningsBlock =
  WARNINGS && WARNINGS.trim()
    ? `\n\n⚠️ Verifier notes:\n${WARNINGS}`
    : "";
const header = `📋 PLAN — review and choose:\n\n`;
let body = planMarkdown;
if (body.length > MAX) {
  body = body.slice(0, MAX) + "\n\n…(truncated — see GitHub Actions logs for full plan)";
}
const text = header + body + warningsBlock;

const replyMarkup = {
  inline_keyboard: [
    [
      { text: "✅ Approve", callback_data: `tg:approve:${TASK_ID}` },
      { text: "✏️ Revise", callback_data: `tg:revise:${TASK_ID}` },
      { text: "❌ Cancel", callback_data: `tg:cancel:${TASK_ID}` },
    ],
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
      parse_mode: "Markdown",
      reply_markup: replyMarkup,
    }),
  },
);

if (!res.ok) {
  const errText = await res.text();
  console.error("Telegram sendMessage failed:", res.status, errText);
  // Try once more without parse_mode in case Markdown rendering blew up
  const fallback = await fetch(
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
  if (!fallback.ok) {
    console.error("Fallback also failed:", fallback.status, await fallback.text());
    process.exit(1);
  }
}

console.log("Plan saved + Telegram message sent.");
