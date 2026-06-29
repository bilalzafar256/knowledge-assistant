"use client";

/**
 * Marketing landing — "Aperture".
 * Technical-editorial dark system, emerald signal accent, Framer Motion
 * throughout. No product imagery: typography, motion, real code, and a system
 * diagram carry the page. Every metric is pulled from the latest gate-grade
 * eval run (evals/report.md, 2026-06-29). Tokens live under `.mkt` in globals.css.
 */

import Link from "next/link";
import { SignedIn, SignedOut } from "@clerk/nextjs";
import { useRef } from "react";
import {
  motion,
  useReducedMotion,
  useScroll,
  useTransform,
} from "framer-motion";
import {
  ArrowUpRight,
  Database,
  Gauge,
  FlaskConical,
  ShieldCheck,
  Activity,
  Workflow,
  type LucideIcon,
} from "lucide-react";
import { Reveal, Stagger, StaggerItem, Counter, Magnetic, ease } from "./motion";
import { CustomCursor } from "./cursor";
import {
  RetrievalField,
  HallucinationDrift,
  JudgeStream,
  NodeWeb,
  FusionStreams,
  CommitGraph,
} from "./section-backgrounds";

/* ─── Real data, sourced from evals/report.md (gate-grade, 2026-06-29) ─────── */

const STATS = [
  { value: 439, decimals: 0, suffix: "", label: "Questions graded", sub: "three public benchmarks" },
  { value: 90.3, decimals: 1, suffix: "%", label: "Faithfulness", sub: "pooled, no hallucination" },
  { value: 85.0, decimals: 1, suffix: "%", label: "Recall@5", sub: "arXiv and CUAD" },
  { value: 97.5, decimals: 1, suffix: "%", label: "Citation accuracy", sub: "CUAD contracts" },
];

const DOMAINS = [
  { name: "Open RAG Bench", kind: "arXiv academic", n: 200, recall: "85.0", faith: "95.6", correct: "65.2", cite: "97.3" },
  { name: "CUAD", kind: "Enterprise contracts", n: 40, recall: "85.0", faith: "96.3", correct: "79.1", cite: "97.5" },
  { name: "RAGBench", kind: "Multi-domain enterprise", n: 199, recall: "77.4", faith: "83.9", correct: "56.5", cite: "n/a" },
];

type Decision = { icon: LucideIcon; title: string; body: string; metric: string; metricLabel: string };

const DECISIONS: Decision[] = [
  {
    icon: Database,
    title: "Vector and lexical, fused in one SQL round-trip.",
    body: "pgvector cosine and Postgres BM25 run inside a single CTE, combined by Reciprocal Rank Fusion before anything reaches the reranker. No stitching results in application code.",
    metric: "k=60",
    metricLabel: "RRF fusion",
  },
  {
    icon: Gauge,
    title: "Reranked, with context written per chunk.",
    body: "Cohere Rerank 3.5 trims the fused pool, and each chunk carries a short context paragraph written by Haiku and prompt-cached. Techniques that did not earn their keep were measured and reverted.",
    metric: "95.6%",
    metricLabel: "faithfulness, arXiv",
  },
  {
    icon: FlaskConical,
    title: "Graded on three public benchmarks.",
    body: "Academic arXiv, enterprise contracts, and a multi-domain set, scored by a cross-family Gemini judge. Published ground truth, no self-reference, every run emits a report.",
    metric: "439",
    metricLabel: "expert questions",
  },
  {
    icon: ShieldCheck,
    title: "Grounded only in what was retrieved.",
    body: "The model answers from retrieved chunks with citations, and refuses to invent a number, date, or name it cannot trace to a source.",
    metric: "97.5%",
    metricLabel: "citation accuracy",
  },
  {
    icon: Workflow,
    title: "Auth and shield before any query runs.",
    body: "CSRF, Clerk, and Arcjet gate every route. Each query is scoped to one tenant, each action written to an audit log.",
    metric: "Every",
    metricLabel: "route protected",
  },
  {
    icon: Activity,
    title: "Telemetry to Axiom, without leaking a prompt.",
    body: "Token usage, latency, and finish reason ship as spans. Prompts and completions stay on the server by construction.",
    metric: "0",
    metricLabel: "prompts stored",
  },
];

const HYBRID_SQL = `WITH vector_hits AS (
  SELECT id, ROW_NUMBER() OVER (ORDER BY embedding <=> $q::vector) AS rank
  FROM document_chunks
  WHERE user_id = $uid AND embedding IS NOT NULL
  ORDER BY embedding <=> $q::vector
  LIMIT $per
),
bm25_hits AS (
  SELECT dc.id, ROW_NUMBER() OVER (
    ORDER BY ts_rank_cd(dc.content_tsv, bq.q) DESC
  ) AS rank
  FROM document_chunks dc, plainto_tsquery('english', $text) bq
  WHERE dc.user_id = $uid AND dc.content_tsv @@ bq.q
  LIMIT $per
),
fused AS (
  SELECT id, SUM(1.0 / (60 + rank)) AS rrf_score
  FROM (SELECT id, rank FROM vector_hits
        UNION ALL
        SELECT id, rank FROM bm25_hits) c
  GROUP BY id
)
SELECT dc.*, f.rrf_score
FROM fused f JOIN document_chunks dc ON dc.id = f.id
ORDER BY f.rrf_score DESC LIMIT $k;`;

const INGEST_FLOW = ["Upload", "Parse", "Chunk", "Embed", "pgvector + tsvector"];
const QUERY_FLOW = ["Synthesize", "Embed", "Hybrid CTE", "RRF fuse", "Rerank", "Grounded stream"];

const TELEGRAM_STEPS = [
  { n: "1", label: "Telegram message", sub: "webhook secret + chat-id allowlist" },
  { n: "2", label: "Classifier", sub: "task, continue, or cancel (Haiku)" },
  { n: "3", label: "Plan subagent", sub: "clarifies, then drafts a plan" },
  { n: "4", label: "Coder agent", sub: "writes the minimal diff, pushes a branch" },
  { n: "5", label: "Pull request into dev", sub: "task closed, link posted back" },
];

const STACK = [
  "Next.js 16", "Vercel AI SDK v6", "Anthropic Claude", "Google Gemini", "Cohere",
  "Neon + pgvector", "Drizzle ORM", "Clerk", "Arcjet", "Inngest", "Axiom",
  "OpenTelemetry", "Tailwind v4", "shadcn/ui",
];

/* ─── Page ─────────────────────────────────────────────────────────────────── */

export function Landing() {
  return (
    <div className="mkt relative min-h-[100dvh] overflow-x-clip antialiased">
      <CustomCursor />
      <Atmosphere />
      <Header />
      <Hero />
      <StatStrip />
      <Problem />
      <Proof />
      <Architecture />
      <Decisions />
      <CodePanel />
      <Telegram />
      <StackMarquee />
      <FinalCta />
      <Footer />
    </div>
  );
}

/* Fixed atmospheric layer — two slowly drifting emerald aurora fields over a
   faint dot grid. Only transform/opacity animate (GPU), it is fixed and
   pointer-events-none so it never costs scroll repaints, and motion is dropped
   entirely under reduced-motion. */
function Atmosphere() {
  const reduce = useReducedMotion();
  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
      <motion.div
        className="absolute -right-[18vw] -top-[12vh] h-[72vh] w-[72vh] rounded-full opacity-70 blur-[120px] will-change-transform"
        style={{ background: "radial-gradient(closest-side, rgba(52,211,153,0.14), rgba(52,211,153,0.03) 60%, transparent)" }}
        animate={reduce ? undefined : { x: [0, -60, 20, 0], y: [0, 40, -20, 0], scale: [1, 1.12, 0.96, 1] }}
        transition={reduce ? undefined : { duration: 26, ease: "easeInOut", repeat: Infinity }}
      />
      <motion.div
        className="absolute -left-[14vw] top-[38vh] h-[56vh] w-[56vh] rounded-full opacity-50 blur-[120px] will-change-transform"
        style={{ background: "radial-gradient(closest-side, rgba(45,212,191,0.1), transparent 65%)" }}
        animate={reduce ? undefined : { x: [0, 50, -30, 0], y: [0, -40, 30, 0], scale: [1, 0.9, 1.1, 1] }}
        transition={reduce ? undefined : { duration: 32, ease: "easeInOut", repeat: Infinity }}
      />
      <div
        className="absolute inset-0 opacity-[0.4]"
        style={{
          backgroundImage:
            "radial-gradient(circle at 1px 1px, rgba(233,236,239,0.05) 1px, transparent 0)",
          backgroundSize: "44px 44px",
          maskImage: "radial-gradient(120% 70% at 50% 0%, #000 30%, transparent 80%)",
        }}
      />
    </div>
  );
}

function Logo() {
  return (
    <span className="flex items-center gap-2.5">
      <span className="relative flex h-7 w-7 items-center justify-center">
        <span className="absolute inset-0 rounded-sm border border-[var(--accent)]/40" />
        <span className="h-1.5 w-1.5 rounded-full bg-[var(--accent)]" />
      </span>
      <span className="text-[0.95rem] font-medium tracking-tight text-[var(--text)]">
        Knowledge Assistant
      </span>
    </span>
  );
}

function Header() {
  return (
    <motion.header
      initial={{ y: -16, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.6, ease }}
      className="sticky top-0 z-40 border-b border-[var(--line)] bg-[var(--bg)]/80 backdrop-blur supports-[backdrop-filter]:bg-[var(--bg)]/60"
    >
      <div className="mx-auto flex h-16 max-w-[1400px] items-center justify-between px-6 md:px-10">
        <Link href="/"><Logo /></Link>
        <nav className="flex items-center gap-2 sm:gap-5">
          <SignedOut>
            <Link
              href="/sign-in"
              className="hidden text-sm text-[var(--text-dim)] transition-colors hover:text-[var(--text)] sm:inline"
            >
              Sign in
            </Link>
            <Link
              href="#contact"
              className="group inline-flex items-center gap-1.5 bg-[var(--accent)] px-4 py-2 text-sm font-medium text-[var(--accent-ink)] transition-[background-color,transform] duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] hover:bg-[var(--accent-strong)] active:translate-y-px"
            >
              Book a call
              <ArrowUpRight className="h-3.5 w-3.5" strokeWidth={2} />
            </Link>
          </SignedOut>
          <SignedIn>
            <Link
              href="/dashboard"
              className="inline-flex items-center gap-1.5 bg-[var(--accent)] px-4 py-2 text-sm font-medium text-[var(--accent-ink)] transition-colors hover:bg-[var(--accent-strong)]"
            >
              Open dashboard
              <ArrowUpRight className="h-3.5 w-3.5" strokeWidth={2} />
            </Link>
          </SignedIn>
        </nav>
      </div>
    </motion.header>
  );
}

function Hero() {
  const ref = useRef<HTMLElement>(null);
  const reduce = useReducedMotion();
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start start", "end start"] });
  const ringY = useTransform(scrollYProgress, [0, 1], [0, reduce ? 0 : -80]);
  const fade = useTransform(scrollYProgress, [0, 0.8], [1, reduce ? 1 : 0]);

  return (
    <section
      ref={ref}
      className="relative mx-auto grid max-w-[1400px] grid-cols-1 items-center gap-x-10 gap-y-16 px-6 pb-20 pt-20 md:px-10 lg:min-h-[88dvh] lg:grid-cols-12 lg:pt-24"
    >
      {/* Left: editorial headline column */}
      <div className="lg:col-span-7">
        <Reveal as="p" className="font-mono text-[0.72rem] uppercase text-[var(--text-faint)]" delay={0} y={12}>
          <span style={{ letterSpacing: "var(--track-label)" }}>Production RAG, as a case study</span>
        </Reveal>

        <h1
          className="mt-7 font-[family-name:var(--font-display)] font-semibold leading-[0.98] text-[var(--text)]"
          style={{ fontSize: "var(--display)", letterSpacing: "var(--track-tight)" }}
        >
          <Reveal as="span" delay={0.06} className="block">Answers you can</Reveal>
          <Reveal as="span" delay={0.14} className="block">
            <span className="text-[var(--accent)]">trace</span> to the source.
          </Reveal>
        </h1>

        <Reveal delay={0.24} className="mt-8 max-w-[46ch] text-[1.05rem] leading-relaxed text-[var(--text-dim)]">
          Hybrid retrieval, reranking, and strict grounding, measured on real benchmarks.
          Built to be trusted in production, not just demoed once.
        </Reveal>

        <Reveal delay={0.32} className="mt-10 flex flex-col gap-3 sm:flex-row sm:items-center">
          <Magnetic>
            <Link
              href="#contact"
              className="group inline-flex items-center justify-center gap-2 bg-[var(--accent)] px-7 py-3.5 text-sm font-medium text-[var(--accent-ink)] transition-[background-color,transform] duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] hover:bg-[var(--accent-strong)] active:translate-y-px"
            >
              Book a call
              <ArrowUpRight className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-0.5 group-hover:-translate-y-0.5" strokeWidth={2} />
            </Link>
          </Magnetic>
          <SignedOut>
            <Link
              href="/sign-up"
              className="inline-flex items-center justify-center border border-[var(--line-strong)] px-7 py-3.5 text-sm font-medium text-[var(--text)] transition-colors duration-300 hover:border-[var(--text-dim)] hover:bg-[var(--surface)]"
            >
              See the live demo
            </Link>
          </SignedOut>
          <SignedIn>
            <Link
              href="/dashboard"
              className="inline-flex items-center justify-center border border-[var(--line-strong)] px-7 py-3.5 text-sm font-medium text-[var(--text)] transition-colors duration-300 hover:border-[var(--text-dim)] hover:bg-[var(--surface)]"
            >
              Open dashboard
            </Link>
          </SignedIn>
        </Reveal>
      </div>

      {/* Right: a live retrieval graph — query, retrieval, trace-to-source */}
      <motion.div style={{ y: ringY, opacity: fade }} className="lg:col-span-5">
        <div className="relative mx-auto w-full max-w-[440px]">
          <div className="aspect-square w-full">
            <RetrievalField />
          </div>
          <div className="mt-4 flex items-center justify-between border-t border-[var(--line)] pt-3 font-mono text-[0.65rem] uppercase tracking-[0.18em] text-[var(--text-faint)]">
            <span>Query</span>
            <span>Retrieve</span>
            <span className="text-[var(--accent)]">Grounded answer</span>
          </div>
        </div>
      </motion.div>
    </section>
  );
}

function StatStrip() {
  return (
    <section className="mx-auto max-w-[1400px] px-6 md:px-10">
      <Stagger className="grid grid-cols-2 gap-px overflow-hidden border border-[var(--line)] bg-[var(--line)] md:grid-cols-4">
        {STATS.map((s) => (
          <StaggerItem key={s.label} className="bg-[var(--bg)] p-6 md:p-8">
            <Counter
              value={s.value}
              decimals={s.decimals}
              suffix={s.suffix}
              className="tnum font-[family-name:var(--font-display)] text-4xl font-semibold tracking-tight text-[var(--accent)] md:text-5xl"
            />
            <div className="mt-3 text-sm font-medium text-[var(--text)]">{s.label}</div>
            <div className="text-xs text-[var(--text-faint)]">{s.sub}</div>
          </StaggerItem>
        ))}
      </Stagger>
      <Reveal className="mt-4 text-xs text-[var(--text-faint)]">
        Latest gate-grade run, 2026-06-29. Scored by a cross-family Gemini judge. Per-domain detail below.
      </Reveal>
    </section>
  );
}

function Problem() {
  return (
    <section className="relative overflow-hidden py-28 md:py-36">
      <div className="absolute inset-0 opacity-50">
        <HallucinationDrift />
      </div>
      <div className="relative mx-auto max-w-[1000px] px-6 md:px-10">
      <Reveal>
        <h2
          className="font-[family-name:var(--font-display)] font-semibold leading-[1.04] text-[var(--text)]"
          style={{ fontSize: "var(--h2)", letterSpacing: "var(--track-tight)" }}
        >
          Anyone can wire up a vector store. Almost no-one ships a RAG system you can{" "}
          <span className="text-[var(--accent)]">trust</span>.
        </h2>
      </Reveal>
      <div className="mt-8 grid gap-6 text-[1.05rem] leading-relaxed text-[var(--text-dim)] md:max-w-[62ch]">
        <Reveal delay={0.08}>
          The usual demo is one document, pure cosine similarity, and a model that confidently
          invents the numbers it could not find. It looks great on a slide and falls apart on the
          first real question.
        </Reveal>
        <Reveal delay={0.16}>
          This is the opposite: a production-shaped answer to the four things that decide whether a
          knowledge assistant is usable. Retrieval quality, grounding discipline, measurement, and
          security, each one built and each one measured.
        </Reveal>
      </div>
      </div>
    </section>
  );
}

function Proof() {
  return (
    <section className="relative overflow-hidden py-20">
      <div className="absolute inset-0 opacity-40">
        <JudgeStream />
      </div>
      <div className="relative mx-auto max-w-[1400px] px-6 md:px-10">
      <Reveal as="p" className="font-mono text-[0.72rem] uppercase text-[var(--text-faint)]" y={12}>
        <span style={{ letterSpacing: "var(--track-label)" }}>Evaluation</span>
      </Reveal>
      <Reveal delay={0.06}>
        <h2
          className="mt-4 max-w-[20ch] font-[family-name:var(--font-display)] font-semibold leading-[1.04] text-[var(--text)]"
          style={{ fontSize: "var(--h2)", letterSpacing: "var(--track-tight)" }}
        >
          The same pipeline, three domains.
        </h2>
      </Reveal>
      <Reveal delay={0.12} className="mt-4 max-w-[58ch] text-[var(--text-dim)]">
        Numbers shown as-measured, including the hard one. RAGBench is a deliberately broad,
        anonymised corpus where retrieval is harder and citation has no natural title to score.
      </Reveal>

      <Reveal delay={0.16} className="mt-12 overflow-x-auto">
        <table className="w-full min-w-[680px] border-collapse text-left">
          <thead>
            <tr className="border-b border-[var(--line-strong)] text-[0.7rem] uppercase tracking-wider text-[var(--text-faint)]">
              <th className="py-3 pr-4 font-medium">Benchmark</th>
              <th className="py-3 pr-4 text-right font-medium">Questions</th>
              <th className="py-3 pr-4 text-right font-medium">Recall@5</th>
              <th className="py-3 pr-4 text-right font-medium">Faithfulness</th>
              <th className="py-3 pr-4 text-right font-medium">Correctness</th>
              <th className="py-3 text-right font-medium">Citation</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--line)]">
            {DOMAINS.map((d) => (
              <tr key={d.name} className="group transition-colors hover:bg-[var(--surface)]/60">
                <td className="py-5 pr-4">
                  <div className="font-[family-name:var(--font-display)] text-lg font-medium text-[var(--text)]">{d.name}</div>
                  <div className="text-xs text-[var(--text-faint)]">{d.kind}</div>
                </td>
                <td className="tnum py-5 pr-4 text-right font-mono text-sm text-[var(--text-dim)]">{d.n}</td>
                <td className="tnum py-5 pr-4 text-right font-mono text-sm text-[var(--text)]">{d.recall}%</td>
                <td className="tnum py-5 pr-4 text-right font-mono text-sm text-[var(--accent)]">{d.faith}%</td>
                <td className="tnum py-5 pr-4 text-right font-mono text-sm text-[var(--text-dim)]">{d.correct}%</td>
                <td className="tnum py-5 text-right font-mono text-sm text-[var(--text-dim)]">{d.cite === "n/a" ? <span className="text-[var(--text-faint)]">n/a</span> : `${d.cite}%`}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Reveal>
      </div>
    </section>
  );
}

function SignalScan() {
  const reduce = useReducedMotion();
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
      {/* faint engineering grid */}
      <div
        className="absolute inset-0 opacity-[0.5]"
        style={{
          backgroundImage:
            "linear-gradient(rgba(233,236,239,0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(233,236,239,0.04) 1px, transparent 1px)",
          backgroundSize: "60px 60px",
          maskImage: "radial-gradient(100% 100% at 50% 50%, #000 40%, transparent 90%)",
        }}
      />
      {/* a single emerald scan line sweeping down the band */}
      {!reduce && (
        <motion.div
          className="absolute inset-x-0 h-px will-change-transform"
          style={{ background: "linear-gradient(90deg, transparent, rgba(52,211,153,0.55), transparent)" }}
          initial={{ top: "-2%" }}
          animate={{ top: ["-2%", "102%"] }}
          transition={{ duration: 7, ease: "easeInOut", repeat: Infinity, repeatDelay: 2 }}
        />
      )}
    </div>
  );
}

function Architecture() {
  return (
    <section className="relative border-y border-[var(--line)] bg-[var(--surface)]/40">
      <SignalScan />
      <div className="relative mx-auto max-w-[1400px] px-6 py-24 md:px-10 md:py-28">
        <Reveal as="p" className="font-mono text-[0.72rem] uppercase text-[var(--text-faint)]" y={12}>
          <span style={{ letterSpacing: "var(--track-label)" }}>Architecture</span>
        </Reveal>
        <Reveal delay={0.06}>
          <h2
            className="mt-4 max-w-[24ch] font-[family-name:var(--font-display)] font-semibold leading-[1.04] text-[var(--text)]"
            style={{ fontSize: "var(--h2)", letterSpacing: "var(--track-tight)" }}
          >
            Two flows, one observability plane.
          </h2>
        </Reveal>

        <div className="mt-14 space-y-10">
          <FlowRow label="Ingestion" steps={INGEST_FLOW} />
          <FlowRow label="Query" steps={QUERY_FLOW} accent />
        </div>
      </div>
    </section>
  );
}

function FlowRow({ label, steps, accent }: { label: string; steps: string[]; accent?: boolean }) {
  return (
    <div>
      <div className="mb-4 font-mono text-[0.7rem] uppercase tracking-wider text-[var(--text-faint)]">{label}</div>
      <Stagger className="flex flex-wrap items-stretch gap-2" amount={0.3}>
        {steps.map((step, i) => (
          <StaggerItem key={step} className="flex items-center gap-2">
            <div
              className={`flex h-full items-center border px-4 py-3 text-sm transition-colors ${
                accent
                  ? "border-[var(--accent)]/25 bg-[var(--accent-wash)] text-[var(--text)]"
                  : "border-[var(--line-strong)] bg-[var(--bg)] text-[var(--text-dim)]"
              }`}
            >
              {step}
            </div>
            {i < steps.length - 1 && (
              <ArrowUpRight className="h-3.5 w-3.5 rotate-45 text-[var(--text-faint)]" strokeWidth={2} />
            )}
          </StaggerItem>
        ))}
      </Stagger>
    </div>
  );
}

function Decisions() {
  return (
    <section className="relative overflow-hidden py-28">
      <div className="absolute inset-0 opacity-40">
        <NodeWeb />
      </div>
      <div className="relative mx-auto max-w-[1400px] px-6 md:px-10">
      <Reveal>
        <h2
          className="max-w-[22ch] font-[family-name:var(--font-display)] font-semibold leading-[1.04] text-[var(--text)]"
          style={{ fontSize: "var(--h2)", letterSpacing: "var(--track-tight)" }}
        >
          Six decisions that separate a demo from a system.
        </h2>
      </Reveal>

      {/* asymmetric bento: 6 items → 6 cells across three rhythm bands (4+2, 2+2+2 omitted, 3+3, 6) */}
      <Stagger className="mt-14 grid grid-cols-1 gap-3 md:grid-cols-6" amount={0.1}>
        <DecisionCell d={DECISIONS[0]!} className="md:col-span-4 md:row-span-2" feature />
        <DecisionCell d={DECISIONS[1]!} className="md:col-span-2 md:row-span-2" />
        <DecisionCell d={DECISIONS[2]!} className="md:col-span-2" />
        <DecisionCell d={DECISIONS[3]!} className="md:col-span-2" />
        <DecisionCell d={DECISIONS[4]!} className="md:col-span-2" />
        <DecisionCell d={DECISIONS[5]!} className="md:col-span-6" wide />
      </Stagger>
      </div>
    </section>
  );
}

function DecisionCell({ d, className, feature, wide }: { d: Decision; className?: string; feature?: boolean; wide?: boolean }) {
  const Icon = d.icon;
  return (
    <StaggerItem className={className}>
      <motion.article
        whileHover={{ y: -4 }}
        transition={{ duration: 0.3, ease }}
        className="group relative flex h-full flex-col justify-between overflow-hidden border border-[var(--line)] bg-[var(--surface)] p-7 md:p-8"
      >
        {(feature || wide) && (
          <div
            aria-hidden
            className="absolute inset-0 opacity-90"
            style={{
              background: feature
                ? "radial-gradient(120% 120% at 88% 0%, rgba(52,211,153,0.12), transparent 55%)"
                : "linear-gradient(100deg, rgba(52,211,153,0.07) 0%, transparent 45%)",
            }}
          />
        )}
        <Icon className="relative z-10 h-6 w-6 text-[var(--accent)]" strokeWidth={1.5} />
        <div className="relative z-10 mt-10">
          <h3
            className={`font-[family-name:var(--font-display)] font-medium leading-tight text-[var(--text)] ${feature ? "text-2xl md:text-[1.85rem]" : "text-xl"}`}
            style={{ letterSpacing: "-0.01em" }}
          >
            {d.title}
          </h3>
          <p className={`mt-3 text-sm leading-relaxed text-[var(--text-dim)] ${feature ? "max-w-[44ch]" : "max-w-[40ch]"}`}>
            {d.body}
          </p>
          <div className="mt-7 flex items-baseline gap-3 border-t border-[var(--line)] pt-5">
            <span className="tnum font-mono text-lg text-[var(--text)]">{d.metric}</span>
            <span className="font-mono text-[0.65rem] uppercase tracking-[0.16em] text-[var(--text-faint)]">{d.metricLabel}</span>
          </div>
        </div>
      </motion.article>
    </StaggerItem>
  );
}

function CodePanel() {
  return (
    <section className="relative overflow-hidden pb-28">
      <div className="absolute inset-0 opacity-40">
        <FusionStreams />
      </div>
      <div className="relative mx-auto grid max-w-[1400px] items-start gap-10 px-6 md:px-10 lg:grid-cols-12">
        <div className="lg:col-span-4">
          <Reveal>
            <h2
              className="font-[family-name:var(--font-display)] font-semibold leading-[1.05] text-[var(--text)]"
              style={{ fontSize: "clamp(1.7rem,3vw,2.4rem)", letterSpacing: "var(--track-tight)" }}
            >
              One round-trip to Postgres.
            </h2>
          </Reveal>
          <Reveal delay={0.08} className="mt-5 text-[var(--text-dim)] leading-relaxed">
            Vector search alone misses exact identifiers. Lexical search alone misses paraphrase.
            Both run in a single CTE and fuse by rank, so the candidate pool is ready before the
            reranker is even called.
          </Reveal>
        </div>
        <Reveal delay={0.12} className="lg:col-span-8">
          <div className="overflow-hidden border border-[var(--line)] bg-[var(--surface)]">
            <div className="flex items-center justify-between border-b border-[var(--line)] bg-[var(--surface-2)] px-4 py-2.5">
              <span className="font-mono text-xs text-[var(--text-dim)]">src/lib/ai.ts</span>
              <span className="font-mono text-[0.65rem] uppercase tracking-wider text-[var(--text-faint)]">hybrid retrieval</span>
            </div>
            <pre className="overflow-x-auto p-5 font-mono text-[0.78rem] leading-relaxed text-[var(--text-dim)]">
              <code>{HYBRID_SQL}</code>
            </pre>
          </div>
        </Reveal>
      </div>
    </section>
  );
}

function Telegram() {
  return (
    <section className="relative overflow-hidden border-y border-[var(--line)] bg-[var(--surface)]/40">
      <div className="absolute inset-0 opacity-50">
        <CommitGraph />
      </div>
      <div className="relative mx-auto grid max-w-[1400px] items-center gap-12 px-6 py-24 md:grid-cols-2 md:px-10 md:py-28">
        <div>
          <Reveal>
            <h2
              className="font-[family-name:var(--font-display)] font-semibold leading-[1.04] text-[var(--text)]"
              style={{ fontSize: "var(--h2)", letterSpacing: "var(--track-tight)" }}
            >
              I ship pull requests from Telegram.
            </h2>
          </Reveal>
          <Reveal delay={0.08} className="mt-6 max-w-[52ch] leading-relaxed text-[var(--text-dim)]">
            A bot drives the development pipeline from my phone. It classifies a message, delegates
            planning to a read-only architect agent, then a coder agent writes the minimal diff and
            opens a PR. Built on GitHub Actions and Neon, with no third-party orchestrator.
          </Reveal>
          <Reveal delay={0.16} className="mt-5 text-sm text-[var(--text-faint)]">
            Every step gated by approval. No agent can push to main.
          </Reveal>
        </div>

        <Stagger className="relative flex flex-col gap-px border border-[var(--line)] bg-[var(--line)]" amount={0.2}>
          {TELEGRAM_STEPS.map((s) => (
            <StaggerItem key={s.n} className="flex items-start gap-4 bg-[var(--bg)] px-5 py-4">
              <span className="tnum mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center border border-[var(--accent)]/30 bg-[var(--accent-wash)] font-mono text-xs font-semibold text-[var(--accent)]">
                {s.n}
              </span>
              <div>
                <div className="text-sm font-medium text-[var(--text)]">{s.label}</div>
                <div className="font-mono text-xs text-[var(--text-faint)]">{s.sub}</div>
              </div>
            </StaggerItem>
          ))}
        </Stagger>
      </div>
    </section>
  );
}

function StackMarquee() {
  const reduce = useReducedMotion();
  const row = [...STACK, ...STACK];
  return (
    <section className="py-24 md:py-28">
      <Reveal className="mx-auto mb-12 max-w-[1400px] px-6 md:px-10">
        <h2 className="font-[family-name:var(--font-display)] text-xl font-medium text-[var(--text-dim)]">
          Built on the 2026 Vercel stack.
        </h2>
      </Reveal>
      <div className="relative overflow-hidden" style={{ maskImage: "linear-gradient(90deg, transparent, #000 8%, #000 92%, transparent)" }}>
        <motion.div
          className="flex w-max gap-3 will-change-transform"
          animate={reduce ? undefined : { x: ["0%", "-50%"] }}
          transition={reduce ? undefined : { duration: 38, ease: "linear", repeat: Infinity }}
        >
          {row.map((t, i) => (
            <span
              key={`${t}-${i}`}
              className="whitespace-nowrap border border-[var(--line)] bg-[var(--surface)] px-5 py-2.5 font-mono text-sm text-[var(--text-dim)]"
            >
              {t}
            </span>
          ))}
        </motion.div>
      </div>
    </section>
  );
}

function FinalCta() {
  const reduce = useReducedMotion();
  return (
    <section id="contact" className="mx-auto max-w-[1400px] px-6 pb-28 md:px-10">
      <Reveal className="relative overflow-hidden border border-[var(--accent)]/25 bg-[var(--surface)] px-8 py-20 text-center md:px-12 md:py-28">
        <motion.div
          aria-hidden
          className="pointer-events-none absolute inset-0 will-change-[opacity,transform]"
          style={{ background: "radial-gradient(120% 100% at 50% 0%, rgba(52,211,153,0.14), transparent 60%)" }}
          animate={reduce ? undefined : { opacity: [0.65, 1, 0.65], scale: [1, 1.06, 1] }}
          transition={reduce ? undefined : { duration: 6, ease: "easeInOut", repeat: Infinity }}
        />
        <h2
          className="relative font-[family-name:var(--font-display)] font-semibold leading-[1.02] text-[var(--text)]"
          style={{ fontSize: "var(--h2)", letterSpacing: "var(--track-tight)" }}
        >
          Need something like this, for your domain?
        </h2>
        <p className="relative mx-auto mt-5 max-w-[48ch] leading-relaxed text-[var(--text-dim)]">
          From schema to retrieval to security to shipping, this is the full stack. If you want the
          same thing built for your documents, let us talk.
        </p>
        <div className="relative mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <Magnetic>
            <Link
              href="mailto:hello@example.com"
              className="group inline-flex items-center justify-center gap-2 bg-[var(--accent)] px-8 py-3.5 text-sm font-medium text-[var(--accent-ink)] transition-[background-color,transform] duration-300 hover:bg-[var(--accent-strong)] active:translate-y-px"
            >
              Book a call
              <ArrowUpRight className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-0.5 group-hover:-translate-y-0.5" strokeWidth={2} />
            </Link>
          </Magnetic>
          <SignedOut>
            <Link
              href="/sign-up"
              className="inline-flex items-center justify-center border border-[var(--line-strong)] px-8 py-3.5 text-sm font-medium text-[var(--text)] transition-colors hover:border-[var(--text-dim)] hover:bg-[var(--surface-2)]"
            >
              See the live demo
            </Link>
          </SignedOut>
        </div>
      </Reveal>
    </section>
  );
}

function Footer() {
  return (
    <footer className="border-t border-[var(--line)]">
      <div className="mx-auto flex max-w-[1400px] flex-col items-center justify-between gap-4 px-6 py-10 text-sm text-[var(--text-faint)] md:flex-row md:px-10">
        <Logo />
        <p className="font-mono text-xs">Next.js · Vercel AI SDK · Neon · Clerk · Arcjet</p>
      </div>
    </footer>
  );
}
