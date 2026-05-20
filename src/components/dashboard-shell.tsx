"use client";

import { useState, useEffect } from "react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import { Menu, X, BookOpen } from "lucide-react";

export function DashboardShell({
  sidebar,
  children,
}: {
  sidebar: React.ReactNode;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  // Auto-close drawer on navigation
  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  // Escape key closes drawer
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [open]);

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      {/* Desktop sidebar — always visible */}
      <div className="hidden md:flex shrink-0">{sidebar}</div>

      {/* Right column: mobile header + main content */}
      <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
        {/* Mobile sticky header */}
        <header className="md:hidden flex items-center justify-between h-14 px-4 border-b border-border/40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 shrink-0 z-30">
          <Link href="/dashboard" className="flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-br from-violet-600 to-indigo-600 shadow-sm">
              <BookOpen className="h-3.5 w-3.5 text-white" />
            </div>
            <span className="font-semibold text-sm bg-gradient-to-r from-violet-600 to-indigo-600 bg-clip-text text-transparent">
              Knowledge Assistant
            </span>
          </Link>
          <button
            onClick={() => setOpen(true)}
            className="p-2 rounded-lg hover:bg-muted transition-colors"
            aria-label="Open navigation"
          >
            <Menu className="h-5 w-5 text-foreground" />
          </button>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto min-h-0">
          <div className="h-full">{children}</div>
        </main>
      </div>

      {/* Mobile slide-over drawer */}
      {open && (
        <div className="fixed inset-0 z-50 md:hidden flex">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            onClick={() => setOpen(false)}
          />
          {/* Sidebar panel */}
          <div
            className="relative z-10 shrink-0 h-full shadow-2xl animate-in slide-in-from-left-4 duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            {sidebar}
          </div>
          {/* Close button */}
          <button
            onClick={() => setOpen(false)}
            className="absolute top-3 right-3 z-20 p-1.5 rounded-lg bg-muted/90 hover:bg-muted text-foreground transition-colors"
            aria-label="Close navigation"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}
    </div>
  );
}
