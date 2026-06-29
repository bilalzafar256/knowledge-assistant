"use client";

import { useState, useEffect } from "react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import { Menu, X } from "lucide-react";
import { BrandMark } from "@/components/brand-mark";

export function DashboardShell({
  sidebar,
  children,
}: {
  sidebar: React.ReactNode;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  // Auto-close the mobile drawer whenever the route changes. This is a genuine
  // synchronization of UI state to an external system (the router), so the
  // synchronous setState here is intentional.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
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
    <div className="dark flex h-screen overflow-hidden bg-background text-foreground">
      {/* Desktop sidebar — always visible */}
      <div className="hidden md:flex shrink-0">{sidebar}</div>

      {/* Right column: mobile header + main content */}
      <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
        {/* Mobile sticky header */}
        <header className="md:hidden flex items-center justify-between h-14 px-4 border-b border-border/40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 shrink-0 z-30">
          <Link href="/dashboard">
            <BrandMark />
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
