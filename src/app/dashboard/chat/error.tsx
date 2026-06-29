"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { AlertCircle, RefreshCw, Plus } from "lucide-react";

export default function ChatError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[chat error]", error);
  }, [error]);

  return (
    <div className="flex flex-col items-center justify-center h-full min-h-[400px] p-8 text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-rose-50 dark:bg-rose-900/20 mb-4">
        <AlertCircle className="h-7 w-7 text-rose-500" />
      </div>
      <h2 className="text-lg font-semibold text-foreground mb-2">Chat unavailable</h2>
      <p className="text-sm text-muted-foreground mb-6 max-w-xs">
        {error.message ?? "An error occurred loading this conversation."}
      </p>
      <div className="flex items-center gap-3">
        <Button
          onClick={reset}
          className="bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white border-0"
        >
          <RefreshCw className="mr-2 h-4 w-4" />
          Try again
        </Button>
        <Button
          variant="outline"
          onClick={() => {
            void fetch("/api/chat/sessions", { method: "POST" })
              .then((r) => r.json())
              .then((d: { session?: { id: string } }) => {
                if (d.session?.id) window.location.href = `/dashboard/chat/${d.session.id}`;
              });
          }}
        >
          <Plus className="mr-2 h-4 w-4" />
          New chat
        </Button>
      </div>
    </div>
  );
}
