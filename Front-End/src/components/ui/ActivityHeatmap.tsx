import { useMemo } from "react";
import { cn } from "@/lib/utils";

export interface HeatmapCell {
  /** ISO date (YYYY-MM-DD) */
  date: string;
  value: number;
}

/**
 * Heatmap estilo GitHub. 52 semanas × 7 dias.
 * Intensidade mapeada em 5 degraus pela distribuição.
 */
export function ActivityHeatmap({
  data,
  weeks = 52,
  cellSize = 11,
  gap = 3,
  colorClass = "bg-emerald-500",
  emptyClass = "bg-white/[0.04]",
  label = "Atividade",
}: {
  data: HeatmapCell[];
  weeks?: number;
  cellSize?: number;
  gap?: number;
  colorClass?: string;
  emptyClass?: string;
  label?: string;
}) {
  const map = useMemo(() => {
    const m = new Map<string, number>();
    data.forEach((c) => m.set(c.date, c.value));
    return m;
  }, [data]);

  const max = useMemo(() => data.reduce((a, c) => Math.max(a, c.value), 0), [data]);

  const columns = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    // Alinha ao sábado mais recente
    const end = new Date(today);
    const delta = 6 - end.getDay();
    end.setDate(end.getDate() + delta);

    const cols: Array<Array<{ date: string; value: number }>> = [];
    for (let w = weeks - 1; w >= 0; w--) {
      const col: Array<{ date: string; value: number }> = [];
      for (let d = 0; d < 7; d++) {
        const date = new Date(end);
        date.setDate(end.getDate() - w * 7 - (6 - d));
        const iso = date.toISOString().slice(0, 10);
        col.push({ date: iso, value: map.get(iso) ?? 0 });
      }
      cols.push(col);
    }
    return cols;
  }, [weeks, map]);

  const levelClass = (v: number): string => {
    if (v === 0 || max === 0) return emptyClass;
    const ratio = v / max;
    if (ratio > 0.75) return `${colorClass} opacity-100`;
    if (ratio > 0.5) return `${colorClass} opacity-75`;
    if (ratio > 0.25) return `${colorClass} opacity-55`;
    return `${colorClass} opacity-35`;
  };

  const total = useMemo(() => data.reduce((a, c) => a + c.value, 0), [data]);

  return (
    <div role="img" aria-label={`${label}: ${total} ocorrências nas últimas ${weeks} semanas`} className="inline-block">
      <div className="flex" style={{ gap }}>
        {columns.map((col, i) => (
          <div key={i} className="flex flex-col" style={{ gap }}>
            {col.map((cell) => (
              <div
                key={cell.date}
                title={`${formatBrDate(cell.date)} · ${cell.value}`}
                className={cn("rounded-[2px] transition", levelClass(cell.value))}
                style={{ width: cellSize, height: cellSize }}
              />
            ))}
          </div>
        ))}
      </div>
      <div className="mt-2 flex items-center justify-between text-[10px] text-slate-500">
        <span>{columns[0]?.[0] ? formatBrDate(columns[0][0].date) : "—"}</span>
        <div className="flex items-center gap-1">
          <span>Menos</span>
          {[0.25, 0.5, 0.75, 1].map((o) => (
            <span
              key={o}
              className={cn("rounded-[2px]", colorClass)}
              style={{ width: cellSize, height: cellSize, opacity: o * 0.8 + 0.2 }}
            />
          ))}
          <span>Mais</span>
        </div>
      </div>
    </div>
  );
}

function formatBrDate(iso: string): string {
  const d = new Date(`${iso}T12:00:00`);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("pt-BR", {
    day: "2-digit", month: "2-digit", year: "numeric",
  });
}
