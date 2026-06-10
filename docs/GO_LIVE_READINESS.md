# Go-Live Readiness — RAG Quality Gate

> Status: **NOT READY** (as of 2026-06-10). Retrieval and answer correctness look launch-grade; the grounding/faithfulness guarantee is unproven and the eval cannot yet be run at scale on the free tier. This doc is the checklist to close that gap.

This document defines (1) the **scorecard** every model/prompt/retrieval change is measured against before launch, (2) the **changes required** to get there, and (3) the **free-tier protocol** for running the 200-doc eval. It complements `PROJECT_PLAN.md` (architecture) and the eval harness under `evals/` (which now mirrors the production Claude + Gemini stack).

---

## 1. Current snapshot

Run: `golive-23doc-20q` — `claude-sonnet-4-6` (chat) + `gemini-embedding-001` (embeddings), 20 questions, 23-doc haystack, Open RAG Benchmark (arXiv). Full report in `evals/benchmarks/open-ragbench/runs/`.

| Metric | Current | Target | Gate? | Verdict |
| --- | ---: | ---: | :---: | --- |
| Recall@5 (after rerank) | 100% | ≥ 85% | ✅ | Pass — but on an easy 23-doc haystack |
| Recall@10 (candidate pool) | 100% | ≥ 90% | — | Pass |
| MRR (reranked) | 0.84 | ≥ 0.70 | — | Pass |
| Context precision | 46% | ≥ 65% | ⚠️ | Below — over-retrieval / noise in top-k |
| **Faithfulness** | **53%** | **≥ 90%** | ✅ **hard gate** | **Fail / unproven — see §2** |
| Answer correctness | 82.5% | ≥ 85% | ✅ | Borderline |
| Citation accuracy | 95% | ≥ 90% | — | Pass |
| Avg answer latency | 24.7 s | ≤ 8 s to first token | ⚠️ | Review under streaming |
| Eval scale | 20 Q / 23 docs | ≥ 100 Q / ≥ 200 docs / ≥ 2 domains | ✅ | Too small to gate a launch |

**Headline:** the architecture works (retrieval + correctness + citation are strong), but **faithfulness — the product's core promise ("answer only from retrieved chunks, never invent")** — is the blocker, and the sample is too small to certify anything.

### Why faithfulness is low (three tangled causes — separate them)
1. **Multimodal questions tank it (real gap).** Text-only faithfulness ≈ 70%; text-image ≈ 21%; text-table-image = **0%**. The eval ingester does not OCR figures (drops `[Figure N]` markers), so figure/table facts aren't in the embedded text and the model fills gaps from parametric knowledge.
2. **The faithfulness judge under-scores (measurement artifact).** `evals/lib/judges.mjs` truncates each chunk to **500 chars** before judging, but chunks are ~2,200 chars — the judge can't see ~75% of the supporting text and wrongly scores "unsupported" (see q_1/q_8/q_13: faithfulness 0.0 but correctness 1.0). Plus Haiku judging Sonnet adds same-family self-preference bias.
3. **Even discounting 1 & 2, it's unproven, not proven-safe** — best case ~70–80% on text, still under the 90% bar.

---

## 2. Changes required before go-live (prioritized)

### P0 — must do (blocks launch)
1. **Fix the faithfulness measurement** so the number is trustworthy:
   - `evals/lib/judges.mjs` → raise the per-chunk truncation in `answerFaithfulness` (and `contextPrecision`) from `slice(0, 500)` to the full chunk (or ≥2,500 chars).
   - Use a **cross-family judge** to kill self-preference bias: judge Claude's answers with a non-Claude model (e.g. a free Gemini Flash model) — different family than the generator. Report both judges if unsure.
2. **Unblock embedding capacity** (see §3). The free tier caps at **1,000 embedding requests/day**; you cannot run a 200-doc / 100-Q eval — or serve real traffic — without either billing or the rolling-ingest protocol.
3. **Re-run at scale:** ≥ 100 questions, ≥ 200 docs, after fixes 1–2. Faithfulness must clear **≥ 90%** on text-only questions.
4. **Decide multimodal scope:**
   - Confirm the production image-upload path OCRs tables/figures (it uses Claude image OCR per `PROJECT_PLAN.md`), **or**
   - Scope launch to text-first and add a guardrail: when a query likely needs a figure/table the index doesn't contain, the assistant says so instead of guessing.

### P1 — should do
5. **Raise context precision** (currently 46%): tighten rerank top-N, or lower the default `limit` the model passes to `searchKnowledge`, so fewer noise chunks reach the answer step.
6. **Latency:** 24.7 s total is high. Production streams (`streamText`), so confirm **time-to-first-token** is acceptable; if total generation is still slow, cap tool steps (`stepCountIs`) lower or reduce rerank candidate count.
7. **Second domain eval:** the benchmark is arXiv papers. Add a small enterprise-style golden set (policies / contracts / wiki) — that's the real production distribution.

### P2 — nice to have
8. Grounding/prompt hardening if faithfulness still < 90% after the measurement fix (e.g. stricter refusal phrasing, require a verbatim quote per claim).
9. Keep `evals/` in lockstep with `src/lib/ai.ts` (CLAUDE.md rule) — the harness was just ported to Claude + Gemini; commit that and don't let it drift again.

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
