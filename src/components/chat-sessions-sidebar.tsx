"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";
import { Plus, MessageSquare, Trash2, Loader2, Pencil, Check, X, Pin, PinOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { toast } from "@/hooks/use-toast";

interface ChatSession {
  id: string;
  title: string;
  pinned: boolean;
  isShared: boolean;
  updatedAt: string;
  messageCount: number;
}

export function ChatSessionsSidebar() {
  const router = useRouter();
  const pathname = usePathname();
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [togglingPinId, setTogglingPinId] = useState<string | null>(null);

  // Confirm-delete dialog
  const [confirmDelete, setConfirmDelete] = useState<ChatSession | null>(null);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const editInputRef = useRef<HTMLInputElement>(null);

  const activeId = pathname.startsWith("/dashboard/chat/")
    ? pathname.split("/dashboard/chat/")[1]
    : undefined;

  const fetchSessions = useCallback(async () => {
    try {
      const res = await fetch("/api/chat/sessions");
      const data = (await res.json()) as { sessions: ChatSession[] };
      setSessions(data.sessions ?? []);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void fetchSessions(); }, [fetchSessions]);

  const createSession = useCallback(async () => {
    if (creating) return;
    setCreating(true);
    try {
      const res = await fetch("/api/chat/sessions", { method: "POST" });
      const data = (await res.json()) as { session: ChatSession };
      setSessions((prev) => [{ ...data.session, messageCount: 0 }, ...prev]);
      router.push(`/dashboard/chat/${data.session.id}`);
    } catch {
      toast({ title: "Failed to create chat", variant: "destructive" });
    } finally {
      setCreating(false);
    }
  }, [creating, router]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        void createSession();
      }
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [createSession]);

  // Called after user confirms in the dialog
  async function deleteSession(id: string, title: string) {
    setDeletingId(id);
    setConfirmDelete(null);
    try {
      const res = await fetch(`/api/chat/sessions/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Delete failed");
      setSessions((prev) => prev.filter((s) => s.id !== id));
      if (activeId === id) router.push("/dashboard/chat");
      toast({ title: "Conversation deleted", description: title, variant: "default" });
    } catch {
      toast({ title: "Failed to delete conversation", variant: "destructive" });
    } finally {
      setDeletingId(null);
    }
  }

  async function togglePin(id: string, currentPinned: boolean, e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    setTogglingPinId(id);
    try {
      const res = await fetch(`/api/chat/sessions/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pinned: !currentPinned }),
      });
      if (!res.ok) throw new Error();
      setSessions((prev) =>
        [...prev.map((s) => s.id === id ? { ...s, pinned: !currentPinned } : s)]
          .sort((a, b) => {
            if (a.pinned !== b.pinned) return b.pinned ? 1 : -1;
            return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
          })
      );
      toast({
        title: currentPinned ? "Unpinned" : "Pinned",
        description: currentPinned ? "Conversation removed from pinned." : "Conversation pinned to top.",
        variant: "success",
      });
    } catch {
      toast({ title: "Failed to update pin", variant: "destructive" });
    } finally {
      setTogglingPinId(null);
    }
  }

  function startEdit(session: ChatSession, e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    setEditingId(session.id);
    setEditTitle(session.title);
    setTimeout(() => editInputRef.current?.focus(), 0);
  }

  async function saveEdit(id: string) {
    const trimmed = editTitle.trim();
    if (!trimmed) { setEditingId(null); return; }
    try {
      const res = await fetch(`/api/chat/sessions/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: trimmed }),
      });
      if (!res.ok) throw new Error();
      setSessions((prev) => prev.map((s) => s.id === id ? { ...s, title: trimmed } : s));
      toast({ title: "Renamed", description: trimmed, variant: "success" });
    } catch {
      toast({ title: "Failed to rename conversation", variant: "destructive" });
    } finally {
      setEditingId(null);
    }
  }

  function cancelEdit() { setEditingId(null); setEditTitle(""); }

  function handleEditKeyDown(e: React.KeyboardEvent, id: string) {
    if (e.key === "Enter") { e.preventDefault(); void saveEdit(id); }
    else if (e.key === "Escape") { e.preventDefault(); cancelEdit(); }
  }

  const pinned = sessions.filter((s) => s.pinned);
  const recent = sessions.filter((s) => !s.pinned);

  return (
    <>
      {/* Confirm-delete dialog */}
      <Dialog open={!!confirmDelete} onOpenChange={(open) => { if (!open) setConfirmDelete(null); }}>
        <DialogContent className="max-w-sm p-0 overflow-hidden gap-0">
          {/* Red accent strip */}
          <div className="h-1.5 w-full bg-gradient-to-r from-rose-500 to-rose-600 rounded-t-xl" />

          <div className="p-6">
            <DialogHeader className="items-center text-center space-y-3">
              {/* Icon */}
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-rose-100 dark:bg-rose-900/30 ring-8 ring-rose-50 dark:ring-rose-900/10">
                <Trash2 className="h-6 w-6 text-rose-600 dark:text-rose-400" />
              </div>

              <DialogTitle className="text-lg">Delete conversation?</DialogTitle>

              <DialogDescription asChild>
                <div className="space-y-2 text-sm">
                  <div className="rounded-lg bg-muted/60 border border-border/60 px-3 py-2.5 text-foreground font-medium text-left truncate">
                    {confirmDelete?.title}
                  </div>
                  <p className="text-muted-foreground text-xs leading-relaxed">
                    All messages in this conversation will be permanently removed.
                    This action cannot be undone.
                  </p>
                </div>
              </DialogDescription>
            </DialogHeader>

            <DialogFooter className="mt-6 flex-row gap-2">
              <Button
                variant="outline"
                onClick={() => setConfirmDelete(null)}
                className="flex-1"
              >
                Cancel
              </Button>
              <Button
                onClick={() => {
                  if (confirmDelete) void deleteSession(confirmDelete.id, confirmDelete.title);
                }}
                disabled={!!deletingId}
                className="flex-1 bg-rose-600 hover:bg-rose-700 text-white border-0 shadow-sm shadow-rose-200 dark:shadow-rose-900/30"
              >
                {deletingId
                  ? <Loader2 className="h-4 w-4 animate-spin" />
                  : <><Trash2 className="h-4 w-4 mr-1.5" />Delete</>
                }
              </Button>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>

      <div className="flex flex-col w-full md:w-60 shrink-0 border-r border-border/40 bg-sidebar-background h-full">
        {/* New Chat */}
        <div className="p-3 border-b border-border/40">
          <Button
            onClick={() => void createSession()}
            disabled={creating}
            size="sm"
            className="w-full bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-700 hover:to-indigo-700 text-white border-0 shadow-sm"
            title="New chat (⌘K)"
          >
            {creating ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" /> : <Plus className="h-3.5 w-3.5 mr-1.5" />}
            New Chat
            <kbd className="ml-auto hidden sm:inline-flex h-5 items-center gap-0.5 rounded border border-white/20 bg-white/10 px-1.5 text-[10px] font-medium opacity-70">
              ⌘K
            </kbd>
          </Button>
        </div>

        {/* Sessions */}
        <div className="flex-1 overflow-y-auto p-2">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
            </div>
          ) : sessions.length === 0 ? (
            <p className="px-3 py-6 text-xs text-center text-muted-foreground">
              No conversations yet.
              <br />
              Press{" "}
              <kbd className="inline-flex h-4 items-center rounded border border-border px-1 text-[10px]">⌘K</kbd>{" "}
              or click &quot;New Chat&quot;.
            </p>
          ) : (
            <>
              {pinned.length > 0 && (
                <div className="mb-2">
                  <p className="px-3 py-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/60">
                    Pinned
                  </p>
                  <div className="space-y-0.5">
                    {pinned.map((s) => (
                      <SessionRow
                        key={s.id}
                        session={s}
                        activeId={activeId}
                        editingId={editingId}
                        editTitle={editTitle}
                        editInputRef={editInputRef}
                        deletingId={deletingId}
                        togglingPinId={togglingPinId}
                        onStartEdit={startEdit}
                        onSaveEdit={saveEdit}
                        onCancelEdit={cancelEdit}
                        onEditKeyDown={handleEditKeyDown}
                        onSetEditTitle={setEditTitle}
                        onRequestDelete={(session) => setConfirmDelete(session)}
                        onTogglePin={togglePin}
                      />
                    ))}
                  </div>
                </div>
              )}

              {recent.length > 0 && (
                <div>
                  {pinned.length > 0 && (
                    <p className="px-3 py-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/60">
                      Recent
                    </p>
                  )}
                  <div className="space-y-0.5">
                    {recent.map((s) => (
                      <SessionRow
                        key={s.id}
                        session={s}
                        activeId={activeId}
                        editingId={editingId}
                        editTitle={editTitle}
                        editInputRef={editInputRef}
                        deletingId={deletingId}
                        togglingPinId={togglingPinId}
                        onStartEdit={startEdit}
                        onSaveEdit={saveEdit}
                        onCancelEdit={cancelEdit}
                        onEditKeyDown={handleEditKeyDown}
                        onSetEditTitle={setEditTitle}
                        onRequestDelete={(session) => setConfirmDelete(session)}
                        onTogglePin={togglePin}
                      />
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </>
  );
}

// ── Session row ───────────────────────────────────────────────────────────────

interface SessionRowProps {
  session: ChatSession;
  activeId?: string;
  editingId: string | null;
  editTitle: string;
  editInputRef: React.RefObject<HTMLInputElement | null>;
  deletingId: string | null;
  togglingPinId: string | null;
  onStartEdit: (s: ChatSession, e: React.MouseEvent) => void;
  onSaveEdit: (id: string) => Promise<void>;
  onCancelEdit: () => void;
  onEditKeyDown: (e: React.KeyboardEvent, id: string) => void;
  onSetEditTitle: (v: string) => void;
  onRequestDelete: (session: ChatSession) => void;
  onTogglePin: (id: string, pinned: boolean, e: React.MouseEvent) => Promise<void>;
}

function SessionRow({
  session, activeId, editingId, editTitle, editInputRef,
  deletingId, togglingPinId,
  onStartEdit, onSaveEdit, onCancelEdit, onEditKeyDown, onSetEditTitle,
  onRequestDelete, onTogglePin,
}: SessionRowProps) {
  const isActive = activeId === session.id;
  const isEditing = editingId === session.id;

  return (
    <div
      className={cn(
        "group relative flex items-center gap-2 rounded-lg px-3 py-2 text-sm transition-colors",
        isActive
          ? "bg-violet-100 dark:bg-violet-900/30 text-violet-700 dark:text-violet-300"
          : "text-foreground/70 hover:bg-muted/60 hover:text-foreground"
      )}
    >
      {isEditing ? (
        <div className="flex items-center gap-1 flex-1 min-w-0">
          <input
            ref={editInputRef}
            value={editTitle}
            onChange={(e) => onSetEditTitle(e.target.value)}
            onKeyDown={(e) => onEditKeyDown(e, session.id)}
            onBlur={() => void onSaveEdit(session.id)}
            className="flex-1 min-w-0 rounded border border-violet-300 dark:border-violet-700 bg-background px-2 py-0.5 text-xs text-foreground outline-none focus:ring-1 focus:ring-violet-400"
          />
          <button
            onMouseDown={(e) => { e.preventDefault(); void onSaveEdit(session.id); }}
            className="shrink-0 text-violet-500 hover:text-violet-700 cursor-pointer"
          >
            <Check className="h-3.5 w-3.5" />
          </button>
          <button
            onMouseDown={(e) => { e.preventDefault(); onCancelEdit(); }}
            className="shrink-0 text-muted-foreground hover:text-foreground cursor-pointer"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      ) : (
        <>
          <Link href={`/dashboard/chat/${session.id}`} className="flex items-center gap-2 flex-1 min-w-0">
            {session.pinned ? (
              <Pin className="h-3.5 w-3.5 shrink-0 text-violet-400" />
            ) : (
              <MessageSquare className={cn("h-3.5 w-3.5 shrink-0", isActive ? "text-violet-500" : "text-muted-foreground")} />
            )}
            <span className="flex-1 truncate text-xs leading-relaxed">{session.title}</span>
            {session.isShared && (
              <span className="shrink-0 h-1.5 w-1.5 rounded-full bg-emerald-400" title="Shared" />
            )}
          </Link>

          {/* Hover actions */}
          <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
            <button
              onClick={(e) => onStartEdit(session, e)}
              className="rounded p-0.5 hover:text-violet-500 hover:bg-violet-100 dark:hover:bg-violet-900/30 cursor-pointer transition-colors"
              title="Rename"
            >
              <Pencil className="h-3 w-3" />
            </button>
            <button
              onClick={(e) => void onTogglePin(session.id, session.pinned, e)}
              disabled={togglingPinId === session.id}
              className="rounded p-0.5 hover:text-amber-500 hover:bg-amber-50 dark:hover:bg-amber-900/30 cursor-pointer transition-colors"
              title={session.pinned ? "Unpin" : "Pin to top"}
            >
              {togglingPinId === session.id ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : session.pinned ? (
                <PinOff className="h-3 w-3" />
              ) : (
                <Pin className="h-3 w-3" />
              )}
            </button>
            <button
              onClick={(e) => { e.preventDefault(); e.stopPropagation(); onRequestDelete(session); }}
              disabled={deletingId === session.id}
              className="rounded p-0.5 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-900/30 cursor-pointer transition-colors"
              title="Delete"
            >
              {deletingId === session.id ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : (
                <Trash2 className="h-3 w-3" />
              )}
            </button>
          </div>
        </>
      )}
    </div>
  );
}
