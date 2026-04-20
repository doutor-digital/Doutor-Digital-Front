import { cn } from "@/lib/utils";

export type KpiTone = "emerald" | "sky" | "amber" | "slate" | "rose" | "indigo";

export const KPI_TONE: Record<
  KpiTone,
  { bar: string; icon: string; iconBg: string }
> = {
  emerald: {
    bar: "bg-gradient-to-r from-emerald-500 via-emerald-400 to-emerald-500/40",
    icon: "text-emerald-300",
    iconBg: "bg-emerald-500/10 ring-1 ring-inset ring-emerald-500/20",
  },
  sky: {
    bar: "bg-gradient-to-r from-sky-500 via-sky-400 to-sky-500/40",
    icon: "text-sky-300",
    iconBg: "bg-sky-500/10 ring-1 ring-inset ring-sky-500/20",
  },
  amber: {
    bar: "bg-gradient-to-r from-amber-500 via-amber-400 to-amber-500/40",
    icon: "text-amber-300",
    iconBg: "bg-amber-500/10 ring-1 ring-inset ring-amber-500/20",
  },
  slate: {
    bar: "bg-gradient-to-r from-slate-400/60 via-slate-300/50 to-slate-400/20",
    icon: "text-slate-300",
    iconBg: "bg-white/[0.04] ring-1 ring-inset ring-white/[0.08]",
  },
  rose: {
    bar: "bg-gradient-to-r from-rose-500 via-rose-400 to-rose-500/40",
    icon: "text-rose-300",
    iconBg: "bg-rose-500/10 ring-1 ring-inset ring-rose-500/20",
  },
  indigo: {
    bar: "bg-gradient-to-r from-indigo-500 via-indigo-400 to-indigo-500/40",
    icon: "text-indigo-300",
    iconBg: "bg-indigo-500/10 ring-1 ring-inset ring-indigo-500/20",
  },
};

export function Kpi({
  label,
  value,
  hint,
  tone,
  icon,
  loading,
}: {
  label: string;
  value: string;
  hint?: string;
  tone: KpiTone;
  icon?: React.ReactNode;
  loading?: boolean;
}) {
  const t = KPI_TONE[tone];
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
              )}
            >
              {icon}
            </div>
          )}
        </div>

        {loading ? (
          <div className="mt-3 h-7 w-36 rounded bg-white/[0.04] animate-pulse" />
        ) : (
          <p className="mt-3 text-[26px] md:text-[28px] font-bold tabular-nums tracking-tight text-slate-50 leading-none">
            {value}
          </p>
        )}

        {hint && (
          <p className="mt-3 text-[11px] text-slate-500 leading-snug">{hint}</p>
        )}
      </div>
    </div>
  );
}
