import type { Metadata } from "next";
import { Space_Grotesk } from "next/font/google";
import { Landing } from "@/components/landing/landing";

/**
 * Marketing home. The display face (Space Grotesk, a technical grotesque) is
 * loaded here and exposed as --font-display; body/mono come from the global
 * Geist stack. The page itself is a client island (`Landing`) because the whole
 * surface is motion-driven; metadata stays here on the server.
 */
const display = Space_Grotesk({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-display",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Knowledge Assistant · a production RAG case study",
  description:
    "A retrieval-augmented knowledge assistant built for production: hybrid retrieval, reranking, strict grounding, and a real eval harness scored on three public benchmarks.",
};

export default function HomePage() {
  return (
    <div className={display.variable}>
      <Landing />
    </div>
  );
}
