"use client";

import { usePathname } from "next/navigation";
import { ChatSessionsSidebar } from "@/components/chat-sessions-sidebar";
import { cn } from "@/lib/utils";

export default function ChatLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  // True when on a specific session: /dashboard/chat/[id]
  const isOnSession = pathname !== "/dashboard/chat";

  return (
    <div className="flex h-full overflow-hidden">
      {/* Sessions sidebar:
          - Mobile: full-width on /dashboard/chat, hidden on /dashboard/chat/[id]
          - Desktop: always visible at 240px */}
      <div
        className={cn(
          "h-full shrink-0",
          isOnSession
            ? "hidden md:flex md:w-60"
            : "flex w-full md:w-60"
        )}
      >
        <ChatSessionsSidebar />
      </div>

      {/* Chat content:
          - Mobile: hidden on /dashboard/chat, full-width on /dashboard/chat/[id]
          - Desktop: always flex-1 */}
      <div
        className={cn(
          "min-w-0 h-full overflow-hidden",
          isOnSession ? "flex flex-col flex-1" : "hidden md:flex md:flex-col md:flex-1"
        )}
      >
        {children}
      </div>
    </div>
  );
}
