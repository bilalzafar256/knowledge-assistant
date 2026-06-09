---
name: telegram-pr-bot
description: The dev-only Telegram→PR pipeline for this repo — webhook secret + chat-id allowlist, repository_dispatch into GitHub Actions, and the telegram_tasks state machine. Use when changing the bot or its workflows.
---

# Telegram → PR bot (dev-only, this repo)

## When to use
Editing the webhook, the classifier, the GitHub Actions workflows, or `telegram_tasks` state.

## Flow
- `POST /api/telegram/webhook` verifies `x-telegram-bot-api-secret-token` **and** a chat-id allowlist (both must match), classifies the message (`src/lib/telegram-classifier.ts`), and fires a `repository_dispatch`.
- GitHub Actions, one workflow per `event_type`:
  - `telegram-plan.yml` → plan/questions → Telegram (Approve/Revise/Cancel)
  - `telegram-code.yml` → write diff → push task branch → Telegram
  - `telegram-pr.yml` → open PR into `dev`, save URL, mark task done
  - plus `telegram-merge.yml`, `telegram-main-pr.yml`
- Progress persists in `telegram_tasks` so one request spans multiple workflow runs.
- `.github/scripts/telegram-*.mjs` handle the Neon ↔ Telegram glue.

## Security boundaries (do not weaken)
- Webhook secret + chat-id allowlist (both required). Not Clerk-authed.
- Fine-grained PAT scoped to one repo, `Contents: RW`.
- Actions push task branches and open PRs but **never push to `main`/`dev`** — human review required.
- All Telegram/GitHub env vars are optional in the app; the webhook returns **503** if any are unset.

## Anchors
- `src/app/api/telegram/webhook/route.ts`, `src/lib/telegram-classifier.ts`
- `.github/workflows/telegram-*.yml`, `.github/scripts/telegram-*.mjs`
- `telegram_tasks` table in `src/lib/schema.ts`
