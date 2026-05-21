// Squash-merges the feature → dev PR for a task, then asks Telegram if the
// user wants to open a dev → main PR.
//
// Env: DATABASE_URL, BOT_TOKEN, GH_TOKEN, TASK_ID, CHAT_ID, GITHUB_REPOSITORY

import { neon } from "@neondatabase/serverless";

const {
  DATABASE_URL,
  BOT_TOKEN,
  GH_TOKEN,
  TASK_ID,
  CHAT_ID,
  GITHUB_REPOSITORY,
} = process.env;
if (
  !DATABASE_URL ||
  !BOT_TOKEN ||
  !GH_TOKEN ||
  !TASK_ID ||
  !CHAT_ID ||
  !GITHUB_REPOSITORY
) {
  console.error(
    "Missing one of DATABASE_URL, BOT_TOKEN, GH_TOKEN, TASK_ID, CHAT_ID, GITHUB_REPOSITORY",
  );
  process.exit(1);
}

const short = TASK_ID.slice(0, 8);
const [owner, repo] = GITHUB_REPOSITORY.split("/");

const sql = neon(DATABASE_URL);
const [task] = await sql`
  SELECT id, pr_url, branch_name, original_message
    FROM telegram_tasks
   WHERE id = ${TASK_ID}::uuid
`;

if (!task) {
  console.error(`Task ${TASK_ID} not found.`);
  process.exit(1);
}
if (!task.pr_url) {
  console.error(`Task ${TASK_ID} has no pr_url — nothing to merge.`);
  process.exit(1);
}

const prNumber = Number(task.pr_url.split("/").pop());
if (!Number.isFinite(prNumber)) {
  console.error(`Could not parse PR number from ${task.pr_url}`);
  process.exit(1);
}

const mergeRes = await fetch(
  `https://api.github.com/repos/${owner}/${repo}/pulls/${prNumber}/merge`,
  {
    method: "PUT",
    headers: {
      Authorization: `Bearer ${GH_TOKEN}`,
      Accept: "application/vnd.github+json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      merge_method: "squash",
      commit_title: `telegram: ${task.original_message}`.slice(0, 70),
    }),
  },
);

const mergeJson = await mergeRes.json();
if (!mergeRes.ok || !mergeJson.merged) {
  console.error("Merge failed:", mergeRes.status, JSON.stringify(mergeJson));
  await sql`
    UPDATE telegram_tasks
       SET status = 'awaiting_pr_merge', updated_at = NOW()
     WHERE id = ${TASK_ID}::uuid
  `;
  const errText = `❌ *Merge failed* · task \`${short}\`\n\n${mergeJson.message ?? "Unknown error"}`;
  await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: CHAT_ID,
      text: errText,
      parse_mode: "Markdown",
    }),
  });
  process.exit(1);
}

await sql`
  UPDATE telegram_tasks
     SET status = 'awaiting_main_pr', updated_at = NOW()
   WHERE id = ${TASK_ID}::uuid
`;

const text = [
  `✅ *Merged to dev* · task \`${short}\``,
  "",
  `[PR #${prNumber}](${task.pr_url}) · branch \`${task.branch_name}\``,
  "",
  "_Promote to `main` by opening a `dev → main` PR?_",
].join("\n");

const replyMarkup = {
  inline_keyboard: [
    [
      { text: "🚀 Open dev → main PR", callback_data: `tg:open_main_pr:${TASK_ID}` },
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

console.log(`Merged PR #${prNumber} to dev.`);
