import { cn } from "@/lib/utils";

/**
 * Shared wordmark — the bordered square + emerald signal dot used on the
 * marketing site, so the dashboard reads as the same product.
 */
export function BrandMark({
  className,
  label = true,
}: {
  className?: string;
  label?: boolean;
}) {
  return (
    <span className={cn("flex items-center gap-2.5", className)}>
      <span className="relative flex h-7 w-7 items-center justify-center">
        <span className="absolute inset-0 rounded-sm border border-emerald-500/40" />
        <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
      </span>
      {label && (
        <span className="text-sm font-medium tracking-tight text-foreground">
          Knowledge Assistant
        </span>
      )}
    </span>
  );
}
