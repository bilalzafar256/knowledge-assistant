// Opens a dev → main PR for a task whose feature branch has already been
// merged into dev. Saves the URL, marks the task done, and notifies Telegram.
// Does not run the coder or verifier — just opens the PR. The user merges
// dev → main themselves on GitHub.
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
  SELECT id, original_message, pr_url
    FROM telegram_tasks
   WHERE id = ${TASK_ID}::uuid
`;
if (!task) {
  console.error(`Task ${TASK_ID} not found.`);
  process.exit(1);
}

const title = `telegram: promote to main — ${task.original_message}`.slice(0, 80);
const body = [
  `_Promotes the Telegram task \`${short}\` from \`dev\` to \`main\`._`,
  "",
  `**Original request:** ${task.original_message}`,
  task.pr_url ? `\n**Feature PR (already merged into dev):** ${task.pr_url}` : "",
].join("\n");

const ghRes = await fetch(
  `https://api.github.com/repos/${owner}/${repo}/pulls`,
  {
    method: "POST",
    headers: {
      Authorization: `Bearer ${GH_TOKEN}`,
      Accept: "application/vnd.github+json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ title, body, head: "dev", base: "main" }),
  },
);

const ghJson = await ghRes.json();
if (!ghRes.ok) {
  console.error("dev→main PR creation failed:", ghRes.status, JSON.stringify(ghJson));
  // Roll the task back so the user can retry from the same buttons.
  await sql`
    UPDATE telegram_tasks
       SET status = 'awaiting_main_pr', updated_at = NOW()
     WHERE id = ${TASK_ID}::uuid
  `;
  const errText = `❌ *Could not open dev → main PR* · task \`${short}\`\n\n${ghJson.message ?? "Unknown error"}`;
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

const prUrl = ghJson.html_url;
const prNumber = ghJson.number;

await sql`
  UPDATE telegram_tasks
     SET main_pr_url = ${prUrl}, status = 'done', updated_at = NOW()
   WHERE id = ${TASK_ID}::uuid
`;

const text = [
  `🚀 *dev → main PR opened* · task \`${short}\``,
  "",
  `[#${prNumber} — review and merge on GitHub](${prUrl})`,
  "",
  "_Task complete. Merge it on GitHub when you're ready._",
].join("\n");

await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    chat_id: CHAT_ID,
    text,
    parse_mode: "Markdown",
    disable_web_page_preview: false,
  }),
});

console.log(`dev→main PR opened: ${prUrl}`);
