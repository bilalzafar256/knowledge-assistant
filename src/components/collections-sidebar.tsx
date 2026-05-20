"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Folder, FolderOpen, Plus, MoreHorizontal, Pencil, Trash2, Layers } from "lucide-react";
import { useRouter } from "next/navigation";

// ── Types ──────────────────────────────────────────────────────────────────────

export interface CollectionItem {
  id: string;
  name: string;
  color: string;
  description: string | null;
}

interface Props {
  collections: CollectionItem[];
  activeCollectionId: string | null;
  onSelect: (id: string | null) => void;
  docCounts: Record<string, number>;
  totalDocs: number;
}

// ── Color palette ─────────────────────────────────────────────────────────────

const COLORS = [
  "#6366f1", // indigo
  "#8b5cf6", // violet
  "#ec4899", // pink
  "#f59e0b", // amber
  "#10b981", // emerald
  "#3b82f6", // blue
  "#ef4444", // red
  "#14b8a6", // teal
];

// ── Create / rename dialog ────────────────────────────────────────────────────

function CollectionDialog({
  trigger,
  initialName = "",
  initialColor = "#6366f1",
  initialDescription = "",
  title,
  onSave,
}: {
  trigger: React.ReactNode;
  initialName?: string;
  initialColor?: string;
  initialDescription?: string;
  title: string;
  onSave: (name: string, color: string, description: string) => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(initialName);
  const [color, setColor] = useState(initialColor);
  const [description, setDescription] = useState(initialDescription);
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    if (!name.trim()) return;
    setSaving(true);
    try {
      await onSave(name.trim(), color, description.trim());
      setOpen(false);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (v) { setName(initialName); setColor(initialColor); setDescription(initialDescription); } }}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 pt-2">
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Name</label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Engineering, Marketing…"
              maxLength={80}
              onKeyDown={(e) => { if (e.key === "Enter") void handleSave(); }}
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Description <span className="text-muted-foreground font-normal">(optional)</span></label>
            <Input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What docs belong here?"
              maxLength={200}
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Color</label>
            <div className="flex gap-2 flex-wrap">
              {COLORS.map((c) => (
                <button
                  key={c}
                  onClick={() => setColor(c)}
                  className={cn(
                    "h-6 w-6 rounded-full border-2 transition-all cursor-pointer",
                    color === c ? "border-foreground scale-110" : "border-transparent opacity-70 hover:opacity-100"
                  )}
                  style={{ backgroundColor: c }}
                />
              ))}
            </div>
          </div>
          <div className="flex gap-2 pt-1">
            <Button
              onClick={() => void handleSave()}
              disabled={!name.trim() || saving}
              className="flex-1 bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-700 hover:to-indigo-700 text-white border-0"
            >
              {saving ? "Saving…" : "Save"}
            </Button>
            <Button variant="outline" onClick={() => setOpen(false)} className="flex-1">
              Cancel
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ── Main sidebar component ────────────────────────────────────────────────────

export function CollectionsSidebar({
  collections,
  activeCollectionId,
  onSelect,
  docCounts,
  totalDocs,
}: Props) {
  const router = useRouter();

  async function createCollection(name: string, color: string, description: string) {
    await fetch("/api/collections", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, color, description }),
    });
    router.refresh();
  }

  async function renameCollection(id: string, name: string, color: string, description: string) {
    await fetch(`/api/collections/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, color, description }),
    });
    router.refresh();
  }

  async function deleteCollection(id: string) {
    await fetch(`/api/collections/${id}`, { method: "DELETE" });
    if (activeCollectionId === id) onSelect(null);
    router.refresh();
  }

  return (
    <div className="space-y-1">
      {/* All documents */}
      <button
        onClick={() => onSelect(null)}
        className={cn(
          "w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors cursor-pointer",
          activeCollectionId === null
            ? "bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-300"
            : "text-muted-foreground hover:bg-muted hover:text-foreground"
        )}
      >
        <Layers className="h-4 w-4 shrink-0" />
        <span className="flex-1 text-left truncate">All documents</span>
        <span className="text-xs tabular-nums opacity-70">{totalDocs}</span>
      </button>

      {/* Collection rows */}
      {collections.map((col) => {
        const isActive = activeCollectionId === col.id;
        return (
          <div key={col.id} className="group relative flex items-center">
            <button
              onClick={() => onSelect(col.id)}
              className={cn(
                "flex-1 flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors cursor-pointer pr-8",
                isActive
                  ? "bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-300"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              )}
            >
              {isActive
                ? <FolderOpen className="h-4 w-4 shrink-0" style={{ color: col.color }} />
                : <Folder className="h-4 w-4 shrink-0" style={{ color: col.color }} />
              }
              <span className="flex-1 text-left truncate">{col.name}</span>
              <span className="text-xs tabular-nums opacity-70">{docCounts[col.id] ?? 0}</span>
            </button>

            {/* Actions menu */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="absolute right-1 p-1 rounded opacity-0 group-hover:opacity-100 focus:opacity-100 text-muted-foreground hover:text-foreground transition-opacity cursor-pointer">
                  <MoreHorizontal className="h-3.5 w-3.5" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-44">
                <CollectionDialog
                  title="Rename collection"
                  initialName={col.name}
                  initialColor={col.color}
                  initialDescription={col.description ?? ""}
                  onSave={(name, color, description) => renameCollection(col.id, name, color, description)}
                  trigger={
                    <DropdownMenuItem
                      onSelect={(e) => e.preventDefault()}
                      className="cursor-pointer gap-2 text-xs"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                      Rename
                    </DropdownMenuItem>
                  }
                />
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={() => void deleteCollection(col.id)}
                  className="cursor-pointer gap-2 text-xs text-rose-600 focus:text-rose-600"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  Delete collection
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        );
      })}

      {/* New collection */}
      <CollectionDialog
        title="New collection"
        onSave={createCollection}
        trigger={
          <button className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm text-muted-foreground hover:bg-muted hover:text-foreground transition-colors cursor-pointer">
            <Plus className="h-4 w-4 shrink-0" />
            New collection
          </button>
        }
      />
    </div>
  );
}
