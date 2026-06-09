# How effective is this RAG system?

> Run: `smoke` · Generated 2026-05-21

This report measures the production RAG pipeline against **Vectara's Open RAG Benchmark** — 1,000 arXiv papers with 3,045 expert-written question-answer pairs spanning text, tables, and figures. Unlike a synthetic eval, the questions are written by humans and the ground truth is published, so results are directly comparable to other RAG systems benchmarked on the same set.

## Headline numbers

- **Questions evaluated:** 20 (of 20 sampled)
- **Recall@5** — fraction of queries where the right section appears in the top 5 results: **75.0%**
- **MRR (Mean Reciprocal Rank)** — how high the right section ranks on average: **0.443**
- **Context precision** — fraction of returned chunks judged relevant: **62.0%**
- **Faithfulness** — fraction of answers grounded in the retrieved context: **40.0%**
- **Correctness** — semantic match against the benchmark's reference answer: **52.5%**
- **Citation accuracy** — fraction of answers that name the source document: **60.0%**
- **Avg latency:** 2.6s per query · **Cost per query:** $0.0062

## Verdict

🔴 **Overall: Needs work before production**

Per-metric scoring against informal RAG community baselines. The Open RAG Benchmark does not publish official pass/fail cutoffs — these thresholds are directional, drawn from typical splits in RAG research and vendor blog posts (Cohere, Vectara, LlamaIndex).

| Metric | Value | Tier | Strong ≥ | Acceptable ≥ |
| --- | ---: | :---: | ---: | ---: |
| Recall@5 | 75.0% | 🟡 Acceptable | 85.0% | 70.0% |
| MRR | 0.443 | 🔴 Needs work | 0.650 | 0.450 |
| Context prec. | 62.0% | 🟢 Strong | 60.0% | 40.0% |
| Faithfulness | 40.0% | 🔴 Needs work | 80.0% | 65.0% |
| Correctness | 52.5% | 🔴 Needs work | 75.0% | 55.0% |
| Citation acc. | 60.0% | 🟡 Acceptable | 80.0% | 60.0% |

Legend: 🟢 Strong (production-grade) · 🟡 Acceptable (pilot-ready) · 🔴 Needs work (below typical production bar).

## What this means

- For every 5 results we surface, the **correct passage is present 75%** of the time.
- The system **fabricates content in ≈60.0%** of answers (1 − faithfulness).
- On average, the correct chunk ranks at position **2.3**.

## Where it shines, where it struggles

### By modality
Question stratified by what the question *requires*: text, a table, an image, or several.

| Modality | Count | Recall@k | MRR | Faith | Corr |
| --- | ---: | ---: | ---: | ---: | ---: |
| text-image | 11 | 54.5% | 0.230 | 54.5% | 68.2% |
| text | 7 | 100.0% | 0.690 | 14.3% | 14.3% |
| text-table | 2 | 100.0% | 0.750 | 50.0% | 100.0% |

### By query type

- **extractive** — answer is a span of text from the source
- **abstractive** — answer synthesises or paraphrases across the source

| Type | Count | Recall@k | MRR | Faith | Corr |
| --- | ---: | ---: | ---: | ---: | ---: |
| abstractive | 16 | 81.3% | 0.429 | 43.8% | 53.1% |
| extractive | 4 | 50.0% | 0.500 | 25.0% | 50.0% |

## Pipeline under test

| Layer | Component |
| --- | --- |
| Chat model | `gpt-4o` |
| Embedding model | `text-embedding-3-small` |
| Judge model (LLM-as-a-judge) | `gpt-4o-mini` |
| Retrieval | Hybrid (pgvector cosine + Postgres BM25) fused via Reciprocal Rank Fusion |
| Reranker | Cohere Rerank 3.5 (with gpt-4o-mini fallback) |
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

Full run artifacts: `open-ragbench/runs/2026-05-21T22-06-51_smoke.json` and the sibling `.md` file.