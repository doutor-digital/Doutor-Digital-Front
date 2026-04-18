import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { PageHeader } from "@/components/layout/PageHeader";
import { EmptyState } from "@/components/ui/EmptyState";
import { SourceDonut } from "@/components/charts/SourceDonut";
import { useClinic } from "@/hooks/useClinic";
import { webhooksService } from "@/services/webhooks";
import { formatNumber, formatPercent } from "@/lib/utils";
import { cn } from "@/lib/utils";
import {
  TrendingUp, Target, BarChart2, Zap, Award, ArrowUpRight, ArrowDownRight, Minus,
} from "lucide-react";

/* ═══════════════════════════════════════════════════════════
   PAGE
═══════════════════════════════════════════════════════════ */
export default function SourcesPage() {
  const { unitId } = useClinic();

  const origem = useQuery({
    queryKey: ["sources-origem", unitId],
    queryFn:  () => webhooksService.origemCloudia(unitId || undefined),
  });
  const source = useQuery({
    queryKey: ["sources-final", unitId],
    queryFn:  () => webhooksService.sourceFinal(unitId || undefined),
  });
  const leads = useQuery({
    queryKey: ["sources-leads", unitId],
    queryFn:  () => webhooksService.listLeads({ clinicId: unitId || undefined }),
  });

  const converted = useMemo(() => {
    const list = leads.data ?? [];
    const map: Record<string, { total: number; convertidos: number }> = {};
    for (const l of list) {
      const key = (l.source ?? "Sem origem").toString();
      if (!map[key]) map[key] = { total: 0, convertidos: 0 };
      map[key].total += 1;
      const stage = (l.currentStage ?? "").toLowerCase();
      if (stage.includes("fechou") || stage.includes("tratamento")) {
        map[key].convertidos += 1;
      }
    }
    return Object.entries(map)
      .map(([source, v]) => ({
        source,
        total:      v.total,
        convertidos: v.convertidos,
        taxa:        v.total > 0 ? (v.convertidos / v.total) * 100 : 0,
      }))
      .sort((a, b) => b.total - a.total);
  }, [leads.data]);

  const donutData = useMemo(() => {
    return (origem.data ?? []).slice(0, 10).map((o) => ({
      name:  o.origem ?? "—",
      value: o.quantidade ?? 0,
    }));
  }, [origem.data]);

  /* ── KPI resumo ── */
  const totalLeads     = useMemo(() => converted.reduce((s, r) => s + r.total, 0), [converted]);
  const totalConvert   = useMemo(() => converted.reduce((s, r) => s + r.convertidos, 0), [converted]);
  const taxaGeral      = totalLeads > 0 ? (totalConvert / totalLeads) * 100 : 0;
  const melhorOrigem   = converted[0];
  const totalOrigens   = converted.length;

  return (
    <div className="space-y-5 animate-in fade-in slide-in-from-bottom-2 duration-400">

      <PageHeader
        title="Origens"
        description="Quais canais trazem — e convertem — mais leads"
      />

      {/* ━━━ KPI STRIP ━━━ */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KpiCard
          icon={<BarChart2 className="h-4 w-4" />}
          label="Total de leads"
          value={formatNumber(totalLeads)}
          tone="blue"
          loading={leads.isLoading}
        />
        <KpiCard
          icon={<TrendingUp className="h-4 w-4" />}
          label="Convertidos"
          value={formatNumber(totalConvert)}
          tone="emerald"
          loading={leads.isLoading}
        />
        <KpiCard
          icon={<Zap className="h-4 w-4" />}
          label="Taxa geral"
          value={formatPercent(taxaGeral)}
          tone={taxaGeral >= 30 ? "emerald" : taxaGeral >= 15 ? "amber" : "red"}
          loading={leads.isLoading}
        />
        <KpiCard
          icon={<Award className="h-4 w-4" />}
          label="Origens ativas"
          value={String(totalOrigens)}
          sub={melhorOrigem ? `Melhor: ${melhorOrigem.source}` : undefined}
          tone="violet"
          loading={leads.isLoading}
        />
      </div>

      {/* ━━━ DONUTS ━━━ */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <ChartCard
          title="Distribuição por origem"
          subtitle="Cloudia — origens registradas"
          icon={<Target className="h-4 w-4 text-violet-400" />}
          loading={origem.isLoading}
        >
          {donutData.length
            ? <SourceDonut data={donutData} />
            : <EmptyState title="Sem dados de origem" />
          }
        </ChartCard>

        <ChartCard
          title="Source final"
          subtitle="Meta · Google · Direto · Outros"
          icon={<TrendingUp className="h-4 w-4 text-brand-400" />}
          loading={source.isLoading}
        >
          {source.data && source.data.length > 0
            ? <SourceDonut data={source.data.map((s) => ({ name: s.source, value: s.count }))} />
            : <EmptyState title="Sem dados de source" />
          }
        </ChartCard>
      </div>

      {/* ━━━ TABELA DE PERFORMANCE ━━━ */}
      <div className="rounded-2xl bg-slate-900/70 ring-1 ring-slate-800/80 backdrop-blur-sm overflow-hidden shadow-xl">

        {/* Header */}
        <div className="flex items-center justify-between gap-4 px-5 py-4 border-b border-slate-800/80">
          <div>
            <p className="text-sm font-semibold text-slate-100">Performance por origem</p>
            <p className="text-xs text-slate-500 mt-0.5">Total de leads × leads fechados por canal</p>
          </div>
          <div className="h-8 w-8 rounded-lg bg-slate-800/60 grid place-items-center shrink-0">
            <BarChart2 className="h-4 w-4 text-brand-400" />
          </div>
        </div>

        {leads.isLoading ? (
          <div className="p-5 space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="skeleton h-12 w-full rounded-xl" />
            ))}
          </div>
        ) : converted.length ? (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-800/60">
                  <th className="px-5 py-3 text-left">
                    <span className="text-[10px] font-bold uppercase tracking-widest text-slate-500">#</span>
                  </th>
                  <th className="px-5 py-3 text-left">
                    <span className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Origem</span>
                  </th>
                  <th className="px-5 py-3 text-right">
                    <span className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Leads</span>
                  </th>
                  <th className="px-5 py-3 text-right">
                    <span className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Convertidos</span>
                  </th>
                  <th className="px-5 py-3 text-right">
                    <span className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Taxa</span>
                  </th>
                  <th className="px-5 py-3 text-left min-w-[160px]">
                    <span className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Performance</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {converted.map((row, idx) => {
                  const isTop    = idx === 0;
                  const pct      = Math.min(100, row.taxa);
                  const barColor =
                    row.taxa >= 30 ? "from-emerald-500 to-emerald-400" :
                    row.taxa >= 15 ? "from-amber-500 to-amber-400"     :
                    row.taxa > 0   ? "from-brand-500 to-violet-500"    :
                    "from-slate-700 to-slate-600";
                  const toneText =
                    row.taxa >= 30 ? "text-emerald-300" :
                    row.taxa >= 15 ? "text-amber-300"   :
                    row.taxa > 0   ? "text-brand-300"   : "text-slate-500";
                  const TrendIcon =
                    row.taxa >= 30 ? ArrowUpRight :
                    row.taxa >= 15 ? Minus        : ArrowDownRight;

                  return (
                    <tr
                      key={row.source}
                      className="group border-b border-slate-800/40 last:border-0 hover:bg-slate-800/30 transition-colors"
                    >
                      {/* Rank */}
                      <td className="px-5 py-3.5">
                        <span className={cn(
                          "inline-flex h-6 w-6 rounded-lg items-center justify-center text-[11px] font-extrabold",
                          isTop
                            ? "bg-amber-500/20 text-amber-300"
                            : "bg-slate-800/60 text-slate-500"
                        )}>
                          {idx + 1}
                        </span>
                      </td>

                      {/* Origem */}
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-2.5">
                          <div className={cn(
                            "h-7 w-7 rounded-lg grid place-items-center shrink-0",
                            isTop ? "bg-amber-500/15" : "bg-slate-800/60"
                          )}>
                            <Target className={cn("h-3.5 w-3.5", isTop ? "text-amber-400" : "text-slate-500")} />
                          </div>
                          <span className="text-sm font-semibold text-slate-200 truncate max-w-[160px]">
                            {row.source}
                          </span>
                          {isTop && (
                            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-amber-500/15 text-amber-300 shrink-0">
                              Top
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Total */}
                      <td className="px-5 py-3.5 text-right">
                        <span className="text-sm font-bold text-slate-200 tabular-nums">
                          {formatNumber(row.total)}
                        </span>
                      </td>

                      {/* Convertidos */}
                      <td className="px-5 py-3.5 text-right">
                        <span className="text-sm font-bold text-emerald-300 tabular-nums">
                          {formatNumber(row.convertidos)}
                        </span>
                      </td>

                      {/* Taxa */}
                      <td className="px-5 py-3.5 text-right">
                        <span className={cn(
                          "inline-flex items-center gap-1 text-sm font-extrabold tabular-nums",
                          toneText
                        )}>
                          <TrendIcon className="h-3.5 w-3.5" />
                          {formatPercent(row.taxa)}
                        </span>
                      </td>

                      {/* Barra de performance */}
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-2.5">
                          <div className="flex-1 h-2 rounded-full bg-slate-800 overflow-hidden min-w-[100px]">
                            <div
                              className={cn("h-full rounded-full bg-gradient-to-r transition-all duration-700", barColor)}
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                          <span className="text-[11px] text-slate-500 tabular-nums w-8 text-right shrink-0">
                            {Math.round(pct)}%
                          </span>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="p-8">
            <EmptyState title="Sem leads para analisar" />
          </div>
        )}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   SUB-COMPONENTS
═══════════════════════════════════════════════════════════ */

function KpiCard({
  icon, label, value, sub, tone, loading,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  sub?: string;
  tone: "blue" | "emerald" | "amber" | "violet" | "red";
  loading?: boolean;
}) {
  const p = {
    blue:    { bg: "bg-brand-500/8",   ring: "ring-brand-500/15",   icon: "text-brand-400",   val: "text-brand-100"   },
    emerald: { bg: "bg-emerald-500/8", ring: "ring-emerald-500/15", icon: "text-emerald-400", val: "text-emerald-100" },
    amber:   { bg: "bg-amber-500/8",   ring: "ring-amber-500/15",   icon: "text-amber-400",   val: "text-amber-100"   },
    violet:  { bg: "bg-violet-500/8",  ring: "ring-violet-500/15",  icon: "text-violet-400",  val: "text-violet-100"  },
    red:     { bg: "bg-red-500/8",     ring: "ring-red-500/15",     icon: "text-red-400",     val: "text-red-100"     },
  }[tone];

  if (loading) return <div className="skeleton h-24 rounded-2xl" />;

  return (
    <div className={cn("rounded-2xl p-4 ring-1 backdrop-blur-sm", p.bg, p.ring)}>
      <div className="flex items-center justify-between mb-3">
        <span className="text-[10px] font-bold uppercase tracking-widest text-slate-500">{label}</span>
        <span className={cn("h-7 w-7 rounded-lg bg-white/5 grid place-items-center", p.icon)}>{icon}</span>
      </div>
      <p className={cn("text-2xl font-extrabold tracking-tight tabular-nums", p.val)}>{value}</p>
      {sub && <p className="text-[11px] text-slate-500 mt-0.5 truncate">{sub}</p>}
    </div>
  );
}

function ChartCard({
  title, subtitle, icon, loading, children,
}: {
  title: string;
  subtitle: string;
  icon: React.ReactNode;
  loading?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl bg-slate-900/70 ring-1 ring-slate-800/80 backdrop-blur-sm overflow-hidden shadow-xl">
      <div className="flex items-center justify-between gap-4 px-5 py-4 border-b border-slate-800/80">
        <div>
          <p className="text-sm font-semibold text-slate-100">{title}</p>
          <p className="text-xs text-slate-500 mt-0.5">{subtitle}</p>
        </div>
        <div className="h-8 w-8 rounded-lg bg-slate-800/60 grid place-items-center shrink-0">{icon}</div>
      </div>
      <div className="p-5">
        {loading
          ? <div className="skeleton h-72 w-full rounded-xl" />
          : children
        }
      </div>
    </div>
  );
}