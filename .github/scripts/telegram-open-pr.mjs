// Opens a PR from the task's branch into `dev`, saves the URL, marks
// the task done, and notifies Telegram.
//
// Env: DATABASE_URL, BOT_TOKEN, GH_TOKEN, TASK_ID, CHAT_ID

import { neon } from "@neondatabase/serverless";

const { DATABASE_URL, BOT_TOKEN, GH_TOKEN, TASK_ID, CHAT_ID } = process.env;
if (!DATABASE_URL || !BOT_TOKEN || !GH_TOKEN || !TASK_ID || !CHAT_ID) {
  console.error("Missing one of DATABASE_URL, BOT_TOKEN, GH_TOKEN, TASK_ID, CHAT_ID");
  process.exit(1);
}

const short = TASK_ID.slice(0, 8);

const sql = neon(DATABASE_URL);
const [task] = await sql`
  SELECT id, original_message, plan_markdown, branch_name, revision_notes
    FROM telegram_tasks
   WHERE id = ${TASK_ID}::uuid
`;

if (!task) {
  console.error(`Task ${TASK_ID} not found.`);
  process.exit(1);
}
if (!task.branch_name) {
  console.error(`Task ${TASK_ID} has no branch_name — cannot open PR.`);
  process.exit(1);
}

const title = `telegram: ${task.original_message}`.slice(0, 80);

const notes = Array.isArray(task.revision_notes) ? task.revision_notes : [];
const notesBlock = notes.length
  ? `\n\n## Iteration notes\n\n${notes.map((n) => `- ${n}`).join("\n")}`
  : "";

const body = [
  `_Opened from Telegram bot · task \`${short}\`_`,
  "",
  `**Original request:** ${task.original_message}`,
  "",
  "## Approved plan",
  "",
  task.plan_markdown ?? "(plan not recorded)",
  notesBlock,
].join("\n");

// Use the GitHub REST API directly so we don't depend on gh CLI presence.
// Get owner/repo from GITHUB_REPOSITORY (provided by Actions runner).
const { GITHUB_REPOSITORY } = process.env;
if (!GITHUB_REPOSITORY) {
  console.error("GITHUB_REPOSITORY env var missing.");
  process.exit(1);
}
const [owner, repo] = GITHUB_REPOSITORY.split("/");

const ghRes = await fetch(
  `https://api.github.com/repos/${owner}/${repo}/pulls`,
  {
    method: "POST",
    headers: {
      Authorization: `Bearer ${GH_TOKEN}`,
      Accept: "application/vnd.github+json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      title,
      body,
      head: task.branch_name,
      base: "dev",
    }),
  },
);

const ghJson = await ghRes.json();
if (!ghRes.ok) {
  console.error("PR creation failed:", ghRes.status, JSON.stringify(ghJson));
  process.exit(1);
}

const prUrl = ghJson.html_url;
const prNumber = ghJson.number;

await sql`
  UPDATE telegram_tasks
     SET pr_url = ${prUrl}, status = 'awaiting_pr_merge', updated_at = NOW()
   WHERE id = ${TASK_ID}::uuid
`;

const text = [
  `🚀 *PR opened* · task \`${short}\``,
  "",
  `[#${prNumber} — open on GitHub](${prUrl})`,
  "",
  `*Branch:* \`${task.branch_name}\` → \`dev\``,
  "",
  "_Merge it to `dev`, request more changes, or pause for later._",
].join("\n");

const replyMarkup = {
  inline_keyboard: [
    [
      { text: "✅ Merge to dev", callback_data: `tg:merge:${TASK_ID}` },
      { text: "✏️ Request changes", callback_data: `tg:revise:${TASK_ID}` },
      { text: "⏸ Later", callback_data: `tg:later:${TASK_ID}` },
    ],
  ],
};

await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    chat_id: CHAT_ID,
    text,
    parse_mode: "Markdown",
    disable_web_page_preview: false,
    reply_markup: replyMarkup,
  }),
});

console.log(`PR opened: ${prUrl}`);
