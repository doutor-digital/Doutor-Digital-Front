import { cn, formatNumber, formatPercent } from "@/lib/utils";

export interface FunnelStage {
  label: string;
  count: number;
  tone?: "sky" | "indigo" | "amber" | "emerald" | "teal" | "blue" | "violet";
}

const toneBar: Record<NonNullable<FunnelStage["tone"]>, string> = {
  sky: "from-sky-500/90 to-sky-700/70",
  indigo: "from-indigo-500/90 to-indigo-700/70",
  amber: "from-amber-500/90 to-amber-700/70",
  emerald: "from-emerald-500/90 to-emerald-700/70",
  teal: "from-teal-500/90 to-teal-700/70",
  // aliases legados
  blue: "from-sky-500/90 to-sky-700/70",
  violet: "from-indigo-500/90 to-indigo-700/70",
};

export function FunnelChart({ stages }: { stages: FunnelStage[] }) {
  const max = Math.max(1, ...stages.map((s) => s.count));
  const first = stages[0]?.count || 1;
  return (
    <div className="space-y-2">
      {stages.map((s, i) => {
        const widthPct = Math.max(6, (s.count / max) * 100);
        const convRate = i === 0 ? 100 : (s.count / first) * 100;
        const dropFromPrev =
          i > 0
            ? ((stages[i - 1].count - s.count) / Math.max(1, stages[i - 1].count)) *
              100
            : 0;

        return (
          <div
            key={s.label}
            className="rounded-lg border border-white/[0.06] bg-white/[0.015] p-3 hover:bg-white/[0.02] transition"
          >
            <div className="flex items-center justify-between mb-2 gap-3">
              <span className="text-[13px] text-slate-200 font-medium">
                {s.label}
              </span>
              <div className="flex items-center gap-2 text-[11px]">
                <span className="text-slate-500 uppercase tracking-wider text-[9.5px]">
                  Conv.
                </span>
                <span className="font-semibold tabular-nums text-slate-100">
                  {formatPercent(convRate)}
                </span>
                {i > 0 && (
                  <span
                    className={cn(
                      "inline-flex items-center rounded-md px-1.5 py-0.5 text-[10px] font-medium tabular-nums ring-1 ring-inset",
                      dropFromPrev > 0
                        ? "bg-rose-500/10 text-rose-300 ring-rose-500/20"
                        : "bg-emerald-500/10 text-emerald-300 ring-emerald-500/20",
                    )}
                  >
                    {dropFromPrev > 0 ? "−" : "+"}
                    {Math.abs(dropFromPrev).toFixed(1)}%
                  </span>
                )}
              </div>
            </div>
            <div className="relative h-8 rounded-md bg-white/[0.03] overflow-hidden">
              <div
                className={cn(
                  "absolute inset-y-0 left-0 bg-gradient-to-r rounded-md flex items-center px-3 transition-all",
                  toneBar[s.tone ?? "sky"],
                )}
                style={{ width: `${widthPct}%` }}
              >
                <span className="text-[12px] font-semibold tabular-nums text-slate-50">
                  {formatNumber(s.count)}
                </span>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
