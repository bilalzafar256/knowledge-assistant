"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  FileText, Upload, Clock, Database, Eye,
  FileArchive, Sheet, Image as ImageIcon, Search, X,
  ArrowDownAZ, ArrowUpZA, CalendarArrowDown, CalendarArrowUp, HardDrive,
  Loader2, CheckCircle2, AlertCircle, Folder, FolderMinus,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { timeAgo, formatFileSize, cn } from "@/lib/utils";
import { DeleteDocumentButton } from "@/components/delete-document-button";
import type { CollectionItem } from "@/components/collections-sidebar";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface DocRow {
  id: string;
  title: string;
  fileType: string | null;
  fileSize: number | null;
  status: "pending" | "processing" | "ready" | "failed";
  createdAt: Date;
  chunkCount: number;
  collectionId: string | null;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const FILE_TYPE_GROUPS: Record<string, string[]> = {
  PDF:    ["pdf"],
  Word:   ["doc", "docx"],
  Excel:  ["xls", "xlsx", "csv"],
  Image:  ["jpg", "jpeg", "png", "gif"],
  Text:   ["txt", "md", "json"],
};

function getGroup(fileType: string | null): string {
  const t = fileType?.toLowerCase() ?? "";
  for (const [group, exts] of Object.entries(FILE_TYPE_GROUPS)) {
    if (exts.includes(t)) return group;
  }
  return "Other";
}

function IngestionStatusPill({ status }: { status: DocRow["status"] }) {
  if (status === "ready") {
    return (
      <span className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400">
        <CheckCircle2 className="h-3 w-3" />
        Indexed
      </span>
    );
  }
  if (status === "processing" || status === "pending") {
    return (
      <span className="inline-flex items-center gap-1 text-violet-600 dark:text-violet-400">
        <Loader2 className="h-3 w-3 animate-spin" />
        {status === "pending" ? "Pending" : "Indexing…"}
      </span>
    );
  }
  if (status === "failed") {
    return (
      <span className="inline-flex items-center gap-1 text-rose-600 dark:text-rose-400">
        <AlertCircle className="h-3 w-3" />
        Failed
      </span>
    );
  }
  return null;
}

function FileIcon({ fileType }: { fileType: string | null }) {
  const t = fileType?.toLowerCase() ?? "";
  if (t === "pdf") return <FileArchive className="h-5 w-5 text-rose-500" />;
  if (["xls", "xlsx", "csv"].includes(t)) return <Sheet className="h-5 w-5 text-emerald-500" />;
  if (["jpg", "jpeg", "png", "gif"].includes(t)) return <ImageIcon className="h-5 w-5 text-amber-500" />;
  if (["doc", "docx"].includes(t)) return <FileText className="h-5 w-5 text-blue-500" />;
  return <FileText className="h-5 w-5 text-indigo-500" />;
}

function badgeClass(fileType: string | null): string {
  const t = fileType?.toLowerCase() ?? "";
  if (t === "pdf") return "bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400 border-0";
  if (["xls", "xlsx"].includes(t)) return "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 border-0";
  if (["jpg", "jpeg", "png"].includes(t)) return "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 border-0";
  if (["doc", "docx"].includes(t)) return "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 border-0";
  return "bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400 border-0";
}

// ── Sort options ──────────────────────────────────────────────────────────────

type SortKey = "newest" | "oldest" | "az" | "za" | "largest";

const SORT_OPTIONS: { key: SortKey; label: string; Icon: React.ComponentType<{ className?: string }> }[] = [
  { key: "newest",  label: "Newest first",  Icon: CalendarArrowDown },
  { key: "oldest",  label: "Oldest first",  Icon: CalendarArrowUp },
  { key: "az",      label: "Name A → Z",    Icon: ArrowDownAZ },
  { key: "za",      label: "Name Z → A",    Icon: ArrowUpZA },
  { key: "largest", label: "Largest first",  Icon: HardDrive },
];

function sortDocs(docs: DocRow[], sort: SortKey): DocRow[] {
  return [...docs].sort((a, b) => {
    switch (sort) {
      case "newest":  return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      case "oldest":  return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
      case "az":      return a.title.localeCompare(b.title);
      case "za":      return b.title.localeCompare(a.title);
      case "largest": return (b.fileSize ?? 0) - (a.fileSize ?? 0);
    }
  });
}

// ── Move-to-collection dropdown ───────────────────────────────────────────────

function MoveToCollectionMenu({
  docId,
  currentCollectionId,
  collections,
}: {
  docId: string;
  currentCollectionId: string | null;
  collections: CollectionItem[];
}) {
  const router = useRouter();

  async function assign(collectionId: string | null) {
    await fetch(`/api/documents/${docId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ collectionId }),
    });
    router.refresh();
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="text-muted-foreground hover:text-violet-600 hover:bg-violet-50 dark:hover:bg-violet-900/20"
          title="Move to collection"
        >
          <Folder className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
        <p className="px-2 py-1.5 text-[10px] font-semibold uppercase text-muted-foreground tracking-wider">
          Move to collection
        </p>
        <DropdownMenuSeparator />
        {collections.map((col) => (
          <DropdownMenuItem
            key={col.id}
            onClick={() => void assign(col.id)}
            className={cn(
              "cursor-pointer gap-2 text-xs",
              currentCollectionId === col.id && "text-violet-600 dark:text-violet-400 font-medium"
            )}
          >
            <span className="h-2.5 w-2.5 rounded-full shrink-0" style={{ backgroundColor: col.color }} />
            {col.name}
          </DropdownMenuItem>
        ))}
        {collections.length === 0 && (
          <p className="px-2 py-2 text-xs text-muted-foreground">No collections yet.</p>
        )}
        {currentCollectionId !== null && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={() => void assign(null)}
              className="cursor-pointer gap-2 text-xs text-muted-foreground"
            >
              <FolderMinus className="h-3.5 w-3.5" />
              Remove from collection
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

// ── Component ─────────────────────────────────────────────────────────────────

export function DocumentList({
  docs,
  collections = [],
  activeCollectionId = null,
}: {
  docs: DocRow[];
  collections?: CollectionItem[];
  activeCollectionId?: string | null;
}) {
  const [search, setSearch] = useState("");
  const [activeGroup, setActiveGroup] = useState<string>("All");
  const [sort, setSort] = useState<SortKey>("newest");

  // Collect which type groups actually exist in the data
  const availableGroups = useMemo(() => {
    const groups = new Set(docs.map((d) => getGroup(d.fileType)));
    return ["All", ...Object.keys(FILE_TYPE_GROUPS).filter((g) => groups.has(g)), ...(groups.has("Other") ? ["Other"] : [])];
  }, [docs]);

  // Count per group (for badges)
  const groupCounts = useMemo(() => {
    const counts: Record<string, number> = { All: docs.length };
    for (const doc of docs) {
      const g = getGroup(doc.fileType);
      counts[g] = (counts[g] ?? 0) + 1;
    }
    return counts;
  }, [docs]);

  const filtered = useMemo(() => {
    const base = docs.filter((doc) => {
      const matchesSearch =
        !search.trim() ||
        doc.title.toLowerCase().includes(search.trim().toLowerCase());
      const matchesGroup =
        activeGroup === "All" || getGroup(doc.fileType) === activeGroup;
      const matchesCollection =
        activeCollectionId === null || doc.collectionId === activeCollectionId;
      return matchesSearch && matchesGroup && matchesCollection;
    });
    return sortDocs(base, sort);
  }, [docs, search, activeGroup, sort, activeCollectionId]);

  const activeSort = SORT_OPTIONS.find((o) => o.key === sort)!;

  if (docs.length === 0) {
    return (
      <Card className="p-12 text-center border-dashed border-2">
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-indigo-50 dark:bg-indigo-900/20 mx-auto mb-4">
          <FileText className="h-8 w-8 text-indigo-400" />
        </div>
        <h2 className="text-lg font-semibold text-foreground mb-2">No documents yet</h2>
        <p className="text-muted-foreground mb-6 max-w-sm mx-auto text-sm">
          Upload your company documents to build your knowledge base.
        </p>
        <Button asChild className="bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-700 hover:to-indigo-700 text-white border-0">
          <Link href="/dashboard/documents/upload">
            <Upload className="mr-2 h-4 w-4" />
            Upload your first document
          </Link>
        </Button>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Search + filter bar */}
      <div className="flex flex-col sm:flex-row gap-3">
        {/* Search */}
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search documents…"
            className="pl-9 pr-9"
          />
          {search && (
            <button
              onClick={() => setSearch("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        {/* Sort dropdown */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" className="h-9 gap-1.5 text-xs shrink-0 border-border/60">
              <activeSort.Icon className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="hidden sm:inline">{activeSort.label}</span>
              <span className="sm:hidden">Sort</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-44">
            {SORT_OPTIONS.map(({ key, label, Icon }) => (
              <DropdownMenuItem
                key={key}
                onClick={() => setSort(key)}
                className={cn("cursor-pointer gap-2 text-xs", sort === key && "text-violet-600 dark:text-violet-400 font-medium")}
              >
                <Icon className="h-3.5 w-3.5" />
                {label}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Type filter pills */}
      <div className="flex items-center gap-1.5 flex-wrap">
        {availableGroups.map((group) => (
          <button
            key={group}
            onClick={() => setActiveGroup(group)}
            className={cn(
              "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-colors cursor-pointer",
              activeGroup === group
                ? "bg-violet-600 text-white shadow-sm shadow-violet-200 dark:shadow-violet-900/40"
                : "bg-muted text-muted-foreground hover:bg-muted/80 hover:text-foreground"
            )}
          >
            {group}
            <span className={cn(
              "inline-flex items-center justify-center h-4 min-w-[1rem] px-1 rounded-full text-[10px] font-semibold",
              activeGroup === group ? "bg-white/20 text-white" : "bg-border text-muted-foreground"
            )}>
              {groupCounts[group] ?? 0}
            </span>
          </button>
        ))}
      </div>

      {/* Result count */}
      {(search || activeGroup !== "All") && (
        <p className="text-sm text-muted-foreground">
          {filtered.length === 0
            ? "No documents match your filters"
            : `${filtered.length} of ${docs.length} document${docs.length !== 1 ? "s" : ""}`}
        </p>
      )}

      {/* Empty filtered state */}
      {filtered.length === 0 && (
        <Card className="p-8 text-center border-dashed">
          <Search className="h-8 w-8 text-muted-foreground/40 mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">No documents match your filters.</p>
          <button
            onClick={() => { setSearch(""); setActiveGroup("All"); }}
            className="mt-2 text-xs text-violet-600 dark:text-violet-400 hover:underline cursor-pointer"
          >
            Clear filters
          </button>
        </Card>
      )}

      {/* Document rows */}
      {filtered.map((doc) => (
        <Card
          key={doc.id}
          className="p-5 hover:shadow-md hover:border-indigo-200 dark:hover:border-indigo-800 transition-all duration-200 border-border/60"
        >
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-start gap-4 min-w-0">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-muted/70 border border-border/50">
                <FileIcon fileType={doc.fileType} />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="font-semibold text-foreground text-sm">{doc.title}</h3>
                  {doc.fileType && (
                    <Badge className={`text-xs font-semibold uppercase ${badgeClass(doc.fileType)}`}>
                      {doc.fileType}
                    </Badge>
                  )}
                </div>
                <div className="flex items-center gap-4 mt-1.5 text-xs text-muted-foreground flex-wrap">
                  <IngestionStatusPill status={doc.status} />
                  {doc.status === "ready" && (
                    <span className="flex items-center gap-1">
                      <Database className="h-3 w-3 text-violet-400" />
                      {Number(doc.chunkCount)} chunk{Number(doc.chunkCount) !== 1 ? "s" : ""}
                    </span>
                  )}
                  {doc.fileSize && <span>{formatFileSize(doc.fileSize)}</span>}
                  <span className="flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    {timeAgo(doc.createdAt)}
                  </span>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-1 shrink-0">
              <Button
                variant="ghost"
                size="sm"
                asChild
                className="text-muted-foreground hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-900/20"
              >
                <Link href={`/dashboard/documents/${doc.id}`}>
                  <Eye className="h-4 w-4" />
                  <span className="ml-1.5 text-xs hidden sm:inline">View</span>
                </Link>
              </Button>
              <MoveToCollectionMenu
                docId={doc.id}
                currentCollectionId={doc.collectionId}
                collections={collections}
              />
              <DeleteDocumentButton documentId={doc.id} />
            </div>
          </div>
        </Card>
      ))}
    </div>
  );
}
