import Link from "next/link";
import { SignedIn, SignedOut } from "@clerk/nextjs";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { BookOpen, MessageSquare, Shield, Zap, ArrowRight, Database } from "lucide-react";

const features = [
  {
    icon: MessageSquare,
    title: "Conversational AI",
    description: "Ask questions in natural language and get precise answers from your company knowledge base.",
    bg: "bg-violet-50 dark:bg-violet-900/20",
    iconColor: "text-violet-600 dark:text-violet-400",
  },
  {
    icon: Database,
    title: "Vector Search",
    description: "Powered by pgvector — semantic similarity search that understands context, not just keywords.",
    bg: "bg-indigo-50 dark:bg-indigo-900/20",
    iconColor: "text-indigo-600 dark:text-indigo-400",
  },
  {
    icon: Shield,
    title: "Enterprise Security",
    description: "Role-based access control, prompt injection protection, and strict data isolation per user.",
    bg: "bg-emerald-50 dark:bg-emerald-900/20",
    iconColor: "text-emerald-600 dark:text-emerald-400",
  },
  {
    icon: Zap,
    title: "Instant Answers",
    description: "Streaming responses with real-time typing effects. No waiting for complete responses.",
    bg: "bg-amber-50 dark:bg-amber-900/20",
    iconColor: "text-amber-600 dark:text-amber-400",
  },
  {
    icon: BookOpen,
    title: "Document Management",
    description: "Upload PDFs, Word docs, Excel sheets, images, and more. Documents are automatically indexed.",
    bg: "bg-rose-50 dark:bg-rose-900/20",
    iconColor: "text-rose-600 dark:text-rose-400",
  },
  {
    icon: ArrowRight,
    title: "Source Citations",
    description: "Every answer cites its source documents so you can verify and explore further.",
    bg: "bg-sky-50 dark:bg-sky-900/20",
    iconColor: "text-sky-600 dark:text-sky-400",
  },
];

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-background">
      {/* Ambient background blobs */}
      <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
        <div className="absolute -top-40 -right-40 h-[600px] w-[600px] rounded-full bg-violet-200/30 dark:bg-violet-900/20 blur-3xl" />
        <div className="absolute -bottom-40 -left-40 h-[600px] w-[600px] rounded-full bg-indigo-200/30 dark:bg-indigo-900/20 blur-3xl" />
      </div>

      {/* Header */}
      <header className="border-b border-border/40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 sticky top-0 z-50">
        <div className="mx-auto max-w-7xl px-6 flex h-16 items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-violet-600 to-indigo-600 shadow-sm">
              <BookOpen className="h-4 w-4 text-white" />
            </div>
            <span className="font-semibold text-foreground">Knowledge Assistant</span>
          </div>
          <nav className="flex items-center gap-3">
            <SignedOut>
              <Button variant="ghost" asChild>
                <Link href="/sign-in">Sign in</Link>
              </Button>
              <Button asChild className="bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-700 hover:to-indigo-700 text-white border-0 shadow-md shadow-indigo-200 dark:shadow-indigo-900/40">
                <Link href="/sign-up">Get started</Link>
              </Button>
            </SignedOut>
            <SignedIn>
              <Button asChild className="bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-700 hover:to-indigo-700 text-white border-0">
                <Link href="/dashboard">
                  Go to Dashboard
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
            </SignedIn>
          </nav>
        </div>
      </header>

      {/* Hero */}
      <section className="mx-auto max-w-7xl px-6 py-24 md:py-32">
        <div className="mx-auto max-w-3xl text-center">
          <Badge className="mb-6 bg-gradient-to-r from-violet-100 to-indigo-100 dark:from-violet-900/30 dark:to-indigo-900/30 text-violet-700 dark:text-violet-300 border border-violet-200 dark:border-violet-800 px-4 py-1.5 text-sm font-semibold shadow-sm">
            ✦ Powered by GPT-4o + pgvector
          </Badge>
          <h1 className="text-4xl font-bold tracking-tight sm:text-6xl">
            Your company knowledge,{" "}
            <span className="bg-gradient-to-r from-violet-600 via-purple-600 to-indigo-600 bg-clip-text text-transparent">
              instantly accessible
            </span>
          </h1>
          <p className="mt-6 text-lg text-muted-foreground leading-8 max-w-2xl mx-auto">
            Stop searching through wikis, Notion pages, and Slack threads. Upload your documents and ask questions in plain English — our AI retrieves the right answer from your knowledge base in seconds.
          </p>
          <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4">
            <SignedOut>
              <Button size="lg" asChild className="bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-700 hover:to-indigo-700 text-white border-0 shadow-lg shadow-indigo-200 dark:shadow-indigo-900/40 px-8">
                <Link href="/sign-up">
                  Start for free
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
              <Button size="lg" variant="outline" asChild className="px-8 border-violet-200 dark:border-violet-800 text-violet-700 dark:text-violet-300 hover:bg-violet-50 dark:hover:bg-violet-900/20">
                <Link href="/sign-in">Sign in to your account</Link>
              </Button>
            </SignedOut>
            <SignedIn>
              <Button size="lg" asChild className="bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-700 hover:to-indigo-700 text-white border-0 px-8">
                <Link href="/dashboard">
                  Open Dashboard
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
            </SignedIn>
          </div>

          {/* Social proof strip */}
          <div className="mt-12 flex flex-wrap items-center justify-center gap-6 text-sm text-muted-foreground mt-8">
            <span className="flex items-center gap-1.5">
              <span className="inline-flex h-2 w-2 rounded-full bg-emerald-400" />
              Semantic search
            </span>
            <span className="flex items-center gap-1.5">
              <span className="inline-flex h-2 w-2 rounded-full bg-violet-400" />
              Streaming responses
            </span>
            <span className="flex items-center gap-1.5">
              <span className="inline-flex h-2 w-2 rounded-full bg-indigo-400" />
              Source citations
            </span>
            <span className="flex items-center gap-1.5">
              <span className="inline-flex h-2 w-2 rounded-full bg-amber-400" />
              Multi-format upload
            </span>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="mx-auto max-w-7xl px-6 py-16 md:py-24">
        <div className="mx-auto max-w-2xl text-center mb-14">
          <Badge className="mb-4 bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-800 px-3 py-1 text-xs font-semibold uppercase tracking-wider">
            Features
          </Badge>
          <h2 className="text-3xl font-bold tracking-tight bg-gradient-to-r from-violet-600 via-purple-600 to-indigo-600 bg-clip-text text-transparent">
            Everything you need
          </h2>
          <p className="mt-4 text-muted-foreground">
            Built on modern, production-grade infrastructure for teams that demand reliability.
          </p>
        </div>
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 mt-4">
          {features.map((feature) => {
            const Icon = feature.icon;
            return (
              <div key={feature.title} className="rounded-xl border border-border/60 bg-card p-6 shadow-sm hover:shadow-md hover:border-violet-200 dark:hover:border-violet-800 transition-all duration-200 text-center">
                <div className={`mx-auto flex h-12 w-12 items-center justify-center rounded-xl ${feature.bg} mb-4`}>
                  <Icon className={`h-6 w-6 ${feature.iconColor}`} />
                </div>
                <h3 className="font-semibold text-foreground mb-2">{feature.title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{feature.description}</p>
              </div>
            );
          })}
        </div>
      </section>

      {/* CTA */}
      <section className="border-t border-border/40">
        <div className="mx-auto max-w-7xl px-6 py-16 md:py-24">
          <div className="rounded-2xl py-8 bg-gradient-to-br from-violet-600 via-purple-600 to-indigo-600 px-8 py-14 text-center shadow-xl shadow-indigo-200/50 dark:shadow-indigo-900/40 relative overflow-hidden">
            {/* Decorative blobs inside CTA */}
            <div className="pointer-events-none absolute -top-12 -right-12 h-48 w-48 rounded-full bg-white/10 blur-2xl" />
            <div className="pointer-events-none absolute -bottom-12 -left-12 h-48 w-48 rounded-full bg-white/10 blur-2xl" />

            <h2 className="text-3xl font-bold tracking-tight text-white">
              Ready to get started?
            </h2>
            <p className="mt-4 text-violet-100 max-w-md mx-auto">
              Upload your first document and ask a question in under 2 minutes.
            </p>
            <div className="mt-8">
              <SignedOut>
                <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
                  <Button size="lg" asChild className="bg-white text-violet-700 hover:bg-violet-50 border-0 shadow-lg px-8 font-semibold">
                    <Link href="/sign-up">
                      Create your account
                      <ArrowRight className="ml-2 h-4 w-4" />
                    </Link>
                  </Button>
                  <Button size="lg" variant="outline" asChild className="border-white/40 text-white hover:bg-white/10 px-8">
                    <Link href="/sign-in">Sign in</Link>
                  </Button>
                </div>
              </SignedOut>
              <SignedIn>
                <Button size="lg" asChild className="bg-white text-violet-700 hover:bg-violet-50 border-0 shadow-lg px-8 font-semibold">
                  <Link href="/dashboard/documents/upload">
                    Upload your first document
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Link>
                </Button>
              </SignedIn>
            </div>
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
            <span className="font-medium">Knowledge Assistant</span>
          </div>
          <p>Built with Next.js, Vercel AI SDK, Neon, Clerk, and Arcjet</p>
        </div>
      </footer>
    </div>
  );
}
