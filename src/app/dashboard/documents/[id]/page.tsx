export const dynamic = "force-dynamic";

import { auth } from "@clerk/nextjs/server";
import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { db } from "@/lib/db";
import { documents, documentChunks } from "@/lib/schema";
import { eq, and, asc } from "drizzle-orm";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, FileText, Database, Clock, HardDrive, Hash } from "lucide-react";
import { timeAgo, formatFileSize } from "@/lib/utils";
import { ReindexDocumentButton } from "@/components/reindex-document-button";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Document" };

export default async function DocumentDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");

  const { id } = await params;

  const [doc] = await db
    .select()
    .from(documents)
    .where(and(eq(documents.id, id), eq(documents.userId, userId)));

  if (!doc) notFound();

  const chunks = await db
    .select({
      id: documentChunks.id,
      chunkIndex: documentChunks.chunkIndex,
      content: documentChunks.content,
      metadata: documentChunks.metadata,
      createdAt: documentChunks.createdAt,
    })
    .from(documentChunks)
    .where(
      and(
        eq(documentChunks.documentId, id),
        eq(documentChunks.userId, userId)
      )
    )
    .orderBy(asc(documentChunks.chunkIndex));

  return (
    <div className="p-4 sm:p-6 md:p-8 max-w-5xl mx-auto">
      {/* Back */}
      <Button variant="ghost" size="sm" asChild className="mb-4 sm:mb-6 -ml-2 text-muted-foreground hover:text-foreground">
        <Link href="/dashboard/documents">
          <ArrowLeft className="mr-1.5 h-4 w-4" />
          Back to Documents
        </Link>
      </Button>

      {/* Header */}
      <div className="mb-8">
        <div className="flex items-start gap-4">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 shadow-md">
            <FileText className="h-6 w-6 text-white" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <h1 className="text-xl sm:text-2xl font-bold text-foreground break-words">{doc.title}</h1>
              <ReindexDocumentButton documentId={doc.id} />
            </div>
            <div className="flex flex-wrap items-center gap-3 mt-2 text-sm text-muted-foreground">
              <Badge variant="secondary" className="uppercase text-xs font-semibold">
                {doc.fileType}
              </Badge>
              {doc.fileSize && (
                <span className="flex items-center gap-1">
                  <HardDrive className="h-3.5 w-3.5" />
                  {formatFileSize(doc.fileSize)}
                </span>
              )}
              <span className="flex items-center gap-1">
                <Clock className="h-3.5 w-3.5" />
                {timeAgo(doc.createdAt)}
              </span>
              <span className="flex items-center gap-1">
                <Database className="h-3.5 w-3.5" />
                {chunks.length} chunk{chunks.length !== 1 ? "s" : ""}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Document Content */}
      <Card className="mb-6 sm:mb-8 border-border/60">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <FileText className="h-4 w-4 text-teal-500" />
            Document Content
          </CardTitle>
        </CardHeader>
        <CardContent>
          <pre className="whitespace-pre-wrap text-xs sm:text-sm text-muted-foreground font-mono bg-muted/50 rounded-lg p-3 sm:p-4 max-h-72 sm:max-h-96 overflow-y-auto leading-relaxed break-words">
            {doc.content}
          </pre>
        </CardContent>
      </Card>

      {/* Chunks */}
      <div>
        <div className="flex items-center gap-2 mb-4">
          <Database className="h-4 w-4 text-emerald-500" />
          <h2 className="font-semibold text-foreground">
            Vector Chunks
            <span className="ml-2 text-sm font-normal text-muted-foreground">
              ({chunks.length} indexed segments)
            </span>
          </h2>
        </div>

        {chunks.length === 0 ? (
          <Card className="p-6 sm:p-8 text-center text-muted-foreground">
            <Database className="h-8 w-8 mx-auto mb-3 opacity-40" />
            <p className="text-sm">No chunks indexed yet. The document may still be processing.</p>
          </Card>
        ) : (
          <div className="space-y-3">
            {chunks.map((chunk) => (
              <Card key={chunk.id} className="border-border/60 hover:border-emerald-200 transition-colors">
                <CardContent className="p-3 sm:p-4">
                  <div className="flex items-start justify-between gap-4 mb-2">
                    <div className="flex items-center gap-2">
                      <div className="flex h-6 w-6 items-center justify-center rounded-full bg-emerald-500/15 dark:bg-emerald-900/30">
                        <Hash className="h-3 w-3 text-emerald-600 dark:text-emerald-400" />
                      </div>
                      <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                        Chunk {chunk.chunkIndex + 1}
                      </span>
                    </div>
                    <span className="text-xs text-muted-foreground shrink-0">
                      {chunk.content.split(/\s+/).filter(Boolean).length} words
                    </span>
                  </div>
                  <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed font-mono whitespace-pre-wrap break-words">
                    {chunk.content}
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
