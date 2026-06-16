import type { Metadata } from "next";
import Link from "next/link";
import { Bodoni_Moda } from "next/font/google";
import { LuxeHero } from "@/components/landing/luxe-hero";
import { LuxeFeatureGrid } from "@/components/landing/luxe-feature-grid";

/**
 * Greenfield luxe landing preview (hero + feature grid).
 * Self-contained on /preview so the live `/` keeps shipping until this is promoted.
 * Theme is locked dark via the `.lux` scope; the Didone display face is loaded
 * here with next/font and exposed as --font-display.
 */
const display = Bodoni_Moda({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  style: ["normal", "italic"],
  variable: "--font-display",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Preview",
  robots: { index: false, follow: false },
};

export default function LuxePreviewPage() {
  return (
    <main className={`lux ${display.variable} min-h-[100dvh] antialiased`}>
      {/* Nav — single line, well under the 80px cap */}
      <header className="sticky top-0 z-40 border-b border-[var(--lux-line)] bg-[var(--lux-ink)]/85 backdrop-blur supports-[backdrop-filter]:bg-[var(--lux-ink)]/65">
        <div className="mx-auto flex h-16 max-w-[1400px] items-center justify-between px-6 md:px-10">
          <span className="font-[family-name:var(--font-display)] text-lg font-medium tracking-tight text-[var(--lux-bone)]">
            Knowledge Assistant
          </span>
          <Link
            href="#contact"
            className="border border-[var(--lux-line-strong)] px-5 py-2 text-xs font-medium uppercase tracking-[0.18em] text-[var(--lux-bone)] transition-colors duration-300 ease-[var(--ease-lux)] hover:border-[var(--lux-bone-dim)] hover:bg-[var(--lux-ink-2)]"
          >
            Book a call
          </Link>
        </div>
      </header>

      <LuxeHero />
      <LuxeFeatureGrid />
    </main>
  );
}
