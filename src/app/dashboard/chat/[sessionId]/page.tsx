export const dynamic = "force-dynamic";

import { auth } from "@clerk/nextjs/server";
import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { db } from "@/lib/db";
import { chatSessions, chatMessages, documents } from "@/lib/schema";
import { and, eq, asc, count } from "drizzle-orm";
import { ChatInterface } from "@/components/chat-interface";
import { ChatActions } from "@/components/chat-actions";
import { ArrowLeft } from "lucide-react";
import type { UIMessage } from "ai";
import type { Metadata } from "next";
import { env } from "@/lib/env";

export const metadata: Metadata = { title: "Chat" };

export default async function ChatSessionPage({
  params,
}: {
  params: Promise<{ sessionId: string }>;
}) {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");

  const { sessionId } = await params;

  // Verify session belongs to user
  const [session] = await db
    .select()
    .from(chatSessions)
    .where(and(eq(chatSessions.id, sessionId), eq(chatSessions.userId, userId)));

  if (!session) notFound();

  // Check if user has any documents
  const [docCountRow] = await db
    .select({ count: count() })
    .from(documents)
    .where(eq(documents.userId, userId));
  const hasDocuments = (docCountRow?.count ?? 0) > 0;

  // Load persisted messages
  const dbMessages = await db
    .select()
    .from(chatMessages)
    .where(
      and(eq(chatMessages.sessionId, sessionId), eq(chatMessages.userId, userId))
    )
    .orderBy(asc(chatMessages.createdAt));

  // Convert DB rows → UIMessage[] (AI SDK v6 format)
  const initialMessages: UIMessage[] = dbMessages.map((msg) => ({
    id: msg.id,
    role: msg.role,
    parts: [{ type: "text" as const, text: msg.content }],
    metadata: {},
  }));

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="border-b border-border/40 bg-background/95 backdrop-blur px-4 md:px-6 py-3 md:py-4 shrink-0 flex items-center gap-3">
        {/* Back button — mobile only */}
        <Link
          href="/dashboard/chat"
          className="md:hidden flex items-center justify-center h-8 w-8 rounded-lg hover:bg-muted transition-colors shrink-0"
          aria-label="Back to conversations"
        >
          <ArrowLeft className="h-4 w-4 text-muted-foreground" />
        </Link>
        <div className="min-w-0 flex-1">
          <h1 className="text-base font-semibold bg-gradient-to-r from-violet-600 to-indigo-600 bg-clip-text text-transparent truncate">
            {session.title}
          </h1>
          <p className="text-xs text-muted-foreground mt-0.5 hidden md:block">
            Ask anything about your company knowledge base
          </p>
        </div>
        <ChatActions
          sessionId={sessionId}
          title={session.title}
          messages={dbMessages.map((m) => ({ role: m.role, content: m.content }))}
          isShared={session.isShared}
          shareId={session.shareId ?? null}
          appUrl={env.NEXT_PUBLIC_APP_URL}
        />
      </div>

      {/* Chat */}
      <div className="flex-1 min-h-0">
        <ChatInterface sessionId={sessionId} initialMessages={initialMessages} hasDocuments={hasDocuments} />
      </div>
    </div>
  );
}
