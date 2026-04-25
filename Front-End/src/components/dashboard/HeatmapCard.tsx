import { useMemo } from "react";
import { Activity } from "lucide-react";
import { ActivityHeatmap, type HeatmapCell } from "@/components/ui/ActivityHeatmap";

interface HeatmapCardProps {
  // Aceita series já no formato { date, value } OU calcula a partir de timestamps brutos
  data?: HeatmapCell[];
  rawDates?: string[];
  loading?: boolean;
  weeks?: number;
}

function buildCellsFromDates(dates: string[], weeks: number): HeatmapCell[] {
  const counts = new Map<string, number>();
  for (const d of dates) {
    const iso = d.slice(0, 10);
    counts.set(iso, (counts.get(iso) ?? 0) + 1);
  }
  const today = new Date();
  const cells: HeatmapCell[] = [];
  for (let i = weeks * 7 - 1; i >= 0; i--) {
    const dt = new Date(today);
    dt.setDate(dt.getDate() - i);
    const iso = dt.toISOString().slice(0, 10);
    cells.push({ date: iso, value: counts.get(iso) ?? 0 });
  }
  return cells;
}

export function HeatmapCard({ data, rawDates, loading, weeks = 26 }: HeatmapCardProps) {
  const cells = useMemo(() => {
    if (data) return data;
    if (rawDates) return buildCellsFromDates(rawDates, weeks);
    return [] as HeatmapCell[];
  }, [data, rawDates, weeks]);

  const total = useMemo(() => cells.reduce((s, c) => s + c.value, 0), [cells]);
  const maxDay = useMemo(
    () => cells.reduce((m, c) => (c.value > (m?.value ?? 0) ? c : m), cells[0]),
    [cells],
  );

  return (
    <div className="rounded-xl border border-white/[0.07] bg-gradient-to-br from-white/[0.02] to-white/[0.005]">
      <div className="flex items-center gap-3 border-b border-white/[0.05] px-5 py-3.5">
        <div className="flex h-8 w-8 items-center justify-center rounded-md bg-emerald-400/10 ring-1 ring-inset ring-emerald-400/20">
          <Activity className="h-4 w-4 text-emerald-300" />
        </div>
        <div className="min-w-0 flex-1 leading-tight">
          <p className="text-[13px] font-semibold text-slate-100">
            Atividade nas últimas {weeks} semanas
          </p>
          <p className="text-[10.5px] text-slate-500">
            {total > 0
              ? `${total} eventos · pico em ${maxDay?.date.slice(8, 10)}/${maxDay?.date.slice(5, 7)}`
              : "Sem eventos no período"}
          </p>
        </div>
      </div>

      <div className="overflow-x-auto px-5 py-4">
        {loading ? (
          <div className="h-24 animate-pulse rounded-md bg-white/[0.03]" />
        ) : (
          <ActivityHeatmap
            data={cells}
            weeks={weeks}
            cellSize={10}
            gap={2.5}
            label="Leads"
          />
        )}
      </div>
    </div>
  );
}
