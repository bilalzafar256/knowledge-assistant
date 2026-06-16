export const dynamic = "force-dynamic";

import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import { db } from "@/lib/db";
import { documents, documentChunks, collections } from "@/lib/schema";
import { eq, sql, desc, asc } from "drizzle-orm";
import { Button } from "@/components/ui/button";
import { Upload } from "lucide-react";
import type { DocRow } from "@/components/document-list";
import { DocumentsWithCollections } from "@/components/documents-with-collections";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Documents" };

export default async function DocumentsPage() {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");

  const [rows, collectionRows] = await Promise.all([
    db
      .select({
        id: documents.id,
        title: documents.title,
        fileType: documents.fileType,
        fileSize: documents.fileSize,
        status: documents.status,
        createdAt: documents.createdAt,
        collectionId: documents.collectionId,
        chunkCount: sql<number>`count(${documentChunks.id})`,
      })
      .from(documents)
      .leftJoin(documentChunks, eq(documentChunks.documentId, documents.id))
      .where(eq(documents.userId, userId))
      .groupBy(
        documents.id,
        documents.title,
        documents.fileType,
        documents.fileSize,
        documents.status,
        documents.createdAt,
        documents.collectionId
      )
      .orderBy(desc(documents.createdAt)),

    db
      .select()
      .from(collections)
      .where(eq(collections.userId, userId))
      .orderBy(asc(collections.name)),
  ]);

  const docs: DocRow[] = rows.map((r) => ({
    ...r,
    chunkCount: Number(r.chunkCount),
    collectionId: r.collectionId ?? null,
  }));

  return (
    <div className="p-6 md:p-8 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold bg-gradient-to-r from-violet-600 to-indigo-600 bg-clip-text text-transparent">
            Documents
          </h1>
          <p className="text-muted-foreground mt-1">
            {docs.length} document{docs.length !== 1 ? "s" : ""} in your knowledge base
          </p>
        </div>
        <Button
          asChild
          className="bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-700 hover:to-indigo-700 text-white shadow-md shadow-indigo-200 dark:shadow-indigo-900/30 border-0"
        >
          <Link href="/dashboard/documents/upload">
            <Upload className="mr-2 h-4 w-4" />
            Upload
          </Link>
        </Button>
      </div>

      <DocumentsWithCollections docs={docs} collections={collectionRows} />
    </div>
  );
}
