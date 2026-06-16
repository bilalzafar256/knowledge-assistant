"use client";

import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, isToolUIPart, isTextUIPart } from "ai";
import type { UIMessage } from "ai";
import { useMemo, useRef, useState, useEffect } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Send,
  Bot,
  User,
  AlertCircle,
  BookOpen,
  RefreshCw,
  ChevronDown,
  Upload,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { MessageMarkdown } from "@/components/message-markdown";

interface ToolCallResult {
  results?: Array<{
    documentTitle: string;
    content: string;
    similarity: number;
  }>;
  message?: string;
}

interface ChatInterfaceProps {
  sessionId: string;
  initialMessages?: UIMessage[];
  hasDocuments?: boolean;
  /** Persisted running LLM spend (USD) for this session, used as the initial display value. */
  initialCostUsd?: number;
}

/** Metadata the chat route attaches to each streamed assistant message. */
type CostMetadata = { sessionCostUsd?: number; messageCostUsd?: number };

export function ChatInterface({ sessionId, initialMessages = [], hasDocuments = true, initialCostUsd = 0 }: ChatInterfaceProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [isAtBottom, setIsAtBottom] = useState(true);
  const [input, setInput] = useState("");

  const transport = useMemo(
    () => new DefaultChatTransport({ api: "/api/chat", body: { sessionId } }),
    [sessionId]
  );

  const { messages, sendMessage, status, error, regenerate } = useChat({
    transport,
    messages: initialMessages,
    onError(err) {
      console.error("[chat]", err);
    },
  });

  const isLoading = status === "submitted" || status === "streaming";

  // Live session spend: prefer the latest assistant message's metadata (updated
  // after each query streams), falling back to the persisted initial total.
  const sessionCost = useMemo(() => {
    for (let i = messages.length - 1; i >= 0; i--) {
      const m = messages[i];
      if (m?.role !== "assistant") continue;
      const meta = m.metadata as CostMetadata | undefined;
      if (Number.isFinite(meta?.sessionCostUsd)) return meta!.sessionCostUsd!;
    }
    return Number.isFinite(initialCostUsd) ? initialCostUsd : 0;
  }, [messages, initialCostUsd]);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    if (isAtBottom && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isAtBottom]);

  const handleScroll = () => {
    const el = scrollRef.current;
    if (!el) return;
    const distFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
    setIsAtBottom(distFromBottom < 100);
  };

  const scrollToBottom = () => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
      setIsAtBottom(true);
    }
  };

  const handleTextareaChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value);
    const ta = e.target;
    ta.style.height = "auto";
    ta.style.height = `${Math.min(ta.scrollHeight, 200)}px`;
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
      e.preventDefault();
      if (input.trim() && !isLoading) {
        handleSubmit(e as unknown as React.FormEvent);
      }
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (input.trim() && !isLoading) {
      void sendMessage({ text: input });
      setInput("");
      // Reset textarea height immediately
      if (textareaRef.current) {
        textareaRef.current.style.height = "auto";
      }
      // Optimistically scroll to bottom before server response
      setIsAtBottom(true);
      requestAnimationFrame(() => {
        if (scrollRef.current) {
          scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
      });
    }
  };

  const suggestedQuestions = [
    "What is our company's vacation policy?",
    "How do I request equipment?",
    "What are the onboarding steps for new employees?",
    "Where can I find the engineering coding standards?",
  ];

  return (
    <div className="flex flex-col h-full">
      {/* Session cost indicator */}
      <div className="flex justify-end px-4 pt-2 shrink-0">
        <Badge
          variant="secondary"
          className="text-xs font-medium text-muted-foreground"
          title="Total LLM spend for this conversation"
        >
          Session cost: ${sessionCost.toFixed(4)}
        </Badge>
      </div>

      {/* Messages area */}
      <div className="relative flex-1 min-h-0">
        <ScrollArea className="h-full" ref={scrollRef as never} onScrollCapture={handleScroll}>
          <div className="p-4 space-y-6 max-w-3xl mx-auto">
            {/* Empty state */}
            {messages.length === 0 && (
              <div className="flex flex-col items-center justify-center min-h-[400px] text-center px-4">
                {!hasDocuments ? (
                  /* Onboarding — no documents uploaded yet */
                  <>
                    <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-50 dark:bg-amber-900/20 mb-4">
                      <Upload className="h-7 w-7 text-amber-500" />
                    </div>
                    <h2 className="text-xl font-semibold text-foreground mb-2">
                      Your knowledge base is empty
                    </h2>
                    <p className="text-muted-foreground mb-6 max-w-sm">
                      Upload your company documents first. Once indexed, you can
                      ask questions and get accurate, cited answers.
                    </p>
                    <Button
                      asChild
                      className="bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-700 hover:to-indigo-700 text-white border-0 shadow-md shadow-indigo-200 dark:shadow-indigo-900/30"
                    >
                      <Link href="/dashboard/documents/upload">
                        <Upload className="mr-2 h-4 w-4" />
                        Upload your first document
                      </Link>
                    </Button>
                    <p className="mt-4 text-xs text-muted-foreground">
                      Supported formats: PDF, Word, Excel, images, plain text
                    </p>
                  </>
                ) : (
                  /* Normal empty state — documents exist */
                  <>
                    <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 mb-4">
                      <BookOpen className="h-7 w-7 text-primary" />
                    </div>
                    <h2 className="text-xl font-semibold text-foreground mb-2">
                      How can I help you?
                    </h2>
                    <p className="text-muted-foreground mb-8 max-w-sm">
                      Ask me anything about your company. I&apos;ll search the knowledge
                      base and provide accurate, cited answers.
                    </p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 w-full max-w-lg">
                      {suggestedQuestions.map((q) => (
                        <button
                          key={q}
                          onClick={() => {
                            setInput(q);
                            textareaRef.current?.focus();
                          }}
                          className="text-left p-3 rounded-lg border border-border bg-card hover:bg-accent hover:border-primary/40 transition-colors text-sm text-muted-foreground hover:text-foreground"
                        >
                          {q}
                        </button>
                      ))}
                    </div>
                  </>
                )}
              </div>
            )}

            {/* Message list */}
            {messages.map((message) => {
              if (message.role === "system") return null;
              return (
                <MessageBubble key={message.id} message={message} />
              );
            })}

            {/* Loading indicator */}
            {isLoading && (
              <div className="flex gap-3">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-violet-100 dark:bg-violet-900/30">
                  <Bot className="h-4 w-4 text-violet-600 dark:text-violet-400" />
                </div>
                <div className="flex flex-col gap-2 flex-1 max-w-xl pt-1">
                  {status === "submitted" ? (
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground italic">Thinking…</span>
                      <span className="flex gap-0.5">
                        {[0, 1, 2].map((i) => (
                          <span
                            key={i}
                            className="h-1.5 w-1.5 rounded-full bg-violet-400 animate-bounce"
                            style={{ animationDelay: `${i * 150}ms` }}
                          />
                        ))}
                      </span>
                    </div>
                  ) : (
                    <>
                      <Skeleton className="h-4 w-3/4 bg-violet-100 dark:bg-violet-900/30" />
                      <Skeleton className="h-4 w-1/2 bg-violet-100 dark:bg-violet-900/30" />
                      <Skeleton className="h-4 w-2/3 bg-violet-100 dark:bg-violet-900/30" />
                    </>
                  )}
                </div>
              </div>
            )}

            {/* Error state */}
            {error && (
              <div className="flex items-start gap-3 p-4 rounded-lg bg-destructive/10 border border-destructive/20">
                <AlertCircle className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
                <div className="flex-1">
                  <p className="text-sm font-medium text-destructive">
                    Something went wrong
                  </p>
                  <p className="text-sm text-muted-foreground mt-1">
                    {error.message ?? "An unexpected error occurred."}
                  </p>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => void regenerate()}
                    className="mt-2"
                  >
                    <RefreshCw className="mr-1.5 h-3 w-3" />
                    Try again
                  </Button>
                </div>
              </div>
            )}
          </div>
        </ScrollArea>

        {/* Scroll to bottom button */}
        {!isAtBottom && (
          <button
            onClick={scrollToBottom}
            className="absolute bottom-4 right-4 flex h-8 w-8 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-md hover:bg-primary/90 transition-colors"
          >
            <ChevronDown className="h-4 w-4" />
          </button>
        )}
      </div>

      {/* Input form */}
      <div className="border-t border-border p-4">
        <div className="max-w-3xl mx-auto">
          <form onSubmit={handleSubmit} className="relative">
            <Textarea
              ref={textareaRef}
              value={input}
              onChange={handleTextareaChange}
              onKeyDown={handleKeyDown}
              placeholder="Ask a question about your company knowledge base... (Ctrl+Enter to send)"
              className="pr-12 min-h-[52px] max-h-[200px] resize-none"
              disabled={isLoading}
              rows={1}
            />
            <Button
              type="submit"
              size="icon"
              disabled={!input.trim() || isLoading}
              className="absolute right-2 bottom-2 h-8 w-8"
            >
              <Send className="h-4 w-4" />
              <span className="sr-only">Send message</span>
            </Button>
          </form>
          <p className="text-xs text-muted-foreground mt-2 text-center">
            Answers are based on your uploaded documents. Always verify critical
            information.
          </p>
        </div>
      </div>
    </div>
  );
}

// ── Message Bubble ──────────────────────────────────────────────────────────

interface MessageBubbleProps {
  message: UIMessage;
}

function MessageBubble({ message }: MessageBubbleProps) {
  const isUser = message.role === "user";
  const [showSources, setShowSources] = useState(false);

  const textContent = useMemo(
    () =>
      message.parts
        .filter(isTextUIPart)
        .map((p) => p.text)
        .join(""),
    [message.parts]
  );

  const toolParts = useMemo(
    () => message.parts.filter(isToolUIPart),
    [message.parts]
  );

  const sources = useMemo(
    () =>
      toolParts
        .filter(
          (p) =>
            p.type === "tool-searchKnowledge" &&
            p.state === "output-available"
        )
        .flatMap((p) => {
          const result = p.output as ToolCallResult | undefined;
          return result?.results ?? [];
        }),
    [toolParts]
  );

  const isSearching = toolParts.some(
    (p) => p.state === "input-streaming" || p.state === "input-available"
  );

  return (
    <div className={cn("flex gap-3", isUser && "flex-row-reverse")}>
      {/* Avatar */}
      <div
        className={cn(
          "flex h-8 w-8 shrink-0 items-center justify-center rounded-full",
          isUser
            ? "bg-gradient-to-br from-violet-600 to-indigo-600 text-white"
            : "bg-violet-100 dark:bg-violet-900/30 text-violet-600 dark:text-violet-400"
        )}
      >
        {isUser ? <User className="h-4 w-4" /> : <Bot className="h-4 w-4" />}
      </div>

      {/* Content */}
      <div className={cn("flex flex-col gap-2 max-w-[80%]", isUser && "items-end")}>
        {/* Tool call indicator */}
        {!isUser && toolParts.length > 0 && (
          <div className="flex items-center gap-1.5">
            {isSearching ? (
              <Badge className="text-xs gap-1 bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-400 border-0">
                <RefreshCw className="h-2.5 w-2.5 animate-spin" />
                Searching knowledge base...
              </Badge>
            ) : sources.length > 0 ? (
              <button onClick={() => setShowSources(!showSources)} className="inline-flex items-center gap-1">
                <Badge className="text-xs gap-1 cursor-pointer bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400 border-0 hover:bg-indigo-200">
                  <BookOpen className="h-2.5 w-2.5" />
                  {sources.length} source{sources.length !== 1 ? "s" : ""}
                  <ChevronDown
                    className={cn(
                      "h-2.5 w-2.5 transition-transform",
                      showSources && "rotate-180"
                    )}
                  />
                </Badge>
              </button>
            ) : null}
          </div>
        )}

        {/* Message bubble */}
        <div
          className={cn(
            "rounded-2xl px-4 py-2.5 text-sm",
            isUser
              ? "bg-gradient-to-br from-violet-600 to-indigo-600 text-white rounded-tr-sm"
              : "bg-muted text-foreground rounded-tl-sm"
          )}
        >
          {textContent ? (
            isUser ? (
              <p className="whitespace-pre-wrap leading-relaxed">{textContent}</p>
            ) : (
              <MessageMarkdown content={textContent} />
            )
          ) : !isUser && isSearching ? (
            <span className="text-muted-foreground italic">
              Searching knowledge base...
            </span>
          ) : null}
        </div>

        {/* Sources panel */}
        {showSources && sources.length > 0 && (
          <div className="w-full space-y-2 mt-1">
            <p className="text-xs font-medium text-muted-foreground">Sources used:</p>
            {sources.slice(0, 3).map((source, idx) => (
              <div key={idx} className="rounded-lg border border-border bg-card p-3 text-xs">
                <div className="flex items-center justify-between mb-1.5">
                  <span className="font-medium text-foreground">{source.documentTitle}</span>
                  <Badge variant="secondary" className="text-xs">
                    {Math.round(source.similarity * 100)}% match
                  </Badge>
                </div>
                <p className="text-muted-foreground line-clamp-3">{source.content}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

