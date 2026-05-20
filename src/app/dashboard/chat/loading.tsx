import { Skeleton } from "@/components/ui/skeleton";

export default function ChatLoading() {
  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="border-b border-border/40 bg-background/95 px-4 md:px-6 py-3 md:py-4 shrink-0 flex items-center gap-3">
        <div className="min-w-0 flex-1 space-y-1.5">
          <Skeleton className="h-5 w-48" />
          <Skeleton className="h-3 w-64 hidden md:block" />
        </div>
        <div className="flex gap-1.5">
          <Skeleton className="h-8 w-20 rounded-md" />
          <Skeleton className="h-8 w-16 rounded-md" />
        </div>
      </div>

      {/* Messages area */}
      <div className="flex-1 p-4 space-y-6 max-w-3xl mx-auto w-full">
        {/* Assistant message */}
        <div className="flex gap-3">
          <Skeleton className="h-8 w-8 rounded-full shrink-0" />
          <div className="space-y-2 flex-1 max-w-xl">
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-4 w-1/2" />
            <Skeleton className="h-4 w-2/3" />
          </div>
        </div>
        {/* User message */}
        <div className="flex gap-3 flex-row-reverse">
          <Skeleton className="h-8 w-8 rounded-full shrink-0" />
          <div className="space-y-2 max-w-sm">
            <Skeleton className="h-10 w-64 rounded-2xl" />
          </div>
        </div>
        {/* Assistant message */}
        <div className="flex gap-3">
          <Skeleton className="h-8 w-8 rounded-full shrink-0" />
          <div className="space-y-2 flex-1 max-w-xl">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-4/5" />
            <Skeleton className="h-4 w-3/5" />
            <Skeleton className="h-4 w-2/3" />
          </div>
        </div>
      </div>

      {/* Input */}
      <div className="border-t border-border p-4">
        <div className="max-w-3xl mx-auto">
          <Skeleton className="h-[52px] w-full rounded-md" />
        </div>
      </div>
    </div>
  );
}
