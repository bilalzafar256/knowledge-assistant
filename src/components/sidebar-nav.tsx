"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { UserButton } from "@clerk/nextjs";
import {
  LayoutDashboard,
  MessageSquare,
  FileText,
  Upload,
  Settings,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { BrandMark } from "@/components/brand-mark";

interface NavItem {
  href: string;
  label: string;
  icon: React.ElementType;
  exact?: boolean;
}

const navItems: NavItem[] = [
  {
    href: "/dashboard",
    label: "Overview",
    icon: LayoutDashboard,
    exact: true,
  },
  {
    href: "/dashboard/chat",
    label: "Chat",
    icon: MessageSquare,
  },
  {
    href: "/dashboard/documents",
    label: "Documents",
    icon: FileText,
  },
  {
    href: "/dashboard/documents/upload",
    label: "Upload",
    icon: Upload,
  },
];

interface SidebarNavProps {
  user: {
    name: string;
    email: string;
    imageUrl?: string;
  };
}

export function SidebarNav({ user }: SidebarNavProps) {
  const pathname = usePathname();

  const isActive = (item: NavItem) => {
    if (item.exact) return pathname === item.href;
    // Exact match for upload to avoid Documents also being highlighted
    if (item.href === "/dashboard/documents/upload") return pathname === item.href || pathname.startsWith("/dashboard/documents/upload/");
    // For /dashboard/documents, only match if NOT on the upload sub-route
    if (item.href === "/dashboard/documents") return pathname.startsWith(item.href) && !pathname.startsWith("/dashboard/documents/upload");
    return pathname.startsWith(item.href);
  };

  return (
    <aside className="flex w-64 flex-col border-r border-sidebar-border bg-sidebar-background text-sidebar-foreground shrink-0">
      {/* Logo / Brand */}
      <div className="px-5 py-4 border-b border-sidebar-border">
        <BrandMark />
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-1">
        <p className="px-2 mb-2 text-xs font-medium text-sidebar-foreground/50 uppercase tracking-wider">
          Navigation
        </p>
        {navItems.map((item) => {
          const Icon = item.icon;
          const active = isActive(item);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                active
                  ? "bg-emerald-500/15 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300"
                  : "text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"
              )}
            >
              <Icon
                className={cn(
                  "h-4 w-4 shrink-0",
                  active
                    ? "text-emerald-600 dark:text-emerald-400"
                    : "text-sidebar-foreground/50"
                )}
              />
              {item.label}
            </Link>
          );
        })}
      </nav>

      {/* Bottom section: User + Settings */}
      <div className="border-t border-sidebar-border p-3 space-y-1">
        <Link
          href="/dashboard/settings"
          className={cn(
            "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
            pathname === "/dashboard/settings"
              ? "bg-emerald-500/15 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300"
              : "text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"
          )}
        >
          <Settings className={cn("h-4 w-4", pathname === "/dashboard/settings" ? "text-emerald-600 dark:text-emerald-400" : "text-sidebar-foreground/50")} />
          Settings
        </Link>

        {/* User profile */}
        <div className="flex items-center gap-3 px-3 py-2 rounded-lg">
          <UserButton
            appearance={{
              variables: {
                colorPrimary: "#34d399",
                colorBackground: "#101216",
                colorText: "#e9ecef",
                colorTextSecondary: "#9aa1ab",
                colorInputBackground: "#161a1f",
                colorInputText: "#e9ecef",
                borderRadius: "0.25rem",
              },
              elements: {
                avatarBox: "h-7 w-7",
                userButtonPopoverCard: "border border-white/10",
              },
            }}
          />
          <div className="min-w-0">
            <p className="text-sm font-medium text-sidebar-foreground truncate">
              {user.name}
            </p>
            <p className="text-xs text-sidebar-foreground/50 truncate">
              {user.email}
            </p>
          </div>
        </div>
      </div>
    </aside>
  );
}
