import { cn } from "@/lib/utils";

/**
 * Skeletons que espelham a estrutura do componente final.
 * Evitam "flash" de conteúdo e dão sensação de carregamento ordenado.
 */

export function Shimmer({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "relative overflow-hidden rounded bg-white/[0.04]",
        "before:absolute before:inset-0 before:-translate-x-full before:animate-[shimmer_1.5s_infinite]",
        "before:bg-gradient-to-r before:from-transparent before:via-white/[0.06] before:to-transparent",
        className,
      )}
    />
  );
}

export function KpiSkeleton({ count = 4 }: { count?: number }) {
  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-2 xl:grid-cols-4">
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className="relative overflow-hidden rounded-xl border border-white/[0.07] bg-white/[0.01] p-5"
        >
          <div className="absolute inset-x-0 top-0 h-[2px] bg-white/[0.04]" />
          <Shimmer className="h-3 w-20" />
          <Shimmer className="mt-4 h-7 w-28" />
          <Shimmer className="mt-3 h-3 w-32" />
        </div>
      ))}
    </div>
  );
}

export function CardSkeleton({ rows = 3 }: { rows?: number }) {
  return (
    <div className="space-y-2.5 rounded-xl border border-white/[0.07] bg-white/[0.01] p-5">
      <Shimmer className="h-4 w-1/3" />
      <Shimmer className="h-3 w-2/3" />
      {Array.from({ length: rows }).map((_, i) => (
        <Shimmer key={i} className="h-3 w-full" />
      ))}
    </div>
  );
}

export function TableSkeleton({
  rows = 6, cols = 5,
}: {
  rows?: number;
  cols?: number;
}) {
  return (
    <div className="overflow-hidden rounded-xl border border-white/[0.07] bg-white/[0.01]">
      <div className="flex gap-4 border-b border-white/[0.05] px-5 py-3">
        {Array.from({ length: cols }).map((_, i) => (
          <Shimmer key={i} className="h-3 flex-1" />
        ))}
      </div>
      <div className="divide-y divide-white/[0.04]">
        {Array.from({ length: rows }).map((_, r) => (
          <div key={r} className="flex gap-4 px-5 py-3">
            {Array.from({ length: cols }).map((_, c) => (
              <Shimmer key={c} className="h-3 flex-1" />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

export function ChartSkeleton({ height = 280 }: { height?: number }) {
  return (
    <div
      className="relative overflow-hidden rounded-xl border border-white/[0.07] bg-white/[0.01] p-5"
      style={{ height }}
    >
      <Shimmer className="h-3 w-1/4" />
      <div className="absolute inset-x-5 bottom-5 flex items-end gap-2" style={{ height: height - 60 }}>
        {Array.from({ length: 12 }).map((_, i) => (
          <Shimmer
            key={i}
            className="flex-1 rounded-md"
            // altura pseudo-aleatória determinística
            style={{ height: `${30 + ((i * 37) % 60)}%` }}
          />
        ))}
      </div>
    </div>
  );
}
