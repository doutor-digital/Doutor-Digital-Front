import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { DollarSign, Filter, MousePointerClick, Tag, Target, TrendingUp } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { EmptyState } from "@/components/ui/EmptyState";
import { useClinic } from "@/hooks/useClinic";
import { insightsService, type UtmGroup } from "@/services/insights";
import { cn, formatCurrency, formatNumber, formatPercent } from "@/lib/utils";

const TABS = [
  { key: "sources", label: "Source", icon: Target },
  { key: "mediums", label: "Medium", icon: Filter },
  { key: "campaigns", label: "Campaign", icon: Tag },
  { key: "contents", label: "Content", icon: MousePointerClick },
  { key: "terms", label: "Term", icon: TrendingUp },
] as const;

type TabKey = typeof TABS[number]["key"];

export default function UtmExplorerPage() {
  const { unitId } = useClinic();
  const [tab, setTab] = useState<TabKey>("sources");

  const data = useQuery({
    queryKey: ["utm-explorer", unitId],
    queryFn: () => insightsService.utm({ unitId: unitId || undefined }),
  });

  const d = data.data;
  const rows: UtmGroup[] = (d?.[tab] as UtmGroup[] | undefined) ?? [];

  return (
    <div className="space-y-5 animate-in fade-in slide-in-from-bottom-2 duration-300">
      <PageHeader
        title="UTM Explorer"
        description="Drilldown por source/medium/campaign/content/term · CPL & ROAS mockados"
        badge="Insights · UTM"
      />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Kpi icon={<Target />} label="Leads" value={formatNumber(d?.totalLeads ?? 0)} />
        <Kpi icon={<TrendingUp />} label="Conversões" value={formatNumber(d?.totalConversions ?? 0)} />
        <Kpi icon={<DollarSign />} label="Spend (mock)" value={formatCurrency(d?.mockedAdSpend ?? 0)} />
        <Kpi icon={<DollarSign />} label="CPL médio (mock)" value={formatCurrency(d?.mockedCpl ?? 0)} />
      </div>

      <div className="inline-flex flex-wrap items-center gap-1 p-1 rounded-lg bg-white/[0.03] border border-white/[0.06]">
        {TABS.map((t) => {
          const Icon = t.icon;
          return (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-[11.5px] font-medium transition",
                tab === t.key ? "bg-white/[0.08] text-slate-50" : "text-slate-400 hover:text-slate-200",
              )}
            >
              <Icon className="h-3.5 w-3.5" />
              {t.label}
            </button>
          );
        })}
      </div>

      <div className="rounded-2xl bg-slate-900/70 ring-1 ring-slate-800/80 overflow-hidden">
        {data.isLoading ? (
          <div className="p-6 space-y-2">
            {Array.from({ length: 6 }).map((_, i) => <div key={i} className="h-9 rounded bg-white/[0.03] animate-pulse" />)}
          </div>
        ) : rows.length === 0 ? (
          <div className="p-8"><EmptyState title="Sem dados nessa dimensão" /></div>
        ) : (
          <table className="w-full text-[12px]">
            <thead className="bg-slate-900/40 text-[10px] text-slate-500 uppercase tracking-widest">
              <tr>
                <th className="px-4 py-2.5 text-left">{TABS.find((t) => t.key === tab)?.label}</th>
                <th className="px-4 py-2.5 text-right">Leads</th>
                <th className="px-4 py-2.5 text-right">Conv.</th>
                <th className="px-4 py-2.5 text-right">Taxa</th>
                <th className="px-4 py-2.5 text-right">Spend (mock)</th>
                <th className="px-4 py-2.5 text-right">CPL (mock)</th>
                <th className="px-4 py-2.5 text-right">ROAS (mock)</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.key} className="border-t border-slate-800/40 hover:bg-slate-800/20">
                  <td className="px-4 py-2.5 text-slate-200 font-medium truncate max-w-[260px]">{r.key}</td>
                  <td className="px-4 py-2.5 text-right tabular-nums">{formatNumber(r.leads)}</td>
                  <td className="px-4 py-2.5 text-right tabular-nums text-emerald-300">{formatNumber(r.conversions)}</td>
                  <td className="px-4 py-2.5 text-right tabular-nums">{formatPercent(r.conversionRate)}</td>
                  <td className="px-4 py-2.5 text-right tabular-nums">{formatCurrency(r.mockedSpend)}</td>
                  <td className="px-4 py-2.5 text-right tabular-nums">{formatCurrency(r.mockedCpl)}</td>
                  <td className={cn("px-4 py-2.5 text-right tabular-nums font-bold",
                    r.mockedRoas >= 5 ? "text-emerald-300" :
                    r.mockedRoas >= 2 ? "text-amber-300" : "text-rose-300"
                  )}>{r.mockedRoas.toFixed(2)}x</td>
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
