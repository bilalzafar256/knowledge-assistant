// Coder ran but produced no file changes. Park the task back at
// awaiting_plan_approval (the user can revise or cancel) and tell them.
//
// Env: DATABASE_URL, BOT_TOKEN, TASK_ID, CHAT_ID

import { neon } from "@neondatabase/serverless";

const { DATABASE_URL, BOT_TOKEN, TASK_ID, CHAT_ID } = process.env;
const short = TASK_ID.slice(0, 8);

const sql = neon(DATABASE_URL);
await sql`
  UPDATE telegram_tasks
     SET status = 'awaiting_plan_approval', updated_at = NOW()
   WHERE id = ${TASK_ID}::uuid
`;

const replyMarkup = {
  inline_keyboard: [
    [
      { text: "✏️ Revise", callback_data: `tg:revise:${TASK_ID}` },
      { text: "❌ Cancel", callback_data: `tg:cancel:${TASK_ID}` },
    ],
  ],
};

await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    chat_id: CHAT_ID,
    text: `⚠️ Coder produced no file changes · task \`${short}\`.\n\nThe coder thought the plan was a no-op or hit an issue. Reply with what should change, or pick:`,
    parse_mode: "Markdown",
    reply_markup: replyMarkup,
  }),
});

console.log("No-changes message sent.");
