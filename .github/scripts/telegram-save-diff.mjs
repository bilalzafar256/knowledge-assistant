// Persists the just-pushed branch + diff summary to telegram_tasks,
// flips status to 'awaiting_code_approval', and sends the diff summary
// to Telegram with [Approve & open PR / Revise / Cancel] buttons.
//
// Env vars: DATABASE_URL, BOT_TOKEN, TASK_ID, CHAT_ID, BRANCH,
//           DIFF_STAT, DIFF_FILES

import { readFileSync } from "node:fs";
import { neon } from "@neondatabase/serverless";

const {
  DATABASE_URL,
  BOT_TOKEN,
  TASK_ID,
  CHAT_ID,
  BRANCH,
  DIFF_STAT,
  DIFF_FILES,
} = process.env;

if (!DATABASE_URL || !BOT_TOKEN || !TASK_ID || !CHAT_ID || !BRANCH) {
  console.error("Missing one of DATABASE_URL, BOT_TOKEN, TASK_ID, CHAT_ID, BRANCH");
  process.exit(1);
}

const short = TASK_ID.slice(0, 8);
const stat = (DIFF_STAT ?? "").trim();
const files = (DIFF_FILES ?? "")
  .split("\n")
  .map((s) => s.trim())
  .filter(Boolean);

let coderSummary = "";
try {
  coderSummary = readFileSync("coder-summary.md", "utf8").trim();
} catch {
  coderSummary = "(coder produced no summary)";
}

// Build a tidy Telegram message
const lines = [];
lines.push(`🛠️ *Code ready* · task \`${short}\``);
lines.push("");
lines.push(`*Branch:* \`${BRANCH}\``);
if (stat) {
  // Last line of git diff --stat is "N files changed, …"
  const summaryLine = stat.split("\n").slice(-1)[0]?.trim();
  if (summaryLine) lines.push(`*Diff:* ${summaryLine}`);
}
if (files.length) {
  lines.push("");
  lines.push("*Files:*");
  for (const f of files.slice(0, 20)) lines.push(`• \`${f}\``);
  if (files.length > 20) lines.push(`• …and ${files.length - 20} more`);
}
lines.push("");
lines.push("*Coder summary:*");
const MAX_SUMMARY = 1800;
lines.push(
  coderSummary.length > MAX_SUMMARY
    ? coderSummary.slice(0, MAX_SUMMARY) + "\n…(truncated)"
    : coderSummary,
);
lines.push("");
lines.push("_Approve to open a PR, or reply with revisions._");

const text = lines.join("\n");

const sql = neon(DATABASE_URL);
await sql`
  UPDATE telegram_tasks
     SET branch_name = ${BRANCH},
         diff_summary = ${text},
         status = 'awaiting_code_approval',
         updated_at = NOW()
   WHERE id = ${TASK_ID}::uuid
`;

const replyMarkup = {
  inline_keyboard: [
    [
      { text: "✅ Approve & open PR", callback_data: `tg:approve:${TASK_ID}` },
      { text: "✏️ Revise", callback_data: `tg:revise:${TASK_ID}` },
      { text: "❌ Cancel", callback_data: `tg:cancel:${TASK_ID}` },
    ],
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
  // Markdown can fail on stray underscores/asterisks — retry plain
  console.error("Markdown send failed:", res.status, await res.text());
  res = await send(false);
  if (!res.ok) {
    console.error("Plain send also failed:", res.status, await res.text());
    process.exit(1);
  }
}

console.log("Diff saved + Telegram message sent.");
