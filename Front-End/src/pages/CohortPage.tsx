import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Layers } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { EmptyState } from "@/components/ui/EmptyState";
import { useClinic } from "@/hooks/useClinic";
import { insightsService } from "@/services/insights";
import { cn, formatPercent } from "@/lib/utils";

export default function CohortPage() {
  const { unitId } = useClinic();
  const [granularity, setGranularity] = useState<"week" | "month">("week");

  const data = useQuery({
    queryKey: ["cohort", unitId, granularity],
    queryFn: () => insightsService.cohort({ unitId: unitId || undefined, granularity }),
  });

  const d = data.data;

  return (
    <div className="space-y-5 animate-in fade-in slide-in-from-bottom-2 duration-300">
      <PageHeader
        title="Cohort Retention"
        description="Leads que chegaram em X e converteram em N dias"
        badge="Insights"
      />

      <div className="flex items-center gap-2 rounded-xl border border-white/[0.06] bg-white/[0.02] p-3">
        <span className="text-[11px] uppercase tracking-widest text-slate-500">Granularidade</span>
        <button onClick={() => setGranularity("week")}
          className={cn("rounded-md px-3 py-1 text-[11.5px] font-medium",
            granularity === "week" ? "bg-violet-500/15 text-violet-200 ring-1 ring-violet-500/30" : "text-slate-400")}>
          Semana
        </button>
        <button onClick={() => setGranularity("month")}
          className={cn("rounded-md px-3 py-1 text-[11.5px] font-medium",
            granularity === "month" ? "bg-violet-500/15 text-violet-200 ring-1 ring-violet-500/30" : "text-slate-400")}>
          Mês
        </button>
      </div>

      {data.isLoading ? (
        <div className="h-96 rounded-xl bg-white/[0.02] animate-pulse" />
      ) : !d || d.rows.length === 0 ? (
        <EmptyState title="Sem dados de cohort" icon={<Layers className="h-5 w-5 text-slate-500" />} />
      ) : (
        <div className="rounded-2xl bg-slate-900/70 ring-1 ring-slate-800/80 overflow-x-auto">
          <table className="w-full text-[12px] min-w-[560px]">
            <thead className="bg-slate-900/40 text-[10px] text-slate-500 uppercase tracking-widest">
              <tr>
                <th className="px-4 py-2.5 text-left">Cohort</th>
                <th className="px-4 py-2.5 text-right">Tamanho</th>
                {d.days.map((day) => (
                  <th key={day} className="px-3 py-2.5 text-right">D+{day}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {d.rows.map((row) => (
                <tr key={row.cohortStart} className="border-t border-slate-800/40">
                  <td className="px-4 py-2.5 text-slate-200 font-medium whitespace-nowrap">{row.label}</td>
                  <td className="px-4 py-2.5 text-right tabular-nums text-slate-400">{row.size}</td>
                  {row.cells.map((c) => {
                    const intensity = c.rate / 100;
                    return (
                      <td key={c.daysSinceCohort} className="px-2 py-1.5 text-right">
                        <div className="rounded-md py-2 tabular-nums text-[11.5px] font-bold"
                          style={{
                            backgroundColor: c.rate === 0
                              ? "rgba(255,255,255,0.02)"
                              : `rgba(124, 58, 237, ${0.15 + intensity * 0.6})`,
                            color: intensity > 0.4 ? "#fff" : "#cbd5e1",
                          }}>
                          {c.rate > 0 ? formatPercent(c.rate, 0) : "—"}
                        </div>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
