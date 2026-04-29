import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, CheckCircle2, Eye, Info, Mail, Phone, Wifi } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { EmptyState } from "@/components/ui/EmptyState";
import { useClinic } from "@/hooks/useClinic";
import { insightsService } from "@/services/insights";
import { cn, formatNumber } from "@/lib/utils";

export default function PixelHealthPage() {
  const { unitId } = useClinic();
  const data = useQuery({
    queryKey: ["pixel-health", unitId],
    queryFn: () => insightsService.pixelHealth({ unitId: unitId || undefined }),
  });

  const d = data.data;

  return (
    <div className="space-y-5 animate-in fade-in slide-in-from-bottom-2 duration-300">
      <PageHeader
        title="Saúde do Pixel"
        description="Cobertura de identificadores e EMQ score · qualidade dos eventos enviados"
        badge="Insights · CAPI"
      />

      {data.isLoading ? (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          {Array.from({ length: 5 }).map((_, i) => <div key={i} className="h-24 rounded-xl bg-white/[0.02] animate-pulse" />)}
        </div>
      ) : !d ? (
        <EmptyState title="Sem dados" />
      ) : (
        <>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            <Coverage icon={<Mail />} label="Email" pct={d.emailHashCoverage} target={70} />
            <Coverage icon={<Phone />} label="Telefone" pct={d.phoneHashCoverage} target={90} />
            <Coverage icon={<Wifi />} label="IP" pct={d.ipCoverage} target={70} />
            <Coverage icon={<Eye />} label="fbp/fbc" pct={Math.round((d.fbpCoverage + d.fbcCoverage) / 2)} target={50} />
            <Coverage icon={<Info />} label="EMQ" pct={d.averageEmqScore * 10} hint={`${d.averageEmqScore.toFixed(1)}/10`} target={60} />
          </div>

          {d.alerts?.length > 0 && (
            <div className="space-y-2">
              {d.alerts.map((a, i) => (
                <div key={i} className={cn(
                  "rounded-xl border p-3 flex items-start gap-3",
                  a.severity === "critical" ? "border-rose-500/30 bg-rose-500/5" :
                  a.severity === "warning"  ? "border-amber-500/30 bg-amber-500/5" :
                                               "border-emerald-500/20 bg-emerald-500/5",
                )}>
                  {a.severity === "critical" ? <AlertTriangle className="h-4 w-4 text-rose-300 mt-0.5" /> :
                   a.severity === "warning"  ? <AlertTriangle className="h-4 w-4 text-amber-300 mt-0.5" /> :
                                                <CheckCircle2 className="h-4 w-4 text-emerald-300 mt-0.5" />}
                  <div>
                    <p className="text-sm font-semibold text-slate-100">{a.title}</p>
                    <p className="text-[11.5px] text-slate-400">{a.message}</p>
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="rounded-2xl bg-slate-900/70 ring-1 ring-slate-800/80 overflow-hidden">
            <div className="px-5 py-3 border-b border-slate-800/80">
              <span className="text-sm font-semibold text-slate-100">Qualidade por unidade</span>
              <span className="ml-2 text-[11px] text-slate-500">{formatNumber(d.totalEvents)} eventos · {d.byUnit.length} unidades</span>
            </div>
            {d.byUnit.length === 0 ? (
              <div className="p-6"><EmptyState title="Nenhuma unidade com eventos" /></div>
            ) : (
              <table className="w-full text-[12.5px]">
                <thead className="text-[10px] text-slate-500 uppercase tracking-widest">
                  <tr>
                    <th className="px-5 py-2.5 text-left">Unidade</th>
                    <th className="px-5 py-2.5 text-right">Eventos</th>
                    <th className="px-5 py-2.5 text-right">EMQ</th>
                    <th className="px-5 py-2.5 text-left">Cobertura</th>
                  </tr>
                </thead>
                <tbody>
                  {d.byUnit.map((u) => (
                    <tr key={u.unitId} className="border-t border-slate-800/40 hover:bg-slate-800/20">
                      <td className="px-5 py-2.5 text-slate-200">{u.unitName}</td>
                      <td className="px-5 py-2.5 text-right tabular-nums">{formatNumber(u.totalEvents)}</td>
                      <td className="px-5 py-2.5 text-right tabular-nums font-bold text-emerald-300">{u.emqScore.toFixed(1)}</td>
                      <td className="px-5 py-2.5">
                        <div className="flex items-center gap-2">
                          <div className="flex-1 h-1.5 rounded-full bg-slate-800 overflow-hidden">
                            <div className="h-full bg-gradient-to-r from-emerald-500 to-emerald-400" style={{ width: `${u.coverage}%` }} />
                          </div>
                          <span className="w-10 text-right text-[11px] text-slate-400 tabular-nums">{u.coverage.toFixed(0)}%</span>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </>
      )}
    </div>
  );
}

function Coverage({ icon, label, pct, target, hint }: {
  icon: React.ReactNode; label: string; pct: number; target: number; hint?: string;
}) {
  const ok = pct >= target;
  const close = pct >= target * 0.7;
  return (
    <div className={cn(
      "rounded-xl p-4 ring-1 ring-inset",
      ok ? "bg-emerald-500/8 ring-emerald-500/30" :
      close ? "bg-amber-500/8 ring-amber-500/30" : "bg-rose-500/8 ring-rose-500/30",
    )}>
      <div className="flex items-center justify-between mb-2">
        <span className="text-[10px] uppercase tracking-widest text-slate-500">{label}</span>
        <span className={cn("h-7 w-7 rounded-md bg-white/5 grid place-items-center",
          ok ? "text-emerald-300" : close ? "text-amber-300" : "text-rose-300")}>{icon}</span>
      </div>
      <p className={cn("text-2xl font-extrabold tabular-nums",
        ok ? "text-emerald-200" : close ? "text-amber-200" : "text-rose-200")}>
        {hint ?? `${pct.toFixed(0)}%`}
      </p>
      <p className="text-[10px] text-slate-500 mt-0.5">meta {target}%</p>
    </div>
  );
}
