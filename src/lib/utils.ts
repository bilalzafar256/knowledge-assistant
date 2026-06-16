import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

/**
 * Merges class names with Tailwind CSS conflict resolution.
 * This is the standard shadcn/ui cn() utility.
 */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}

/**
 * Formats a file size in bytes to a human-readable string.
 */
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  const size = sizes[i];
  if (!size) return `${bytes} B`;
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${size}`;
}

/**
 * Truncates text to a given length with an ellipsis.
 */
export function truncate(text: string, length: number): string {
  if (text.length <= length) return text;
  return text.slice(0, length) + "…";
}

/**
 * Formats a date to a relative time string (e.g., "2 hours ago").
 */
export function timeAgo(date: Date | string): string {
  const now = new Date();
  const then = new Date(date);
  const seconds = Math.floor((now.getTime() - then.getTime()) / 1000);

  if (seconds < 60) return "just now";
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  if (seconds < 2592000) return `${Math.floor(seconds / 86400)}d ago`;

  return then.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: then.getFullYear() !== now.getFullYear() ? "numeric" : undefined,
  });
}

/**
 * Sanitizes extracted document text before ingestion.
 * Removes null bytes, non-printable control characters, and normalizes whitespace.
 * Preserves standard whitespace (\t, \n, \r) so document structure is intact.
 * This mitigates indirect prompt injection via malicious document content.
 */
export function sanitizeText(text: string): string {
  return text
    // Remove null bytes
    .replace(/\0/g, "")
    // Remove non-printable control characters except tab, newline, carriage return
    .replace(/[\x01-\x08\x0B\x0C\x0E-\x1F\x7F]/g, "")
    // Collapse runs of 3+ blank lines to 2
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/**
 * Splits text into chunks of approximately `chunkSize` tokens, respecting
 * document structure: it packs whole sentences (grouped by paragraph) up to the
 * budget and NEVER breaks mid-sentence. Overlap between consecutive chunks is
 * carried as whole trailing sentences, so a fact that starts near a boundary is
 * not severed across two chunks — which is what caps chunk-level retrieval.
 *
 * Sizing keeps the original heuristic (1 token ≈ 4 chars ≈ 0.75 words) so chunk
 * counts stay comparable to the previous word-window chunker.
 *
 * `sanitizeText()` already collapses 3+ newlines to 2, so `\n\n` reliably marks
 * paragraph boundaries here.
 *
 * NOTE: the eval harness inlines a byte-identical copy of this algorithm in
 * `evals/benchmarks/open-ragbench/ingest.mjs` (CLAUDE.md parity rule). Keep both
 * in lockstep.
 */
export function chunkText(
  text: string,
  chunkSize = 500,
  overlap = 50
): string[] {
  const wordsPerChunk = Math.floor(chunkSize * 0.75);
  const overlapWords = Math.floor(overlap * 0.75);
  const wordCount = (s: string) => s.split(/\s+/).filter(Boolean).length;

  // Split into sentence units, paragraph by paragraph. A paragraph with no
  // detectable sentence boundary (e.g. a CSV/table dump) becomes one unit.
  const units: string[] = [];
  for (const para of text.split(/\n\s*\n/)) {
    const trimmed = para.trim();
    if (!trimmed) continue;
    const sentences = trimmed.match(/[^.!?]+(?:[.!?]+(?=\s|$)|$)/g) ?? [trimmed];
    for (const s of sentences) {
      const sent = s.trim();
      if (sent) units.push(sent);
    }
  }

  const chunks: string[] = [];
  let current: string[] = [];
  let currentWords = 0;
  const flush = () => {
    const joined = current.join(" ").trim();
    if (joined) chunks.push(joined);
  };

  for (const sent of units) {
    const w = wordCount(sent);

    // A single sentence longer than the budget can't be packed — flush the
    // current chunk, then hard-split the oversized sentence by words so no
    // chunk exceeds the budget and no content is dropped.
    if (w > wordsPerChunk) {
      flush();
      current = [];
      currentWords = 0;
      const words = sent.split(/\s+/).filter(Boolean);
      for (let i = 0; i < words.length; i += wordsPerChunk) {
        chunks.push(words.slice(i, i + wordsPerChunk).join(" "));
      }
      continue;
    }

    // Adding this sentence would overflow the budget — close the chunk and seed
    // the next one with trailing whole sentences as overlap.
    if (currentWords + w > wordsPerChunk && current.length > 0) {
      flush();
      const overlapSents: string[] = [];
      let ow = 0;
      for (let i = current.length - 1; i >= 0; i--) {
        const prev = current[i];
        if (prev === undefined) break;
        const sw = wordCount(prev);
        if (ow + sw > overlapWords) break;
        overlapSents.unshift(prev);
        ow += sw;
      }
      current = overlapSents;
      currentWords = ow;
    }

    current.push(sent);
    currentWords += w;
  }
  flush();

  return chunks;
}
