# Go-Live Readiness — RAG Quality Gate

> Status: **CONDITIONAL GO — beta, not blind GA** (as of 2026-06-10). The grounding/faithfulness gate is now **cleared (95%)** on a trustworthy cross-family judge at 200-doc scale: the assistant answers from retrieved content and refuses when it can't, so it does not hallucinate. The open item is **end-to-end correctness (70%)** — but that's driven by retrieval misses + hard abstractive academic questions, not by invented facts, and it must be re-measured on the real (enterprise) domain before GA.

This document defines (1) the **scorecard** every model/prompt/retrieval change is measured against before launch, (2) the **changes required** to get there, and (3) the **free-tier protocol** for running the 200-doc eval. It complements `PROJECT_PLAN.md` (architecture) and the eval harness under `evals/` (which now mirrors the production Claude + Gemini stack).

---

## 1. Current snapshot

Run: `golive-200doc-100q-gemjudge-v2` — `claude-sonnet-4-6` (chat) + `gemini-embedding-001` (embeddings) + **`gemini-2.5-flash` cross-family judge** over full chunks, 100 questions, **198-doc** haystack, Open RAG Benchmark (arXiv). Full report in `evals/benchmarks/open-ragbench/runs/`.

| Metric | Current | Target | Gate? | Verdict |
| --- | ---: | ---: | :---: | --- |
| Recall@5 (after rerank) | 88% | ≥ 85% | ✅ | Pass at real 200-doc scale |
| Recall@10 (candidate pool) | 91% | ≥ 90% | — | Pass |
| MRR (reranked) | 0.72 | ≥ 0.70 | — | Pass |
| Context precision | 57% | ≥ 65% | ⚠️ | Below — over-retrieval / noise in top-k |
| **Faithfulness** | **95%** | **≥ 90%** | ✅ **hard gate** | **PASS — grounding proven, no hallucination** |
| Answer correctness | 70% | ≥ 85% | ⚠️ | **Below — now the main gap (see note)** |
| Citation accuracy | 94.5% | ≥ 90% | — | Pass |
| Avg answer latency | 15.5 s | ≤ 8 s to first token | ⚠️ | Review under streaming |
| Eval scale | 100 Q / 198 docs | ≥ 100 Q / ≥ 200 docs / ≥ 2 domains | ⚠️ | Scale met; **2nd (enterprise) domain still needed** |

**Headline:** the **grounding gate is cleared** — faithfulness 95% (94% when retrieval hits, **100% when it misses**, i.e. the model faithfully says "not found" instead of inventing). Retrieval and citation are solid at 200-doc scale. The open item is **correctness (70%)**.

### Why correctness (70%) is below target — and why it's not a safety blocker
- **It is not hallucination.** Faithfulness is 95%; the model stays grounded. Low correctness = faithfully *incomplete or partial* answers, not confidently wrong ones.
- **~12% is retrieval misses.** Correctness on recall-hit questions is 72% vs 56% on misses — closing the recall gap lifts correctness directly.
- **The benchmark is adversarially hard for correctness.** arXiv math/science, **abstractive** (synthesis) questions score 66% vs extractive higher. The production domain (policies, contracts, wikis) is far more extractive, so 70% here likely **understates** real-world correctness — this must be confirmed on an enterprise golden set before GA.
- Judge health: 3/100 calls returned `parse_error` (vs 98/100 before the thinking-budget fix) — negligible.

---

## 1a. Thresholds (canonical — single source of truth)

These are the **strict** go-live bars. The Open RAG Benchmark publishes no official pass/fail cutoffs (it's a dataset + ground truth, not a graded test), and the metric definitions are the standard RAGAS/RAG-eval set — so these numbers are *our* chosen bars for a grounding-strict product, set deliberately stricter than generic RAG-demo baselines. **This table governs.** The eval report generator (`evals/benchmarks/open-ragbench/report.mjs` → `TIERS`) mirrors these as its `Gate ≥` column; keep the two in lockstep.

| Metric | **Gate ≥** | Pilot floor ≥ | Hard gate (blocks launch)? |
| --- | ---: | ---: | :---: |
| Faithfulness | **90%** | 75% | ✅ **hard** |
| Answer correctness | **85%** | 65% | ✅ **hard** |
| Recall@5 (after rerank) | **85%** | 70% | ✅ **hard** |
| Citation accuracy | **90%** | 70% | ✅ **hard** |
| MRR (reranked) | 0.70 | 0.50 | soft target |
| Context precision | 65% | 45% | soft target |
| Recall@10 (candidate pool) | 90% | — | soft target |
| Latency (time-to-first-token) | ≤ 8 s | — | soft target |

**Rule:** ship to **GA** only when every *hard gate* is met **and** measured on ≥ 2 domains (arXiv + an enterprise set). A **limited beta** is allowed when all hard gates are met on ≥ 1 domain and no metric is below its pilot floor. Anything below a pilot floor = 🔴 needs work.

---

## 2. Changes required before go-live (prioritized)

### P0 — must do (blocks launch)
1. ✅ **DONE — Fix the faithfulness measurement.** `evals/lib/judges.mjs` now judges with `gemini-2.5-flash` (cross-family) over full chunks (`slice(0, 4000)` / `2000`), with thinking disabled (`thinkingConfig.thinkingBudget: 0`) so the JSON isn't starved. Result: faithfulness measured at 95% (was a false 53%).
2. ✅ **DONE — Embedding capacity.** Gemini account on paid **Tier 1** (unlimited embedding RPD). 198 docs ingested for ~$0.73.
3. ✅ **DONE — Re-run at scale.** 100 Q / 198 docs; faithfulness **95% ≥ 90% gate** (text-only 95.6%). See §1.
4. ⬜ **Close the correctness gap before GA.** 70% is below the 85% target. Priorities: (a) re-measure on an **enterprise-domain** golden set (the arXiv number likely understates production); (b) lift retrieval recall (12% miss → directly caps correctness).
5. ⬜ **Decide multimodal scope.** text-image faithfulness is now healthy (91.7%), but correctness on image/table questions is lower (60–80%). Confirm the production image-upload path OCRs tables/figures (Claude image OCR per `PROJECT_PLAN.md`), **or** scope launch text-first with a guardrail that flags figure/table-dependent queries.

### P1 — should do
6. **Raise context precision** (currently 57%, gate 65%): tighten rerank top-N, or lower the default `limit` the model passes to `searchKnowledge`, so fewer noise chunks reach the answer step.
7. **Latency:** 15.5 s total generation is high. Production streams (`streamText`), so confirm **time-to-first-token** is acceptable; if total generation is still slow, cap tool steps (`stepCountIs`) lower or reduce rerank candidate count.
8. **Second-domain eval (enterprise):** the benchmark is arXiv papers; the production distribution is policies / contracts / wikis / support / finance. See the backlog in §3a — this is required before GA.

### P2 — nice to have
9. Grounding/prompt hardening if enterprise-domain faithfulness dips below 90% (e.g. stricter refusal phrasing, require a verbatim quote per claim).
10. Keep `evals/` in lockstep with `src/lib/ai.ts` (CLAUDE.md rule) — the harness is ported to Claude + Gemini; don't let it drift again.

### Operational readiness (verify, likely already done)
- Tenant isolation: every query filtered by `userId` (`document_chunks.userId`).
- Rate limiting: Arcjet `chatAj` / `uploadAj` live on all surfaces.
- Graceful degradation: query synthesis + rerank fall back silently on error.
- Env validation fails fast at boot (`src/lib/env.ts`).
- Audit logging + Axiom telemetry (metadata only, never prompts/completions).

---

## 3. How to test 200 docs on a free AI tier

**The honest first answer:** embedding 200 docs costs **~$0.50** of Gemini billing (≈ 8,000 chunks × ~500 tokens × $0.15/M). Enabling billing removes a week of friction for the price of a coffee — it is the best engineering ROI by far, and it's also required for real traffic. Everything below is for staying strictly $0.

### Free-tier reality
- **Gemini `gemini-embedding-001`** — free tier ≈ **1,000 embedding requests/day** (each chunk = 1 request; we hit this at 23 docs / 922 chunks). 100 RPM. This is the *most generous durable free embedding quota* available.
- **OpenAI** — no durable free embedding tier (trial credits only, then paid). Not viable for repeat eval runs.
- **Cohere trial** — embed ≈ 1,000 calls/**month**. Too small.
- **Voyage / Jina / Mistral free tiers** — usable volume, but **not the production embedder** → retrieval numbers won't reflect production, and dims (1024/768) don't match the `vector(1536)` column.

### Recommended free path — *rolling daily ingest* (faithful, zero code change)
200 docs ≈ ~8,000 chunks ≈ **~8 days** at 1,000 chunks/day. The ingester is resume-safe (skips already-ingested papers), so just run it once per day:

```bash
# Day 1..8 — each run consumes that day's free quota, then stops on 429.
node evals/benchmarks/open-ragbench/ingest.mjs --limit 200
# Re-run next day; it skips what's already in the DB and continues.
```

On the final day (fresh quota), build the golden set and run the eval — a 100-Q run needs only ~250 query embeds, well within one day's free budget:

```bash
node evals/benchmarks/open-ragbench/import-golden.mjs --limit 100
node evals/benchmarks/open-ragbench/run.mjs --label golive-200doc-100q --concurrency 1
```

### Immediate win — more questions on the docs already ingested (do this tomorrow)
The 23 docs are already in the DB. On fresh quota you can run a **full 100-question eval against them** (≈250 query embeds, fits free) — 5× the grounding sample *now*, without ingesting anything new. The haystack stays small (retrieval stays easy), but **faithfulness/correctness — the metrics that actually block go-live — get statistically meaningful**:

```bash
node evals/benchmarks/open-ragbench/import-golden.mjs --limit 100   # ~86 available from 23 docs
node evals/benchmarks/open-ragbench/run.mjs --label grounding-100q --concurrency 1
```

### Faster-but-less-faithful free option — local embedder
Run embeddings locally (e.g. Ollama `nomic-embed-text`, or `transformers.js` `bge`/`gte`) — **unlimited, free, minutes not days**. Caveats: (a) you must point the eval at a separate DB / tenant whose vector column matches the model's dims (768/1024, not 1536), and (b) retrieval no longer reflects production Gemini quality. Good for **iterating on grounding/prompt fixes at 200-doc scale**; not for final embedding-quality sign-off. Pair it with a small Gemini run for fidelity.

### Not recommended
- **Multiple Google accounts / keys** to multiply the 1,000/day quota — fast but against Google's ToS; don't build the pipeline on it.

### Decision guide
| You want… | Do this |
| --- | --- |
| A trustworthy launch gate, fastest | Enable Gemini billing (~$0.50), run 200-doc / 100-Q once |
| Strictly free + production-faithful | Rolling daily ingest (~8 days), then eval |
| A better grounding signal *today*, free | 100-Q eval against the 23 docs already ingested |
| To iterate on prompt/grounding fixes at scale, free | Local embedder on a separate eval DB |

---

## 3a. Future eval surfaces — enterprise golden sets (backlog)

The current eval is arXiv only (Open RAG Benchmark). Before GA we must validate on the real production distribution (policies / contracts / wikis / support / finance). **None of these is plug-and-play** — each needs an ingest + golden-importer adapter like the Open RAG Benchmark one. Test these later:

| Dataset | Enterprise domain | What it is | Source | License note |
| --- | --- | --- | --- | --- |
| **FinanceBench** (Patronus) | Financial filings (10-K/10-Q, earnings) | RAG QA with reference answers (~150-Q open subset) | HF `PatronusAI/financebench` | open subset free; full set non-commercial |
| **CUAD** (Atticus) | Commercial contracts | 500+ contracts, expert clause labels | HF `cuad` | CC-BY 4.0 — fully free |
| **TechQA** (IBM) | IT / tech-support docs | QA over support tickets + technotes | HF / IBM GitHub | research-use license |
| **TAT-QA / FinQA / ConvFinQA** | Financial reports w/ tables | hybrid table+text QA | HF / GitHub | academic, free |
| **PolicyQA / PrivacyQA** | Privacy / website policies | QA over policy documents | academic GitHub | free, research |
| **RAGTruth** | mixed QA / summarization | word-level hallucination labels — best for the **faithfulness** axis | HF / GitHub | free |

**Recommended primary:** build a **synthetic golden set from our own uploaded documents** (LLM-generate Q&A grounded in specific chunks). It's the most representative *and* nearly free, and the harness already supports it — `run.mjs` matches on `expected_chunk_id` (not just the Open RAG Bench `expected_section_id`), so the plumbing exists; it needs a small generator script + a human spot-check to avoid leaking answers into questions. Use **FinanceBench** or **CUAD** as a public cross-check.

> Verify each dataset's license for commercial use before relying on it, and confirm current availability on HuggingFace — identifiers above may have moved.

---

## 4. Go / No-Go checklist

Launch only when **all** are true:

- [ ] Faithfulness ≥ 90% (text-only), measured with the truncation fix + a cross-family judge
- [ ] Answer correctness ≥ 85%
- [ ] Citation accuracy ≥ 90%
- [ ] Recall@5 (after rerank) ≥ 85% at ≥ 200-doc scale
- [ ] Context precision ≥ 65%
- [ ] Eval run on ≥ 100 questions across ≥ 2 domains (arXiv + enterprise-style)
- [ ] Multimodal scope decided and guardrail in place (or OCR path confirmed)
- [ ] Time-to-first-token acceptable under streaming
- [ ] Embedding capacity provisioned for production traffic (billing or documented limit)
- [ ] Operational readiness verified (tenant isolation, rate limits, degradation, audit)

> Owner: _TBD_ · Last eval: `golive-23doc-20q`, 2026-06-10 · Re-run and update §1 on every retrieval/prompt/model change.
