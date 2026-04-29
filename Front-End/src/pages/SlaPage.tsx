import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Clock, Gauge, Timer, Users2 } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { EmptyState } from "@/components/ui/EmptyState";
import { useClinic } from "@/hooks/useClinic";
import { insightsService } from "@/services/insights";
import { cn, formatNumber, formatPercent } from "@/lib/utils";

export default function SlaPage() {
  const { unitId } = useClinic();
  const [target, setTarget] = useState(5);

  const data = useQuery({
    queryKey: ["sla", unitId, target],
    queryFn: () => insightsService.sla({ unitId: unitId || undefined, targetMinutes: target }),
  });

  const d = data.data;

  return (
    <div className="space-y-5 animate-in fade-in slide-in-from-bottom-2 duration-300">
      <PageHeader
        title="SLA · Primeira Resposta"
        description="Tempo entre lead criado e primeira mensagem enviada por atendente"
        badge="Insights · Operacional"
      />

      <div className="flex items-center gap-2 rounded-xl border border-white/[0.06] bg-white/[0.02] p-3">
        <span className="text-[11px] uppercase tracking-widest text-slate-500">Meta</span>
        {[1, 5, 15, 30].map((m) => (
          <button key={m} onClick={() => setTarget(m)}
            className={cn(
              "rounded-md px-3 py-1 text-[11.5px] font-medium",
              target === m ? "bg-emerald-500/15 text-emerald-200 ring-1 ring-emerald-500/30" : "text-slate-400 hover:text-slate-200",
            )}>
            {m}min
          </button>
        ))}
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Kpi icon={<Timer />} label="Média" value={`${(d?.averageFirstResponseMinutes ?? 0).toFixed(1)}m`} tone="slate" />
        <Kpi icon={<Clock />} label="Mediana" value={`${(d?.medianFirstResponseMinutes ?? 0).toFixed(1)}m`} tone="slate" />
        <Kpi icon={<Gauge />} label="P90" value={`${(d?.p90FirstResponseMinutes ?? 0).toFixed(1)}m`} tone="amber" />
        <Kpi icon={<Users2 />} label="Dentro do SLA" value={formatPercent(d?.totalLeads
          ? (100 * (d?.withinTargetCount ?? 0)) / Math.max(1, d.leadsWithFirstResponse)
          : 0)} tone="emerald" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="rounded-2xl bg-slate-900/70 ring-1 ring-slate-800/80 overflow-hidden">
          <div className="px-5 py-3 border-b border-slate-800/80">
            <span className="text-sm font-semibold text-slate-100">Distribuição por tempo</span>
          </div>
          {!d || d.buckets.length === 0 ? (
            <div className="p-8"><EmptyState title="Sem dados de SLA" /></div>
          ) : (
            <div className="p-4 space-y-2">
              {d.buckets.map((b) => (
                <div key={b.range} className="rounded-lg bg-slate-900/40 p-3">
                  <div className="flex items-center justify-between text-[12px]">
                    <span className="font-medium text-slate-200">{b.range}</span>
                    <span className="tabular-nums text-slate-400">{formatNumber(b.count)} · {formatPercent(b.percent)}</span>
                  </div>
                  <div className="mt-1.5 h-1.5 rounded-full bg-slate-800 overflow-hidden">
                    <div className="h-full bg-gradient-to-r from-sky-500 to-sky-400" style={{ width: `${b.percent}%` }} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="rounded-2xl bg-slate-900/70 ring-1 ring-slate-800/80 overflow-hidden">
          <div className="px-5 py-3 border-b border-slate-800/80">
            <span className="text-sm font-semibold text-slate-100">Por atendente</span>
          </div>
          {!d || d.byAttendant.length === 0 ? (
            <div className="p-8"><EmptyState title="Sem atendentes no período" /></div>
          ) : (
            <table className="w-full text-[12px]">
              <thead className="bg-slate-900/40 text-[10px] text-slate-500 uppercase tracking-widest">
                <tr>
                  <th className="px-4 py-2.5 text-left">Atendente</th>
                  <th className="px-4 py-2.5 text-right">Leads</th>
                  <th className="px-4 py-2.5 text-right">Média</th>
                  <th className="px-4 py-2.5 text-right">No SLA</th>
                </tr>
              </thead>
              <tbody>
                {d.byAttendant.map((a) => (
                  <tr key={a.attendantId} className="border-t border-slate-800/40 hover:bg-slate-800/20">
                    <td className="px-4 py-2.5 text-slate-200">{a.attendantName}</td>
                    <td className="px-4 py-2.5 text-right tabular-nums">{a.totalLeads}</td>
                    <td className="px-4 py-2.5 text-right tabular-nums">{a.averageMinutes.toFixed(1)}m</td>
                    <td className={cn("px-4 py-2.5 text-right tabular-nums font-bold",
                      a.withinTargetRate >= 80 ? "text-emerald-300" :
                      a.withinTargetRate >= 50 ? "text-amber-300" : "text-rose-300"
                    )}>{formatPercent(a.withinTargetRate)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}

function Kpi({ icon, label, value, tone }: {
  icon: React.ReactNode; label: string; value: string;
  tone: "slate" | "emerald" | "amber";
}) {
  const c = {
    slate: "bg-slate-900/60 ring-slate-700/40 text-slate-200",
    emerald: "bg-emerald-500/8 ring-emerald-500/30 text-emerald-200",
    amber: "bg-amber-500/8 ring-amber-500/30 text-amber-200",
  }[tone];
  return (
    <div className={cn("rounded-xl p-4 ring-1 ring-inset", c)}>
      <div className="flex items-center justify-between mb-2">
        <span className="text-[10px] uppercase tracking-widest text-slate-500">{label}</span>
        <span className="h-7 w-7 rounded-md bg-white/5 grid place-items-center">{icon}</span>
      </div>
      <p className="text-2xl font-extrabold tabular-nums">{value}</p>
    </div>
  );
}
