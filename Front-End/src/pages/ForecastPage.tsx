import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { CalendarRange, DollarSign, TrendingUp } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { EmptyState } from "@/components/ui/EmptyState";
import { useClinic } from "@/hooks/useClinic";
import { insightsService } from "@/services/insights";
import { cn, formatCurrency, formatNumber, formatPercent } from "@/lib/utils";

export default function ForecastPage() {
  const { unitId } = useClinic();
  const [horizon, setHorizon] = useState(30);

  const data = useQuery({
    queryKey: ["forecast", unitId, horizon],
    queryFn: () => insightsService.forecast({ unitId: unitId || undefined, horizonDays: horizon }),
  });

  const d = data.data;

  return (
    <div className="space-y-5 animate-in fade-in slide-in-from-bottom-2 duration-300">
      <PageHeader
        title="Forecast de Pipeline"
        description="Projeção simples baseada na taxa histórica de conversão por etapa"
        badge="Insights"
      />

      <div className="flex items-center gap-2 rounded-xl border border-white/[0.06] bg-white/[0.02] p-3">
        <span className="text-[11px] uppercase tracking-widest text-slate-500">Horizonte</span>
        {[7, 14, 30, 60].map((h) => (
          <button key={h} onClick={() => setHorizon(h)}
            className={cn(
              "rounded-md px-3 py-1 text-[11.5px] font-medium",
              horizon === h ? "bg-violet-500/15 text-violet-200 ring-1 ring-violet-500/30" : "text-slate-400 hover:text-slate-200",
            )}>
            {h}d
          </button>
        ))}
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Kpi icon={<CalendarRange />} label="Leads abertos" value={formatNumber(d?.openLeadsTotal ?? 0)} />
        <Kpi icon={<TrendingUp />} label="Conversões projetadas" value={formatNumber(Math.round(d?.projectedConversions ?? 0))} />
        <Kpi icon={<DollarSign />} label="Receita projetada" value={formatCurrency(d?.projectedRevenue ?? 0)} />
        <Kpi icon={<TrendingUp />} label="Taxa histórica" value={formatPercent(d?.overallConversionRate ?? 0)} />
      </div>

      <div className="rounded-2xl bg-slate-900/70 ring-1 ring-slate-800/80 overflow-hidden">
        <div className="px-5 py-3 border-b border-slate-800/80">
          <span className="text-sm font-semibold text-slate-100">Projeção por etapa</span>
        </div>
        {!d || d.byStage.length === 0 ? (
          <div className="p-8"><EmptyState title="Sem leads abertos" /></div>
        ) : (
          <table className="w-full text-[12px]">
            <thead className="bg-slate-900/40 text-[10px] text-slate-500 uppercase tracking-widest">
              <tr>
                <th className="px-4 py-2.5 text-left">Etapa</th>
                <th className="px-4 py-2.5 text-right">Em aberto</th>
                <th className="px-4 py-2.5 text-right">Conv. histórica</th>
                <th className="px-4 py-2.5 text-right">Conv. projetada</th>
                <th className="px-4 py-2.5 text-right">Receita projetada</th>
              </tr>
            </thead>
            <tbody>
              {d.byStage.map((s) => (
                <tr key={s.stage} className="border-t border-slate-800/40">
                  <td className="px-4 py-2.5 text-slate-200">{s.stage || "—"}</td>
                  <td className="px-4 py-2.5 text-right tabular-nums">{formatNumber(s.openLeads)}</td>
                  <td className="px-4 py-2.5 text-right tabular-nums">{formatPercent(s.historicalConversionRate)}</td>
                  <td className="px-4 py-2.5 text-right tabular-nums text-emerald-300 font-bold">{s.projectedConversions.toFixed(1)}</td>
                  <td className="px-4 py-2.5 text-right tabular-nums text-emerald-200">{formatCurrency(s.projectedRevenue)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {d && d.timeline.length > 0 && (
        <div className="rounded-2xl bg-slate-900/70 ring-1 ring-slate-800/80 overflow-hidden">
          <div className="px-5 py-3 border-b border-slate-800/80">
            <span className="text-sm font-semibold text-slate-100">Linha do tempo</span>
            <span className="ml-2 text-[11px] text-slate-500">faixa: ±15%</span>
          </div>
          <div className="p-4">
            <TimelineBars rows={d.timeline} />
          </div>
        </div>
      )}
    </div>
  );
}

function TimelineBars({ rows }: { rows: { date: string; projected: number; lowerBound: number; upperBound: number }[] }) {
  const max = Math.max(1, ...rows.map((r) => r.upperBound));
  return (
    <div className="flex items-end gap-1 h-40">
      {rows.map((r) => {
        const top = (r.upperBound / max) * 100;
        const proj = (r.projected / max) * 100;
        const bottom = (r.lowerBound / max) * 100;
        return (
          <div key={r.date} title={`${r.date}: ${r.projected.toFixed(1)} (±15%)`}
            className="flex-1 relative flex items-end">
            <div className="absolute inset-x-0 bg-violet-500/20 rounded-sm"
              style={{ height: `${top}%`, bottom: 0 }} />
            <div className="absolute inset-x-0 bg-violet-500/40 rounded-sm"
              style={{ height: `${proj}%`, bottom: 0 }} />
            <div className="absolute inset-x-0 bg-violet-500/70 rounded-sm"
              style={{ height: `${bottom}%`, bottom: 0 }} />
          </div>
        );
      })}
    </div>
  );
}

function Kpi({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="rounded-xl p-4 ring-1 ring-inset ring-slate-700/40 bg-slate-900/60">
      <div className="flex items-center justify-between mb-2">
        <span className="text-[10px] uppercase tracking-widest text-slate-500">{label}</span>
        <span className="h-7 w-7 rounded-md bg-white/5 grid place-items-center text-slate-300">{icon}</span>
      </div>
      <p className="text-2xl font-extrabold tabular-nums text-slate-100">{value}</p>
    </div>
  );
}
