"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Trash2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "@/hooks/use-toast";

export function DeleteDocumentButton({ documentId }: { documentId: string }) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [loading, setLoading] = useState(false);

  // Escape key dismisses the confirmation
  useEffect(() => {
    if (!confirming) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") setConfirming(false);
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [confirming]);

  async function handleDelete() {
    setLoading(true);
    try {
      const res = await fetch(`/api/documents/${documentId}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Delete failed");
      toast({ title: "Document deleted", variant: "default" });
      router.refresh();
    } catch {
      toast({ title: "Failed to delete document", variant: "destructive" });
    } finally {
      setLoading(false);
      setConfirming(false);
    }
  }

  if (confirming) {
    return (
      <div className="flex items-center gap-1.5 rounded-lg border border-rose-200 dark:border-rose-800 bg-rose-50 dark:bg-rose-900/20 px-2.5 py-1">
        <Trash2 className="h-3.5 w-3.5 text-rose-500 shrink-0" />
        <span className="text-xs font-medium text-rose-600 dark:text-rose-400">Delete?</span>
        <Button
          variant="destructive"
          size="sm"
          className="h-6 px-2.5 text-xs font-semibold bg-rose-600 hover:bg-rose-700 border-0 shadow-sm"
          onClick={handleDelete}
          disabled={loading}
        >
          {loading ? <Loader2 className="h-3 w-3 animate-spin" /> : "Yes"}
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className="h-6 px-2.5 text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-muted"
          onClick={() => setConfirming(false)}
          disabled={loading}
        >
          No
        </Button>
      </div>
    );
  }

  return (
    <Button
      variant="ghost"
      size="sm"
      className="cursor-pointer text-muted-foreground hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-900/20 transition-colors"
      onClick={() => setConfirming(true)}
    >
      <Trash2 className="h-4 w-4" />
      <span className="sr-only">Delete</span>
    </Button>
  );
}
