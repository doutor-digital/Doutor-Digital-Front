import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Calendar, Trophy, Users, CalendarRange } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { EvolutionLine } from "@/components/charts/EvolutionLine";
import { EmptyState } from "@/components/ui/EmptyState";
import { webhooksService } from "@/services/webhooks";
import { useClinic } from "@/hooks/useClinic";
import { cn, formatNumber } from "@/lib/utils";

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
      };
    }
    const total = data.reduce((a, d) => a + d.total, 0);
    const avg = total / data.length;
    const bestMonth = data.reduce((a, d) => (d.total > a.total ? d : a), data[0]);
    return { total, avg, bestMonth };
  }, [data]);

  const loading = serie.isLoading;

  return (
    <>
      <PageHeader
        title="Quantos leads chegaram?"
        description="Veja, mês a mês, o volume de pacientes que entrou em contato com a sua clínica."
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
            <span className="text-slate-500 text-xs">até</span>
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
              Últimos 12 meses
            </Button>
          </div>
        }
      />

      {/* ── 3 números simples ─────────────────────────────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-4">
        <SimpleStat
          icon={<Users className="h-4 w-4" />}
          label="Total de leads"
          value={loading ? null : formatNumber(stats.total)}
          hint="no período selecionado"
          tone="brand"
        />
        <SimpleStat
          icon={<CalendarRange className="h-4 w-4" />}
          label="Média por mês"
          value={loading ? null : formatNumber(Math.round(stats.avg))}
          hint={data.length ? `${data.length} meses` : "—"}
          tone="brand"
        />
        <SimpleStat
          icon={<Trophy className="h-4 w-4" />}
          label="Melhor mês"
          value={loading ? null : stats.bestMonth ? formatNumber(stats.bestMonth.total) : "—"}
          hint={stats.bestMonth?.periodo}
          tone="accent"
        />
      </div>

      {/* ── Gráfico ─────────────────────────────────────────────────── */}
      <Card className="mb-4">
        <CardHeader
          title="Leads por mês"
          subtitle="Cada ponto representa um mês"
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

      {/* ── Lista mês a mês ─────────────────────────────────────────── */}
      {!loading && data.length > 0 && (
        <Card>
          <CardHeader
            title="Mês a mês"
            subtitle="A barra compara cada mês com o melhor do período"
          />
          <CardBody className="p-0">
            <MonthList data={data} best={stats.bestMonth?.total ?? 0} />
          </CardBody>
        </Card>
      )}
    </>
  );
}

/* ─── Número grande, sem enfeite ─────────────────────────────────────── */

function SimpleStat({
  icon,
  label,
  value,
  hint,
  tone,
}: {
  icon: React.ReactNode;
  label: string;
  value: string | null;
  hint?: string;
  tone: "brand" | "accent";
}) {
  const toneMap = {
    brand: {
      iconBg: "bg-brand-500/12 text-brand-600 dark:text-brand-300",
      bar: "bg-brand-500",
    },
    accent: {
      iconBg: "bg-accent-500/15 text-accent-700 dark:text-accent-400",
      bar: "bg-accent-500",
    },
  }[tone];

  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-2xl",
        "bg-surface border border-hairline shadow-card",
        "px-5 py-4"
      )}
    >
      <div className="flex items-center gap-3">
        <span
          className={cn(
            "flex h-9 w-9 shrink-0 items-center justify-center rounded-xl",
            toneMap.iconBg
          )}
        >
          {icon}
        </span>
        <div className="min-w-0">
          <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
            {label}
          </div>
          <div className="mt-0.5 text-2xl font-bold leading-none tabular-nums text-slate-50">
            {value ?? <span className="inline-block skeleton h-7 w-20 rounded" />}
          </div>
          {hint && (
            <div className="mt-1 text-[11px] text-slate-500">{hint}</div>
          )}
        </div>
      </div>

      <div className={cn("absolute bottom-0 left-0 right-0 h-[2px] opacity-60", toneMap.bar)} />
    </div>
  );
}

/* ─── Lista mês a mês (simples) ──────────────────────────────────────── */

function MonthList({
  data,
  best,
}: {
  data: Array<{ periodo: string; total: number }>;
  best: number;
}) {
  return (
    <ul className="divide-y divide-hairline">
      {data.map((r, i) => {
        const barPct = best > 0 ? (r.total / best) * 100 : 0;
        const isBest = r.total === best && best > 0;
        return (
          <li
            key={`${r.periodo}-${i}`}
            className="flex items-center gap-4 px-5 py-3.5 transition-colors hover:bg-white/[0.04]"
          >
            {/* Mês */}
            <div className="w-20 shrink-0 font-medium text-slate-200">
              {r.periodo}
            </div>

            {/* Barra */}
            <div className="flex-1 min-w-0">
              <div className="h-2 w-full rounded-full bg-slate-500/10 overflow-hidden">
                <div
                  className={cn(
                    "h-full rounded-full transition-all",
                    isBest
                      ? "bg-gradient-to-r from-accent-500 to-accent-600"
                      : "bg-gradient-to-r from-brand-500 to-brand-600"
                  )}
                  style={{ width: `${Math.max(2, barPct)}%` }}
                />
              </div>
            </div>

            {/* Valor */}
            <div className="w-24 shrink-0 text-right">
              <span className="text-sm font-semibold tabular-nums text-slate-100">
                {formatNumber(r.total)}
              </span>
              {isBest && (
                <span className="ml-1.5 chip bg-accent-500/15 text-accent-700 dark:text-accent-400">
                  topo
                </span>
              )}
            </div>
          </li>
        );
      })}
    </ul>
  );
}
