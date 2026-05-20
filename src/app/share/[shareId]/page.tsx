import { notFound } from "next/navigation";
import Link from "next/link";
import { db } from "@/lib/db";
import { chatSessions, chatMessages } from "@/lib/schema";
import { and, eq, asc } from "drizzle-orm";
import { BookOpen, Bot, User, ExternalLink } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { Metadata } from "next";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ shareId: string }>;
}): Promise<Metadata> {
  const { shareId } = await params;
  const [session] = await db
    .select({ title: chatSessions.title })
    .from(chatSessions)
    .where(and(eq(chatSessions.shareId, shareId), eq(chatSessions.isShared, true)));
  return { title: session ? `${session.title} — Shared Chat` : "Shared Chat" };
}

export default async function SharedChatPage({
  params,
}: {
  params: Promise<{ shareId: string }>;
}) {
  const { shareId } = await params;

  const [session] = await db
    .select()
    .from(chatSessions)
    .where(and(eq(chatSessions.shareId, shareId), eq(chatSessions.isShared, true)));

  if (!session) notFound();

  const messages = await db
    .select()
    .from(chatMessages)
    .where(eq(chatMessages.sessionId, session.id))
    .orderBy(asc(chatMessages.createdAt));

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border/40 bg-background/95 backdrop-blur sticky top-0 z-20">
        <div className="mx-auto max-w-3xl px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-br from-violet-600 to-indigo-600 shadow-sm">
              <BookOpen className="h-3.5 w-3.5 text-white" />
            </div>
            <span className="font-semibold text-sm bg-gradient-to-r from-violet-600 to-indigo-600 bg-clip-text text-transparent">
              Knowledge Assistant
            </span>
            <Badge className="bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-400 border-0 text-xs">
              Shared
            </Badge>
          </div>
          <Button
            asChild
            size="sm"
            className="bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-700 hover:to-indigo-700 text-white border-0"
          >
            <Link href="/sign-up">
              Try it free
              <ExternalLink className="ml-1.5 h-3.5 w-3.5" />
            </Link>
          </Button>
        </div>
      </header>

      {/* Conversation */}
      <div className="mx-auto max-w-3xl px-4 py-8">
        {/* Title */}
        <div className="mb-8">
          <h1 className="text-2xl font-bold bg-gradient-to-r from-violet-600 to-indigo-600 bg-clip-text text-transparent">
            {session.title}
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            {messages.length} message{messages.length !== 1 ? "s" : ""} ·{" "}
            Shared conversation
          </p>
        </div>

        {messages.length === 0 ? (
          <p className="text-center text-muted-foreground py-16">
            This conversation has no messages yet.
          </p>
        ) : (
          <div className="space-y-6">
            {messages.map((msg) => {
              const isUser = msg.role === "user";
              return (
                <div key={msg.id} className={`flex gap-3 ${isUser ? "flex-row-reverse" : ""}`}>
                  <div
                    className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${
                      isUser
                        ? "bg-gradient-to-br from-violet-600 to-indigo-600 text-white"
                        : "bg-violet-100 dark:bg-violet-900/30 text-violet-600 dark:text-violet-400"
                    }`}
                  >
                    {isUser ? <User className="h-4 w-4" /> : <Bot className="h-4 w-4" />}
                  </div>
                  <div className={`max-w-[80%] rounded-2xl px-4 py-3 text-sm leading-relaxed ${
                    isUser
                      ? "bg-gradient-to-br from-violet-600 to-indigo-600 text-white rounded-tr-sm"
                      : "bg-muted text-foreground rounded-tl-sm"
                  }`}>
                    {msg.content}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* CTA footer */}
        <div className="mt-16 rounded-2xl bg-gradient-to-br from-violet-600 via-purple-600 to-indigo-600 p-8 text-center text-white">
          <h2 className="text-xl font-bold mb-2">Build your own knowledge assistant</h2>
          <p className="text-violet-100 text-sm mb-6 max-w-sm mx-auto">
            Upload your company documents and ask questions in plain English. Answers are sourced directly from your knowledge base.
          </p>
          <Button asChild className="bg-white text-violet-700 hover:bg-violet-50 border-0 font-semibold">
            <Link href="/sign-up">Get started for free</Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
