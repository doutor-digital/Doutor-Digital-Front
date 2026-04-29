import { useQuery } from "@tanstack/react-query";
import { Network, Route as RouteIcon, Trophy } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { EmptyState } from "@/components/ui/EmptyState";
import { useClinic } from "@/hooks/useClinic";
import { insightsService } from "@/services/insights";
import { cn, formatNumber } from "@/lib/utils";

export default function AttributionPathPage() {
  const { unitId } = useClinic();
  const data = useQuery({
    queryKey: ["attribution-summary", unitId],
    queryFn: () => insightsService.attributionSummary({ unitId: unitId || undefined }),
  });

  const d = data.data;

  return (
    <div className="space-y-5 animate-in fade-in slide-in-from-bottom-2 duration-300">
      <PageHeader
        title="Caminho de Atribuição"
        description="Quem trouxe o lead × quem fechou — first / last / linear touch"
        badge="Insights · Atribuição"
      />

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <Stat icon={<RouteIcon />} label="Total de leads" value={formatNumber(d?.totalLeads ?? 0)} tone="slate" />
        <Stat icon={<Trophy />} label="Convertidos" value={formatNumber(d?.totalConverted ?? 0)} tone="emerald" />
        <Stat icon={<Network />} label="Modelos calculados" value="3" tone="violet" />
      </div>

      {data.isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {Array.from({ length: 3 }).map((_, i) => <div key={i} className="h-72 rounded-xl bg-white/[0.02] animate-pulse" />)}
        </div>
      ) : !d || d.linearBreakdown.length === 0 ? (
        <EmptyState title="Sem dados de atribuição no período" />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <ModelCard title="First-touch" subtitle="Crédito vai para o primeiro contato" rows={d.firstTouchBreakdown} accent="emerald" />
          <ModelCard title="Last-touch"  subtitle="Crédito vai para o último contato"  rows={d.lastTouchBreakdown}  accent="amber"   />
          <ModelCard title="Linear"      subtitle="Crédito distribuído igualmente"     rows={d.linearBreakdown}     accent="violet"  />
        </div>
      )}
    </div>
  );
}

function ModelCard({ title, subtitle, rows, accent }: {
  title: string;
  subtitle: string;
  rows: { source: string; score: number; leads: number; conversions: number }[];
  accent: "emerald" | "amber" | "violet";
}) {
  const max = Math.max(1, ...rows.map((r) => r.leads));
  const accentColor = {
    emerald: "from-emerald-500 to-emerald-400 text-emerald-300",
    amber: "from-amber-500 to-amber-400 text-amber-300",
    violet: "from-violet-500 to-violet-400 text-violet-300",
  }[accent];

  return (
    <div className="rounded-2xl bg-slate-900/70 ring-1 ring-slate-800/80 overflow-hidden">
      <div className="px-5 py-3 border-b border-slate-800/80">
        <p className="text-sm font-semibold text-slate-100">{title}</p>
        <p className="text-[11px] text-slate-500 mt-0.5">{subtitle}</p>
      </div>
      <div className="p-3 space-y-2">
        {rows.slice(0, 10).map((r) => (
          <div key={r.source} className="rounded-lg bg-slate-900/40 px-3 py-2">
            <div className="flex items-center justify-between">
              <span className="text-[12px] font-semibold text-slate-200 truncate">{r.source}</span>
              <span className={cn("text-[11px] tabular-nums font-bold", accentColor.split(" ").pop())}>{r.score.toFixed(1)}</span>
            </div>
            <div className="mt-1.5 h-1.5 rounded-full bg-slate-800 overflow-hidden">
              <div className={cn("h-full bg-gradient-to-r", accentColor)}
                style={{ width: `${(r.leads / max) * 100}%` }} />
            </div>
            <div className="mt-1 flex items-center justify-between text-[10.5px] text-slate-500">
              <span>{r.leads} leads</span>
              <span>{r.conversions} conv.</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function Stat({ icon, label, value, tone }: {
  icon: React.ReactNode; label: string; value: string; tone: "slate" | "emerald" | "violet";
}) {
  const c = {
    slate: "bg-slate-900/60 ring-slate-700/40 text-slate-200",
    emerald: "bg-emerald-500/8 ring-emerald-500/30 text-emerald-200",
    violet: "bg-indigo-500/8 ring-indigo-500/30 text-indigo-200",
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
