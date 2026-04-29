import { useQuery } from "@tanstack/react-query";
import { AlertCircle, Layers, X } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { EmptyState } from "@/components/ui/EmptyState";
import { useClinic } from "@/hooks/useClinic";
import { insightsService } from "@/services/insights";
import { formatNumber, formatPercent } from "@/lib/utils";

export default function LostReasonsPage() {
  const { unitId } = useClinic();
  const data = useQuery({
    queryKey: ["lost-reasons", unitId],
    queryFn: () => insightsService.lostReasons({ unitId: unitId || undefined }),
  });
  const d = data.data;

  return (
    <div className="space-y-5 animate-in fade-in slide-in-from-bottom-2 duration-300">
      <PageHeader
        title="Motivos de Perda"
        description="Por que os leads não convertem · classificação heurística do texto livre"
        badge="Insights"
      />

      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        <Kpi icon={<X />} label="Perdidos" value={formatNumber(d?.totalLost ?? 0)} />
        <Kpi icon={<Layers />} label="Categorias" value={String(d?.reasons?.length ?? 0)} />
        <Kpi icon={<AlertCircle />} label="Top motivo"
          value={d?.reasons?.[0]?.category ?? "—"} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="rounded-2xl bg-slate-900/70 ring-1 ring-slate-800/80 overflow-hidden">
          <div className="px-5 py-3 border-b border-slate-800/80">
            <span className="text-sm font-semibold text-slate-100">Distribuição de motivos</span>
          </div>
          {!d || d.reasons.length === 0 ? (
            <div className="p-8"><EmptyState title="Sem motivos classificados" /></div>
          ) : (
            <div className="p-4 space-y-2">
              {d.reasons.map((r) => (
                <div key={r.reason} className="rounded-lg bg-slate-900/40 p-3">
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-[12.5px] font-semibold text-slate-200">{r.category}</span>
                    <span className="text-[11px] text-slate-400 tabular-nums">
                      {formatNumber(r.count)} · {formatPercent(r.percent)}
                    </span>
                  </div>
                  <div className="h-1.5 rounded-full bg-slate-800 overflow-hidden">
                    <div className="h-full bg-gradient-to-r from-rose-500 to-rose-400" style={{ width: `${r.percent}%` }} />
                  </div>
                  {r.keywords?.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1">
                      {r.keywords.slice(0, 4).map((k) => (
                        <span key={k} className="rounded-full bg-slate-800/60 px-2 py-0.5 text-[10px] text-slate-400">{k}</span>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="rounded-2xl bg-slate-900/70 ring-1 ring-slate-800/80 overflow-hidden">
          <div className="px-5 py-3 border-b border-slate-800/80">
            <span className="text-sm font-semibold text-slate-100">Por etapa</span>
          </div>
          {!d || d.byStage.length === 0 ? (
            <div className="p-8"><EmptyState title="Sem etapas" /></div>
          ) : (
            <table className="w-full text-[12px]">
              <thead className="text-[10px] text-slate-500 uppercase tracking-widest">
                <tr>
                  <th className="px-4 py-2.5 text-left">Etapa</th>
                  <th className="px-4 py-2.5 text-right">Perdidos</th>
                  <th className="px-4 py-2.5 text-left">Top motivo</th>
                </tr>
              </thead>
              <tbody>
                {d.byStage.map((s) => (
                  <tr key={s.stage} className="border-t border-slate-800/40">
                    <td className="px-4 py-2.5 text-slate-200">{s.stage || "—"}</td>
                    <td className="px-4 py-2.5 text-right tabular-nums">{formatNumber(s.count)}</td>
                    <td className="px-4 py-2.5 text-slate-400">{s.topReason}</td>
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

function Kpi({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="rounded-xl p-4 ring-1 ring-inset ring-slate-700/40 bg-slate-900/60">
      <div className="flex items-center justify-between mb-2">
        <span className="text-[10px] uppercase tracking-widest text-slate-500">{label}</span>
        <span className="h-7 w-7 rounded-md bg-white/5 grid place-items-center text-slate-300">{icon}</span>
      </div>
      <p className="text-2xl font-extrabold tabular-nums text-slate-100 truncate">{value}</p>
    </div>
  );
}
