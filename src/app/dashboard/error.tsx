"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { AlertCircle, RefreshCw, Home } from "lucide-react";
import Link from "next/link";

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[dashboard error]", error);
  }, [error]);

  return (
    <div className="flex flex-col items-center justify-center min-h-[400px] p-8 text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-rose-50 dark:bg-rose-900/20 mb-5">
        <AlertCircle className="h-8 w-8 text-rose-500" />
      </div>
      <h2 className="text-xl font-semibold text-foreground mb-2">Something went wrong</h2>
      <p className="text-sm text-muted-foreground mb-6 max-w-sm">
        {error.message ?? "An unexpected error occurred. Please try again."}
      </p>
      <div className="flex items-center gap-3">
        <Button
          onClick={reset}
          className="bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-700 hover:to-indigo-700 text-white border-0"
        >
          <RefreshCw className="mr-2 h-4 w-4" />
          Try again
        </Button>
        <Button variant="outline" asChild>
          <Link href="/dashboard">
            <Home className="mr-2 h-4 w-4" />
            Dashboard
          </Link>
        </Button>
      </div>
      {error.digest && (
        <p className="mt-4 text-xs text-muted-foreground/60">
          Error ID: {error.digest}
        </p>
      )}
    </div>
  );
}
