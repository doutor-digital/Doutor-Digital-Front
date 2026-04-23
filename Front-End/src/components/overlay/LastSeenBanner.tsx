import { useState } from "react";
import { create } from "zustand";
import { persist } from "zustand/middleware";
import { Sparkles, X } from "lucide-react";
import { cn } from "@/lib/utils";

interface LastSeenStore {
  lastSeenAt: number | null;
  ping: () => void;
}

export const useLastSeen = create<LastSeenStore>()(
  persist(
    (set) => ({
      lastSeenAt: null,
      ping: () => set({ lastSeenAt: Date.now() }),
    }),
    { name: "doutor.digital.lastseen" },
  ),
);

/**
 * Banner "Desde sua última visita há X: Y novos leads, Z pagamentos".
 * Dispensável (X). Só aparece se passou > 4h da última visita E tiver delta > 0.
 */
export function LastSeenBanner({
  stats,
}: {
  stats?: Array<{ label: string; value: number; tone?: "emerald" | "sky" | "amber" | "rose" }>;
}) {
  const [dismissed, setDismissed] = useState(false);
  const lastSeen = useLastSeen((s) => s.lastSeenAt);

  if (dismissed || !lastSeen) return null;
  const diff = Date.now() - lastSeen;
  const FOUR_HOURS = 4 * 60 * 60 * 1000;
  if (diff < FOUR_HOURS) return null;

  const hasDelta = stats?.some((s) => s.value > 0);
  if (!hasDelta) return null;

  return (
    <div className={cn(
      "mb-4 flex items-start gap-3 rounded-xl border border-emerald-500/20 px-4 py-3",
      "bg-gradient-to-r from-emerald-500/[0.06] to-sky-500/[0.03]",
    )}>
      <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-emerald-300" />
      <div className="flex-1">
        <p className="text-[12.5px] font-medium text-slate-100">
          Desde sua última visita {formatAgoBr(diff)}:
        </p>
        <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11.5px] text-slate-300">
          {stats?.map((s, i) => (
            <span key={i}>
              <span className={cn(
                "tabular-nums font-semibold",
                s.tone === "emerald" && "text-emerald-300",
                s.tone === "sky" && "text-sky-300",
                s.tone === "amber" && "text-amber-300",
                s.tone === "rose" && "text-rose-300",
              )}>
                +{s.value}
              </span>{" "}
              {s.label}
            </span>
          ))}
        </div>
      </div>
      <button
        type="button"
        onClick={() => setDismissed(true)}
        aria-label="Dispensar"
        className="text-slate-500 transition hover:text-slate-200"
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

function formatAgoBr(ms: number): string {
  const h = Math.floor(ms / (60 * 60 * 1000));
  if (h < 24) return `há ${h}h`;
  const d = Math.floor(h / 24);
  if (d < 7) return `há ${d} dia${d === 1 ? "" : "s"}`;
  const w = Math.floor(d / 7);
  return `há ${w} semana${w === 1 ? "" : "s"}`;
}
