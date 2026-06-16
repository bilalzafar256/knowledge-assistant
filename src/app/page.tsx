import Link from "next/link";
import { SignedIn, SignedOut } from "@clerk/nextjs";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Activity,
  ArrowRight,
  BookOpen,
  Database,
  Gauge,
  Github,
  Layers,
  Send,
  ShieldCheck,
  Sparkles,
  Workflow,
  ExternalLink,
} from "lucide-react";

const stats = [
  { label: "Faithfulness", value: "95.6%", hint: "answers grounded in sources — no hallucination" },
  { label: "Recall@5", value: "85%", hint: "right passage in top 5 · 200-doc benchmark" },
  { label: "Citation", value: "97.3%", hint: "answers name their source" },
  { label: "Benchmarks", value: "2 domains", hint: "academic (arXiv) + enterprise (contracts)" },
];

// Gate-grade run: 200 questions / 199-doc haystack, cross-family Gemini judge.
const verdictRows: { metric: string; value: string; tier: "strong" | "acceptable" | "needs-work" }[] = [
  { metric: "Faithfulness", value: "95.6%", tier: "strong" },
  { metric: "Citation accuracy", value: "97.3%", tier: "strong" },
  { metric: "Recall@5", value: "85.0%", tier: "strong" },
  { metric: "Correctness", value: "65.2%", tier: "acceptable" },
  { metric: "MRR (rerank)", value: "0.624", tier: "acceptable" },
  { metric: "Context precision", value: "50.8%", tier: "acceptable" },
];

// Same pipeline, second domain: CUAD enterprise contracts, retrieval scoped to
// the target document (the realistic "ask about my contract" scenario).
const domainRows = [
  { domain: "Academic — Open RAG Bench (arXiv)", recall: "85%", faith: "95.6%", cite: "97.3%" },
  { domain: "Enterprise — CUAD (contracts)", recall: "90%", faith: "97.2%", cite: "100%" },
];

const evalRuns = [
  { label: "baseline", note: "hybrid (vector + BM25 RRF) + Cohere rerank", recall: "88%", mrr: "0.724", latency: "—", cost: "$0.020" },
  { label: "+ contextual retrieval", note: "Haiku per-chunk context, prompt-cached", recall: "85%", mrr: "0.624", latency: "—", cost: "$0.020", highlight: true },
];

const techStack = [
  "Next.js 16",
  "Vercel AI SDK v6",
  "Anthropic Claude",
  "Google Gemini",
  "Cohere",
  "Neon + pgvector",
  "Drizzle ORM",
  "Clerk",
  "Arcjet",
  "Inngest",
  "Axiom",
  "OpenTelemetry",
  "Tailwind v4",
  "shadcn/ui",
];

const hybridSqlSnippet = `WITH vector_hits AS (
  SELECT id, ROW_NUMBER() OVER (ORDER BY embedding <=> $q::vector) AS rank
  FROM document_chunks
  WHERE user_id = $uid AND embedding IS NOT NULL
  ORDER BY embedding <=> $q::vector
  LIMIT $per
),
bm25_query AS (SELECT plainto_tsquery('english', $text) AS q),
bm25_hits AS (
  SELECT dc.id, ROW_NUMBER() OVER (
    ORDER BY ts_rank_cd(dc.content_tsv, bq.q) DESC
  ) AS rank
  FROM document_chunks dc, bm25_query bq
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

const securitySnippet = `// src/app/api/chat/route.ts
export async function POST(request: NextRequest) {
  if (!isCsrfSafe(request)) return forbidden();

  const { userId } = await auth();           // 1. Clerk
  if (!userId) return unauthorized();

  const decision = await chatAj.protect(    // 2. Arcjet:
    request,                                 //    shield + bot + rate limit
    { userId, requested: 1 },
  );
  if (decision.isDenied()) return denied(decision);

  //  Every query below is .where(eq(t.userId, userId))
  //  Every action ends with logAudit({ userId, action, ... })
}`;

const evalSnippet = `$ pnpm eval:ragbench:run -- --label gate-grade --concurrency 4
✓ 200 questions · 199-doc haystack · cross-family Gemini judge
✓ contextual retrieval + hybrid search + rerank

Recall@5             85.0%      Citation       97.3%
Faithfulness         95.6%      Correctness    65.2%

Verdict: 🟢 grounded (faithfulness 95.6% — no hallucination)
         🟢 3 / 4 hard gates met · correctness is the arXiv-hardness axis
         → enterprise domain (CUAD) scores higher: 90 / 97 / 100`;

const observabilitySnippet = `// src/app/api/chat/route.ts
const result = streamText({
  model: anthropic(CHAT_MODEL),
  experimental_telemetry: {
    isEnabled: true,
    functionId: "chat.stream",
    recordInputs: false,    //  prompts stay on the server
    recordOutputs: false,   //  only usage / latency / finishReason leave
    metadata: { userId, sessionId },
  },
  onError({ error }) {
    //  no more silent provider failures
    logger.error("chat.stream_error", { userId, error: String(error) });
  },
});`;

export default function LandingPage() {
  return (
    <div className="min-h-dvh bg-background">
      {/* Ambient background blobs */}
      <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
        <div className="absolute -top-40 -right-40 h-[600px] w-[600px] rounded-full bg-violet-200/30 dark:bg-violet-900/20 blur-3xl" />
        <div className="absolute -bottom-40 -left-40 h-[600px] w-[600px] rounded-full bg-indigo-200/30 dark:bg-indigo-900/20 blur-3xl" />
      </div>

      {/* Header */}
      <header className="border-b border-border/40 bg-background/80 backdrop-blur supports-[backdrop-filter]:bg-background/60 sticky top-0 z-50">
        <div className="mx-auto max-w-7xl px-6 flex h-16 items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-violet-600 to-indigo-600 shadow-sm">
              <BookOpen className="h-4 w-4 text-white" />
            </div>
            <span className="font-semibold text-foreground tracking-tight">Knowledge Assistant</span>
          </div>
          <nav className="flex items-center gap-2 sm:gap-3">
            <Button asChild variant="ghost" className="hidden sm:inline-flex">
              <Link href="#case-study">Case study</Link>
            </Button>
            <SignedOut>
              <Button variant="ghost" asChild>
                <Link href="/sign-in">Sign in</Link>
              </Button>
              <Button asChild className="bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-700 hover:to-indigo-700 text-white border-0 shadow-sm">
                <Link href="#contact">Book a call</Link>
              </Button>
            </SignedOut>
            <SignedIn>
              <Button asChild className="bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-700 hover:to-indigo-700 text-white border-0">
                <Link href="/dashboard">
                  Dashboard
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
            </SignedIn>
          </nav>
        </div>
      </header>

      {/* Hero */}
      <section className="mx-auto max-w-7xl px-6 pt-20 pb-12 md:pt-28 md:pb-16">
        <div className="grid lg:grid-cols-12 gap-12 lg:gap-16 items-center">
          <div className="lg:col-span-6">
            <Badge className="mb-5 bg-gradient-to-r from-violet-100 to-indigo-100 dark:from-violet-900/30 dark:to-indigo-900/30 text-violet-700 dark:text-violet-300 border border-violet-200 dark:border-violet-800 px-3.5 py-1.5 text-xs font-semibold tracking-wide">
              <Sparkles className="h-3.5 w-3.5 mr-1.5" />
              Case study · Production RAG
            </Badge>
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight leading-[1.05]">
              A RAG assistant{" "}
              <span className="bg-gradient-to-r from-violet-600 via-purple-600 to-indigo-600 bg-clip-text text-transparent">
                engineered, evaluated, and shipped.
              </span>
            </h1>
            <p className="mt-6 text-lg text-muted-foreground leading-7 max-w-xl">
              Most RAG demos die in production — retrieval misses, the model hallucinates specifics, no eval loop, no
              observability. This one ships with hybrid retrieval, Cohere reranking, strict grounding, a real eval
              harness, and Clerk + Arcjet security on every route.
            </p>
            <div className="mt-8 flex flex-col sm:flex-row items-start sm:items-center gap-3">
              <Button size="lg" asChild className="bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-700 hover:to-indigo-700 text-white border-0 shadow-lg shadow-indigo-200 dark:shadow-indigo-900/40 px-6">
                <Link href="#contact">
                  Book a call
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
              <SignedOut>
                <Button size="lg" variant="outline" asChild className="px-6 border-violet-200 dark:border-violet-800 text-violet-700 dark:text-violet-300 hover:bg-violet-50 dark:hover:bg-violet-900/20">
                  <Link href="/sign-up">
                    Try the live demo
                    <ExternalLink className="ml-2 h-4 w-4" />
                  </Link>
                </Button>
              </SignedOut>
              <SignedIn>
                <Button size="lg" variant="outline" asChild className="px-6 border-violet-200 dark:border-violet-800 text-violet-700 dark:text-violet-300 hover:bg-violet-50 dark:hover:bg-violet-900/20">
                  <Link href="/dashboard">
                    Open dashboard
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Link>
                </Button>
              </SignedIn>
              <Button size="lg" variant="ghost" asChild className="px-3 text-muted-foreground hover:text-foreground">
                <Link href="#" aria-label="View source on GitHub">
                  <Github className="h-4 w-4 mr-2" />
                  Source
                </Link>
              </Button>
            </div>
          </div>

          {/* Hero visual */}
          <div className="lg:col-span-6">
            <div className="relative rounded-2xl border border-border/60 bg-gradient-to-br from-violet-50 to-indigo-50 dark:from-violet-950/40 dark:to-indigo-950/40 p-2 shadow-2xl shadow-indigo-200/40 dark:shadow-indigo-950/40">
              <div className="absolute -inset-4 bg-gradient-to-r from-violet-600/20 to-indigo-600/20 blur-2xl -z-10" />
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/screenshots/hero-chat.png"
                alt="Chat interface streaming an answer with citations from uploaded documents"
                width={1600}
                height={1000}
                className="aspect-[16/10] w-full rounded-xl border border-border/60 bg-card object-cover"
                loading="eager"
              />
            </div>
          </div>
        </div>
      </section>

      {/* Stats strip */}
      <section className="mx-auto max-w-7xl px-6 py-8">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 rounded-2xl border border-border/60 bg-card/50 backdrop-blur p-6 md:p-8">
          {stats.map((s) => (
            <div key={s.label} className="flex flex-col gap-1 text-center md:text-left">
              <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{s.label}</span>
              <span className="text-3xl md:text-4xl font-bold tracking-tight bg-gradient-to-br from-violet-600 to-indigo-600 bg-clip-text text-transparent">
                {s.value}
              </span>
              <span className="text-xs text-muted-foreground">{s.hint}</span>
            </div>
          ))}
        </div>
        <p className="text-xs text-muted-foreground mt-3 text-center md:text-left">
          Measured on <strong className="text-foreground">Vectara&apos;s Open RAG Benchmark</strong> — 1,000 arXiv papers and 3,045 expert-written Q&amp;A pairs. Per-run JSON + Markdown artifacts committed to <code className="font-mono">evals/benchmarks/open-ragbench/runs/</code>.
        </p>
      </section>

      {/* Problem */}
      <section id="case-study" className="mx-auto max-w-3xl px-6 py-16 md:py-20">
        <Badge className="mb-4 bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400 border border-rose-200 dark:border-rose-800 px-3 py-1 text-xs font-semibold uppercase tracking-wider">
          The problem
        </Badge>
        <h2 className="text-3xl md:text-4xl font-bold tracking-tight leading-tight">
          Anyone can wire up a vector store. Almost no-one ships a RAG system you can trust.
        </h2>
        <div className="mt-6 space-y-4 text-muted-foreground leading-7">
          <p>
            The usual demo: a single document, pure cosine similarity, a model that confidently invents the numbers it
            couldn&apos;t find. It looks great on a slide. It falls apart the first time someone asks a real question.
          </p>
          <p>
            This case study is the opposite — a complete, production-shaped answer to the four things that actually
            decide whether a knowledge assistant is usable: <strong className="text-foreground">retrieval quality</strong>,{" "}
            <strong className="text-foreground">grounding discipline</strong>,{" "}
            <strong className="text-foreground">measurement</strong>, and{" "}
            <strong className="text-foreground">security</strong>.
          </p>
        </div>
      </section>

      {/* Architecture */}
      <section className="mx-auto max-w-6xl px-6 py-12 md:py-16">
        <div className="mb-10 text-center">
          <Badge className="mb-3 bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-800 px-3 py-1 text-xs font-semibold uppercase tracking-wider">
            Architecture
          </Badge>
          <h2 className="text-3xl md:text-4xl font-bold tracking-tight">End-to-end pipeline</h2>
          <p className="mt-3 text-muted-foreground max-w-2xl mx-auto">
            Two flows, one observability plane. Ingestion runs in the background with a guaranteed inline fallback.
            Query runs hybrid retrieval + Cohere reranking in a single round-trip to Neon. Every step ships logs and
            traces to Axiom.
          </p>
        </div>

        <div className="rounded-2xl border border-border/60 bg-card p-6 md:p-10 shadow-sm">
          {/* Ingestion row */}
          <div className="mb-6">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">Ingestion</p>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-2 md:gap-3 text-xs md:text-sm">
              <ArchBox label="Upload" tone="violet" />
              <ArchBox label="Parse (PDF, DOCX, OCR)" tone="violet" />
              <ArchBox label="Inngest queue" tone="indigo" />
              <ArchBox label="Chunk + embed" tone="indigo" />
              <ArchBox label="pgvector + tsvector" tone="emerald" />
            </div>
          </div>
          {/* Query row */}
          <div className="mb-6">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">Query</p>
            <div className="grid grid-cols-2 md:grid-cols-6 gap-2 md:gap-3 text-xs md:text-sm">
              <ArchBox label="Synthesize query" tone="amber" />
              <ArchBox label="Embed" tone="amber" />
              <ArchBox label="Vector + BM25 in one CTE" tone="emerald" />
              <ArchBox label="RRF fusion (k=60)" tone="emerald" />
              <ArchBox label="Cohere Rerank 3.5" tone="indigo" />
              <ArchBox label="Grounded streaming" tone="violet" />
            </div>
          </div>
          {/* Observability row */}
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">Observability</p>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2 md:gap-3 text-xs md:text-sm">
              <ArchBox label="Structured logger" tone="rose" />
              <ArchBox label="AI SDK telemetry" tone="rose" />
              <ArchBox label="OTLP traces" tone="rose" />
              <ArchBox label="Axiom dataset" tone="rose" />
            </div>
          </div>
        </div>
      </section>

      {/* Deep dive 1: Hybrid retrieval */}
      <DeepDive
        eyebrow="Retrieval"
        icon={Database}
        title="Hybrid retrieval, fused in one SQL round-trip."
        body="Vector search alone misses keyword-heavy queries — invoice numbers, model IDs, exact names. Pure BM25 misses semantic restatements. The fix isn't running both and stitching the results in Node; it's running them inside one Postgres CTE and fusing with Reciprocal Rank Fusion (k=60). Latency stays roughly the same as pure vector, and the fused candidate pool feeds straight into the reranker."
        artifact={
          <CodeBlock language="sql" title="src/lib/ai.ts — hybrid retrieval CTE">
            {hybridSqlSnippet}
          </CodeBlock>
        }
      />

      {/* Deep dive 2: Reranking */}
      <DeepDive
        eyebrow="Reranking"
        icon={Gauge}
        title="Every retrieval change is measured — and reverted if it doesn't earn its keep."
        body="Three techniques were trialled against the 200-doc Open RAG Benchmark with a cross-family judge. Multi-query expansion and an adaptive rerank floor lifted retrieval metrics but pulled off-target chunks into answers — measured net-negative on correctness and faithfulness, so both were reverted. Anthropic Contextual Retrieval (a Haiku-written context per chunk, prompt-cached at ~98% hit) was kept. Discipline over vibes: the eval harness mirrors production, so the number decides."
        artifact={
          <div className="rounded-xl border border-border/60 bg-card overflow-hidden">
            <div className="px-4 py-2.5 border-b border-border/60 bg-muted/40 flex items-center justify-between">
              <span className="text-xs font-mono text-muted-foreground">evals/runs/ · 200-doc benchmark A/B</span>
              <span className="text-[10px] uppercase tracking-wider text-muted-foreground">cross-family judge</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-xs text-muted-foreground border-b border-border/60">
                  <tr>
                    <th className="text-left px-4 py-2.5 font-medium">Run</th>
                    <th className="text-right px-4 py-2.5 font-medium">Recall@5</th>
                    <th className="text-right px-4 py-2.5 font-medium">MRR</th>
                    <th className="text-right px-4 py-2.5 font-medium">Latency</th>
                    <th className="text-right px-4 py-2.5 font-medium">Cost</th>
                  </tr>
                </thead>
                <tbody>
                  {evalRuns.map((r) => (
                    <tr
                      key={r.label}
                      className={`border-b border-border/40 last:border-0 ${
                        r.highlight ? "bg-gradient-to-r from-violet-50/60 to-indigo-50/60 dark:from-violet-950/30 dark:to-indigo-950/30" : ""
                      }`}
                    >
                      <td className="px-4 py-3">
                        <div className="font-mono text-xs font-semibold">{r.label}</div>
                        <div className="text-xs text-muted-foreground">{r.note}</div>
                      </td>
                      <td className="text-right px-4 py-3 font-mono text-xs">{r.recall}</td>
                      <td className={`text-right px-4 py-3 font-mono text-xs ${r.highlight ? "font-bold text-violet-700 dark:text-violet-300" : ""}`}>
                        {r.mrr}
                      </td>
                      <td className="text-right px-4 py-3 font-mono text-xs">{r.latency}</td>
                      <td className="text-right px-4 py-3 font-mono text-xs">{r.cost}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        }
      />

      {/* Deep dive 3: Evals */}
      <DeepDive
        eyebrow="Evals"
        icon={Layers}
        title="Scored on two public benchmarks — academic and enterprise."
        body="The synthetic golden set was retired (its questions came from the same chunks the retriever had to find — self-referential). Today the same production pipeline is scored against two public sets with a cross-family judge: Vectara's Open RAG Benchmark (1,000 arXiv papers, 3,045 expert Q&A) and CUAD (commercial contracts). No self-reference, published ground truth, every run emits a Markdown report with a per-metric verdict against the canonical go-live gates."
        artifact={
          <div className="space-y-4">
            <CodeBlock language="bash" title="pnpm eval:ragbench:run — terminal output">
              {evalSnippet}
            </CodeBlock>
            <VerdictTable />
            <ModalityTable />
          </div>
        }
      />

      {/* Deep dive 4: Security */}
      <DeepDive
        eyebrow="Security"
        icon={ShieldCheck}
        title="Auth, shield, rate limit, audit — applied before any logic runs."
        body="Every API route chains CSRF → Clerk auth → Arcjet (prompt-injection shield + bot detection + token-bucket rate limit) before touching the database. Every query filters on userId — no cross-tenant leak is possible. Every state-changing action emits a row to audit_logs with IP and user-agent, queryable from the user's settings page."
        artifact={
          <CodeBlock language="ts" title="src/app/api/chat/route.ts — middleware chain">
            {securitySnippet}
          </CodeBlock>
        }
      />

      {/* Deep dive 5: Observability */}
      <DeepDive
        eyebrow="Observability"
        icon={Activity}
        title="Logs and traces ship to Axiom — without leaking prompts."
        body="The AI SDK's experimental_telemetry attaches a span to every chat stream with token usage, latency, and finishReason — but recordInputs and recordOutputs are forced to false so prompts and completions never leave the server. A structured logger replaced every console.* in the ingest pipeline, RAG library, and API layer; silent failures (audit-log writes, rerank fallback, Inngest enqueue) all surface in Axiom now. OTLP traces and HTTP logs ship over HTTPS directly — no Vercel Pro log drain needed."
        artifact={
          <CodeBlock language="ts" title="AI SDK telemetry — privacy-preserving by construction">
            {observabilitySnippet}
          </CodeBlock>
        }
      />

      {/* Deep dive 6: Background ingestion */}
      <DeepDive
        eyebrow="Ingestion"
        icon={Workflow}
        title="Background jobs with a guaranteed fallback."
        body="Document ingestion runs through Inngest with three retries. If the Inngest connection is unavailable, the request falls back to inline processing with a 55-second hard cap and returns a descriptive 202 if the document is too large. Reindex is idempotent — chunks are deleted before reinsert, so retries are safe. The UI polls until the document's status flips to Indexed."
        artifact={
          <div className="rounded-xl border border-border/60 bg-card p-6">
            <div className="flex flex-col gap-3 font-mono text-xs">
              <div className="flex items-center gap-3">
                <span className="rounded-md bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 px-2 py-1 font-semibold">pending</span>
                <span className="text-muted-foreground">document.uploaded → enqueue ingest event</span>
              </div>
              <div className="flex items-center gap-3 pl-4">
                <span className="rounded-md bg-violet-100 dark:bg-violet-900/30 text-violet-700 dark:text-violet-300 px-2 py-1 font-semibold">processing</span>
                <span className="text-muted-foreground">chunk → embed (batch 20) → upsert (batch 50)</span>
              </div>
              <div className="flex items-center gap-3 pl-8">
                <span className="rounded-md bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300 px-2 py-1 font-semibold">ready</span>
                <span className="text-muted-foreground">UI poller flips badge; chunks become searchable</span>
              </div>
              <div className="flex items-center gap-3 pl-8 mt-2 pt-2 border-t border-border/40">
                <span className="rounded-md bg-rose-100 dark:bg-rose-900/30 text-rose-700 dark:text-rose-300 px-2 py-1 font-semibold">failed</span>
                <span className="text-muted-foreground">errorMessage persisted, reindex button surfaced</span>
              </div>
            </div>
          </div>
        }
      />

      {/* Product screenshots grid */}
      <section className="mx-auto max-w-7xl px-6 py-16 md:py-20">
        <div className="mb-10 text-center">
          <Badge className="mb-3 bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-400 border border-violet-200 dark:border-violet-800 px-3 py-1 text-xs font-semibold uppercase tracking-wider">
            The product
          </Badge>
          <h2 className="text-3xl md:text-4xl font-bold tracking-tight">It&apos;s a real, working app.</h2>
          <p className="mt-3 text-muted-foreground max-w-2xl mx-auto">
            Server Components by default. Streaming chat with citations. A document library with live ingestion status.
            A queryable audit log per user.
          </p>
        </div>
        <div className="grid sm:grid-cols-2 gap-6">
          <Screenshot src="/screenshots/dashboard-overview.png" caption="Per-user stats, server-rendered." />
          <Screenshot src="/screenshots/chat-with-sources.png" caption="Streaming answers with inline citations." />
          <Screenshot src="/screenshots/documents-list.png" caption="Sortable / filterable library, ingestion status live." />
          <Screenshot src="/screenshots/settings-activity.png" caption="Queryable audit trail per user." />
        </div>
      </section>

      {/* Telegram bot bonus */}
      <section className="mx-auto max-w-6xl px-6 py-16 md:py-20">
        <div className="rounded-2xl border border-border/60 bg-gradient-to-br from-card to-violet-50/30 dark:to-violet-950/20 p-8 md:p-12">
          <div className="grid md:grid-cols-2 gap-10 items-center">
            <div>
              <Badge className="mb-4 bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800 px-3 py-1 text-xs font-semibold uppercase tracking-wider">
                <Send className="h-3 w-3 mr-1.5" />
                Bonus
              </Badge>
              <h2 className="text-3xl font-bold tracking-tight">I ship PRs from Telegram.</h2>
              <p className="mt-4 text-muted-foreground leading-7">
                A custom Telegram bot lets me drive the development pipeline from my phone. Planning is delegated to
                Claude Code&apos;s built-in Plan subagent (read-only, software-architect persona). The bot asks clarifying
                questions when the requirement is ambiguous, then drafts a plan; once approved, a coder agent writes the
                minimal diff and opens a PR into <code className="font-mono text-foreground">dev</code>. Built on top of
                GitHub Actions and Neon — no third-party orchestrator.
              </p>
              <p className="mt-4 text-sm text-muted-foreground">
                Every step gated by approval. No agent can push to <code className="font-mono">main</code>.
              </p>
            </div>

            <div className="rounded-xl border border-border/60 bg-card p-5 font-mono text-xs space-y-2">
              <FlowStep n="1" label="Telegram message" sub="webhook secret + chat.id allowlist" />
              <FlowArrow />
              <FlowStep n="2" label="Classifier" sub="task | continue | cancel (claude-haiku-4-5)" tone="violet" />
              <FlowArrow />
              <FlowStep n="3" label="Plan subagent" sub="QUESTIONS or PLAN; clarifies if unclear" tone="violet" />
              <FlowArrow approve label="Approve" />
              <FlowStep n="4" label="Coder agent" sub="writes minimal diff, pushes branch" tone="indigo" />
              <FlowArrow approve label="Approve" />
              <FlowStep n="5" label="PR opened → dev" sub="task marked done, link posted back" tone="emerald" />
            </div>
          </div>
        </div>
      </section>

      {/* Tech stack */}
      <section className="mx-auto max-w-5xl px-6 py-16 md:py-20">
        <div className="text-center mb-8">
          <Badge className="mb-3 bg-muted text-muted-foreground border border-border px-3 py-1 text-xs font-semibold uppercase tracking-wider">
            Stack
          </Badge>
          <h2 className="text-2xl md:text-3xl font-bold tracking-tight">Built on the 2026 Vercel stack.</h2>
        </div>
        <div className="flex flex-wrap items-center justify-center gap-2">
          {techStack.map((tech) => (
            <Badge
              key={tech}
              variant="outline"
              className="px-3 py-1.5 text-sm font-medium bg-card border-border/80 text-foreground"
            >
              {tech}
            </Badge>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section id="contact" className="mx-auto max-w-7xl px-6 py-16 md:py-24">
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-violet-600 via-purple-600 to-indigo-600 px-8 py-14 md:px-12 md:py-20 text-center shadow-xl shadow-indigo-200/50 dark:shadow-indigo-950/40">
          <div className="pointer-events-none absolute -top-12 -right-12 h-56 w-56 rounded-full bg-white/10 blur-2xl" />
          <div className="pointer-events-none absolute -bottom-12 -left-12 h-56 w-56 rounded-full bg-white/10 blur-2xl" />

          <h2 className="text-3xl md:text-4xl font-bold tracking-tight text-white">
            Need something like this built?
          </h2>
          <p className="mt-4 text-violet-100 max-w-xl mx-auto leading-7">
            If you&apos;re looking at this and thinking &quot;we need the same thing, but for our domain&quot; — let&apos;s talk. From
            schema to retrieval to security to shipping, this is the full stack.
          </p>
          <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-3">
            <Button size="lg" asChild className="bg-white text-violet-700 hover:bg-violet-50 border-0 shadow-lg px-8 font-semibold">
              <Link href="#contact">
                Book a call
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
            <SignedOut>
              <Button size="lg" variant="outline" asChild className="border-white/40 text-white hover:bg-white/10 px-8">
                <Link href="/sign-up">Try the live demo</Link>
              </Button>
            </SignedOut>
            <SignedIn>
              <Button size="lg" variant="outline" asChild className="border-white/40 text-white hover:bg-white/10 px-8">
                <Link href="/dashboard">Open dashboard</Link>
              </Button>
            </SignedIn>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border/40 py-8">
        <div className="mx-auto max-w-7xl px-6 flex flex-col sm:flex-row items-center justify-between gap-4 text-sm text-muted-foreground">
          <div className="flex items-center gap-2">
            <div className="flex h-6 w-6 items-center justify-center rounded bg-gradient-to-br from-violet-600 to-indigo-600">
              <BookOpen className="h-3 w-3 text-white" />
            </div>
            <span className="font-medium text-foreground">Knowledge Assistant</span>
          </div>
          <p className="text-xs">Built with Next.js · Vercel AI SDK · Neon · Clerk · Arcjet</p>
        </div>
      </footer>
    </div>
  );
}

/* ─── Sub-components ────────────────────────────────────────────────────── */

function ArchBox({
  label,
  tone,
}: {
  label: string;
  tone: "violet" | "indigo" | "emerald" | "amber" | "rose";
}) {
  const toneClass = {
    violet: "border-violet-200 dark:border-violet-800 bg-violet-50 dark:bg-violet-950/40 text-violet-700 dark:text-violet-300",
    indigo: "border-indigo-200 dark:border-indigo-800 bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300",
    emerald: "border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300",
    amber: "border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300",
    rose: "border-rose-200 dark:border-rose-800 bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300",
  }[tone];
  return (
    <div className={`rounded-lg border ${toneClass} px-3 py-2.5 font-medium text-center`}>{label}</div>
  );
}

function DeepDive({
  eyebrow,
  icon: Icon,
  title,
  body,
  artifact,
}: {
  eyebrow: string;
  icon: typeof Database;
  title: string;
  body: string;
  artifact: React.ReactNode;
}) {
  return (
    <section className="mx-auto max-w-6xl px-6 py-10 md:py-14">
      <div className="grid md:grid-cols-12 gap-8 lg:gap-12 items-start">
        <div className="md:col-span-5">
          <div className="flex items-center gap-2 mb-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-violet-500/10 to-indigo-500/10 border border-violet-200/60 dark:border-violet-800/60">
              <Icon className="h-4 w-4 text-violet-600 dark:text-violet-400" />
            </div>
            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{eyebrow}</span>
          </div>
          <h3 className="text-2xl md:text-3xl font-bold tracking-tight leading-tight">{title}</h3>
          <p className="mt-4 text-muted-foreground leading-7">{body}</p>
        </div>
        <div className="md:col-span-7">{artifact}</div>
      </div>
    </section>
  );
}

function CodeBlock({
  children,
  language,
  title,
}: {
  children: string;
  language: string;
  title: string;
}) {
  return (
    <div className="rounded-xl border border-border/60 bg-card overflow-hidden shadow-sm">
      <div className="px-4 py-2.5 border-b border-border/60 bg-muted/40 flex items-center justify-between">
        <span className="text-xs font-mono text-muted-foreground">{title}</span>
        <span className="text-[10px] uppercase tracking-wider text-muted-foreground">{language}</span>
      </div>
      <pre className="overflow-x-auto p-4 text-xs leading-relaxed font-mono text-foreground/90">
        <code>{children}</code>
      </pre>
    </div>
  );
}

function Screenshot({ src, caption }: { src: string; caption: string }) {
  return (
    <figure className="group">
      <div className="rounded-xl border border-border/60 bg-card overflow-hidden shadow-sm transition-all duration-200 motion-reduce:transition-none group-hover:shadow-lg group-hover:border-violet-200 dark:group-hover:border-violet-800">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={src}
          alt={caption}
          width={1600}
          height={1000}
          className="w-full block aspect-[16/10] object-cover bg-muted/30"
          loading="lazy"
        />
      </div>
      <figcaption className="mt-3 text-sm text-muted-foreground text-center">{caption}</figcaption>
    </figure>
  );
}

function FlowStep({
  n,
  label,
  sub,
  tone,
}: {
  n: string;
  label: string;
  sub: string;
  tone?: "violet" | "indigo" | "emerald";
}) {
  const toneClass = tone
    ? {
        violet: "bg-violet-100 dark:bg-violet-900/30 text-violet-700 dark:text-violet-300",
        indigo: "bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300",
        emerald: "bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300",
      }[tone]
    : "bg-muted text-muted-foreground";
  return (
    <div className="flex items-start gap-3">
      <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-[11px] font-bold ${toneClass}`}>
        {n}
      </span>
      <div>
        <div className="font-semibold text-foreground">{label}</div>
        <div className="text-muted-foreground text-[11px]">{sub}</div>
      </div>
    </div>
  );
}

function VerdictTable() {
  const tierLabel = {
    strong: { text: "Strong", className: "bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300" },
    acceptable: { text: "Acceptable", className: "bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300" },
    "needs-work": { text: "Needs work", className: "bg-rose-100 dark:bg-rose-900/30 text-rose-700 dark:text-rose-300" },
  } as const;
  return (
    <div className="rounded-xl border border-border/60 bg-card overflow-hidden">
      <div className="px-4 py-2.5 border-b border-border/60 bg-muted/40 flex items-center justify-between">
        <span className="text-xs font-mono text-muted-foreground">REPORT.md · per-metric verdict</span>
        <span className="text-[10px] uppercase tracking-wider text-muted-foreground">Open RAG Benchmark</span>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="text-xs text-muted-foreground border-b border-border/60">
            <tr>
              <th className="text-left px-4 py-2.5 font-medium">Metric</th>
              <th className="text-right px-4 py-2.5 font-medium">Value</th>
              <th className="text-right px-4 py-2.5 font-medium">Tier</th>
            </tr>
          </thead>
          <tbody>
            {verdictRows.map((row) => {
              const t = tierLabel[row.tier];
              return (
                <tr key={row.metric} className="border-b border-border/40 last:border-0">
                  <td className="px-4 py-2.5 text-xs">{row.metric}</td>
                  <td className="text-right px-4 py-2.5 font-mono text-xs">{row.value}</td>
                  <td className="text-right px-4 py-2.5">
                    <span className={`inline-block rounded-md ${t.className} px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider`}>
                      {t.text}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="px-4 py-2.5 text-[11px] text-muted-foreground border-t border-border/40 leading-relaxed">
        Thresholds are directional, drawn from typical splits in RAG research and vendor write-ups. The benchmark itself
        publishes no official pass/fail cutoffs.
      </p>
    </div>
  );
}

function ModalityTable() {
  return (
    <div className="rounded-xl border border-border/60 bg-card overflow-hidden">
      <div className="px-4 py-2.5 border-b border-border/60 bg-muted/40 flex items-center justify-between">
        <span className="text-xs font-mono text-muted-foreground">Two domains · same pipeline</span>
        <span className="text-[10px] uppercase tracking-wider text-muted-foreground">public benchmarks</span>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="text-xs text-muted-foreground border-b border-border/60">
            <tr>
              <th className="text-left px-4 py-2.5 font-medium">Domain</th>
              <th className="text-right px-4 py-2.5 font-medium">Recall@5</th>
              <th className="text-right px-4 py-2.5 font-medium">Faithfulness</th>
              <th className="text-right px-4 py-2.5 font-medium">Citation</th>
            </tr>
          </thead>
          <tbody>
            {domainRows.map((row) => (
              <tr key={row.domain} className="border-b border-border/40 last:border-0">
                <td className="px-4 py-2.5 text-xs font-mono">{row.domain}</td>
                <td className="text-right px-4 py-2.5 font-mono text-xs">{row.recall}</td>
                <td className="text-right px-4 py-2.5 font-mono text-xs">{row.faith}</td>
                <td className="text-right px-4 py-2.5 font-mono text-xs">{row.cite}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function FlowArrow({ approve, label }: { approve?: boolean; label?: string }) {
  return (
    <div className="flex items-center gap-2 pl-2 text-muted-foreground">
      <span className="text-base leading-none">↓</span>
      {approve && (
        <span className="rounded bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider">
          {label}
        </span>
      )}
    </div>
  );
}
