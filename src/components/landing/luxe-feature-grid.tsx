import {
  Database,
  Gauge,
  FlaskConical,
  ShieldCheck,
  Activity,
  Workflow,
  type LucideIcon,
} from "lucide-react";

/**
 * Luxe feature grid — asymmetric bento, exactly 6 cells across 3 rhythm bands
 * (4+2, 2+2+2, 6). DESIGN_VARIANCE 9. No eyebrow here: the page's single
 * eyebrow allowance is spent on the hero. Metrics are real project numbers.
 *
 * Background diversity: the lead cell carries a gold field, the reranking cell
 * a duotone image, the closing cell a wide ink-gold gradient. The rest breathe
 * on plain ink with hairlines — cards earn elevation only where it means something.
 */

type Feature = {
  icon: LucideIcon;
  title: string;
  body: string;
  metric: string;
  metricLabel: string;
};

const STROKE = 1.5;

function Cell({
  feature,
  className,
  children,
}: {
  feature: Feature;
  className?: string;
  children?: React.ReactNode;
}) {
  const Icon = feature.icon;
  return (
    <article
      className={`group relative flex flex-col justify-between overflow-hidden border border-[var(--lux-line)] bg-[var(--lux-ink-2)] p-7 transition-colors duration-300 ease-[var(--ease-lux)] hover:border-[var(--lux-line-strong)] md:p-9 ${className ?? ""}`}
    >
      {children}
      <div className="relative z-10">
        <Icon className="h-6 w-6 text-[var(--lux-gold)]" strokeWidth={STROKE} />
      </div>
      <div className="relative z-10 mt-10">
        <h3
          className="font-[family-name:var(--font-display)] text-[1.5rem] font-medium leading-tight text-[var(--lux-bone)] md:text-[1.7rem]"
          style={{ letterSpacing: "-0.01em" }}
        >
          {feature.title}
        </h3>
        <p className="mt-3 max-w-[42ch] text-sm leading-relaxed text-[var(--lux-bone-dim)]">
          {feature.body}
        </p>
        <div className="mt-7 flex items-baseline gap-3 border-t border-[var(--lux-line)] pt-5">
          <span className="font-[family-name:var(--font-geist-mono)] text-lg text-[var(--lux-bone)]">
            {feature.metric}
          </span>
          <span className="font-[family-name:var(--font-geist-mono)] text-[0.65rem] uppercase tracking-[0.18em] text-[var(--lux-bone-faint)]">
            {feature.metricLabel}
          </span>
        </div>
      </div>
    </article>
  );
}

const lead: Feature = {
  icon: Database,
  title: "Vector and BM25, fused in one SQL round-trip.",
  body: "Cosine similarity and Postgres lexical search run inside a single CTE, combined with Reciprocal Rank Fusion before anything reaches the reranker. No stitching results together in application code.",
  metric: "k=60",
  metricLabel: "RRF fusion",
};

const rerank: Feature = {
  icon: Gauge,
  title: "Grounded answers — measured, not claimed.",
  body: "Hybrid search + reranking + Anthropic Contextual Retrieval, with a cross-family judge grading every run.",
  metric: "95.6%",
  metricLabel: "faithfulness",
};

const evals: Feature = {
  icon: FlaskConical,
  title: "Scored on two public benchmarks.",
  body: "Academic (Vectara Open RAG Benchmark, 1,000 arXiv papers) and enterprise (CUAD contracts). Published ground truth, no self-reference.",
  metric: "3,045",
  metricLabel: "expert Q&A",
};

const grounding: Feature = {
  icon: ShieldCheck,
  title: "Grounded only in what was retrieved.",
  body: "The model answers from retrieved chunks with citations, and refuses to invent numbers, dates, or names.",
  metric: "62%",
  metricLabel: "context precision",
};

const security: Feature = {
  icon: Workflow,
  title: "Auth and shield before any query runs.",
  body: "CSRF, Clerk, and Arcjet gate every route. Each query is tenant-scoped, each action audited.",
  metric: "Every",
  metricLabel: "route",
};

const observability: Feature = {
  icon: Activity,
  title: "Telemetry to Axiom, without leaking a prompt.",
  body: "Token usage, latency, and finish reason ship as spans, while prompts and completions stay on the server by construction.",
  metric: "0",
  metricLabel: "prompts stored",
};

export function LuxeFeatureGrid() {
  return (
    <section className="px-6 py-24 md:px-10 md:py-32">
      <div className="mx-auto max-w-[1400px]">
        <header className="lux-rise max-w-[24ch]" style={{ ["--i" as string]: 0 }}>
          <h2
            className="font-[family-name:var(--font-display)] font-medium text-[var(--lux-bone)]"
            style={{
              fontSize: "var(--lux-h2)",
              lineHeight: 1.02,
              letterSpacing: "var(--lux-track-tight)",
            }}
          >
            Six decisions that separate a demo from a system.
          </h2>
        </header>

        {/* 6-col desktop grid → three rhythm bands (4+2, 2+2+2, 6).
            Collapses to a single column below md. */}
        <div className="mt-14 grid grid-cols-1 gap-4 md:mt-16 md:grid-cols-6">
          {/* Band 1 — lead cell (gold field) + reranking (duotone image) */}
          <Cell
            feature={lead}
            className="lux-rise md:col-span-4 md:min-h-[26rem]"
          >
            <div
              aria-hidden
              className="absolute inset-0 opacity-90"
              style={{
                background:
                  "radial-gradient(120% 130% at 85% 0%, rgba(200,169,106,0.14), transparent 55%)",
              }}
            />
          </Cell>

          <Cell
            feature={rerank}
            className="lux-rise md:col-span-2 md:min-h-[26rem]"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="https://picsum.photos/seed/ranked-order-light/700/900"
              alt=""
              aria-hidden
              className="lux-duotone absolute inset-0 h-full w-full object-cover opacity-30 transition-opacity duration-500 ease-[var(--ease-lux)] group-hover:opacity-40"
            />
            <div
              aria-hidden
              className="absolute inset-0"
              style={{
                background:
                  "linear-gradient(180deg, rgba(19,18,16,0.55) 0%, rgba(19,18,16,0.92) 100%)",
              }}
            />
          </Cell>

          {/* Band 2 — three equal-weight cells on plain ink */}
          <Cell feature={evals} className="lux-rise md:col-span-2" />
          <Cell feature={grounding} className="lux-rise md:col-span-2" />
          <Cell feature={security} className="lux-rise md:col-span-2" />

          {/* Band 3 — full-width closing cell (wide ink-gold gradient) */}
          <Cell
            feature={observability}
            className="lux-rise md:col-span-6 md:min-h-[18rem]"
          >
            <div
              aria-hidden
              className="absolute inset-0"
              style={{
                background:
                  "linear-gradient(100deg, rgba(28,26,23,0.9) 0%, rgba(19,18,16,0.6) 45%, rgba(200,169,106,0.08) 100%)",
              }}
            />
          </Cell>
        </div>
      </div>
    </section>
  );
}
