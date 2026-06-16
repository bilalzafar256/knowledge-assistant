# How effective is this RAG system?

> Run: `p1-contextual-200q-gategrade` · Generated 2026-06-16

This report measures the production RAG pipeline against **Vectara's Open RAG Benchmark** — 1,000 arXiv papers with 3,045 expert-written question-answer pairs spanning text, tables, and figures. Unlike a synthetic eval, the questions are written by humans and the ground truth is published, so results are directly comparable to other RAG systems benchmarked on the same set.

## Headline numbers

- **Questions evaluated:** 200 (of 200 sampled)
- **Recall@5** — fraction of queries where the right section appears in the top 5 results: **85.0%**
- **MRR (Mean Reciprocal Rank)** — how high the right section ranks on average: **0.624**
- **Context precision** — fraction of returned chunks judged relevant: **50.8%**
- **Faithfulness** — fraction of answers grounded in the retrieved context: **95.6%**
- **Correctness** — semantic match against the benchmark's reference answer: **65.2%**
- **Citation accuracy** — fraction of answers that name the source document: **97.3%**
- **Avg latency:** 18.7s per query · **Cost per query:** $0.0249

## Verdict

🟡 **Overall: Conditional GO — beta only (a hard gate is below its launch threshold)**

Scored against the **canonical strict go-live gates** defined in `docs/GO_LIVE_READINESS.md` (the single source of truth). The Open RAG Benchmark publishes no official cutoffs — these are our chosen strict bars for a grounding-strict product. **Gate ≥** is the launch threshold; **Pilot ≥** is a below-gate floor that's acceptable for a limited beta.

| Metric | Value | Status | Gate ≥ | Pilot ≥ |
| --- | ---: | :---: | ---: | ---: |
| Recall@5 | 85.0% | 🟢 Meets gate | 85.0% | 70.0% |
| MRR | 0.624 | 🟡 Below gate (pilot) | 0.700 | 0.500 |
| Context prec. | 50.8% | 🟡 Below gate (pilot) | 65.0% | 45.0% |
| Faithfulness | 95.6% | 🟢 Meets gate | 90.0% | 75.0% |
| Correctness | 65.2% | 🟡 Below gate (pilot) | 85.0% | 65.0% |
| Citation acc. | 97.3% | 🟢 Meets gate | 90.0% | 70.0% |

Legend: 🟢 Meets gate (launch-grade) · 🟡 Below gate (beta-only) · 🔴 Needs work.

## What this means

- For every 5 results we surface, the **correct passage is present 85%** of the time.
- The system **fabricates content in ≈4.4%** of answers (1 − faithfulness).
- On average, the correct chunk ranks at position **1.6**.

## Diagnostic: where correctness leaks

Correctness fails in two independent ways. Splitting by whether retrieval found the right section tells us where to invest — retrieval vs the answer/chunk-quality step.

| Slice | Count | Correctness | Faithfulness | Context prec. |
| --- | ---: | ---: | ---: | ---: |
| Retrieval **hit** | 170 | 67.1% | 94.9% | 48.7% |
| Retrieval **miss** | 30 | 54.7% | 99.3% | 62.7% |

**Hit-but-weak:** 32 of 170 retrieval hits still scored correctness < 0.5 (their context precision 50.0% vs all-hits 48.7%). When these two precisions are close, noise is **not** the cause — with section-level recall matching, it points to the fact-bearing chunk not ranking (a chunking / chunk-context problem).

## Where it shines, where it struggles

### By modality
Question stratified by what the question *requires*: text, a table, an image, or several.

| Modality | Count | Recall@k | MRR | Ctx prec. | Faith | Corr |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| text | 132 | 88.6% | 0.632 | 46.5% | 95.6% | 70.9% |
| text-image | 49 | 75.5% | 0.584 | 58.8% | 95.9% | 53.8% |
| text-table-image | 13 | 76.9% | 0.622 | 55.4% | 100.0% | 53.1% |
| text-table | 6 | 100.0% | 0.792 | 70.0% | 83.3% | 58.3% |

### By query type

- **extractive** — answer is a span of text from the source
- **abstractive** — answer synthesises or paraphrases across the source

| Type | Count | Recall@k | MRR | Ctx prec. | Faith | Corr |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| abstractive | 123 | 83.7% | 0.641 | 58.9% | 95.9% | 59.3% |
| extractive | 77 | 87.0% | 0.597 | 37.9% | 95.1% | 74.5% |

## Pipeline under test

| Layer | Component |
| --- | --- |
| Chat model | `claude-sonnet-4-6` |
| Embedding model | `gemini-embedding-001` |
| Judge model (LLM-as-a-judge) | `gemini-2.5-flash` |
| Retrieval | Hybrid (pgvector cosine + Postgres BM25) fused via Reciprocal Rank Fusion |
| Reranker | Cohere Rerank 3.5 (with Claude Haiku fallback) |
| Top-K | 5 |

## Caveats

- **Domain:** arXiv research papers only. Performance on enterprise documents (contracts, policies, internal wikis) may differ — that's a separate eval surface.
- **Sampling:** stratified by modality so smaller samples still exercise tables and figures. See `golden/golden-set.json` for the exact subset.
- **Image content:** the dataset ships images as base64 blobs which we do not OCR — image-modality questions retrieve via surrounding text only.
- **Section granularity:** the benchmark's ground truth is at section level. We tag every chunk with its `section_id` in metadata and score a hit if any chunk from the right section lands in the top-k.

## How to reproduce

```bash
pnpm eval:ragbench:download    # ~743 MB to evals/benchmarks/open-ragbench/data/
pnpm eval:ragbench:ingest      # ~3–5 min, ~$5 in embeddings
pnpm eval:ragbench:golden -- --sample 2000
pnpm eval:ragbench:run -- --label ragbench-baseline --concurrency 4
pnpm eval:ragbench:report
```

Full run artifacts: `open-ragbench/runs/2026-06-16T10-21-11_p1-contextual-200q-gategrade.json` and the sibling `.md` file.