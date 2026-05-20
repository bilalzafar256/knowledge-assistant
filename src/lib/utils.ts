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
    // eslint-disable-next-line no-control-regex
    .replace(/[\x01-\x08\x0B\x0C\x0E-\x1F\x7F]/g, "")
    // Collapse runs of 3+ blank lines to 2
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/**
 * Splits text into chunks of approximately chunkSize tokens.
 * Uses a simple word-boundary approach (~4 chars per token).
 */
export function chunkText(
  text: string,
  chunkSize = 500,
  overlap = 50
): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  const chunks: string[] = [];

  // Approximate: 1 token ≈ 4 characters, so 500 tokens ≈ 375 words
  const wordsPerChunk = Math.floor(chunkSize * 0.75);
  const overlapWords = Math.floor(overlap * 0.75);

  let start = 0;
  while (start < words.length) {
    const end = Math.min(start + wordsPerChunk, words.length);
    const chunk = words.slice(start, end).join(" ");
    if (chunk.trim()) {
      chunks.push(chunk.trim());
    }
    if (end === words.length) break;
    start = end - overlapWords;
  }

  return chunks;
}
