import { ReactNode } from "react";
import { cn } from "@/lib/utils";

export interface TimelineEntry {
  id: string | number;
  title: ReactNode;
  description?: ReactNode;
  time: string;      // ISO
  icon: ReactNode;
  tone?: "sky" | "emerald" | "amber" | "rose" | "indigo" | "slate";
}

const DOT_TONE: Record<NonNullable<TimelineEntry["tone"]>, string> = {
  sky:     "bg-sky-500/20 text-sky-300 ring-sky-500/30",
  emerald: "bg-emerald-500/20 text-emerald-300 ring-emerald-500/30",
  amber:   "bg-amber-500/20 text-amber-300 ring-amber-500/30",
  rose:    "bg-rose-500/20 text-rose-300 ring-rose-500/30",
  indigo:  "bg-indigo-500/20 text-indigo-300 ring-indigo-500/30",
  slate:   "bg-white/[0.05] text-slate-300 ring-white/[0.08]",
};

/**
 * Timeline vertical com ponto colorido por tipo de evento.
 */
export function Timeline({
  entries, className,
}: {
  entries: TimelineEntry[];
  className?: string;
}) {
  if (entries.length === 0) {
    return (
      <p className="text-[12px] text-slate-500">Sem eventos para exibir.</p>
    );
  }
  return (
    <ol className={cn("relative space-y-4", className)}>
      <div className="absolute left-[15px] top-1 bottom-1 w-px bg-gradient-to-b from-white/[0.06] via-white/[0.03] to-transparent" />
      {entries.map((e) => {
        const tone = e.tone ?? "slate";
        return (
          <li key={e.id} className="relative flex gap-3 pl-0">
            <span
              className={cn(
                "relative z-[1] flex h-[30px] w-[30px] shrink-0 items-center justify-center rounded-full ring-1 ring-inset [&>svg]:h-3.5 [&>svg]:w-3.5",
                DOT_TONE[tone],
              )}
            >
              {e.icon}
            </span>
            <div className="min-w-0 flex-1 pt-1">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <div className="min-w-0 text-[13px] font-medium text-slate-100">{e.title}</div>
                <time className="text-[10.5px] tabular-nums text-slate-500">
                  {formatTime(e.time)}
                </time>
              </div>
              {e.description && (
                <div className="mt-0.5 text-[11.5px] leading-relaxed text-slate-400">
                  {e.description}
                </div>
              )}
            </div>
          </li>
        );
      })}
    </ol>
  );
}

function formatTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString("pt-BR", {
    day: "2-digit", month: "2-digit", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}
