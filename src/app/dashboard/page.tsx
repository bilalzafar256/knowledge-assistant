export const dynamic = "force-dynamic";

import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import { db } from "@/lib/db";
import { documents, documentChunks, chatSessions, chatMessages } from "@/lib/schema";
import { and, eq, sql, desc } from "drizzle-orm";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  MessageSquare,
  FileText,
  Database,
  Upload,
  ArrowRight,
  Clock,
  MessagesSquare,
  Layers,
  Wallet,
} from "lucide-react";
import { timeAgo, truncate } from "@/lib/utils";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Dashboard",
};

export default async function DashboardPage() {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");

  // Fetch stats and recent documents in parallel
  const [docCountResult, chunkCountResult, sessionCountResult, messageCountResult, recentDocs, totalSpendResult, topSessions] = await Promise.all([
    db
      .select({ count: sql<number>`count(*)` })
      .from(documents)
      .where(eq(documents.userId, userId)),

    db
      .select({ count: sql<number>`count(*)` })
      .from(documentChunks)
      .where(eq(documentChunks.userId, userId)),

    db
      .select({ count: sql<number>`count(*)` })
      .from(chatSessions)
      .where(eq(chatSessions.userId, userId)),

    db
      .select({ count: sql<number>`count(*)` })
      .from(chatMessages)
      .where(eq(chatMessages.userId, userId)),

    db
      .select({
        id: documents.id,
        title: documents.title,
        fileType: documents.fileType,
        createdAt: documents.createdAt,
        content: documents.content,
      })
      .from(documents)
      .where(eq(documents.userId, userId))
      .orderBy(desc(documents.createdAt))
      .limit(5),

    // Total LLM spend across all sessions
    db
      .select({ total: sql<string>`coalesce(sum(${chatSessions.totalCostUsd}), 0)` })
      .from(chatSessions)
      .where(eq(chatSessions.userId, userId)),

    // Highest-spending sessions
    db
      .select({
        id: chatSessions.id,
        title: chatSessions.title,
        totalCostUsd: chatSessions.totalCostUsd,
      })
      .from(chatSessions)
      .where(and(eq(chatSessions.userId, userId), sql`${chatSessions.totalCostUsd} > 0`))
      .orderBy(desc(chatSessions.totalCostUsd))
      .limit(5),
  ]);

  const docCount = Number(docCountResult[0]?.count ?? 0);
  const chunkCount = Number(chunkCountResult[0]?.count ?? 0);
  const sessionCount = Number(sessionCountResult[0]?.count ?? 0);
  const messageCount = Number(messageCountResult[0]?.count ?? 0);
  const parsedSpend = Number(totalSpendResult[0]?.total ?? 0);
  const totalSpend = Number.isFinite(parsedSpend) ? parsedSpend : 0;

  const stats = [
    {
      label: "Documents",
      value: docCount,
      icon: FileText,
      description: "Uploaded documents",
      href: "/dashboard/documents",
      bg: "bg-violet-50 dark:bg-violet-900/20",
      iconColor: "text-violet-600 dark:text-violet-400",
      arrowColor: "group-hover:text-violet-600",
    },
    {
      label: "Knowledge Chunks",
      value: chunkCount.toLocaleString(),
      icon: Database,
      description: "Indexed text segments",
      href: "/dashboard/documents",
      bg: "bg-indigo-50 dark:bg-indigo-900/20",
      iconColor: "text-indigo-600 dark:text-indigo-400",
      arrowColor: "group-hover:text-indigo-600",
    },
    {
      label: "Conversations",
      value: sessionCount,
      icon: MessagesSquare,
      description: "Chat sessions started",
      href: "/dashboard/chat",
      bg: "bg-emerald-50 dark:bg-emerald-900/20",
      iconColor: "text-emerald-600 dark:text-emerald-400",
      arrowColor: "group-hover:text-emerald-600",
    },
    {
      label: "Messages Sent",
      value: messageCount.toLocaleString(),
      icon: Layers,
      description: "Total messages across all chats",
      href: "/dashboard/chat",
      bg: "bg-sky-50 dark:bg-sky-900/20",
      iconColor: "text-sky-600 dark:text-sky-400",
      arrowColor: "group-hover:text-sky-600",
    },
    {
      label: "Total Spend",
      value: `$${totalSpend.toFixed(2)}`,
      icon: Wallet,
      description: "LLM cost across all sessions",
      href: "/dashboard/chat",
      bg: "bg-amber-50 dark:bg-amber-900/20",
      iconColor: "text-amber-600 dark:text-amber-400",
      arrowColor: "group-hover:text-amber-600",
    },
  ];

  return (
    <div className="p-6 md:p-8 max-w-6xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold bg-gradient-to-r from-violet-600 to-indigo-600 bg-clip-text text-transparent">
          Dashboard
        </h1>
        <p className="text-muted-foreground mt-1">
          Overview of your knowledge base and recent activity
        </p>
      </div>

      {/* Stats */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 mb-8">
        {stats.map((stat) => {
          const Icon = stat.icon;
          return (
            <Link key={stat.label} href={stat.href}>
              <Card className="p-6 hover:shadow-md hover:border-violet-200 dark:hover:border-violet-800 transition-all duration-200 cursor-pointer group border-border/60">
                <div className="flex items-center justify-between mb-3">
                  <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${stat.bg}`}>
                    <Icon className={`h-5 w-5 ${stat.iconColor}`} />
                  </div>
                  <ArrowRight className={`h-4 w-4 text-muted-foreground transition-colors ${stat.arrowColor}`} />
                </div>
                <div className="text-2xl font-bold text-foreground">
                  {stat.value}
                </div>
                <div className="text-sm font-medium text-foreground mt-0.5">
                  {stat.label}
                </div>
                <div className="text-xs text-muted-foreground mt-0.5">
                  {stat.description}
                </div>
              </Card>
            </Link>
          );
        })}
      </div>

      {/* Quick Actions */}
      <div className="grid gap-4 sm:grid-cols-2 mb-8">
        <Card className="p-6 border-border/60 hover:border-violet-200 dark:hover:border-violet-800 transition-colors">
          <div className="flex items-center gap-2 mb-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-violet-100 dark:bg-violet-900/30">
              <MessageSquare className="h-4 w-4 text-violet-600 dark:text-violet-400" />
            </div>
            <h2 className="font-semibold text-foreground">
              Start a conversation
            </h2>
          </div>
          <p className="text-sm text-muted-foreground mb-4">
            Ask questions about your company knowledge base using natural
            language.
          </p>
          <Button asChild className="bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-700 hover:to-indigo-700 text-white border-0 shadow-sm">
            <Link href="/dashboard/chat">
              <MessageSquare className="mr-2 h-4 w-4" />
              Open Chat
            </Link>
          </Button>
        </Card>

        <Card className="p-6 border-border/60 hover:border-indigo-200 dark:hover:border-indigo-800 transition-colors">
          <div className="flex items-center gap-2 mb-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-indigo-100 dark:bg-indigo-900/30">
              <Upload className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
            </div>
            <h2 className="font-semibold text-foreground">
              Add new knowledge
            </h2>
          </div>
          <p className="text-sm text-muted-foreground mb-4">
            Upload documents to expand the knowledge base. Supports text,
            markdown, and more.
          </p>
          <Button variant="outline" asChild className="border-indigo-200 dark:border-indigo-800 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/20">
            <Link href="/dashboard/documents/upload">
              <Upload className="mr-2 h-4 w-4" />
              Upload Document
            </Link>
          </Button>
        </Card>
      </div>

      {/* Top spending sessions */}
      {topSessions.length > 0 && (
        <div className="mb-8">
          <div className="flex items-center gap-2 mb-4">
            <Wallet className="h-4 w-4 text-amber-500" />
            <h2 className="font-semibold text-foreground">Top spending sessions</h2>
          </div>
          <div className="space-y-2">
            {topSessions.map((s) => (
              <Link key={s.id} href={`/dashboard/chat/${s.id}`}>
                <Card className="p-4 hover:shadow-sm hover:border-amber-200 dark:hover:border-amber-800 transition-all border-border/60 cursor-pointer">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-amber-50 dark:bg-amber-900/20">
                        <MessageSquare className="h-4 w-4 text-amber-500" />
                      </div>
                      <p className="font-medium text-foreground text-sm truncate">
                        {s.title}
                      </p>
                    </div>
                    <Badge className="text-xs bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 border-0 font-semibold shrink-0">
                      ${(Number.isFinite(Number(s.totalCostUsd)) ? Number(s.totalCostUsd) : 0).toFixed(4)}
                    </Badge>
                  </div>
                </Card>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Recent Documents */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-semibold text-foreground">Recent Documents</h2>
          <Button variant="ghost" size="sm" asChild className="text-violet-600 hover:text-violet-700 hover:bg-violet-50 dark:hover:bg-violet-900/20">
            <Link href="/dashboard/documents">
              View all
              <ArrowRight className="ml-1 h-3 w-3" />
            </Link>
          </Button>
        </div>

        {recentDocs.length === 0 ? (
          <Card className="p-8 text-center border-dashed border-2">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-violet-50 dark:bg-violet-900/20 mx-auto mb-3">
              <FileText className="h-7 w-7 text-violet-400" />
            </div>
            <h3 className="font-medium text-foreground mb-1">
              No documents yet
            </h3>
            <p className="text-sm text-muted-foreground mb-4">
              Upload your first document to get started.
            </p>
            <Button asChild className="bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-700 hover:to-indigo-700 text-white border-0">
              <Link href="/dashboard/documents/upload">
                <Upload className="mr-2 h-4 w-4" />
                Upload Document
              </Link>
            </Button>
          </Card>
        ) : (
          <div className="space-y-2">
            {recentDocs.map((doc) => (
              <Card
                key={doc.id}
                className="p-4 hover:shadow-sm hover:border-violet-200 dark:hover:border-violet-800 transition-all border-border/60"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3 min-w-0">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-violet-50 dark:bg-violet-900/20 mt-0.5">
                      <FileText className="h-4 w-4 text-violet-500" />
                    </div>
                    <div className="min-w-0">
                      <p className="font-medium text-foreground text-sm truncate">
                        {doc.title}
                      </p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {truncate(doc.content, 100)}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <Badge className="text-xs bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400 border-0 uppercase font-semibold">
                      {doc.fileType}
                    </Badge>
                    <div className="flex items-center gap-1 text-xs text-muted-foreground">
                      <Clock className="h-3 w-3" />
                      {timeAgo(doc.createdAt)}
                    </div>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
