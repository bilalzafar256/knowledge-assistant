Both files look right. Per the coder skill, I should produce only the summary — no need to test types since the diff is documentation-only.

## Summary
Refreshed `CLAUDE.md` (tech-stack list now names Inngest, Drizzle, OpenAI, pnpm; doc-update directive points at the correctly-cased on-disk filenames) and rewrote three sections of `PROJECT_PLAN.md` so it matches what's actually in the tree at HEAD.

## Files changed
- `CLAUDE.md` — corrected core-instruction filenames (`PROJECT_PLAN.md`, `Readme.md`), swapped "Vercel Workflows" for "Inngest (event-driven queue, with 55 s inline fallback)", added ORM/LLM/package-manager lines, added a one-line pointer to the Telegram pipeline.
- `PROJECT_PLAN.md` `## Migrations` — added a sentence noting `drizzle/` is `.gitignore`d (line 20) so migration filenames aren't checked into a fresh clone.
- `PROJECT_PLAN.md` (new section between `## Core Library` and `## RAG Pipeline`) — added `## Helper Scripts & Agent Skills` with one-line descriptions for each of the 7 scripts in `.github/scripts/` and each of the 11 skills in `.agents/skills/`.
- `PROJECT_PLAN.md` `## Telegram → PR Bot` — replaced the obsolete single-`telegram-to-pr.yml` flow with the actual three-workflow pipeline (`telegram-plan.yml` / `telegram-code.yml` / `telegram-pr.yml`) driven by the classifier and `repository_dispatch` event types `plan-task` / `code-task` / `pr-task`, persisting state to Neon's `telegram_tasks`. Added `DATABASE_URL` to env vars and noted the workflow secrets accordingly.

## Deviations from the plan
None.

## Notes for the reviewer
- `Readme.md` (mixed-case) also still describes the old `.github/workflows/telegram-to-pr.yml` flow at roughly lines 184 and 195. The plan flagged this under Risks and deliberately left it out of scope; happy to fix in a follow-up if you want the README and PROJECT_PLAN to stay in sync.
- The `## Migrations` table still lists `drizzle/0000_…sql` etc. by name. I added a caveat note rather than deleting the rows so the historical record survives — if you'd rather have those rows removed entirely, that's a one-edit follow-up.
- Only one commit is reachable from this shallow clone (`31e914c`), so "all latest commits" was interpreted as "current state of `main`." Mentioned in the original plan; raising again here so it doesn't surprise you.
