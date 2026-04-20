import { cn } from "@/lib/utils";

export function Skeleton({ className }: { className?: string }) {
  return (
    <div
      className={cn("h-4 w-full rounded bg-white/[0.04] animate-pulse", className)}
    />
  );
}

export function CardSkeleton({ lines = 3 }: { lines?: number }) {
  return (
    <div className="rounded-xl border border-white/[0.07] bg-gradient-to-b from-white/[0.02] to-white/[0.005] shadow-[0_1px_0_rgba(255,255,255,0.03)_inset] p-5 space-y-3">
      <Skeleton className="h-5 w-40" />
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton key={i} className="h-3" />
      ))}
    </div>
  );
}
