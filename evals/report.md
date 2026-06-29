# RAG Eval — Gate-Grade Report (multi-domain)

> Generated 2026-06-29 22:55:12Z. Combines the latest gate-grade run from each eval surface. Hard/soft gate bars per `docs/GO_LIVE_READINESS.md` §1a.

## Gate thresholds

| Metric | Gate ≥ | Type |
| --- | ---: | :---: |
| Recall@5 (reranked) | 85.0% | **hard** |
| Faithfulness | 90.0% | **hard** |
| Answer correctness | 85.0% | **hard** |
| Citation accuracy | 90.0% | **hard** |
| MRR (reranked) | 0.700 | soft |
| Context precision | 65.0% | soft |

Hard gates block GA; a domain is "gate-clear" when all four hard gates pass.

---

## 1. Open RAG Bench — arXiv academic

- **Run:** `p1-contextual-200q-gategrade` · 2026-06-16T10-21-11_p1-contextual-200q-gategrade.json
- **Questions:** 200 · **chat:** `claude-sonnet-4-6` · **embed:** `gemini-embedding-001` · **judge:** `gemini-2.5-flash` · concurrency 4
- **Anthropic answer cost:** ~$4.97 · avg latency 18728 ms

| Metric | Value | Gate | Verdict |
| --- | ---: | ---: | :---: |
| Recall@5 (reranked) | 85.0% | 85.0% | ✅ |
| Faithfulness | 95.6% | 90.0% | ✅ |
| Answer correctness | 65.2% | 85.0% | ❌ |
| Citation accuracy | 97.3% | 90.0% | ✅ |
| MRR (reranked) | 0.624 | 0.700 | ⚠️ |
| Context precision | 50.8% | 65.0% | ⚠️ |

Correctness slices — recall-**hit** 67.1% (n=170) · recall-**miss** 54.7% (n=30): retrieval misses drag correctness; the answer step caps the rest.

---

## 2. CUAD — enterprise contracts (doc-scoped)

- **Run:** `cuad-cohere-c1` · 2026-06-29T21-10-33_cuad-cohere-c1.json
- **Questions:** 40 · **chat:** `claude-sonnet-4-6` · **embed:** `gemini-embedding-001` · **judge:** `gemini-2.5-flash` · concurrency 1
- **Anthropic answer cost:** ~$1.29 · avg latency 23253 ms

| Metric | Value | Gate | Verdict |
| --- | ---: | ---: | :---: |
| Recall@5 (reranked) | 85.0% | 85.0% | ✅ |
| Faithfulness | 96.3% | 90.0% | ✅ |
| Answer correctness | 79.1% | 85.0% | ❌ |
| Citation accuracy | 97.5% | 90.0% | ✅ |
| MRR (reranked) | 0.663 | 0.700 | ⚠️ |
| Context precision *(N/A — single-doc QA)* | 39.2% | 65.0% | — |

Correctness slices — recall-**hit** 81.3% (n=34) · recall-**miss** 66.7% (n=6): retrieval misses drag correctness; the answer step caps the rest.

---

## 3. RAGBench — multi-domain enterprise

- **Run:** `rb-gate` · 2026-06-29T22-29-06_rb-gate.json
- **Questions:** 199 · **chat:** `claude-sonnet-4-6` · **embed:** `gemini-embedding-001` · **judge:** `gemini-2.5-flash` · concurrency 2
- **Anthropic answer cost:** ~$2.81 · avg latency 11359 ms

| Metric | Value | Gate | Verdict |
| --- | ---: | ---: | :---: |
| Recall@5 (reranked) | 77.4% | 85.0% | ❌ |
| Faithfulness | 83.9% | 90.0% | ❌ |
| Answer correctness | 56.5% | 85.0% | ❌ |
| Citation accuracy *(N/A — anonymous corpus)* | 64.8% | 90.0% | — |
| MRR (reranked) | 0.591 | 0.700 | ⚠️ |
| Context precision | 36.5% | 65.0% | ⚠️ |

Correctness slices — recall-**hit** 62.8% (n=154) · recall-**miss** 35.0% (n=45): retrieval misses drag correctness; the answer step caps the rest.

### Breakdown by domain
| Domain | n | Recall@5 | Faithfulness | Correctness |
| --- | ---: | ---: | ---: | ---: |
| support | 78 | 67.9% | 92.2% | 57.3% |
| biomedical | 43 | 88.4% | 69.8% | 44.0% |
| general | 43 | 93.0% | 74.4% | 61.0% |
| finance | 35 | 65.7% | 94.3% | 64.7% |

---

## Combined

### Per-domain gate matrix
| Domain | n | Recall@5 | Faithful | Correct | Citation | Hard gates |
| --- | ---: | ---: | ---: | ---: | ---: | :---: |
| arxiv | 200 | 85.0%✅ | 95.6%✅ | 65.2%❌ | 97.3%✅ | 3/4 |
| cuad | 40 | 85.0%✅ | 96.3%✅ | 79.1%❌ | 97.5%✅ | 3/4 |
| ragbench | 199 | 77.4%❌ | 83.9%❌ | 56.5%❌ | n/a | 1/4 |

### Pooled — all 439 questions across 3 domains

| Metric | Pooled | Gate | Verdict |
| --- | ---: | ---: | :---: |
| Recall@5 (reranked) | 81.5% | 85.0% | ❌ |
| Faithfulness | 90.3% | 90.0% | ✅ |
| Answer correctness | 62.5% | 85.0% | ❌ |
| Citation accuracy | 82.6% | 90.0% | ❌ |
| MRR (reranked) | 0.613 | 0.700 | ⚠️ |
| Context precision | 43.3% | 65.0% | ⚠️ |

### Verdict

- **Grounding (faithfulness ≥ 90%):** ⚠️ below on ragbench.
- **Answer correctness (≥ 85%):** ⚠️ open — below target on arxiv (65.2%), cuad (79.1%), ragbench (56.5%). Driven by retrieval misses + abstractive/hard questions, not hallucination (faithfulness stays high).
- **Retrieval (Recall@5 ≥ 85%) & citation:** see matrix above.

> Reranking ran on the Cohere trial key (10 calls/min) with graceful Haiku fallback under concurrency; ranking-sensitive metrics (MRR, context precision) understate a production-Cohere setup. Citation is **N/A** for RAGBench (anonymous corpus passages have no natural title) and context precision is **N/A** for doc-scoped CUAD.
