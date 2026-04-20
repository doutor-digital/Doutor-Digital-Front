import { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function Tabs({
  tabs,
  value,
  onChange,
}: {
  tabs: { value: string; label: ReactNode; count?: number }[];
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="inline-flex items-center p-0.5 rounded-lg bg-white/[0.03] border border-white/[0.06]">
      {tabs.map((t) => (
        <button
          key={t.value}
          onClick={() => onChange(t.value)}
          className={cn(
            "px-3 py-1.5 text-[12px] rounded-md transition flex items-center gap-1.5",
            value === t.value
              ? "bg-white/[0.08] text-slate-50 shadow-sm"
              : "text-slate-400 hover:text-slate-200",
          )}
        >
          {t.label}
          {typeof t.count === "number" && (
            <span
              className={cn(
                "ml-1 px-1.5 py-0.5 text-[10px] rounded-full tabular-nums",
                value === t.value
                  ? "bg-white/[0.08] text-slate-200"
                  : "bg-white/[0.04] text-slate-500",
              )}
            >
              {t.count}
            </span>
          )}
        </button>
      ))}
    </div>
  );
}
