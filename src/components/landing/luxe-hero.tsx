import Link from "next/link";
import { ArrowUpRight } from "lucide-react";

/**
 * Luxe hero — asymmetric editorial composition (DESIGN_VARIANCE 9).
 * Server Component. Motion is CSS-only (.lux-rise / .lux-veil), reduced-motion
 * gated in globals.css, so this renders fully static with JS disabled.
 *
 * Typographic layout is driven by custom properties: the headline lines carry
 * per-line indents (--indent) to break the grid, and the display face is a
 * Didone (Bodoni Moda) set against an engineering mono for the metadata rail.
 */
export function LuxeHero() {
  return (
    <section className="relative isolate min-h-[100dvh] overflow-hidden border-b border-[var(--lux-line)] px-6 pb-16 pt-24 md:px-10">
      {/* atmosphere: a single off-center ink-gold field, not an AI-purple blob */}
      <div
        aria-hidden
        className="lux-veil pointer-events-none absolute -right-[20vw] -top-[15vh] -z-10 h-[80vh] w-[80vh] rounded-full opacity-70 blur-3xl"
        style={{
          background:
            "radial-gradient(closest-side, rgba(200,169,106,0.16), rgba(200,169,106,0.04) 60%, transparent)",
        }}
      />

      <div className="mx-auto grid max-w-[1400px] grid-cols-1 gap-x-10 gap-y-14 lg:grid-cols-12 lg:items-end">
        {/* ── Left: editorial headline column (7/12, deliberately offset) ── */}
        <div className="lg:col-span-7 lg:pt-[14vh]">
          <p
            className="lux-rise font-[family-name:var(--font-geist-mono)] text-[0.7rem] uppercase text-[var(--lux-bone-faint)]"
            style={{ letterSpacing: "var(--lux-track-label)", ["--i" as string]: 0 }}
          >
            A production RAG case study
          </p>

          <h1
            className="mt-7 font-[family-name:var(--font-display)] font-medium text-[var(--lux-bone)]"
            style={{
              fontSize: "var(--lux-display)",
              lineHeight: 0.98,
              letterSpacing: "var(--lux-track-tight)",
            }}
          >
            <span className="lux-rise block" style={{ ["--i" as string]: 1 }}>
              Answers you can
            </span>
            {/* broken-grid second line: indented + italic gold emphasis in the
                SAME family (no mixed-family emphasis) */}
            <span
              className="lux-rise block pl-[8vw] sm:pl-[14vw]"
              style={{ ["--i" as string]: 2 }}
            >
              <em
                className="italic text-[var(--lux-gold)]"
                style={{ lineHeight: 1.1, paddingBottom: "0.06em", display: "inline-block" }}
              >
                trace
              </em>{" "}
              to the source.
            </span>
          </h1>

          <p
            className="lux-rise mt-9 max-w-[46ch] text-[1.05rem] leading-relaxed text-[var(--lux-bone-dim)]"
            style={{ ["--i" as string]: 3 }}
          >
            Hybrid retrieval, reranking, and strict grounding, measured on a real
            benchmark. Built to be trusted in production, not just demoed.
          </p>

          <div
            className="lux-rise mt-11 flex flex-col gap-4 sm:flex-row sm:items-center"
            style={{ ["--i" as string]: 4 }}
          >
            <Link
              href="#contact"
              className="group inline-flex items-center justify-center gap-2 bg-[var(--lux-gold)] px-7 py-3.5 text-sm font-medium tracking-wide text-[var(--lux-ink)] transition-[transform,background-color] duration-300 ease-[var(--ease-lux)] hover:bg-[#d8bd82] active:translate-y-px"
            >
              Book a call
              <ArrowUpRight
                className="h-4 w-4 transition-transform duration-300 ease-[var(--ease-lux)] group-hover:translate-x-0.5 group-hover:-translate-y-0.5"
                strokeWidth={1.5}
              />
            </Link>
            <Link
              href="/sign-up"
              className="inline-flex items-center justify-center border border-[var(--lux-line-strong)] px-7 py-3.5 text-sm font-medium tracking-wide text-[var(--lux-bone)] transition-colors duration-300 ease-[var(--ease-lux)] hover:border-[var(--lux-bone-dim)] hover:bg-[var(--lux-ink-2)]"
            >
              See the live demo
            </Link>
          </div>
        </div>

        {/* ── Right: tall duotone editorial asset (5/12), overlapping baseline ── */}
        <div className="lg:col-span-5">
          <figure
            className="lux-veil relative aspect-[3/4] w-full overflow-hidden border border-[var(--lux-line)] lg:translate-y-8"
            style={{ ["--i" as string]: 2 }}
          >
            {/* TODO: replace with a real product shot or generated hero asset.
                Seeded placeholder is collapsed to the palette via .lux-duotone. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="https://picsum.photos/seed/quiet-archive-reading-room/1100/1500"
              alt="An ordered archive, standing in for documents made answerable"
              className="lux-duotone h-full w-full object-cover"
              loading="eager"
            />
            <div
              aria-hidden
              className="absolute inset-0"
              style={{
                background:
                  "linear-gradient(180deg, rgba(12,11,10,0) 35%, rgba(12,11,10,0.85) 100%), radial-gradient(120% 80% at 70% 10%, rgba(200,169,106,0.12), transparent 60%)",
              }}
            />
            {/* one honest caption, set in mono on a hairline — no photo-credit decoration */}
            <figcaption className="absolute inset-x-0 bottom-0 flex items-center justify-between border-t border-[var(--lux-line)] px-5 py-3.5">
              <span className="font-[family-name:var(--font-geist-mono)] text-[0.65rem] uppercase tracking-[0.22em] text-[var(--lux-bone-dim)]">
                Open RAG Benchmark
              </span>
              <span className="font-[family-name:var(--font-geist-mono)] text-[0.65rem] text-[var(--lux-gold)]">
                3,045 Q&amp;A
              </span>
            </figcaption>
          </figure>
        </div>
      </div>
    </section>
  );
}
