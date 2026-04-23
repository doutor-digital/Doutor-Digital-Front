import { ReactNode } from "react";
import { TrendingDown, TrendingUp } from "lucide-react";
import { Sparkline } from "@/components/ui/Sparkline";
import { cn, formatNumber } from "@/lib/utils";

type Tone = "sky" | "emerald" | "amber" | "rose" | "indigo" | "slate";

const TONE: Record<Tone, { bar: string; icon: string; spark: string; value: string }> = {
  sky:     { bar: "from-sky-500 via-sky-400 to-sky-500/40",           icon: "text-sky-300 bg-sky-500/10 ring-sky-500/20",         spark: "text-sky-400",     value: "text-slate-50" },
  emerald: { bar: "from-emerald-500 via-emerald-400 to-emerald-500/40",icon: "text-emerald-300 bg-emerald-500/10 ring-emerald-500/20",spark:"text-emerald-400", value: "text-slate-50" },
  amber:   { bar: "from-amber-500 via-amber-400 to-amber-500/40",     icon: "text-amber-300 bg-amber-500/10 ring-amber-500/20",    spark: "text-amber-400",   value: "text-slate-50" },
  rose:    { bar: "from-rose-500 via-rose-400 to-rose-500/40",        icon: "text-rose-300 bg-rose-500/10 ring-rose-500/20",       spark: "text-rose-400",    value: "text-slate-50" },
  indigo:  { bar: "from-indigo-500 via-indigo-400 to-indigo-500/40",  icon: "text-indigo-300 bg-indigo-500/10 ring-indigo-500/20", spark: "text-indigo-400",  value: "text-slate-50" },
  slate:   { bar: "from-slate-400 via-slate-300 to-slate-500/40",     icon: "text-slate-300 bg-white/[0.04] ring-white/[0.08]",    spark: "text-slate-400",   value: "text-slate-50" },
};

/**
 * KPI com mini-gráfico ao lado do número.
 * Não substitui KpiCard — é variação opcional pra páginas que querem trend visual.
 */
export function SparklineKpi({
  label, value, icon, tone = "slate", trend, subtitle, series, loading,
}: {
  label: string;
  value: number | string;
  icon?: ReactNode;
  tone?: Tone;
  trend?: number;
  subtitle?: string;
  series?: number[];
  loading?: boolean;
}) {
  const t = TONE[tone] ?? TONE.slate;
  const trendUp = trend !== undefined && trend >= 0;

  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-xl border border-white/[0.07]",
        "bg-gradient-to-b from-white/[0.025] via-white/[0.01] to-transparent",
        "shadow-[0_1px_0_rgba(255,255,255,0.03)_inset,0_1px_2px_rgba(0,0,0,0.25)]",
        "hover:border-white/[0.12] transition-all",
      )}
    >
      <div className={cn("absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r", t.bar)} />
      <div className="p-5 pt-[22px]">
        <div className="flex items-start justify-between gap-2">
          <p className="text-[10px] font-medium uppercase tracking-[0.22em] text-slate-400">
            {label}
          </p>
          {icon && (
            <div className={cn("h-7 w-7 shrink-0 grid place-items-center rounded-md ring-1 ring-inset [&>svg]:h-4 [&>svg]:w-4", t.icon)}>
              {icon}
            </div>
          )}
        </div>

        {loading ? (
          <div className="mt-3 h-7 w-36 rounded bg-white/[0.04] animate-pulse" />
        ) : (
          <div className="mt-3 flex items-end justify-between gap-3">
            <div className="min-w-0 flex-1">
              <p className={cn("text-[26px] md:text-[28px] font-bold tabular-nums tracking-tight leading-none", t.value)}>
                {typeof value === "number" ? formatNumber(value) : value}
              </p>
              {trend !== undefined && (
                <span
                  className={cn(
                    "mt-2 inline-flex items-center gap-0.5 rounded-md px-1.5 py-0.5 text-[10.5px] font-medium tabular-nums ring-1 ring-inset",
                    trendUp
                      ? "bg-emerald-500/10 text-emerald-300 ring-emerald-500/20"
                      : "bg-rose-500/10 text-rose-300 ring-rose-500/20",
                  )}
                >
                  {trendUp ? <TrendingUp className="h-2.5 w-2.5" /> : <TrendingDown className="h-2.5 w-2.5" />}
                  {trendUp ? "+" : "−"}{Math.abs(trend).toFixed(1)}%
                </span>
              )}
            </div>

            {series && series.length > 0 && (
              <div className={cn("flex items-end", t.spark)}>
                <Sparkline data={series} width={88} height={30} />
              </div>
            )}
          </div>
        )}

        {subtitle && (
          <p className="mt-3 text-[11px] text-slate-500 leading-snug">{subtitle}</p>
        )}
      </div>
    </div>
  );
}
