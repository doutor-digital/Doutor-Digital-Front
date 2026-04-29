import { useQuery } from "@tanstack/react-query";
import { MapPin } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { EmptyState } from "@/components/ui/EmptyState";
import { useClinic } from "@/hooks/useClinic";
import { insightsService } from "@/services/insights";
import { cn, formatNumber, formatPercent } from "@/lib/utils";

export default function LeadsMapPage() {
  const { unitId } = useClinic();
  const data = useQuery({
    queryKey: ["geo", unitId],
    queryFn: () => insightsService.geo({ unitId: unitId || undefined }),
  });

  const d = data.data;

  return (
    <div className="space-y-5 animate-in fade-in slide-in-from-bottom-2 duration-300">
      <PageHeader
        title="Mapa de Leads"
        description="Distribuição geográfica · cidades e estados (geo mockada)"
        badge="Insights"
      />

      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        <Kpi label="Total" value={formatNumber(d?.totalLeads ?? 0)} />
        <Kpi label="Estados ativos" value={String(d?.states?.length ?? 0)} />
        <Kpi label="Cidades ativas" value={String(d?.cities?.length ?? 0)} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="rounded-2xl bg-slate-900/70 ring-1 ring-slate-800/80 overflow-hidden">
          <div className="px-5 py-3 border-b border-slate-800/80">
            <span className="text-sm font-semibold text-slate-100">Top estados</span>
          </div>
          {!d || d.states.length === 0 ? (
            <div className="p-8"><EmptyState title="Sem dados geográficos" /></div>
          ) : (
            <div className="p-4 space-y-2">
              {d.states.slice(0, 12).map((s) => {
                const max = Math.max(1, ...d.states.map((x) => x.leads));
                return (
                  <div key={s.state} className="flex items-center gap-3">
                    <span className="w-8 text-[11px] font-bold text-slate-300">{s.state}</span>
                    <span className="flex-1 text-[12px] text-slate-400 truncate">{s.stateName}</span>
                    <div className="w-32 h-1.5 rounded-full bg-slate-800 overflow-hidden">
                      <div className="h-full bg-gradient-to-r from-sky-500 to-sky-400" style={{ width: `${(s.leads / max) * 100}%` }} />
                    </div>
                    <span className="w-12 text-right text-[11px] tabular-nums text-slate-300">{s.leads}</span>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="rounded-2xl bg-slate-900/70 ring-1 ring-slate-800/80 overflow-hidden">
          <div className="px-5 py-3 border-b border-slate-800/80">
            <span className="text-sm font-semibold text-slate-100">Top cidades</span>
          </div>
          {!d || d.cities.length === 0 ? (
            <div className="p-8"><EmptyState title="Sem cidades" /></div>
          ) : (
            <table className="w-full text-[12px]">
              <thead className="bg-slate-900/40 text-[10px] text-slate-500 uppercase tracking-widest">
                <tr>
                  <th className="px-4 py-2.5 text-left">Cidade</th>
                  <th className="px-4 py-2.5 text-right">Leads</th>
                  <th className="px-4 py-2.5 text-right">Conv.</th>
                  <th className="px-4 py-2.5 text-right">Taxa</th>
                </tr>
              </thead>
              <tbody>
                {d.cities.slice(0, 15).map((c) => (
                  <tr key={`${c.city}-${c.state}`} className="border-t border-slate-800/40">
                    <td className="px-4 py-2.5 text-slate-200">
                      <div className="flex items-center gap-2">
                        <MapPin className="h-3 w-3 text-slate-500" />
                        <span>{c.city}</span>
                        <span className="text-[10px] text-slate-500">{c.state}</span>
                      </div>
                    </td>
                    <td className="px-4 py-2.5 text-right tabular-nums">{c.leads}</td>
                    <td className="px-4 py-2.5 text-right tabular-nums text-emerald-300">{c.conversions}</td>
                    <td className={cn("px-4 py-2.5 text-right tabular-nums font-bold",
                      c.conversionRate >= 30 ? "text-emerald-300" :
                      c.conversionRate >= 15 ? "text-amber-300" : "text-slate-400"
                    )}>{formatPercent(c.conversionRate)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {d && d.points.length > 0 && (
        <div className="rounded-2xl bg-slate-900/70 ring-1 ring-slate-800/80 overflow-hidden">
          <div className="px-5 py-3 border-b border-slate-800/80">
            <span className="text-sm font-semibold text-slate-100">Mapa de calor (Brasil)</span>
            <span className="ml-2 text-[11px] text-slate-500">{d.points.length} pontos · verde = convertido</span>
          </div>
          <div className="relative h-[420px] bg-[#020617] overflow-hidden">
            <BrazilScatter points={d.points} />
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * Plota pontos lat/long como um scatter rudimentar dentro de um SVG do Brasil.
 * Não pretende ser um mapa real — só dá contexto visual da distribuição.
 */
function BrazilScatter({ points }: { points: { leadId: number; lat: number; lng: number; converted: boolean; name: string; city: string; state: string }[] }) {
  // bounding box approx: BR ~ lat -34..5, lng -75..-32
  const minLat = -34, maxLat = 5;
  const minLng = -75, maxLng = -32;
  return (
    <svg viewBox="0 0 100 100" className="absolute inset-0 w-full h-full" preserveAspectRatio="none">
      <rect width="100" height="100" fill="rgba(15,23,42,0.6)" />
      {points.map((p) => {
        const x = ((p.lng - minLng) / (maxLng - minLng)) * 100;
        const y = ((maxLat - p.lat) / (maxLat - minLat)) * 100;
        return (
          <circle
            key={p.leadId}
            cx={x} cy={y}
            r={p.converted ? 0.8 : 0.5}
            fill={p.converted ? "rgba(16,185,129,0.85)" : "rgba(56,189,248,0.5)"}
          >
            <title>{`${p.name} — ${p.city}/${p.state}`}</title>
          </circle>
        );
      })}
    </svg>
  );
}

function Kpi({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl p-4 ring-1 ring-inset ring-slate-700/40 bg-slate-900/60">
      <span className="text-[10px] uppercase tracking-widest text-slate-500">{label}</span>
      <p className="mt-1 text-2xl font-extrabold tabular-nums text-slate-100">{value}</p>
    </div>
  );
}
