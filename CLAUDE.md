# Project: Company Knowledge Assistant (2026 Vercel Stack)

## Core Instructions
- **Skills**: Use the specialized skills located in `.agents/skills/`.
- **Updates**: After every major implementation or architectural decision, you MUST update `project_plan.md` with the new state and `README.md` with user-facing setup instructions.

## Tech Stack
- Frontend: Next.js 16+ (App Router)
- AI: Vercel AI SDK (Streaming, Tools, Generative UI)
- Database: Neon (Postgres + pgvector)
- Shadcn/ui + v0
- Auth: Clerk (RBAC)
- Security: Arcjet (Prompt Injection & Rate Limiting)
- Ingestion: Vercel Workflows (for long-running jobs)