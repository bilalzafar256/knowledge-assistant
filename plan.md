I have enough context to produce a plan. Outputting as the final message per the skill.

# PLAN

## Goal
Refresh `CLAUDE.md` and `PROJECT_PLAN.md` so they match the actual codebase state at HEAD. The only commit in this repo's local history is `31e914c` (2026-05-21, "Merge pull request #1 from bilalzafar256/dev") — a `--depth=1` shallow clone that brought in 129 files in one squash-merge — so "latest commits" effectively means "the current state of `main`." I will fix the doc-vs-code drift surfaced by inspecting that state.

## Approach
Treat this as a documentation-drift sweep, not a "what changed since last release" diff. Read the actual code (`src/`, `.github/workflows/`, `.agents/skills/`, `src/lib/`) and rewrite the stale paragraphs in `CLAUDE.md` (very short — stack + skill pointer) and the stale sections in `PROJECT_PLAN.md` (deep — Telegram pipeline, scripts, skills system, migrations note). Schema, API-routes, pages, and components sections of `PROJECT_PLAN.md` already match the code and need no changes.

## Files I will edit

- `CLAUDE.md` — entire file (14 lines) — three corrections:
  1. Line 5: rename references `project_plan.md` → `PROJECT_PLAN.md` and `README.md` → `Readme.md` (the on-disk filenames are capitalised differently than the directive says).
  2. Line 14: `Ingestion: Vercel Workflows` → `Ingestion: Inngest (event-driven queue, with 55 s inline fallback)`. The codebase uses Inngest (`src/inngest/ingest-document.ts`, `src/lib/inngest.ts`, `src/app/api/inngest/route.ts`), not Vercel Workflows.
  3. Add three missing stack items used by the code but absent from the list: `ORM: Drizzle (Postgres + drizzle-kit migrations)`, `LLM provider: OpenAI (gpt-4o + text-embedding-3-small + gpt-4o-mini)`, `Package manager: pnpm`. Optionally a one-line pointer: "Dev-only Telegram → PR pipeline lives under `.github/workflows/telegram-*.yml` and uses skills in `.agents/skills/`."

- `PROJECT_PLAN.md` — three sections need rewrites, the rest stays:
  1. **`## Telegram → PR Bot` (lines 245-274)** — completely outdated. Currently describes a single-workflow `telegram-to-pr.yml` running `claude -p "$MESSAGE"`. Reality is a **three-workflow pipeline** triggered by `repository_dispatch` events from `/api/telegram/webhook` (`src/app/api/telegram/webhook/route.ts` uses `lib/telegram-classifier.ts` to route messages to `plan-task`, `code-task`, or `pr-task`):
     - `.github/workflows/telegram-plan.yml` — runs planner skill → plan-verifier skill (one auto-retry on block), saves plan to Neon, returns to Telegram with Approve/Revise/Cancel buttons.
     - `.github/workflows/telegram-code.yml` — runs coder skill on an approved plan, saves diff to Neon, opens a draft PR-prep branch.
     - `.github/workflows/telegram-pr.yml` — finalises and opens the PR via `gh pr create`.
     - Replace the ASCII flow block with one that shows: webhook → classifier → repository_dispatch (plan/code/pr) → corresponding workflow → Neon task row → Telegram reply.
     - Update env-var bullet to include `DATABASE_URL` (workflows persist task state in Neon).

  2. **`## Migrations` (lines 130-140)** — the listed files `drizzle/0000_petite_mockingbird.sql`, `0001_complex_queen_noir.sql`, `0002_collections.sql` are not in the repo because `drizzle/` is `.gitignore`d (line 20 of `.gitignore`). Add one sentence under the table: "*Migration SQL is generated locally via `pnpm db:generate` and never checked in — `.gitignore` line 20 excludes `drizzle/`. Migration filenames above are illustrative of the current local state.*" Leaves the historical record but stops a fresh clone from looking broken.

  3. **New section after `## Core Library`, before `## RAG Pipeline`**: `## Helper Scripts & Agent Skills`. The repo's `.github/scripts/` (7 Node scripts: `parse-verify.mjs`, `telegram-load-task-branch.mjs`, `telegram-no-changes.mjs`, `telegram-open-pr.mjs`, `telegram-save-diff.mjs`, `telegram-save-plan.mjs`, `telegram-save-questions.mjs`) and `.agents/skills/` (planner, plan-verifier, coder, find-skills, nextjs-developer, nextjs-app-router-*, nextjs-best-practices, nextjs-react-typescript, neon-postgres, clerk-nextjs-patterns) are both load-bearing for the Telegram pipeline but currently undocumented. Two short tables, one per directory, one line per file/skill.

- `PROJECT_PLAN.md` line 140 (`Last full rebuild: 2026-05-20`) — leave unchanged; that date is older than the merge commit and refers to a Neon DB rebuild, not the codebase.

## Files I will create
- None.

## Files I read but won't change (proof I looked)
- `Readme.md` — has the same outdated Telegram section as `PROJECT_PLAN.md` (`.github/workflows/telegram-to-pr.yml`, lines 184, 195). User asked only for CLAUDE + plan, but `CLAUDE.md` says README must also be updated for user-facing changes. Flagged under Risks.
- `src/lib/schema.ts` — confirms `collections`, `documents`, `document_chunks`, `chat_sessions`, `chat_messages`, `rag_settings`, `audit_logs`. Matches the schema section of `PROJECT_PLAN.md` exactly. No edits needed there.
- `src/app/api/telegram/webhook/route.ts` (451 lines per stat) — webhook handler that fires three different `repository_dispatch` event types depending on classifier output. Confirms the three-workflow architecture above.
- `.github/workflows/telegram-plan.yml` — confirms planner+verifier pipeline, Neon persistence via `telegram-save-plan.mjs`, two-pass retry on verifier block.
- `.github/workflows/telegram-code.yml`, `.github/workflows/telegram-pr.yml` (listed via `ls`, not opened in full) — confirms the split is real.
- `src/inngest/ingest-document.ts`, `src/lib/inngest.ts`, `src/app/api/inngest/route.ts` — confirms Inngest, not Vercel Workflows.
- `drizzle.config.ts` — confirms drizzle-kit output goes to `./drizzle/`, which is gitignored.
- `.gitignore` line 20 — `drizzle/` is excluded.
- Git log (`git log --all`, `git reflog`) — only one commit reachable; `gh api` access for the upstream commit list was denied, so no further commits can be inspected.

## Schema / migrations
N/A — because this is a documentation-only change.

## Tests
N/A — because this is a documentation-only change and the project has no test suite (confirmed by `PROJECT_PLAN.md` line 346: "Zero test coverage — excluded from this sprint.").

## Breaking changes & backwards compatibility
N/A — because docs aren't part of any public API.

## Risks & open questions
- **Only one commit is reachable from this checkout.** The shallow clone (`--depth=1`) and the denied `gh api` request mean I can't read commit-by-commit history. If the user wanted me to walk individual dev-branch commits (e.g., "what changed since 2026-05-15?"), I cannot — and the plan above interprets "latest commits" as "current state of `main`." If that interpretation is wrong, reply with a target commit range and I'll re-plan.
- **`Readme.md` has the same Telegram drift as `PROJECT_PLAN.md`.** The user's request named only CLAUDE + project plan, but `CLAUDE.md` line 5 explicitly says README must also be updated for user-facing changes. Default: leave Readme.md alone this round; flag here. Confirm before I touch it.
- **Filename casing assumption.** The on-disk file is `PROJECT_PLAN.md` (uppercase) and `Readme.md` (mixed). `CLAUDE.md` currently says `project_plan.md` / `README.md`. I'm updating `CLAUDE.md` to match the disk, not renaming the files. If the user prefers the files renamed instead, that's the opposite change.
- **No `Skills` section in `PROJECT_PLAN.md` today.** I'm proposing a new "Helper Scripts & Agent Skills" section as the cleanest home for them. If the user prefers a separate top-level `## Telegram Pipeline Internals`, that's a one-line change to where the table lives.

## Done when…
- `CLAUDE.md` references the actual filenames (`PROJECT_PLAN.md`, `Readme.md`), names Inngest (not Vercel Workflows) as the ingestion runtime, and lists Drizzle/OpenAI/pnpm in the stack.
- `PROJECT_PLAN.md` `## Telegram → PR Bot` section accurately describes the three-workflow planner → coder → PR pipeline, with the correct workflow filenames and the Neon task-state persistence.
- `PROJECT_PLAN.md` `## Migrations` notes that `drizzle/` is gitignored.
- `PROJECT_PLAN.md` has a new section listing `.github/scripts/*` and `.agents/skills/*` with a one-line purpose for each.
- A casual reader of either file can no longer find a sentence that contradicts what's in `src/`, `.github/workflows/`, or `.agents/skills/`.
- No code files are touched; no new files are created beyond the doc edits above.