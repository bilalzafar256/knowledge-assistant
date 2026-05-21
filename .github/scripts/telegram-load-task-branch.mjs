// Used by the telegram-code workflow. Loads the task from Neon,
// allocates a branch name if the task doesn't have one yet, and emits
// outputs the workflow needs to (a) check out the branch and (b) feed
// the coder the right context.
//
// Env vars: DATABASE_URL, TASK_ID, RUNNER_TEMP
// Outputs (to $GITHUB_OUTPUT):
//   branch          — the branch name to check out
//   is_new_branch   — "true" if we just allocated it, "false" if it already existed
//   plan_path       — file path (in $RUNNER_TEMP) holding the approved plan
//   revision_path   — file path (in $RUNNER_TEMP) holding revision notes (may be empty)
//   message_path    — file path (in $RUNNER_TEMP) holding the original user request

import { execSync } from "node:child_process";
import { appendFileSync, writeFileSync } from "node:fs";
import { neon } from "@neondatabase/serverless";

const { DATABASE_URL, TASK_ID, GITHUB_OUTPUT, RUNNER_TEMP } = process.env;
if (!DATABASE_URL || !TASK_ID || !GITHUB_OUTPUT || !RUNNER_TEMP) {
  console.error("Missing DATABASE_URL, TASK_ID, GITHUB_OUTPUT or RUNNER_TEMP");
  process.exit(1);
}

const sql = neon(DATABASE_URL);
const rows = await sql`
  SELECT id, original_message, plan_markdown, branch_name, revision_notes
    FROM telegram_tasks
   WHERE id = ${TASK_ID}::uuid
`;
const task = rows[0];
if (!task) {
  console.error(`Task ${TASK_ID} not found.`);
  process.exit(1);
}

let branch = task.branch_name;
let isNew = false;
if (!branch) {
  branch = `telegram/${TASK_ID.slice(0, 8)}`;
  isNew = true;
  await sql`
    UPDATE telegram_tasks
       SET branch_name = ${branch}, updated_at = NOW()
     WHERE id = ${TASK_ID}::uuid
  `;
}

// Try to check out the branch. If it doesn't exist on the remote yet,
// create it. If it does exist, fetch and check it out.
try {
  if (isNew) {
    execSync(`git checkout -b "${branch}"`, { stdio: "inherit" });
  } else {
    execSync(
      `git fetch origin "${branch}":"${branch}" 2>/dev/null || git fetch origin "${branch}"`,
      { stdio: "inherit", shell: "/bin/bash" },
    );
    execSync(`git checkout "${branch}"`, { stdio: "inherit" });
  }
} catch (err) {
  console.error("git checkout failed:", err);
  process.exit(1);
}

const notes = Array.isArray(task.revision_notes)
  ? task.revision_notes.join("\n\n---\n\n")
  : "";

// Pass big strings through files to avoid shell escaping landmines.
// Write to $RUNNER_TEMP (outside the repo checkout) so `git add -A` in
// later steps can't sweep them into the commit.
const planPath = `${RUNNER_TEMP}/plan.md`;
const revisionPath = `${RUNNER_TEMP}/revision-notes.md`;
const messagePath = `${RUNNER_TEMP}/message.txt`;
writeFileSync(planPath, task.plan_markdown ?? "");
writeFileSync(revisionPath, notes);
writeFileSync(messagePath, task.original_message ?? "");

appendFileSync(GITHUB_OUTPUT, `branch=${branch}\n`);
appendFileSync(GITHUB_OUTPUT, `is_new_branch=${isNew}\n`);
appendFileSync(GITHUB_OUTPUT, `plan_path=${planPath}\n`);
appendFileSync(GITHUB_OUTPUT, `revision_path=${revisionPath}\n`);
appendFileSync(GITHUB_OUTPUT, `message_path=${messagePath}\n`);

console.log(`Branch: ${branch} (new=${isNew})`);
