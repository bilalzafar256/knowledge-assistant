"use client";

import { useState, useMemo } from "react";
import { DocumentList } from "@/components/document-list";
import { CollectionsSidebar } from "@/components/collections-sidebar";
import type { DocRow } from "@/components/document-list";
import type { CollectionItem } from "@/components/collections-sidebar";

interface Props {
  docs: DocRow[];
  collections: CollectionItem[];
}

export function DocumentsWithCollections({ docs, collections }: Props) {
  const [activeCollectionId, setActiveCollectionId] = useState<string | null>(null);

  // Count documents per collection
  const docCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const doc of docs) {
      if (doc.collectionId) {
        counts[doc.collectionId] = (counts[doc.collectionId] ?? 0) + 1;
      }
    }
    return counts;
  }, [docs]);

  return (
    <div className="flex gap-6">
      {/* Collections sidebar */}
      <aside className="w-52 shrink-0 hidden md:block">
        <p className="text-xs font-semibold uppercase text-muted-foreground tracking-wider px-3 mb-2">
          Collections
        </p>
        <CollectionsSidebar
          collections={collections}
          activeCollectionId={activeCollectionId}
          onSelect={setActiveCollectionId}
          docCounts={docCounts}
          totalDocs={docs.length}
        />
      </aside>

      {/* Document list */}
      <div className="flex-1 min-w-0">
        <DocumentList
          docs={docs}
          collections={collections}
          activeCollectionId={activeCollectionId}
        />
      </div>
    </div>
  );
}
