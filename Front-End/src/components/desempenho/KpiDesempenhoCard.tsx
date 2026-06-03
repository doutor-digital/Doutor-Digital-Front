import type { ComponentType, SVGProps } from "react";
import { cn } from "@/lib/utils";

type IconType = ComponentType<SVGProps<SVGSVGElement>>;

/**
 * Card de KPI do dashboard de desempenho. Apenas apresentacional — recebe o valor
 * já formatado. `destaque` aplica o realce verde (usado no ROAS).
 */
export function KpiDesempenhoCard({
  label,
  value,
  hint,
  icon: Icon,
  destaque = false,
  valueClass,
}: {
  label: string;
  value: string;
  hint?: string;
  icon?: IconType;
  destaque?: boolean;
  valueClass?: string;
}) {
  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-2xl p-5 transition",
        destaque
          ? "border border-emerald-400/30 bg-emerald-500/[0.07] ring-1 ring-emerald-400/20 shadow-[0_0_0_1px_rgba(16,185,129,0.06),0_8px_30px_-12px_rgba(16,185,129,0.35)]"
          : "border border-white/10 bg-white/5",
      )}
      style={destaque ? undefined : { borderTop: "3px solid rgba(255,255,255,0.08)" }}
    >
      {destaque && (
        <div className="pointer-events-none absolute -right-8 -top-8 h-24 w-24 rounded-full bg-emerald-400/[0.12] blur-2xl" />
      )}
      <div className="relative flex items-start justify-between gap-2">
        <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-white/55">
          {label}
        </p>
        {Icon && (
          <Icon
            className={cn(
              "h-4 w-4 shrink-0",
              destaque ? "text-emerald-300" : "text-white/30",
            )}
          />
        )}
      </div>
      <p
        className={cn(
          "relative mt-3 font-semibold tabular-nums leading-none",
          destaque ? "text-3xl text-emerald-300" : "text-2xl text-white",
          valueClass,
        )}
      >
        {value}
      </p>
      {hint && <p className="relative mt-2 text-[11px] text-white/40">{hint}</p>}
    </div>
  );
}
