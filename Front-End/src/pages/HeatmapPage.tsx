import { useQuery } from "@tanstack/react-query";
import { Calendar, Clock } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { EmptyState } from "@/components/ui/EmptyState";
import { useClinic } from "@/hooks/useClinic";
import { insightsService } from "@/services/insights";
import { cn, formatNumber } from "@/lib/utils";

const WEEKDAYS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

export default function HeatmapPage() {
  const { unitId } = useClinic();
  const data = useQuery({
    queryKey: ["heatmap", unitId],
    queryFn: () => insightsService.heatmap({ unitId: unitId || undefined }),
  });

  const d = data.data;

  return (
    <div className="space-y-5 animate-in fade-in slide-in-from-bottom-2 duration-300">
      <PageHeader
        title="Heatmap de Chegada"
        description="Quando os leads costumam chegar — hora × dia da semana"
        badge="Insights"
      />

      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        <Kpi label="Total de leads" value={formatNumber(d?.totalLeads ?? 0)} icon={<Calendar />} />
        <Kpi label="Pico (cell)" value={formatNumber(d?.max ?? 0)} icon={<Clock />} />
        <Kpi label="Dia mais ativo"
          value={d?.byWeekday?.length ? WEEKDAYS[d.byWeekday.reduce((a, b) => a.count > b.count ? a : b).weekday] : "—"}
          icon={<Calendar />} />
      </div>

      {data.isLoading ? (
        <div className="h-96 rounded-xl bg-white/[0.02] animate-pulse" />
      ) : !d || d.totalLeads === 0 ? (
        <EmptyState title="Sem leads no período" />
      ) : (
        <div className="rounded-2xl bg-slate-900/70 ring-1 ring-slate-800/80 overflow-hidden">
          <div className="px-5 py-3 border-b border-slate-800/80">
            <span className="text-sm font-semibold text-slate-100">Distribuição</span>
            <span className="ml-2 text-[11px] text-slate-500">cores mais quentes = mais leads</span>
          </div>
          <div className="p-5 overflow-x-auto">
            <div className="inline-block min-w-full">
              <div className="grid" style={{ gridTemplateColumns: "60px repeat(24, 1fr)" }}>
                <div />
                {Array.from({ length: 24 }).map((_, h) => (
                  <div key={h} className="text-[9px] text-slate-500 text-center tabular-nums">{h}</div>
                ))}
                {Array.from({ length: 7 }).map((_, w) => (
                  <>
                    <div key={`l${w}`} className="text-[10px] text-slate-500 pr-2 flex items-center">{WEEKDAYS[w]}</div>
                    {Array.from({ length: 24 }).map((_, h) => {
                      const cell = d.cells.find((c) => c.weekday === w && c.hour === h);
                      const intensity = d.max > 0 ? (cell?.count ?? 0) / d.max : 0;
                      return (
                        <div
                          key={`c${w}-${h}`}
                          title={`${WEEKDAYS[w]} ${h}h — ${cell?.count ?? 0} leads`}
                          className="aspect-square m-px rounded-sm"
                          style={{
                            backgroundColor: intensity === 0
                              ? "rgba(255,255,255,0.03)"
                              : `rgba(16, 185, 129, ${0.15 + intensity * 0.85})`,
                          }}
                        />
                      );
                    })}
                  </>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <SmallChart title="Por dia da semana" rows={(d?.byWeekday ?? []).map((b) => ({ label: WEEKDAYS[b.weekday], value: b.count }))} />
        <SmallChart title="Por hora do dia" rows={(d?.byHour ?? []).map((h) => ({ label: `${h.hour}h`, value: h.count }))} />
      </div>
    </div>
  );
}

function SmallChart({ title, rows }: { title: string; rows: { label: string; value: number }[] }) {
  const max = Math.max(1, ...rows.map((r) => r.value));
  return (
    <div className="rounded-2xl bg-slate-900/70 ring-1 ring-slate-800/80 overflow-hidden">
      <div className="px-5 py-3 border-b border-slate-800/80">
        <span className="text-sm font-semibold text-slate-100">{title}</span>
      </div>
      <div className="p-4 space-y-1.5">
        {rows.map((r) => (
          <div key={r.label} className="flex items-center gap-2">
            <span className="w-12 text-[11px] text-slate-400">{r.label}</span>
            <div className="flex-1 h-1.5 rounded-full bg-slate-800 overflow-hidden">
              <div className="h-full bg-gradient-to-r from-emerald-500 to-emerald-400"
                style={{ width: `${(r.value / max) * 100}%` }} />
            </div>
            <span className="w-10 text-right text-[10.5px] text-slate-500 tabular-nums">{r.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function Kpi({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className={cn("rounded-xl p-4 ring-1 ring-inset ring-slate-700/40 bg-slate-900/60")}>
      <div className="flex items-center justify-between mb-2">
        <span className="text-[10px] uppercase tracking-widest text-slate-500">{label}</span>
        <span className="h-7 w-7 rounded-md bg-white/5 grid place-items-center text-slate-300">{icon}</span>
      </div>
      <p className="text-2xl font-extrabold tabular-nums text-slate-100">{value}</p>
    </div>
  );
}
