import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import {
  ArrowUpRight,
  ArrowDownRight,
  Calendar,
  LineChart as LineIcon,
  Sigma,
  Trophy,
  TrendingUp,
} from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { EvolutionLine } from "@/components/charts/EvolutionLine";
import { EmptyState } from "@/components/ui/EmptyState";
import { KpiCard } from "@/components/kpi/KpiCard";
import { webhooksService } from "@/services/webhooks";
import { useClinic } from "@/hooks/useClinic";
import { cn, formatNumber } from "@/lib/utils";

const DATE_FMT = new Intl.DateTimeFormat("pt-BR", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
});

function formatDate(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return DATE_FMT.format(d);
}

export default function EvolutionPage() {
  const { tenantId } = useClinic();

  const defaultRange = useMemo(() => {
    const end = new Date();
    const start = new Date();
    start.setMonth(start.getMonth() - 11);
    start.setDate(1);
    return {
      start: start.toISOString().slice(0, 10),
      end: end.toISOString().slice(0, 10),
    };
  }, []);

  const [range, setRange] = useState(defaultRange);

  const serie = useQuery({
    queryKey: ["evolution", tenantId, range],
    queryFn: () =>
      webhooksService.buscarInicioFim({
        clinicId: tenantId || undefined,
        dataInicio: range.start,
        dataFim: range.end,
      }),
  });

  const data = serie.data ?? [];

  const stats = useMemo(() => {
    if (data.length === 0) {
      return {
        total: 0,
        avg: 0,
        bestMonth: null as null | { periodo: string; total: number },
        worstMonth: null as null | { periodo: string; total: number },
        growth: 0,
        first: 0,
        last: 0,
      };
    }
    const total = data.reduce((a, d) => a + d.total, 0);
    const avg = total / data.length;
    const bestMonth = data.reduce((a, d) => (d.total > a.total ? d : a), data[0]);
    const worstMonth = data.reduce((a, d) => (d.total < a.total ? d : a), data[0]);
    const first = data[0].total;
    const last = data[data.length - 1].total;
    const growth = first > 0 ? ((last - first) / first) * 100 : last > 0 ? 100 : 0;
    return { total, avg, bestMonth, worstMonth, growth, first, last };
  }, [data]);

  const loading = serie.isLoading;

  return (
    <>
      <PageHeader
        title="Evolução temporal"
        description="Volume de leads ao longo do tempo, agrupado por mês"
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative">
              <Calendar className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-500" />
              <Input
                type="date"
                value={range.start}
                onChange={(e) => setRange((r) => ({ ...r, start: e.target.value }))}
                className="pl-8"
              />
            </div>
            <span className="text-slate-500 text-xs">→</span>
            <div className="relative">
              <Calendar className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-500" />
              <Input
                type="date"
                value={range.end}
                onChange={(e) => setRange((r) => ({ ...r, end: e.target.value }))}
                className="pl-8"
              />
            </div>
            <Button variant="outline" size="sm" onClick={() => setRange(defaultRange)}>
              Resetar
            </Button>
          </div>
        }
      />

      {/* ── KPIs ─────────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
        <KpiCard
          label="Total no período"
          value={stats.total}
          icon={<Sigma />}
          tone="blue"
          subtitle={`${formatDate(range.start)} → ${formatDate(range.end)}`}
          loading={loading}
        />
        <KpiCard
          label="Média mensal"
          value={Math.round(stats.avg)}
          icon={<LineIcon />}
          tone="blue"
          subtitle={data.length ? `${data.length} meses analisados` : "—"}
          loading={loading}
        />
        <KpiCard
          label="Melhor mês"
          value={stats.bestMonth ? stats.bestMonth.total : 0}
          icon={<Trophy />}
          tone="amber"
          subtitle={stats.bestMonth?.periodo}
          loading={loading}
        />
        <KpiCard
          label="Crescimento"
          value={`${stats.growth >= 0 ? "+" : ""}${stats.growth.toFixed(1)}%`}
          icon={<TrendingUp />}
          tone={stats.growth >= 0 ? "green" : "red"}
          subtitle={
            data.length > 1
              ? `${formatNumber(stats.first)} → ${formatNumber(stats.last)}`
              : "sem comparação"
          }
          loading={loading}
        />
      </div>

      {/* ── Chart ────────────────────────────────────────────────────────── */}
      <Card className="mb-4">
        <CardHeader
          title="Captação mensal"
          subtitle="Leads por mês dentro do intervalo selecionado"
          action={
            <span className="inline-flex items-center gap-1.5 rounded-full border border-hairline bg-surface-2 px-2.5 py-0.5 text-[10.5px] font-semibold text-slate-500">
              <span className="h-1.5 w-1.5 rounded-full bg-brand-600" />
              Leads
            </span>
          }
        />
        <CardBody>
          {loading ? (
            <div className="skeleton h-80 w-full rounded" />
          ) : data.length > 0 ? (
            <EvolutionLine data={data} />
          ) : (
            <EmptyState title="Sem dados no período escolhido" />
          )}
        </CardBody>
      </Card>

      {/* ── Monthly breakdown ────────────────────────────────────────────── */}
      {!loading && data.length > 0 && (
        <Card>
          <CardHeader
            title="Detalhamento por mês"
            subtitle="Ranking com barra de participação relativa"
          />
          <CardBody className="p-0">
            <MonthlyTable data={data} total={stats.total} best={stats.bestMonth?.total ?? 0} />
          </CardBody>
        </Card>
      )}
    </>
  );
}

/* ─── Monthly table ────────────────────────────────────────────────────── */

function MonthlyTable({
  data,
  total,
  best,
}: {
  data: Array<{ periodo: string; total: number; ano?: number; mes?: number }>;
  total: number;
  best: number;
}) {
  const rows = [...data].map((d, i, arr) => {
    const prev = i > 0 ? arr[i - 1].total : null;
    const delta = prev !== null && prev > 0 ? ((d.total - prev) / prev) * 100 : null;
    const share = total > 0 ? (d.total / total) * 100 : 0;
    const barPct = best > 0 ? (d.total / best) * 100 : 0;
    return { ...d, delta, share, barPct, isBest: d.total === best && best > 0 };
  });

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[640px] text-sm">
        <thead>
          <tr className="border-b border-hairline">
            <th className="px-5 py-2.5 text-left text-[10.5px] font-semibold uppercase tracking-wider text-slate-500">
              Mês
            </th>
            <th className="px-5 py-2.5 text-right text-[10.5px] font-semibold uppercase tracking-wider text-slate-500">
              Leads
            </th>
            <th className="px-5 py-2.5 text-right text-[10.5px] font-semibold uppercase tracking-wider text-slate-500">
              Δ vs anterior
            </th>
            <th className="px-5 py-2.5 text-right text-[10.5px] font-semibold uppercase tracking-wider text-slate-500">
              % do total
            </th>
            <th className="px-5 py-2.5 text-left text-[10.5px] font-semibold uppercase tracking-wider text-slate-500 w-[28%]">
              Participação
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr
              key={`${r.periodo}-${i}`}
              className={cn(
                "border-b border-hairline/70 last:border-0 transition-colors",
                "hover:bg-white/[0.04]"
              )}
            >
              <td className="px-5 py-3 font-medium text-slate-200">
                <span className="inline-flex items-center gap-2">
                  {r.periodo}
                  {r.isBest && (
                    <span className="chip bg-accent-500/15 text-accent-700 dark:text-accent-400">
                      topo
                    </span>
                  )}
                </span>
              </td>
              <td className="px-5 py-3 text-right tabular-nums text-slate-200">
                {formatNumber(r.total)}
              </td>
              <td className="px-5 py-3 text-right tabular-nums">
                {r.delta === null ? (
                  <span className="text-slate-500">—</span>
                ) : (
                  <span
                    className={cn(
                      "inline-flex items-center gap-0.5 rounded-md px-1.5 py-0.5 text-[11px] font-semibold",
                      r.delta >= 0
                        ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                        : "bg-red-500/10 text-red-600 dark:text-red-400"
                    )}
                  >
                    {r.delta >= 0 ? (
                      <ArrowUpRight className="h-3 w-3" />
                    ) : (
                      <ArrowDownRight className="h-3 w-3" />
                    )}
                    {r.delta >= 0 ? "+" : ""}
                    {r.delta.toFixed(1)}%
                  </span>
                )}
              </td>
              <td className="px-5 py-3 text-right tabular-nums text-slate-400">
                {r.share.toFixed(1)}%
              </td>
              <td className="px-5 py-3">
                <div className="h-1.5 w-full rounded-full bg-slate-500/10 overflow-hidden">
                  <div
                    className={cn(
                      "h-full rounded-full transition-all",
                      r.isBest
                        ? "bg-gradient-to-r from-accent-500 to-accent-600"
                        : "bg-gradient-to-r from-brand-500 to-brand-600"
                    )}
                    style={{ width: `${Math.max(2, r.barPct)}%` }}
                  />
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
