"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, Save, Settings2, RotateCcw, CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "@/hooks/use-toast";

// ── Presets ───────────────────────────────────────────────────────────────────

const PRESETS = [
  {
    label: "Default",
    description: "General-purpose documents",
    chunkSize: 500,
    chunkOverlap: 50,
    color: "violet",
  },
  {
    label: "Legal / Policy",
    description: "Dense formal text, long clauses",
    chunkSize: 800,
    chunkOverlap: 100,
    color: "indigo",
  },
  {
    label: "Code / Technical",
    description: "Source code, specs, short snippets",
    chunkSize: 300,
    chunkOverlap: 30,
    color: "sky",
  },
  {
    label: "Dense Knowledge",
    description: "Research papers, handbooks",
    chunkSize: 1000,
    chunkOverlap: 150,
    color: "emerald",
  },
] as const;

type PresetColor = "violet" | "indigo" | "sky" | "emerald";

const PRESET_COLORS: Record<PresetColor, string> = {
  violet: "border-violet-300 bg-violet-50 text-violet-700 dark:border-violet-700 dark:bg-violet-900/20 dark:text-violet-300",
  indigo:  "border-indigo-300 bg-indigo-50 text-indigo-700 dark:border-indigo-700 dark:bg-indigo-900/20 dark:text-indigo-300",
  sky:     "border-sky-300 bg-sky-50 text-sky-700 dark:border-sky-700 dark:bg-sky-900/20 dark:text-sky-300",
  emerald: "border-emerald-300 bg-emerald-50 text-emerald-700 dark:border-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-300",
};

// ── Component ─────────────────────────────────────────────────────────────────

interface RagSettingsFormProps {
  initialChunkSize: number;
  initialChunkOverlap: number;
}

export function RagSettingsForm({ initialChunkSize, initialChunkOverlap }: RagSettingsFormProps) {
  const [chunkSize, setChunkSize] = useState(initialChunkSize);
  const [chunkOverlap, setChunkOverlap] = useState(initialChunkOverlap);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const isDirty = chunkSize !== initialChunkSize || chunkOverlap !== initialChunkOverlap;
  const activePreset = PRESETS.find(
    (p) => p.chunkSize === chunkSize && p.chunkOverlap === chunkOverlap
  );

  async function handleSave() {
    setSaving(true);
    try {
      const res = await fetch("/api/settings/rag", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chunkSize, chunkOverlap }),
      });
      if (!res.ok) {
        const data = (await res.json()) as { error?: string };
        throw new Error(data.error ?? "Failed to save");
      }
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
      toast({ title: "Settings saved", description: "New chunk settings will apply to future uploads.", variant: "success" });
    } catch (err) {
      toast({ title: "Failed to save settings", description: err instanceof Error ? err.message : "An error occurred.", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card className="border-border/60 shadow-sm">
      <CardHeader className="pb-4">
        <CardTitle className="text-base flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-violet-100 dark:bg-violet-900/30">
            <Settings2 className="h-4 w-4 text-violet-600 dark:text-violet-400" />
          </div>
          Knowledge Base Settings
        </CardTitle>
        <CardDescription>
          Controls how documents are split into chunks when indexed. Changes apply to
          newly uploaded documents — re-upload existing documents to re-index with new settings.
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* Preset buttons */}
        <div>
          <p className="text-sm font-medium text-foreground mb-3">Quick presets</p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {PRESETS.map((preset) => {
              const isActive = preset.chunkSize === chunkSize && preset.chunkOverlap === chunkOverlap;
              return (
                <button
                  key={preset.label}
                  onClick={() => { setChunkSize(preset.chunkSize); setChunkOverlap(preset.chunkOverlap); }}
                  className={cn(
                    "rounded-xl border p-3 text-left transition-all cursor-pointer hover:shadow-sm",
                    isActive
                      ? PRESET_COLORS[preset.color as PresetColor]
                      : "border-border/60 hover:border-violet-300 dark:hover:border-violet-700"
                  )}
                >
                  <p className="text-xs font-semibold">{preset.label}</p>
                  <p className="text-[10px] text-muted-foreground mt-0.5 leading-relaxed">{preset.description}</p>
                  <p className="text-[10px] font-mono mt-1.5 opacity-70">{preset.chunkSize}/{preset.chunkOverlap}</p>
                </button>
              );
            })}
          </div>
        </div>

        {/* Chunk Size slider */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label className="text-sm font-medium text-foreground">
              Chunk size
              <span className="ml-2 text-xs text-muted-foreground font-normal">(tokens)</span>
            </label>
            <div className="flex items-center gap-2">
              {activePreset && (
                <Badge className="text-[10px] bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-400 border-0">
                  {activePreset.label}
                </Badge>
              )}
              <span className="text-sm font-semibold text-foreground tabular-nums w-12 text-right">
                {chunkSize}
              </span>
            </div>
          </div>
          <input
            type="range"
            min={100}
            max={2000}
            step={50}
            value={chunkSize}
            onChange={(e) => {
              const v = Number(e.target.value);
              setChunkSize(v);
              if (chunkOverlap >= v) setChunkOverlap(Math.max(0, v - 50));
            }}
            className="w-full accent-violet-600"
          />
          <div className="flex justify-between text-[10px] text-muted-foreground">
            <span>100 — fine-grained</span>
            <span>2000 — broad context</span>
          </div>
          <p className="text-xs text-muted-foreground">
            Smaller chunks give more precise retrieval; larger chunks preserve more surrounding context per result.
          </p>
        </div>

        {/* Chunk Overlap slider */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label className="text-sm font-medium text-foreground">
              Chunk overlap
              <span className="ml-2 text-xs text-muted-foreground font-normal">(tokens)</span>
            </label>
            <span className="text-sm font-semibold text-foreground tabular-nums w-12 text-right">
              {chunkOverlap}
            </span>
          </div>
          <input
            type="range"
            min={0}
            max={Math.max(0, chunkSize - 50)}
            step={10}
            value={chunkOverlap}
            onChange={(e) => setChunkOverlap(Number(e.target.value))}
            className="w-full accent-violet-600"
          />
          <div className="flex justify-between text-[10px] text-muted-foreground">
            <span>0 — no overlap</span>
            <span>{Math.max(0, chunkSize - 50)} — max</span>
          </div>
          <p className="text-xs text-muted-foreground">
            Overlap tokens are repeated at the start of the next chunk so sentences split at a boundary still match.
          </p>
        </div>

        {/* Preview */}
        <div className="rounded-xl bg-muted/50 border border-border/60 p-4 text-xs font-mono space-y-1">
          <p className="text-muted-foreground font-sans font-medium text-xs mb-2">Preview</p>
          <p><span className="text-violet-600">chunkSize</span>    = <span className="text-foreground">{chunkSize}</span> tokens (~{Math.round(chunkSize * 4)} chars)</p>
          <p><span className="text-indigo-600">chunkOverlap</span> = <span className="text-foreground">{chunkOverlap}</span> tokens (~{Math.round(chunkOverlap * 4)} chars)</p>
          <p><span className="text-muted-foreground">wordsPerChunk</span> ≈ <span className="text-foreground">{Math.floor(chunkSize * 0.75)}</span> words</p>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-3 pt-1">
          <Button
            onClick={() => void handleSave()}
            disabled={saving || !isDirty}
            className="bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-700 hover:to-indigo-700 text-white border-0"
          >
            {saving ? (
              <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Saving…</>
            ) : saved ? (
              <><CheckCircle2 className="h-4 w-4 mr-2 text-emerald-300" />Saved!</>
            ) : (
              <><Save className="h-4 w-4 mr-2" />Save settings</>
            )}
          </Button>
          {isDirty && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => { setChunkSize(initialChunkSize); setChunkOverlap(initialChunkOverlap); }}
              className="text-muted-foreground hover:text-foreground"
            >
              <RotateCcw className="h-3.5 w-3.5 mr-1.5" />
              Reset
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
