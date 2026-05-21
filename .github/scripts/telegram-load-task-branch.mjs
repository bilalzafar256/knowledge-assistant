// Used by the telegram-code workflow. Loads the task from Neon,
// allocates a branch name if the task doesn't have one yet, and emits
// outputs the workflow needs to (a) check out the branch and (b) feed
// the coder the right context.
//
// Env vars: DATABASE_URL, TASK_ID
// Outputs (to $GITHUB_OUTPUT):
//   branch          — the branch name to check out
//   is_new_branch   — "true" if we just allocated it, "false" if it already existed
//   plan            — the approved plan markdown
//   revision_notes  — concatenated user feedback (may be empty)
//   message         — the original user request

import { execSync } from "node:child_process";
import { appendFileSync, writeFileSync } from "node:fs";
import { neon } from "@neondatabase/serverless";

const { DATABASE_URL, TASK_ID, GITHUB_OUTPUT } = process.env;
if (!DATABASE_URL || !TASK_ID || !GITHUB_OUTPUT) {
  console.error("Missing DATABASE_URL, TASK_ID or GITHUB_OUTPUT");
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

// Pass big strings through files to avoid shell escaping landmines,
// then expose the file paths or contents via outputs.
writeFileSync("plan.md", task.plan_markdown ?? "");
writeFileSync("revision-notes.md", notes);
writeFileSync("message.txt", task.original_message ?? "");

const out = (key, value) => {
  appendFileSync(GITHUB_OUTPUT, `${key}<<EOFTEL_${key}\n${value}\nEOFTEL_${key}\n`);
};
appendFileSync(GITHUB_OUTPUT, `branch=${branch}\n`);
appendFileSync(GITHUB_OUTPUT, `is_new_branch=${isNew}\n`);
out("plan", task.plan_markdown ?? "");
out("revision_notes", notes);
out("message", task.original_message ?? "");

console.log(`Branch: ${branch} (new=${isNew})`);
