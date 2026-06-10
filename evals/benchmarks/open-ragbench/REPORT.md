# How effective is this RAG system?

> Run: `golive-200doc-100q-gemjudge-v2` · Generated 2026-06-10

This report measures the production RAG pipeline against **Vectara's Open RAG Benchmark** — 1,000 arXiv papers with 3,045 expert-written question-answer pairs spanning text, tables, and figures. Unlike a synthetic eval, the questions are written by humans and the ground truth is published, so results are directly comparable to other RAG systems benchmarked on the same set.

## Headline numbers

- **Questions evaluated:** 100 (of 100 sampled)
- **Recall@5** — fraction of queries where the right section appears in the top 5 results: **88.0%**
- **MRR (Mean Reciprocal Rank)** — how high the right section ranks on average: **0.724**
- **Context precision** — fraction of returned chunks judged relevant: **57.0%**
- **Faithfulness** — fraction of answers grounded in the retrieved context: **95.0%**
- **Correctness** — semantic match against the benchmark's reference answer: **70.0%**
- **Citation accuracy** — fraction of answers that name the source document: **94.5%**
- **Avg latency:** 15.5s per query · **Cost per query:** $0.0196

## Verdict

🟡 **Overall: Conditional GO — beta only (a hard gate is below its launch threshold)**

Scored against the **canonical strict go-live gates** defined in `docs/GO_LIVE_READINESS.md` (the single source of truth). The Open RAG Benchmark publishes no official cutoffs — these are our chosen strict bars for a grounding-strict product. **Gate ≥** is the launch threshold; **Pilot ≥** is a below-gate floor that's acceptable for a limited beta.

| Metric | Value | Status | Gate ≥ | Pilot ≥ |
| --- | ---: | :---: | ---: | ---: |
| Recall@5 | 88.0% | 🟢 Meets gate | 85.0% | 70.0% |
| MRR | 0.724 | 🟢 Meets gate | 0.700 | 0.500 |
| Context prec. | 57.0% | 🟡 Below gate (pilot) | 65.0% | 45.0% |
| Faithfulness | 95.0% | 🟢 Meets gate | 90.0% | 75.0% |
| Correctness | 70.0% | 🟡 Below gate (pilot) | 85.0% | 65.0% |
| Citation acc. | 94.5% | 🟢 Meets gate | 90.0% | 70.0% |

Legend: 🟢 Meets gate (launch-grade) · 🟡 Below gate (beta-only) · 🔴 Needs work.

## What this means

- For every 5 results we surface, the **correct passage is present 88%** of the time.
- The system **fabricates content in ≈5.0%** of answers (1 − faithfulness).
- On average, the correct chunk ranks at position **1.4**.

## Where it shines, where it struggles

### By modality
Question stratified by what the question *requires*: text, a table, an image, or several.

| Modality | Count | Recall@k | MRR | Faith | Corr |
| --- | ---: | ---: | ---: | ---: | ---: |
| text | 68 | 85.3% | 0.730 | 95.6% | 71.9% |
| text-image | 24 | 91.7% | 0.668 | 91.7% | 60.4% |
| text-table-image | 7 | 100.0% | 0.929 | 100.0% | 80.0% |
| text-table | 1 | 100.0% | 0.200 | 100.0% | 100.0% |

### By query type

- **extractive** — answer is a span of text from the source
- **abstractive** — answer synthesises or paraphrases across the source

| Type | Count | Recall@k | MRR | Faith | Corr |
| --- | ---: | ---: | ---: | ---: | ---: |
| abstractive | 56 | 87.5% | 0.710 | 100.0% | 66.3% |
| extractive | 44 | 88.6% | 0.741 | 88.6% | 74.8% |

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

Full run artifacts: `open-ragbench/runs/2026-06-10T21-18-05_golive-200doc-100q-gemjudge-v2.json` and the sibling `.md` file.