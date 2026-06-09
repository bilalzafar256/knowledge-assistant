"use client";

import { useState, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Upload,
  FileText,
  CheckCircle2,
  AlertCircle,
  Loader2,
  X,
  FileUp,
  FileImage,
  FileSpreadsheet,
  FileArchive,
} from "lucide-react";
import { cn, formatFileSize } from "@/lib/utils";

// ── Types ─────────────────────────────────────────────────────────────────────

type FileStatus = "queued" | "parsing" | "ready" | "uploading" | "processing" | "done" | "error";

interface FileItem {
  id: string;
  file: File;
  title: string;
  content: string;
  status: FileStatus;
  /** Live sub-step shown while status is "parsing" (e.g. "Reading file…"). */
  progressLabel?: string;
  error?: string;
}

// ── Constants ─────────────────────────────────────────────────────────────────

const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB

const ACCEPTED_TYPES: Record<string, string> = {
  "application/pdf": "PDF",
  "application/msword": "DOC",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "DOCX",
  "application/vnd.ms-excel": "XLS",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": "XLSX",
  "image/jpeg": "JPG",
  "image/png": "PNG",
  "text/plain": "TXT",
  "text/markdown": "MD",
  "application/json": "JSON",
};

const ACCEPTED_EXTENSIONS = ".pdf,.doc,.docx,.xls,.xlsx,.jpg,.jpeg,.png,.txt,.md,.json";

const BINARY_TYPES = new Set([
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "image/jpeg",
  "image/png",
]);

// ── Helpers ───────────────────────────────────────────────────────────────────

function guessMime(filename: string): string {
  const ext = filename.split(".").pop()?.toLowerCase();
  const map: Record<string, string> = {
    pdf: "application/pdf",
    doc: "application/msword",
    docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    xls: "application/vnd.ms-excel",
    xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    png: "image/png",
    txt: "text/plain",
    md: "text/markdown",
    json: "application/json",
  };
  return map[ext ?? ""] ?? "text/plain";
}

function readFileAsText(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => resolve(e.target?.result as string);
    reader.onerror = () => reject(new Error("Failed to read file"));
    reader.readAsText(file);
  });
}

function getFileIcon(mimeType: string) {
  if (mimeType.startsWith("image/")) return FileImage;
  if (mimeType.includes("sheet") || mimeType.includes("excel")) return FileSpreadsheet;
  if (mimeType === "application/pdf") return FileArchive;
  return FileText;
}

const STATUS_LABEL: Record<FileStatus, string> = {
  queued: "Queued",
  parsing: "Extracting text…",
  ready: "Ready",
  uploading: "Uploading…",
  processing: "Indexing…",
  done: "Done",
  error: "Error",
};

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Poll /api/documents/[id]/status until the document is ready or failed.
 * Resolves when status is "ready"; throws when status is "failed".
 * Times out after ~90s (30 × 3s intervals).
 */
async function pollDocumentStatus(documentId: string): Promise<void> {
  const MAX_POLLS = 30;
  const POLL_INTERVAL_MS = 3000;

  for (let i = 0; i < MAX_POLLS; i++) {
    await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
    const res = await fetch(`/api/documents/${documentId}/status`);
    if (!res.ok) continue;
    const data = (await res.json()) as { status: string; errorMessage?: string };
    if (data.status === "ready") return;
    if (data.status === "failed") {
      throw new Error(data.errorMessage ?? "Indexing failed");
    }
  }
  // Timed out — treat as done anyway (background job may still finish)
}

// ── Component ─────────────────────────────────────────────────────────────────

export function DocumentUpload() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [dragActive, setDragActive] = useState(false);
  const [fileQueue, setFileQueue] = useState<FileItem[]>([]);
  const [uploading, setUploading] = useState(false);

  // Paste / manual mode (shown when no files are queued)
  const [manualTitle, setManualTitle] = useState("");
  const [manualContent, setManualContent] = useState("");
  const [manualStatus, setManualStatus] = useState<"idle" | "uploading" | "processing" | "success" | "error">("idle");
  const [manualMessage, setManualMessage] = useState("");

  // ── File queue helpers ──────────────────────────────────────────────────────

  const updateItem = useCallback((id: string, patch: Partial<FileItem>) => {
    setFileQueue((prev) => prev.map((f) => (f.id === id ? { ...f, ...patch } : f)));
  }, []);

  const parseOne = useCallback(
    async (id: string, file: File) => {
      const mime = file.type || guessMime(file.name);
      updateItem(id, { status: "parsing" });

      if (!BINARY_TYPES.has(mime)) {
        try {
          const text = await readFileAsText(file);
          updateItem(id, { content: text, status: "ready" });
        } catch {
          updateItem(id, { status: "error", error: "Could not read file." });
        }
        return;
      }

      try {
        const form = new FormData();
        form.append("file", file);
        const res = await fetch("/api/documents/parse", { method: "POST", body: form });
        if (!res.ok || !res.body) {
          // Non-stream error response (auth/arcjet/validation) is plain JSON.
          const data = (await res.json().catch(() => ({}))) as { error?: string };
          throw new Error(data.error ?? "Failed to extract text");
        }

        // Read the NDJSON stream: one JSON event per line.
        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buf = "";
        let text: string | undefined;
        let streamError: string | undefined;

        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          buf += decoder.decode(value, { stream: true });
          const lines = buf.split("\n");
          buf = lines.pop() ?? ""; // keep any partial trailing line
          for (const line of lines) {
            if (!line.trim()) continue;
            const ev = JSON.parse(line) as {
              stage: string;
              text?: string;
              vision?: boolean;
              error?: string;
            };
            if (ev.stage === "reading") {
              updateItem(id, { progressLabel: "Reading file…" });
            } else if (ev.stage === "extracting") {
              updateItem(id, {
                progressLabel: ev.vision
                  ? "Running OCR on image…"
                  : "Extracting text…",
              });
            } else if (ev.stage === "done") {
              text = ev.text;
            } else if (ev.stage === "error") {
              streamError = ev.error;
            }
          }
        }

        if (streamError || !text) throw new Error(streamError ?? "Failed to extract text");
        updateItem(id, { content: text, status: "ready", progressLabel: undefined });
      } catch (err) {
        updateItem(id, {
          status: "error",
          progressLabel: undefined,
          error: err instanceof Error ? err.message : "Parse failed.",
        });
      }
    },
    [updateItem]
  );

  const addFiles = useCallback(
    (files: File[]) => {
      const toAdd: FileItem[] = [];
      for (const file of files) {
        if (file.size > MAX_FILE_SIZE) continue;
        const mime = file.type || guessMime(file.name);
        if (!ACCEPTED_TYPES[mime]) continue;
        toAdd.push({
          id: crypto.randomUUID(),
          file,
          title: file.name.replace(/\.[^/.]+$/, ""),
          content: "",
          status: "queued",
        });
      }
      if (!toAdd.length) return;
      setFileQueue((prev) => [...prev, ...toAdd]);
      // Parse all new items in parallel
      void Promise.all(toAdd.map((item) => parseOne(item.id, item.file)));
    },
    [parseOne]
  );

  // ── Drag / drop ─────────────────────────────────────────────────────────────

  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(e.type === "dragenter" || e.type === "dragover");
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setDragActive(false);
      addFiles(Array.from(e.dataTransfer.files));
    },
    [addFiles]
  );

  // ── Upload queue ─────────────────────────────────────────────────────────────

  const uploadAll = async () => {
    setUploading(true);

    // Take a snapshot of ready items
    const readyIds = fileQueue
      .filter((f) => f.status === "ready")
      .map((f) => f.id);

    for (const id of readyIds) {
      // Re-read item from the queue at this point
      const item = fileQueue.find((f) => f.id === id);
      if (!item) continue;

      updateItem(id, { status: "uploading" });

      try {
        const docRes = await fetch("/api/documents", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title: item.title.trim() || item.file.name,
            content: item.content.trim(),
            fileType: item.file.name.split(".").pop()?.toLowerCase() ?? "text",
            fileSize: item.file.size,
            metadata: { originalFilename: item.file.name, mimeType: item.file.type },
          }),
        });

        if (!docRes.ok) {
          const e = (await docRes.json()) as { error?: string };
          throw new Error(e.error ?? "Failed to create document");
        }

        const { document: doc } = (await docRes.json()) as { document: { id: string } };

        updateItem(id, { status: "processing" });

        const ingestRes = await fetch("/api/workflows/ingest", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ documentId: doc.id }),
        });

        if (!ingestRes.ok) {
          const e = (await ingestRes.json()) as { error?: string };
          throw new Error(e.error ?? "Failed to index document");
        }

        // Poll the status endpoint until ingestion finishes (background job)
        await pollDocumentStatus(doc.id);

        updateItem(id, { status: "done" });
      } catch (err) {
        updateItem(id, {
          status: "error",
          error: err instanceof Error ? err.message : "Upload failed.",
        });
      }
    }

    setUploading(false);

    // Navigate away if all terminal
    setTimeout(() => {
      const q = fileQueue;
      const allDone = q.every((f) => f.status === "done" || f.status === "error");
      if (allDone && q.some((f) => f.status === "done")) {
        router.push("/dashboard/documents");
        router.refresh();
      }
    }, 1200);
  };

  // ── Manual submit ─────────────────────────────────────────────────────────

  const handleManualSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualTitle.trim() || !manualContent.trim()) return;

    setManualStatus("uploading");
    setManualMessage("Creating document record…");

    try {
      const docRes = await fetch("/api/documents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: manualTitle.trim(),
          content: manualContent.trim(),
          fileType: "text",
          fileSize: manualContent.length,
          metadata: {},
        }),
      });

      if (!docRes.ok) {
        const e = (await docRes.json()) as { error?: string };
        throw new Error(e.error ?? "Failed to create document");
      }

      const { document: doc } = (await docRes.json()) as { document: { id: string } };

      setManualStatus("processing");
      setManualMessage("Chunking and indexing document…");

      const ingestRes = await fetch("/api/workflows/ingest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ documentId: doc.id }),
      });

      if (!ingestRes.ok) {
        const e = (await ingestRes.json()) as { error?: string };
        throw new Error(e.error ?? "Failed to index document");
      }

      // Poll until background ingestion finishes
      await pollDocumentStatus(doc.id);

      setManualStatus("success");
      setManualMessage("Document uploaded and indexed successfully!");

      setTimeout(() => {
        router.push("/dashboard/documents");
        router.refresh();
      }, 1500);
    } catch (err) {
      setManualStatus("error");
      setManualMessage(err instanceof Error ? err.message : "An unexpected error occurred.");
    }
  };

  // ── Derived state ─────────────────────────────────────────────────────────

  const readyCount = fileQueue.filter((f) => f.status === "ready").length;
  const doneCount = fileQueue.filter((f) => f.status === "done").length;
  const errorCount = fileQueue.filter((f) => f.status === "error").length;
  const activeCount = fileQueue.filter(
    (f) => f.status === "uploading" || f.status === "processing" || f.status === "parsing"
  ).length;
  const canUpload = readyCount > 0 && !uploading;

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">
      {/* Drop zone */}
      <Card className="border-border/60">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Upload files</CardTitle>
          <CardDescription>
            Drag and drop one or more files, or click to browse. Max 50MB per file.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div
            onDragEnter={handleDrag}
            onDragLeave={handleDrag}
            onDragOver={handleDrag}
            onDrop={handleDrop}
            onClick={() => !uploading && fileInputRef.current?.click()}
            className={cn(
              "flex flex-col items-center justify-center rounded-xl border-2 border-dashed p-8 text-center transition-colors cursor-pointer",
              dragActive
                ? "border-violet-500 bg-violet-50/60 dark:bg-violet-900/20"
                : "border-border hover:border-violet-400 hover:bg-violet-50/30 dark:hover:bg-violet-900/10",
              uploading && "opacity-50 cursor-not-allowed"
            )}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept={ACCEPTED_EXTENSIONS}
              multiple
              onChange={(e) => { addFiles(Array.from(e.target.files ?? [])); e.target.value = ""; }}
              className="sr-only"
              disabled={uploading}
            />
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-violet-100 dark:bg-violet-900/30 mb-3">
              <FileUp className="h-6 w-6 text-violet-600 dark:text-violet-400" />
            </div>
            <p className="font-medium text-sm text-foreground">
              {dragActive ? "Drop files here" : "Drop files or click to browse"}
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              Multiple files supported
            </p>
            <div className="flex flex-wrap gap-1 mt-3 justify-center">
              {["PDF", "DOC", "DOCX", "XLS", "XLSX", "JPG", "PNG", "TXT"].map((ext) => (
                <Badge
                  key={ext}
                  className="text-xs bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-400 border-0"
                >
                  {ext}
                </Badge>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* File queue */}
      {fileQueue.length > 0 && (
        <Card className="border-border/60">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">
                Files{" "}
                <span className="text-muted-foreground font-normal text-sm">
                  ({fileQueue.length})
                </span>
              </CardTitle>
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                {doneCount > 0 && (
                  <span className="text-emerald-600 dark:text-emerald-400 font-medium">
                    {doneCount} indexed
                  </span>
                )}
                {errorCount > 0 && (
                  <span className="text-rose-600 dark:text-rose-400 font-medium">
                    {errorCount} failed
                  </span>
                )}
                {activeCount > 0 && (
                  <span className="text-violet-600 dark:text-violet-400 font-medium flex items-center gap-1">
                    <Loader2 className="h-3 w-3 animate-spin" />
                    {activeCount} active
                  </span>
                )}
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-2">
            {fileQueue.map((item) => {
              const Icon = getFileIcon(item.file.type || guessMime(item.file.name));
              return (
                <div
                  key={item.id}
                  className={cn(
                    "flex items-start gap-3 rounded-lg border p-3 transition-colors",
                    item.status === "done" && "border-emerald-200 bg-emerald-50/50 dark:border-emerald-800 dark:bg-emerald-900/10",
                    item.status === "error" && "border-rose-200 bg-rose-50/50 dark:border-rose-800 dark:bg-rose-900/10",
                    item.status === "ready" && "border-border/60",
                    (item.status === "queued" || item.status === "parsing" || item.status === "uploading" || item.status === "processing") && "border-violet-200/60 bg-violet-50/30 dark:border-violet-800/40 dark:bg-violet-900/10"
                  )}
                >
                  {/* Icon */}
                  <div className={cn(
                    "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg",
                    item.status === "done" ? "bg-emerald-100 dark:bg-emerald-900/30" :
                    item.status === "error" ? "bg-rose-100 dark:bg-rose-900/30" :
                    "bg-violet-100 dark:bg-violet-900/30"
                  )}>
                    {item.status === "done" ? (
                      <CheckCircle2 className="h-4.5 w-4.5 text-emerald-600" />
                    ) : item.status === "error" ? (
                      <AlertCircle className="h-4.5 w-4.5 text-rose-600" />
                    ) : item.status === "parsing" || item.status === "uploading" || item.status === "processing" ? (
                      <Loader2 className="h-4.5 w-4.5 text-violet-600 animate-spin" />
                    ) : (
                      <Icon className="h-4.5 w-4.5 text-violet-600 dark:text-violet-400" />
                    )}
                  </div>

                  {/* Name + title edit */}
                  <div className="flex-1 min-w-0">
                    <input
                      value={item.title}
                      onChange={(e) => updateItem(item.id, { title: e.target.value })}
                      disabled={uploading || item.status === "done"}
                      className="w-full text-sm font-medium text-foreground bg-transparent border-0 outline-none focus:ring-1 focus:ring-violet-400 rounded px-0.5 disabled:cursor-default"
                      title="Click to rename"
                    />
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-xs text-muted-foreground">
                        {formatFileSize(item.file.size)}
                      </span>
                      <StatusChip status={item.status} label={item.progressLabel} />
                      {item.error && (
                        <span className="text-xs text-rose-600 truncate">{item.error}</span>
                      )}
                    </div>
                  </div>

                  {/* Remove */}
                  {!uploading && item.status !== "done" && (
                    <button
                      onClick={() => setFileQueue((prev) => prev.filter((f) => f.id !== item.id))}
                      className="shrink-0 rounded p-1 text-muted-foreground hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-900/20 transition-colors cursor-pointer"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              );
            })}

            {/* Upload button */}
            <div className="flex items-center gap-3 pt-2">
              <Button
                onClick={() => void uploadAll()}
                disabled={!canUpload}
                className="bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-700 hover:to-indigo-700 text-white border-0 shadow-sm"
              >
                {uploading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Uploading…
                  </>
                ) : (
                  <>
                    <Upload className="mr-2 h-4 w-4" />
                    Upload{readyCount > 1 ? ` ${readyCount} files` : " file"}
                  </>
                )}
              </Button>
              {!uploading && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setFileQueue([])}
                  className="text-muted-foreground hover:text-foreground"
                >
                  Clear all
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Manual paste — only shown when no files queued */}
      {fileQueue.length === 0 && (
        <>
          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t border-border/40" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-background px-2 text-muted-foreground">Or paste content</span>
            </div>
          </div>

          <form onSubmit={handleManualSubmit}>
            <Card className="border-border/60">
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Paste document text</CardTitle>
                <CardDescription>
                  Manually enter a title and paste your document content
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-1.5">
                  <label htmlFor="doc-title" className="text-sm font-medium text-foreground">
                    Title <span className="text-destructive">*</span>
                  </label>
                  <Input
                    id="doc-title"
                    value={manualTitle}
                    onChange={(e) => setManualTitle(e.target.value)}
                    placeholder="e.g. Employee Handbook 2026"
                    disabled={manualStatus === "uploading" || manualStatus === "processing"}
                    maxLength={200}
                  />
                </div>

                <div className="space-y-1.5">
                  <label htmlFor="doc-content" className="text-sm font-medium text-foreground">
                    Content <span className="text-destructive">*</span>
                  </label>
                  <Textarea
                    id="doc-content"
                    value={manualContent}
                    onChange={(e) => setManualContent(e.target.value)}
                    placeholder="Paste your document content here…"
                    disabled={manualStatus === "uploading" || manualStatus === "processing"}
                    className="min-h-[200px] font-mono text-xs"
                    maxLength={2_000_000}
                  />
                  <p className="text-xs text-muted-foreground">
                    {manualContent.length.toLocaleString()} characters
                  </p>
                </div>

                {/* Status */}
                {manualMessage && (
                  <div
                    className={cn(
                      "flex items-start gap-3 p-3 rounded-lg border text-sm",
                      manualStatus === "error" &&
                        "bg-rose-50 border-rose-200 text-rose-700 dark:bg-rose-900/20 dark:border-rose-800 dark:text-rose-400",
                      manualStatus === "success" &&
                        "bg-emerald-50 border-emerald-200 text-emerald-700 dark:bg-emerald-900/20 dark:border-emerald-800 dark:text-emerald-400",
                      (manualStatus === "uploading" || manualStatus === "processing") &&
                        "bg-violet-50 border-violet-200 text-violet-700 dark:bg-violet-900/20 dark:border-violet-800 dark:text-violet-400"
                    )}
                  >
                    {manualStatus === "error" && <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />}
                    {manualStatus === "success" && <CheckCircle2 className="h-4 w-4 shrink-0 mt-0.5" />}
                    {(manualStatus === "uploading" || manualStatus === "processing") && (
                      <Loader2 className="h-4 w-4 shrink-0 mt-0.5 animate-spin" />
                    )}
                    {manualMessage}
                  </div>
                )}

                <Button
                  type="submit"
                  disabled={
                    !manualTitle.trim() ||
                    !manualContent.trim() ||
                    manualStatus === "uploading" ||
                    manualStatus === "processing"
                  }
                  className="bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-700 hover:to-indigo-700 text-white border-0"
                >
                  {manualStatus === "uploading" || manualStatus === "processing" ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      {manualStatus === "processing" ? "Indexing…" : "Uploading…"}
                    </>
                  ) : (
                    <>
                      <Upload className="mr-2 h-4 w-4" />
                      Upload & Index
                    </>
                  )}
                </Button>
              </CardContent>
            </Card>
          </form>
        </>
      )}
    </div>
  );
}

// ── Status chip ───────────────────────────────────────────────────────────────

function StatusChip({ status, label }: { status: FileStatus; label?: string }) {
  const styles: Record<FileStatus, string> = {
    queued: "bg-muted text-muted-foreground",
    parsing: "bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-400",
    ready: "bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400",
    uploading: "bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-400",
    processing: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
    done: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400",
    error: "bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400",
  };
  return (
    <span className={cn("inline-flex items-center rounded-full px-1.5 py-0.5 text-[10px] font-semibold", styles[status])}>
      {label ?? STATUS_LABEL[status]}
    </span>
  );
}
