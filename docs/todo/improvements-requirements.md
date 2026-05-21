# Requirements: Production-Grade Improvements

Status: Draft
Owner: TBD
Last updated: 2026-05-21

This document captures the work required to take the Knowledge Assistant from
"impressive Claude Code project" to production-grade. Findings are grounded in
the current repository state (branch `dev`, 19 commits, clean tree).

---

## 1. Automated test coverage

**Problem.** No `*.test.*` or `*.spec.*` files exist anywhere in the repo.
There are 14 API route handlers under `src/app/api/`, a 387-line
`src/lib/ai.ts`, hybrid search SQL, a reranker, and a Telegram webhook — none
of it is covered by automated tests.

**Requirements.**
- Add Vitest (or equivalent) as the test runner; wire `pnpm test` and
  `pnpm test:watch` into `package.json`.
- Minimum coverage for first pass:
  - Chunking and embedding path in `src/lib/ai.ts`.
  - Hybrid search SQL behavior (vector + lexical fusion) against a Neon
    branch or a local Postgres with pgvector.
  - At least one Clerk-authed route handler (happy path + unauthorized).
  - The Arcjet wrapper in `src/lib/arcjet.ts` (prompt-injection + rate-limit
    decisions).
- Tests must run in CI on every PR (see section 2).

**Done when.** `pnpm test` passes locally and in CI, with at least one test
per area above.

---

## 2. CI gates on pull requests

**Problem.** `.github/workflows/` currently contains only the dev-only
Telegram pipeline (`telegram-*.yml`). There is no `ci.yml`. PRs can merge
without typecheck, lint, build, or eval verification.

**Requirements.**
- Add `.github/workflows/ci.yml` triggered on `pull_request` and pushes to
  `main`/`dev`. Steps:
  1. `pnpm install --frozen-lockfile`
  2. `pnpm type-check`
  3. `pnpm lint`
  4. `pnpm build`
  5. `pnpm test`
  6. `pnpm eval:run` against the golden set (see section 4).
- The eval step must fail the build if grounded-answer rate or any other
  tracked metric regresses by more than a defined threshold vs. `main`.
- Migrations must be applied against a throwaway Neon branch as part of CI
  (see section 6).

**Done when.** A PR with a deliberate regression (failing test or eval
regression) is blocked from merging.

---

## 3. Observability

**Problem.** A grep across `src/` for `sentry|otel|opentelemetry|logger|pino|winston`
returns zero hits. The app has no structured logging, no error tracking, and
no tracing around the retrieval → rerank → generate pipeline. The offline
eval harness measures quality but the system is blind to live failures.

**Requirements.**
- **Error tracking.** Integrate Sentry (or equivalent) for both server and
  client. Capture unhandled errors in every API route and every Inngest job.
- **Structured logging.** One structured log line per chat turn containing:
  session id, user id (Clerk), query, retrieved chunk ids, rerank scores,
  model, prompt tokens, completion tokens, latency, and grounded/refused
  outcome. Do not log raw document content.
- **Tracing.** OpenTelemetry spans around: ingestion (per document), chunking,
  embedding, retrieval (vector + lexical), rerank, generation. Export to a
  collector that the team can actually read.
- **Dashboards.** At minimum: chat latency p50/p95, refusal rate, error rate
  by route, ingestion job success rate.

**Done when.** A live error surfaces in Sentry with a useful stack and a
structured log entry, and the team can pull a per-turn trace from the
dashboard.

---

## 4. Eval harness upgrades

**Problem.** Four eval runs exist in `evals/runs/` (baseline → hybrid-search
→ limit3-strict-prompt → cohere-rerank), but they are manual snapshots.
Nothing enforces non-regression, and the golden set appears to cover only
happy-path retrieval.

**Requirements.**
- **Automate.** Run `pnpm eval:run` on every PR (see section 2). Post a
  comment on the PR showing the delta vs. `main` for each tracked metric.
- **Adversarial cases.** Extend `evals/golden/golden-set.json` to include:
  - Prompt-injection attempts (must be neutralized by Arcjet or refused).
  - Out-of-corpus questions (must refuse, not hallucinate).
  - Conflicting-source questions (must surface the conflict, not pick one).
  - Multi-hop questions requiring two or more chunks.
- **Persist history.** Keep eval run artifacts (currently in `evals/runs/`)
  attached to CI runs or stored in a way that lets us plot metrics over time.

**Done when.** A PR that worsens grounded-answer rate or refusal accuracy is
blocked, and adversarial categories appear in the golden set with their own
metrics.

---

## 5. Abuse and entrypoint hardening

**Problem.** Arcjet is wired in (`src/lib/arcjet.ts`, 78 lines), but it is
not yet verified to cover every public entrypoint. The Telegram webhook
(`/api/telegram/webhook`) and the shared-chat route
(`/api/chat/sessions/[id]/share`) are unauthenticated surfaces.

**Requirements.**
- Audit every route under `src/app/api/` and confirm each has the
  appropriate combination of: Clerk auth (where applicable), Arcjet
  rate-limit + prompt-injection rules, and CSRF protection
  (`src/lib/csrf.ts`) on state-changing requests.
- The Telegram webhook must verify the Telegram signature header and reject
  unsigned requests before any other processing.
- Public share routes must rate-limit per IP and refuse to leak any
  session metadata beyond what is intentionally shared.
- Document the matrix of route → protections in this file once verified.

**Done when.** A documented matrix exists and a quick test confirms that an
unsigned Telegram request and an over-limit share request are both rejected.

---

## 6. Migration safety in CI

**Problem.** The repo has a custom `db:migrate` script
(`scripts/db-migrate.mjs`) and a baseline (`scripts/db-baseline.mjs`) — a
good setup — but there is no CI step that verifies migrations actually apply
cleanly before merge.

**Requirements.**
- On every PR that touches `drizzle/` or `scripts/db-*.mjs`, CI must:
  1. Create a Neon branch from `main`.
  2. Run `pnpm db:migrate` against it.
  3. Run a smoke query (e.g., a tiny hybrid-search call) to confirm the
     schema is usable.
  4. Delete the Neon branch.
- The `db:push` script must remain disabled (it already prints a deprecation
  message — keep it that way).

**Done when.** A PR introducing a broken migration is blocked by CI before
review.

---

## 7. CLAUDE.md hardening

**Problem.** `CLAUDE.md` is 895 bytes and lists the stack but not the
non-obvious rules. Future Claude Code sessions can — and will — regress on
conventions that aren't written down.

**Requirements.** Extend `CLAUDE.md` to encode at least the following rules:
- Always use `db:generate` + `db:migrate`; never `db:push`.
- Every new API route requires a Clerk check (where applicable) and an
  Arcjet wrapper. Public routes additionally require rate-limit + CSRF
  review.
- RAG-affecting changes (retrieval, reranking, prompt, chunking) require a
  new eval run committed under `evals/runs/` and must not regress baseline
  metrics.
- Never log raw document content; structured logs only.
- Tests are required for new route handlers and for any change to
  `src/lib/ai.ts`.

**Done when.** A new Claude Code session, given only `CLAUDE.md`, would
follow each of these rules without being reminded.

---

## Priority order

If work is sequenced rather than parallel:

1. Section 2 (CI gates) — unlocks enforcement for everything else.
2. Section 1 (tests) — needed for CI to be meaningful.
3. Section 4 (eval automation + adversarial cases) — protects RAG quality.
4. Section 3 (observability) — needed before any real traffic.
5. Section 6 (migration CI).
6. Section 5 (entrypoint hardening audit).
7. Section 7 (CLAUDE.md hardening) — do alongside the others as rules
   solidify.
