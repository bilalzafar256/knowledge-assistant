"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "@/hooks/use-toast";

export function ReindexDocumentButton({ documentId }: { documentId: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function handleReindex() {
    setLoading(true);
    try {
      const res = await fetch("/api/workflows/ingest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ documentId }),
      });

      if (!res.ok) {
        const data = (await res.json()) as { error?: string };
        throw new Error(data.error ?? "Re-index failed");
      }

      const data = (await res.json()) as { mode?: string };
      toast({
        title: "Re-indexing started",
        description:
          data.mode === "background"
            ? "Document is being re-indexed in the background."
            : "Document has been re-indexed with your current chunk settings.",
        variant: "success",
      });
      router.refresh();
    } catch (err) {
      toast({
        title: "Re-index failed",
        description: err instanceof Error ? err.message : "An error occurred.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={() => void handleReindex()}
      disabled={loading}
      className="gap-1.5 text-xs border-violet-200 text-violet-700 hover:bg-violet-50 dark:border-violet-800 dark:text-violet-400 dark:hover:bg-violet-900/20"
    >
      <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
      {loading ? "Re-indexing…" : "Re-index"}
    </Button>
  );
}
