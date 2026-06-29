import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { MessageSquare } from "lucide-react";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Chat" };

export default async function ChatPage() {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");

  return (
    <div className="h-full flex flex-col items-center justify-center text-center px-6">
      <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 shadow-lg shadow-teal-200/50 dark:shadow-teal-900/40 mb-5">
        <MessageSquare className="h-8 w-8 text-white" />
      </div>
      <h2 className="text-xl font-semibold bg-gradient-to-r from-emerald-600 to-teal-600 bg-clip-text text-transparent mb-2">
        Your conversations
      </h2>
      <p className="text-sm text-muted-foreground max-w-xs">
        Select a conversation from the sidebar, or click{" "}
        <span className="font-medium text-emerald-600 dark:text-emerald-400">
          New Chat
        </span>{" "}
        to start a fresh one.
      </p>
    </div>
  );
}
