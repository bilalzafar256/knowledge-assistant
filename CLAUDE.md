# Project: Company Knowledge Assistant (2026 Vercel Stack)

## Core Instructions
- **Skills**: Use the specialized skills located in `.agents/skills/`.
- **Updates**: After every major implementation or architectural decision, you MUST update `PROJECT_PLAN.md` with the new state and `Readme.md` with user-facing setup instructions.

## Tech Stack
- Frontend: Next.js 16+ (App Router)
- AI: Vercel AI SDK (Streaming, Tools, Generative UI)
- LLM provider: OpenAI (gpt-4o + text-embedding-3-small + gpt-4o-mini)
- Database: Neon (Postgres + pgvector)
- ORM: Drizzle (drizzle-kit migrations)
- Shadcn/ui + v0
- Auth: Clerk (RBAC)
- Security: Arcjet (Prompt Injection & Rate Limiting)
- Ingestion: Inngest (event-driven queue, with 55 s inline fallback)
- Package manager: pnpm

> Dev-only Telegram → PR pipeline lives under `.github/workflows/telegram-*.yml` and uses skills in `.agents/skills/`.