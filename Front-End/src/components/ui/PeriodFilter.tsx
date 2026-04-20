import { Calendar } from "lucide-react";
import { cn } from "@/lib/utils";

export function todayIso(offset = 0) {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  return d.toISOString().slice(0, 10);
}

export function ytdFrom() {
  const d = new Date();
  return `${d.getFullYear()}-01-01`;
}

export const PERIOD_PRESETS: Array<{ key: string; label: string; from: string }> = [
  { key: "7d", label: "7 dias", from: todayIso(-7) },
  { key: "30d", label: "30 dias", from: todayIso(-30) },
  { key: "90d", label: "90 dias", from: todayIso(-90) },
  { key: "ytd", label: "Este ano", from: ytdFrom() },
];

export function PeriodFilter({
  activePreset,
  onPreset,
  className,
}: {
  activePreset?: string;
  onPreset: (from: string) => void;
  className?: string;
}) {
  return (
    <div className={cn("flex items-center gap-2.5 flex-wrap", className)}>
      <div className="flex items-center gap-1.5">
        <Calendar className="h-3 w-3 text-slate-500" />
        <span className="text-[10px] font-medium uppercase tracking-[0.18em] text-slate-500">
          Período
        </span>
      </div>
      <div className="inline-flex items-center p-0.5 rounded-lg bg-white/[0.03] border border-white/[0.06] shadow-[0_1px_0_rgba(255,255,255,0.02)_inset]">
        {PERIOD_PRESETS.map((p) => (
          <button
            key={p.key}
            onClick={() => onPreset(p.from)}
            className={cn(
              "relative px-3 py-1 text-[11px] font-medium rounded-md transition",
              activePreset === p.key
                ? "bg-white/[0.08] text-slate-50 shadow-sm"
                : "text-slate-400 hover:text-slate-200",
            )}
          >
            {p.label}
          </button>
        ))}
      </div>
    </div>
  );
}
