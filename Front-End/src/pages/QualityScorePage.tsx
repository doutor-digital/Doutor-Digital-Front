import { useQuery } from "@tanstack/react-query";
import { Award, Star } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { EmptyState } from "@/components/ui/EmptyState";
import { useClinic } from "@/hooks/useClinic";
import { insightsService } from "@/services/insights";
import { cn, formatNumber, formatPercent } from "@/lib/utils";

const TIER_COLORS: Record<string, string> = {
  S: "bg-emerald-500/15 text-emerald-200 ring-emerald-500/30",
  A: "bg-sky-500/15 text-sky-200 ring-sky-500/30",
  B: "bg-amber-500/15 text-amber-200 ring-amber-500/30",
  C: "bg-orange-500/15 text-orange-200 ring-orange-500/30",
  D: "bg-rose-500/15 text-rose-200 ring-rose-500/30",
};

export default function QualityScorePage() {
  const { unitId } = useClinic();
  const data = useQuery({
    queryKey: ["quality-score", unitId],
    queryFn: () => insightsService.qualityScore({ unitId: unitId || undefined }),
  });
  const d = data.data;

  return (
    <div className="space-y-5 animate-in fade-in slide-in-from-bottom-2 duration-300">
      <PageHeader
        title="Quality Score por Origem"
        description="Score 0-100 = 60% conversão + 30% taxa de resposta + 10% velocidade"
        badge="Insights"
      />

      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        <Kpi icon={<Star />} label="Origens analisadas" value={String(d?.sources?.length ?? 0)} />
        <Kpi icon={<Award />} label="Total de leads" value={formatNumber(d?.totalLeads ?? 0)} />
        <Kpi icon={<Award />} label="Conversões" value={formatNumber(d?.totalConversions ?? 0)} />
      </div>

      <div className="rounded-2xl bg-slate-900/70 ring-1 ring-slate-800/80 overflow-hidden">
        <div className="px-5 py-3 border-b border-slate-800/80">
          <span className="text-sm font-semibold text-slate-100">Ranking de qualidade</span>
        </div>
        {!d || d.sources.length === 0 ? (
          <div className="p-8"><EmptyState title="Sem dados de qualidade" /></div>
        ) : (
          <table className="w-full text-[12px]">
            <thead className="bg-slate-900/40 text-[10px] text-slate-500 uppercase tracking-widest">
              <tr>
                <th className="px-4 py-2.5 text-left">Origem</th>
                <th className="px-4 py-2.5 text-center">Tier</th>
                <th className="px-4 py-2.5 text-right">Score</th>
                <th className="px-4 py-2.5 text-right">Leads</th>
                <th className="px-4 py-2.5 text-right">Conv.</th>
                <th className="px-4 py-2.5 text-right">Taxa</th>
                <th className="px-4 py-2.5 text-right">Resposta</th>
                <th className="px-4 py-2.5 text-right">Tempo médio</th>
              </tr>
            </thead>
            <tbody>
              {d.sources.map((s) => (
                <tr key={s.source} className="border-t border-slate-800/40 hover:bg-slate-800/20">
                  <td className="px-4 py-2.5 text-slate-200 font-medium">{s.source}</td>
                  <td className="px-4 py-2.5 text-center">
                    <span className={cn("inline-flex items-center justify-center w-7 h-7 rounded-md text-[12px] font-extrabold ring-1 ring-inset",
                      TIER_COLORS[s.tier] ?? TIER_COLORS.D)}>{s.tier}</span>
                  </td>
                  <td className="px-4 py-2.5 text-right tabular-nums font-bold text-slate-100">{s.qualityScore.toFixed(1)}</td>
                  <td className="px-4 py-2.5 text-right tabular-nums">{formatNumber(s.leads)}</td>
                  <td className="px-4 py-2.5 text-right tabular-nums text-emerald-300">{formatNumber(s.conversions)}</td>
                  <td className="px-4 py-2.5 text-right tabular-nums">{formatPercent(s.conversionRate)}</td>
                  <td className="px-4 py-2.5 text-right tabular-nums text-slate-400">{formatPercent(s.responseRate)}</td>
                  <td className="px-4 py-2.5 text-right tabular-nums text-slate-400">
                    {s.avgTimeToConvertHours > 0 ? `${s.avgTimeToConvertHours.toFixed(1)}h` : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
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
