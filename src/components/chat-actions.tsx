"use client";

import { useState } from "react";
import { toast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Download,
  Printer,
  Share2,
  Copy,
  Check,
  Link2Off,
  Loader2,
  ChevronDown,
} from "lucide-react";

interface SimpleMessage {
  role: "user" | "assistant";
  content: string;
}

interface ChatActionsProps {
  sessionId: string;
  title: string;
  messages: SimpleMessage[];
  isShared: boolean;
  shareId: string | null;
  appUrl: string;
}

export function ChatActions({
  sessionId,
  title,
  messages,
  isShared: initialIsShared,
  shareId: initialShareId,
  appUrl,
}: ChatActionsProps) {
  const [isShared, setIsShared] = useState(initialIsShared);
  const [shareId, setShareId] = useState<string | null>(initialShareId);
  const [sharing, setSharing] = useState(false);
  const [copied, setCopied] = useState(false);

  const shareUrl = shareId ? `${appUrl}/share/${shareId}` : null;

  // ── Export ──────────────────────────────────────────────────────────────────

  function exportMarkdown() {
    const lines = [
      `# ${title}`,
      `*Exported from Knowledge Assistant — ${new Date().toLocaleDateString()}*`,
      "",
    ];
    for (const msg of messages) {
      if (!msg.content) continue;
      lines.push(`## ${msg.role === "user" ? "You" : "Assistant"}`);
      lines.push(msg.content);
      lines.push("");
    }
    const blob = new Blob([lines.join("\n")], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${title.replace(/[^a-z0-9]/gi, "-").toLowerCase()}.md`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function printAsPDF() {
    const html = `<!DOCTYPE html>
<html>
<head>
  <title>${title}</title>
  <meta charset="utf-8" />
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: system-ui, sans-serif; max-width: 800px; margin: 0 auto; padding: 2rem; color: #111; line-height: 1.6; }
    h1 { font-size: 1.5rem; font-weight: 700; color: #5b21b6; margin-bottom: 0.25rem; }
    .meta { font-size: 0.75rem; color: #6b7280; margin-bottom: 2rem; }
    .msg { margin-bottom: 1.25rem; }
    .role { font-size: 0.75rem; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 0.4rem; }
    .user .role { color: #7c3aed; }
    .assistant .role { color: #4f46e5; }
    .bubble { padding: 0.75rem 1rem; border-radius: 0.75rem; font-size: 0.9rem; white-space: pre-wrap; }
    .user .bubble { background: #f3f0ff; border: 1px solid #ddd6fe; }
    .assistant .bubble { background: #f9fafb; border: 1px solid #e5e7eb; }
    @media print { body { padding: 1rem; } }
  </style>
</head>
<body>
  <h1>${title}</h1>
  <div class="meta">Exported from Knowledge Assistant · ${new Date().toLocaleDateString()}</div>
  ${messages
    .filter((m) => m.content)
    .map(
      (m) => `
    <div class="msg ${m.role}">
      <div class="role">${m.role === "user" ? "You" : "Assistant"}</div>
      <div class="bubble">${m.content.replace(/</g, "&lt;").replace(/>/g, "&gt;")}</div>
    </div>`
    )
    .join("")}
  <script>window.onload = () => window.print();<\/script>
</body>
</html>`;
    const blob = new Blob([html], { type: "text/html" });
    const url = URL.createObjectURL(blob);
    window.open(url, "_blank");
    setTimeout(() => URL.revokeObjectURL(url), 60000);
  }

  // ── Share ───────────────────────────────────────────────────────────────────

  async function enableSharing() {
    setSharing(true);
    try {
      const res = await fetch(`/api/chat/sessions/${sessionId}/share`, {
        method: "POST",
      });
      if (!res.ok) throw new Error("Failed to generate share link");
      const data = (await res.json()) as { shareId: string };
      setShareId(data.shareId);
      setIsShared(true);
      toast({ title: "Share link created", description: "Anyone with the link can view this conversation.", variant: "success" });
    } catch {
      toast({ title: "Failed to create share link", variant: "destructive" });
    } finally {
      setSharing(false);
    }
  }

  async function revokeSharing() {
    setSharing(true);
    try {
      const res = await fetch(`/api/chat/sessions/${sessionId}/share`, { method: "DELETE" });
      if (!res.ok) throw new Error();
      setIsShared(false);
      toast({ title: "Sharing revoked", description: "The share link is no longer active.", variant: "default" });
    } catch {
      toast({ title: "Failed to revoke sharing", variant: "destructive" });
    } finally {
      setSharing(false);
    }
  }

  async function copyLink() {
    if (!shareUrl) return;
    await navigator.clipboard.writeText(shareUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="flex items-center gap-1.5">
      {/* Export dropdown */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            className="text-muted-foreground hover:text-foreground h-8 px-2.5 gap-1"
            title="Export conversation"
          >
            <Download className="h-3.5 w-3.5" />
            <span className="hidden sm:inline text-xs">Export</span>
            <ChevronDown className="h-3 w-3 opacity-50" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-44">
          <DropdownMenuItem onClick={exportMarkdown} className="cursor-pointer gap-2">
            <Download className="h-3.5 w-3.5 text-indigo-500" />
            <span>Markdown (.md)</span>
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={printAsPDF} className="cursor-pointer gap-2">
            <Printer className="h-3.5 w-3.5 text-violet-500" />
            <span>Print / PDF</span>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Share popover */}
      <Popover>
        <PopoverTrigger asChild>
          <Button
            variant={isShared ? "outline" : "ghost"}
            size="sm"
            className={`h-8 px-2.5 gap-1 ${
              isShared
                ? "border-violet-300 dark:border-violet-700 text-violet-600 dark:text-violet-400"
                : "text-muted-foreground hover:text-foreground"
            }`}
            title="Share conversation"
          >
            <Share2 className="h-3.5 w-3.5" />
            <span className="hidden sm:inline text-xs">
              {isShared ? "Shared" : "Share"}
            </span>
          </Button>
        </PopoverTrigger>
        <PopoverContent align="end" className="w-80 p-4">
          <h4 className="font-semibold text-sm mb-1">Share conversation</h4>
          <p className="text-xs text-muted-foreground mb-4">
            Anyone with the link can view this conversation in read-only mode.
          </p>

          {isShared && shareUrl ? (
            <div className="space-y-3">
              <div className="flex items-center gap-2 p-2 rounded-lg bg-muted/50 border border-border/60">
                <span className="text-xs text-muted-foreground truncate flex-1 font-mono">
                  {shareUrl}
                </span>
                <button
                  onClick={() => void copyLink()}
                  className="shrink-0 p-1 rounded hover:bg-muted transition-colors cursor-pointer"
                  title="Copy link"
                >
                  {copied ? (
                    <Check className="h-3.5 w-3.5 text-emerald-500" />
                  ) : (
                    <Copy className="h-3.5 w-3.5 text-muted-foreground" />
                  )}
                </button>
              </div>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  onClick={() => void copyLink()}
                  className="flex-1 bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-700 hover:to-indigo-700 text-white border-0 h-8 text-xs"
                >
                  {copied ? <Check className="h-3.5 w-3.5 mr-1.5" /> : <Copy className="h-3.5 w-3.5 mr-1.5" />}
                  {copied ? "Copied!" : "Copy link"}
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => void revokeSharing()}
                  disabled={sharing}
                  className="h-8 text-xs text-rose-600 border-rose-200 hover:bg-rose-50 dark:border-rose-800 dark:hover:bg-rose-900/20"
                >
                  {sharing ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Link2Off className="h-3.5 w-3.5" />
                  )}
                </Button>
              </div>
            </div>
          ) : (
            <Button
              onClick={() => void enableSharing()}
              disabled={sharing}
              className="w-full bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-700 hover:to-indigo-700 text-white border-0 h-9"
            >
              {sharing ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <Share2 className="h-4 w-4 mr-2" />
              )}
              Generate share link
            </Button>
          )}
        </PopoverContent>
      </Popover>
    </div>
  );
}
