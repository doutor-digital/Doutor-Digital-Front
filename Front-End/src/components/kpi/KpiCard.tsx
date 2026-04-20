import { ReactNode } from "react";
import { TrendingDown, TrendingUp } from "lucide-react";
import { cn, formatNumber } from "@/lib/utils";

// ─── KpiCard (legado) — renderiza agora o visual canônico do Kpi ──────────────
// Mantém a API (label, value, icon, trend, tone, subtitle, loading) para não
// forçar reescrita das páginas; mapeia tones legados para a paleta nova.

type LegacyTone =
  | "neutral"
  | "blue"
  | "green"
  | "amber"
  | "red"
  | "violet"
  | "slate"
  | "sky"
  | "emerald"
  | "rose"
  | "indigo";

const TONE_STYLE: Record<
  LegacyTone,
  { bar: string; icon: string; iconBg: string; value: string }
> = {
  neutral: {
    bar: "bg-gradient-to-r from-slate-400/60 via-slate-300/50 to-slate-400/20",
    icon: "text-slate-300",
    iconBg: "bg-white/[0.04] ring-1 ring-inset ring-white/[0.08]",
    value: "text-slate-50",
  },
  slate: {
    bar: "bg-gradient-to-r from-slate-400/60 via-slate-300/50 to-slate-400/20",
    icon: "text-slate-300",
    iconBg: "bg-white/[0.04] ring-1 ring-inset ring-white/[0.08]",
    value: "text-slate-50",
  },
  sky: {
    bar: "bg-gradient-to-r from-sky-500 via-sky-400 to-sky-500/40",
    icon: "text-sky-300",
    iconBg: "bg-sky-500/10 ring-1 ring-inset ring-sky-500/20",
    value: "text-slate-50",
  },
  blue: {
    bar: "bg-gradient-to-r from-sky-500 via-sky-400 to-sky-500/40",
    icon: "text-sky-300",
    iconBg: "bg-sky-500/10 ring-1 ring-inset ring-sky-500/20",
    value: "text-slate-50",
  },
  emerald: {
    bar: "bg-gradient-to-r from-emerald-500 via-emerald-400 to-emerald-500/40",
    icon: "text-emerald-300",
    iconBg: "bg-emerald-500/10 ring-1 ring-inset ring-emerald-500/20",
    value: "text-slate-50",
  },
  green: {
    bar: "bg-gradient-to-r from-emerald-500 via-emerald-400 to-emerald-500/40",
    icon: "text-emerald-300",
    iconBg: "bg-emerald-500/10 ring-1 ring-inset ring-emerald-500/20",
    value: "text-slate-50",
  },
  amber: {
    bar: "bg-gradient-to-r from-amber-500 via-amber-400 to-amber-500/40",
    icon: "text-amber-300",
    iconBg: "bg-amber-500/10 ring-1 ring-inset ring-amber-500/20",
    value: "text-slate-50",
  },
  rose: {
    bar: "bg-gradient-to-r from-rose-500 via-rose-400 to-rose-500/40",
    icon: "text-rose-300",
    iconBg: "bg-rose-500/10 ring-1 ring-inset ring-rose-500/20",
    value: "text-slate-50",
  },
  red: {
    bar: "bg-gradient-to-r from-rose-500 via-rose-400 to-rose-500/40",
    icon: "text-rose-300",
    iconBg: "bg-rose-500/10 ring-1 ring-inset ring-rose-500/20",
    value: "text-slate-50",
  },
  indigo: {
    bar: "bg-gradient-to-r from-indigo-500 via-indigo-400 to-indigo-500/40",
    icon: "text-indigo-300",
    iconBg: "bg-indigo-500/10 ring-1 ring-inset ring-indigo-500/20",
    value: "text-slate-50",
  },
  violet: {
    bar: "bg-gradient-to-r from-indigo-500 via-indigo-400 to-indigo-500/40",
    icon: "text-indigo-300",
    iconBg: "bg-indigo-500/10 ring-1 ring-inset ring-indigo-500/20",
    value: "text-slate-50",
  },
};

export function KpiCard({
  label,
  value,
  icon,
  trend,
  tone = "neutral",
  subtitle,
  loading,
}: {
  label: string;
  value: number | string;
  icon?: ReactNode;
  trend?: number;
  tone?: LegacyTone;
  subtitle?: string;
  loading?: boolean;
}) {
  const t = TONE_STYLE[tone] ?? TONE_STYLE.neutral;
  const trendUp = trend !== undefined && trend >= 0;

  return (
    <div
      className={cn(
        "group relative rounded-xl border border-white/[0.07] overflow-hidden",
        "bg-gradient-to-b from-white/[0.025] via-white/[0.01] to-transparent",
        "shadow-[0_1px_0_rgba(255,255,255,0.03)_inset,0_1px_2px_rgba(0,0,0,0.25)]",
        "hover:border-white/[0.12] hover:bg-white/[0.025] transition-all",
      )}
    >
      <div className={cn("absolute top-0 left-0 right-0 h-[2px]", t.bar)} />

      <div className="p-5 pt-[22px]">
        <div className="flex items-start justify-between gap-2">
          <p className="text-[10px] font-medium uppercase tracking-[0.22em] text-slate-400">
            {label}
          </p>

          {icon && (
            <div
              className={cn(
                "h-7 w-7 shrink-0 grid place-items-center rounded-md",
                t.iconBg,
                t.icon,
                "[&>svg]:h-4 [&>svg]:w-4",
              )}
            >
              {icon}
            </div>
          )}
        </div>

        {loading ? (
          <div className="mt-3 h-7 w-36 rounded bg-white/[0.04] animate-pulse" />
        ) : (
          <div className="mt-3 flex items-end justify-between gap-2">
            <p
              className={cn(
                "text-[26px] md:text-[28px] font-bold tabular-nums tracking-tight leading-none",
                t.value,
              )}
            >
              {typeof value === "number" ? formatNumber(value) : value}
            </p>

            {trend !== undefined && (
              <span
                className={cn(
                  "mb-0.5 inline-flex items-center gap-0.5 rounded-md px-1.5 py-0.5 text-[10.5px] font-medium tabular-nums ring-1 ring-inset",
                  trendUp
                    ? "bg-emerald-500/10 text-emerald-300 ring-emerald-500/20"
                    : "bg-rose-500/10 text-rose-300 ring-rose-500/20",
                )}
              >
                {trendUp ? (
                  <TrendingUp className="h-2.5 w-2.5 shrink-0" />
                ) : (
                  <TrendingDown className="h-2.5 w-2.5 shrink-0" />
                )}
                {trendUp ? "+" : "−"}
                {Math.abs(trend).toFixed(1)}%
              </span>
            )}
          </div>
        )}

        {subtitle && (
          <p className="mt-3 text-[11px] text-slate-500 leading-snug">
            {subtitle}
          </p>
        )}
      </div>
    </div>
  );
}
