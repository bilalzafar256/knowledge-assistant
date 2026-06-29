"use client";

import { memo } from "react";
import ReactMarkdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";
import { cn } from "@/lib/utils";

/**
 * Renders an assistant message as proper GitHub-flavored Markdown.
 *
 * Replaces the old regex `renderMarkdown` (which couldn't do tables or
 * thematic breaks, so structured answers leaked raw `| … |` pipes). Every
 * element is styled for a dense chat bubble: real bordered tables with a
 * header band and zebra rows, subtle dividers, tight heading rhythm, and
 * inline-code / code-block chips. react-markdown does NOT render raw HTML
 * by default, so this is XSS-safe without `dangerouslySetInnerHTML`.
 */
const COMPONENTS: Components = {
  // ── Headings — clear hierarchy without shouting ──────────────────────────
  h1: ({ children }) => (
    <h1 className="mt-4 mb-2 text-base font-semibold tracking-tight first:mt-0">{children}</h1>
  ),
  h2: ({ children }) => (
    <h2 className="mt-4 mb-2 text-[0.95rem] font-semibold tracking-tight first:mt-0">{children}</h2>
  ),
  h3: ({ children }) => (
    <h3 className="mt-3 mb-1.5 text-sm font-semibold first:mt-0">{children}</h3>
  ),

  p: ({ children }) => <p className="my-2 leading-relaxed first:mt-0 last:mb-0">{children}</p>,

  // ── Lists ────────────────────────────────────────────────────────────────
  ul: ({ children }) => <ul className="my-2 ml-1 list-disc space-y-1 pl-4 marker:text-emerald-400">{children}</ul>,
  ol: ({ children }) => <ol className="my-2 ml-1 list-decimal space-y-1 pl-4 marker:text-muted-foreground">{children}</ol>,
  li: ({ children }) => <li className="leading-relaxed [&>ul]:my-1 [&>ol]:my-1">{children}</li>,

  // ── Emphasis ─────────────────────────────────────────────────────────────
  strong: ({ children }) => <strong className="font-semibold text-foreground">{children}</strong>,
  em: ({ children }) => <em className="italic text-muted-foreground">{children}</em>,

  // ── Links — always open safely in a new tab ──────────────────────────────
  a: ({ href, children }) => (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="font-medium text-emerald-600 underline decoration-emerald-300 underline-offset-2 hover:text-emerald-700 dark:text-emerald-400 dark:decoration-emerald-700"
    >
      {children}
    </a>
  ),

  // ── Thematic break — a real divider instead of literal "---" ─────────────
  hr: () => <hr className="my-4 border-t border-border/70" />,

  // ── Blockquote ───────────────────────────────────────────────────────────
  blockquote: ({ children }) => (
    <blockquote className="my-2 border-l-2 border-emerald-300 pl-3 text-muted-foreground italic dark:border-emerald-700">
      {children}
    </blockquote>
  ),

  // ── Code ─────────────────────────────────────────────────────────────────
  code: ({ className, children, ...props }) => {
    const isBlock = /language-/.test(className ?? "");
    if (isBlock) {
      return (
        <code className={cn("font-mono text-[0.8rem] leading-relaxed", className)} {...props}>
          {children}
        </code>
      );
    }
    return (
      <code className="rounded bg-emerald-500/15/70 px-1.5 py-0.5 font-mono text-[0.8em] text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300">
        {children}
      </code>
    );
  },
  pre: ({ children }) => (
    <pre className="my-3 overflow-x-auto rounded-lg border border-border/60 bg-muted/60 p-3 text-foreground">
      {children}
    </pre>
  ),

  // ── Tables — the headline fix. Bordered, header band, zebra rows ─────────
  table: ({ children }) => (
    <div className="my-3 overflow-x-auto rounded-lg border border-border/70">
      <table className="w-full border-collapse text-left text-[0.8rem]">{children}</table>
    </div>
  ),
  thead: ({ children }) => <thead className="bg-muted/70">{children}</thead>,
  tbody: ({ children }) => (
    <tbody className="[&>tr:nth-child(even)]:bg-muted/30 [&>tr:last-child>td]:border-b-0">{children}</tbody>
  ),
  tr: ({ children }) => <tr className="border-b border-border/50">{children}</tr>,
  th: ({ children }) => (
    <th className="px-3 py-2 font-semibold text-foreground whitespace-nowrap">{children}</th>
  ),
  td: ({ children }) => <td className="px-3 py-2 align-top text-foreground/90">{children}</td>,
};

function MessageMarkdownImpl({ content, className }: { content: string; className?: string }) {
  return (
    <div className={cn("text-sm [word-break:break-word]", className)}>
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={COMPONENTS}>
        {content}
      </ReactMarkdown>
    </div>
  );
}

// Memoize: streaming re-renders the whole list on every token; only re-parse
// when this message's text actually changes.
export const MessageMarkdown = memo(MessageMarkdownImpl);
