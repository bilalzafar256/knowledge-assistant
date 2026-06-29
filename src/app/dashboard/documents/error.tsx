"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { AlertCircle, RefreshCw, Upload } from "lucide-react";
import Link from "next/link";

export default function DocumentsError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[documents error]", error);
  }, [error]);

  return (
    <div className="flex flex-col items-center justify-center min-h-[400px] p-8 text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-rose-50 dark:bg-rose-900/20 mb-4">
        <AlertCircle className="h-7 w-7 text-rose-500" />
      </div>
      <h2 className="text-lg font-semibold text-foreground mb-2">Documents unavailable</h2>
      <p className="text-sm text-muted-foreground mb-6 max-w-xs">
        {error.message ?? "An error occurred loading your documents."}
      </p>
      <div className="flex items-center gap-3">
        <Button
          onClick={reset}
          className="bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white border-0"
        >
          <RefreshCw className="mr-2 h-4 w-4" />
          Try again
        </Button>
        <Button variant="outline" asChild>
          <Link href="/dashboard/documents/upload">
            <Upload className="mr-2 h-4 w-4" />
            Upload
          </Link>
        </Button>
      </div>
    </div>
  );
}
