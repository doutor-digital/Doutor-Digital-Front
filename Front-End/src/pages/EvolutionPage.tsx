import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import {
  Calendar,
  ArrowUpRight,
  ArrowDownRight,
  Minus,
} from "lucide-react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ComposedChart,
  Legend,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { Tabs } from "@/components/ui/Tabs";
import { EvolutionLine } from "@/components/charts/EvolutionLine";
import { EmptyState } from "@/components/ui/EmptyState";
import { webhooksService } from "@/services/webhooks";
import { useClinic } from "@/hooks/useClinic";
import { cn, formatNumber, formatPercent } from "@/lib/utils";
import type { EvolutionMonthPointDto } from "@/types";

/* ────────────────────────────────────────────────────────────────
 * Princípios aplicados
 * ──────────────────────────────────────────────────────────────
 * 1. Paleta restrita: neutro (slate) como base, indigo como único
 *    accent de marca, verde/vermelho SOMENTE com função semântica
 *    (variação positiva/negativa). Nada de violeta→fuchsia decorativo.
 * 2. Data-ink ratio (Tufte): remover gradientes, brilhos, sombras
 *    múltiplas, barrinhas decorativas. Cada pixel de cor precisa
 *    comunicar algo.
 * 3. Hierarquia tipográfica: KPI = número grande e pesado; label
 *    pequeno, uppercase sutil; hint discreto. Três níveis claros.
 * 4. Lei da proximidade: cards agrupam informação relacionada;
 *    espaço entre grupos (gap-6) maior que dentro deles (gap-3).
 * 5. Consistência: um único estilo de card, um único radius,
 *    um único set de cores, uma única forma de mostrar delta.
 * 6. Cognitive load: removida a seção "Sugestões para ir além"
 *    (era uma lista de TODOs interna exposta ao usuário final).
 * ──────────────────────────────────────────────────────────────── */

const MODE_BASIC = "basic";
const MODE_ADVANCED = "advanced";

// Paleta única para séries multi-categoria. Sequencial, harmônica,
// começando pela cor de marca. Evita o arco-íris aleatório.
const SERIES_PALETTE = [
  "#6366f1", // indigo (marca)
  "#0ea5e9", // sky
  "#14b8a6", // teal
  "#f59e0b", // amber
  "#f43f5e", // rose
  "#a855f7", // violet
  "#64748b", // slate
];

const AXIS_COLOR = "#64748b";
const GRID_COLOR = "rgba(148,163,184,.08)";

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

  const [mode, setMode] = useState<string>(MODE_BASIC);
  const [range, setRange] = useState(defaultRange);

  const basic = useQuery({
    queryKey: ["evolution-basic", tenantId, range],
    queryFn: () =>
      webhooksService.buscarInicioFim({
        clinicId: tenantId || undefined,
        dataInicio: range.start,
        dataFim: range.end,
      }),
    enabled: mode === MODE_BASIC,
  });

  const advanced = useQuery({
    queryKey: ["evolution-advanced", tenantId, range],
    queryFn: () =>
      webhooksService.evolutionAdvanced({
        clinicId: tenantId || undefined,
        dataInicio: range.start,
        dataFim: range.end,
      }),
    enabled: mode === MODE_ADVANCED,
  });

  return (
    <>
      <PageHeader
        title="Evolução de leads"
        description="Acompanhe o volume ao longo do tempo e identifique padrões."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <DateField
              value={range.start}
              onChange={(v) => setRange((r) => ({ ...r, start: v }))}
            />
            <span className="text-xs text-slate-500">até</span>
            <DateField
              value={range.end}
              onChange={(v) => setRange((r) => ({ ...r, end: v }))}
            />
            <Button
              variant="outline"
              size="sm"
              onClick={() => setRange(defaultRange)}
            >
              Últimos 12 meses
            </Button>
          </div>
        }
      />

      <div className="mb-6">
        <Tabs
          value={mode}
          onChange={setMode}
          tabs={[
            { value: MODE_BASIC, label: "Resumo" },
            { value: MODE_ADVANCED, label: "Análise detalhada" },
          ]}
        />
      </div>

      {mode === MODE_BASIC ? (
        <BasicMode data={basic.data ?? []} loading={basic.isLoading} />
      ) : (
        <AdvancedMode data={advanced.data} loading={advanced.isLoading} />
      )}
    </>
  );
}

/* ═══════════════════════════════════════════════════════════════
 *  MODO BÁSICO
 * ═══════════════════════════════════════════════════════════════ */

function BasicMode({
  data,
  loading,
}: {
  data: Array<{ periodo: string; total: number }>;
  loading: boolean;
}) {
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
    const bestMonth = data.reduce(
      (a, d) => (d.total > a.total ? d : a),
      data[0]
    );
    return { total, avg, bestMonth };
  }, [data]);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        <Kpi
          label="Total de leads"
          value={loading ? null : formatNumber(stats.total)}
          hint="no período selecionado"
        />
        <Kpi
          label="Média mensal"
          value={loading ? null : formatNumber(Math.round(stats.avg))}
          hint={data.length ? `${data.length} meses` : "—"}
        />
        <Kpi
          label="Melhor mês"
          value={
            loading
              ? null
              : stats.bestMonth
              ? formatNumber(stats.bestMonth.total)
              : "—"
          }
          hint={stats.bestMonth?.periodo}
        />
      </div>

      <Card>
        <CardHeader title="Leads por mês" />
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

      {!loading && data.length > 0 && (
        <Card>
          <CardHeader
            title="Detalhamento mensal"
            subtitle="Comparativo com o melhor mês do período"
          />
          <CardBody className="p-0">
            <MonthList data={data} best={stats.bestMonth?.total ?? 0} />
          </CardBody>
        </Card>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
 *  MODO AVANÇADO
 * ═══════════════════════════════════════════════════════════════ */

function AdvancedMode({
  data,
  loading,
}: {
  data: import("@/types").EvolutionAdvancedDto | undefined;
  loading: boolean;
}) {
  if (loading || !data) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="skeleton h-24 rounded-xl" />
          ))}
        </div>
        <div className="skeleton h-80 w-full rounded-xl" />
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <div className="skeleton h-64 rounded-xl" />
          <div className="skeleton h-64 rounded-xl" />
        </div>
      </div>
    );
  }

  const monthly = data.monthly;
  const forecast = useMemo(() => buildForecast(monthly, 3), [monthly]);

  const mergedSeries = useMemo(
    () => [
      ...monthly.map((m) => ({
        label: m.label,
        total: m.total,
        cumulative: m.cumulative,
        mm3: m.movingAverage3,
        forecast: null as number | null,
      })),
      ...forecast.map((f) => ({
        label: f.label,
        total: null as number | null,
        cumulative: null,
        mm3: null,
        forecast: f.value,
      })),
    ],
    [monthly, forecast]
  );

  const topGrowth = useMemo(
    () =>
      monthly
        .filter((m) => m.momGrowthPercent !== null)
        .slice()
        .sort(
          (a, b) => (b.momGrowthPercent ?? 0) - (a.momGrowthPercent ?? 0)
        )
        .slice(0, 3),
    [monthly]
  );
  const topDrop = useMemo(
    () =>
      monthly
        .filter((m) => m.momGrowthPercent !== null)
        .slice()
        .sort(
          (a, b) => (a.momGrowthPercent ?? 0) - (b.momGrowthPercent ?? 0)
        )
        .slice(0, 3),
    [monthly]
  );

  const stackedSources = useMemo(() => {
    const months = monthly.map((m) => m.label);
    return months.map((lbl) => {
      const row: Record<string, number | string> = { label: lbl };
      data.sourcesOverTime.forEach((s) => {
        const p = s.points.find((x) => x.label === lbl);
        row[s.source] = p?.count ?? 0;
      });
      return row;
    });
  }, [monthly, data.sourcesOverTime]);

  const weekdayMax = Math.max(1, ...data.weekday.map((w) => w.total));
  const hourMax = Math.max(1, ...data.hour.map((h) => h.total));

  return (
    <div className="space-y-6">
      {/* KPIs — hierarquia única: número grande, label pequeno, delta semântico */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        <Kpi
          label="Total"
          value={formatNumber(data.totalLeads)}
          hint={`${monthly.length} meses`}
        />
        <Kpi
          label="Média mensal"
          value={formatNumber(Math.round(data.averageMonthly))}
          hint={`mediana ${formatNumber(Math.round(data.medianMonthly))}`}
        />
        <Kpi
          label="Crescimento"
          value={formatPercent(data.growthPercentFirstToLast)}
          hint="1º vs último mês"
          delta={data.growthPercentFirstToLast}
        />
        <Kpi
          label="Melhor mês"
          value={formatNumber(data.bestMonthTotal)}
          hint={data.bestMonthLabel}
        />
        <Kpi
          label="Desvio padrão"
          value={formatNumber(Math.round(data.stdDevMonthly))}
          hint="volatilidade"
        />
        <Kpi
          label="Projeção 1m"
          value={
            forecast[0] ? formatNumber(Math.round(forecast[0].value)) : "—"
          }
          hint="tendência linear"
        />
      </div>

      {/* Série principal */}
      <Card>
        <CardHeader
          title="Volume, tendência e projeção"
          subtitle="Dados reais, média móvel de 3 meses e previsão para os próximos 3"
        />
        <CardBody>
          {monthly.length === 0 ? (
            <EmptyState title="Sem dados no período escolhido" />
          ) : (
            <div className="h-80 w-full">
              <ResponsiveContainer>
                <ComposedChart
                  data={mergedSeries}
                  margin={{ top: 12, right: 16, left: 0, bottom: 0 }}
                >
                  <defs>
                    <linearGradient id="fill-volume" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#6366f1" stopOpacity={0.2} />
                      <stop offset="100%" stopColor="#6366f1" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid
                    strokeDasharray="3 3"
                    stroke={GRID_COLOR}
                    vertical={false}
                  />
                  <XAxis
                    dataKey="label"
                    tick={{ fill: AXIS_COLOR, fontSize: 11 }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    tick={{ fill: AXIS_COLOR, fontSize: 11 }}
                    axisLine={false}
                    tickLine={false}
                    width={40}
                  />
                  <Tooltip content={<ChartTooltip />} />
                  <Legend
                    wrapperStyle={{ color: "#94a3b8", fontSize: 11, paddingTop: 8 }}
                    iconType="line"
                  />
                  <Area
                    type="monotone"
                    dataKey="total"
                    name="Volume"
                    stroke="#6366f1"
                    strokeWidth={2}
                    fill="url(#fill-volume)"
                  />
                  <Line
                    type="monotone"
                    dataKey="mm3"
                    name="Média móvel (3m)"
                    stroke="#94a3b8"
                    strokeWidth={1.5}
                    dot={false}
                  />
                  <Line
                    type="monotone"
                    dataKey="forecast"
                    name="Projeção"
                    stroke="#6366f1"
                    strokeWidth={1.5}
                    strokeDasharray="4 4"
                    dot={{ r: 2, fill: "#6366f1" }}
                  />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          )}
        </CardBody>
      </Card>

      {/* MoM + Acumulado */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader
            title="Variação mês a mês"
            subtitle="% em relação ao mês anterior"
          />
          <CardBody>
            {monthly.length < 2 ? (
              <EmptyState title="É necessário ao menos 2 meses" />
            ) : (
              <div className="h-64 w-full">
                <ResponsiveContainer>
                  <BarChart
                    data={monthly.slice(1)}
                    margin={{ top: 10, right: 10, left: 0, bottom: 0 }}
                  >
                    <CartesianGrid
                      strokeDasharray="3 3"
                      stroke={GRID_COLOR}
                      vertical={false}
                    />
                    <XAxis
                      dataKey="label"
                      tick={{ fill: AXIS_COLOR, fontSize: 11 }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <YAxis
                      tick={{ fill: AXIS_COLOR, fontSize: 11 }}
                      axisLine={false}
                      tickLine={false}
                      width={40}
                      tickFormatter={(v) => `${v}%`}
                    />
                    <Tooltip content={<ChartTooltip suffix="%" />} />
                    <ReferenceLine y={0} stroke="rgba(148,163,184,.35)" />
                    <Bar dataKey="momGrowthPercent" name="MoM" radius={[3, 3, 0, 0]}>
                      {monthly.slice(1).map((m, i) => (
                        <Cell
                          key={i}
                          fill={
                            (m.momGrowthPercent ?? 0) >= 0
                              ? "#10b981"
                              : "#f43f5e"
                          }
                        />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </CardBody>
        </Card>

        <Card>
          <CardHeader
            title="Volume acumulado"
            subtitle="Total corrente no período"
          />
          <CardBody>
            {monthly.length === 0 ? (
              <EmptyState title="Sem dados" />
            ) : (
              <div className="h-64 w-full">
                <ResponsiveContainer>
                  <AreaChart
                    data={monthly}
                    margin={{ top: 10, right: 10, left: 0, bottom: 0 }}
                  >
                    <defs>
                      <linearGradient id="fill-cumul" x1="0" y1="0" x2="0" y2="1">
                        <stop
                          offset="0%"
                          stopColor="#6366f1"
                          stopOpacity={0.2}
                        />
                        <stop
                          offset="100%"
                          stopColor="#6366f1"
                          stopOpacity={0}
                        />
                      </linearGradient>
                    </defs>
                    <CartesianGrid
                      strokeDasharray="3 3"
                      stroke={GRID_COLOR}
                      vertical={false}
                    />
                    <XAxis
                      dataKey="label"
                      tick={{ fill: AXIS_COLOR, fontSize: 11 }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <YAxis
                      tick={{ fill: AXIS_COLOR, fontSize: 11 }}
                      axisLine={false}
                      tickLine={false}
                      width={48}
                      tickFormatter={(v) => formatNumber(Number(v))}
                    />
                    <Tooltip content={<ChartTooltip />} />
                    <Area
                      type="monotone"
                      dataKey="cumulative"
                      name="Acumulado"
                      stroke="#6366f1"
                      strokeWidth={2}
                      fill="url(#fill-cumul)"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            )}
          </CardBody>
        </Card>
      </div>

      {/* Funil de conversão */}
      <Card>
        <CardHeader
          title="Funil de conversão mensal"
          subtitle="Volume total, agendamentos, pagamentos e tratamentos"
        />
        <CardBody>
          {data.conversionOverTime.length === 0 ? (
            <EmptyState title="Sem dados" />
          ) : (
            <div className="h-72 w-full">
              <ResponsiveContainer>
                <LineChart
                  data={data.conversionOverTime}
                  margin={{ top: 10, right: 16, left: 0, bottom: 0 }}
                >
                  <CartesianGrid
                    strokeDasharray="3 3"
                    stroke={GRID_COLOR}
                    vertical={false}
                  />
                  <XAxis
                    dataKey="label"
                    tick={{ fill: AXIS_COLOR, fontSize: 11 }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    tick={{ fill: AXIS_COLOR, fontSize: 11 }}
                    axisLine={false}
                    tickLine={false}
                    width={40}
                  />
                  <Tooltip content={<ChartTooltip />} />
                  <Legend
                    wrapperStyle={{
                      color: "#94a3b8",
                      fontSize: 11,
                      paddingTop: 8,
                    }}
                    iconType="line"
                  />
                  <Line
                    type="monotone"
                    dataKey="total"
                    name="Total"
                    stroke="#6366f1"
                    strokeWidth={2}
                    dot={{ r: 2 }}
                  />
                  <Line
                    type="monotone"
                    dataKey="agendado"
                    name="Agendado"
                    stroke="#0ea5e9"
                    strokeWidth={2}
                    dot={{ r: 2 }}
                  />
                  <Line
                    type="monotone"
                    dataKey="pago"
                    name="Pago"
                    stroke="#10b981"
                    strokeWidth={2}
                    dot={{ r: 2 }}
                  />
                  <Line
                    type="monotone"
                    dataKey="tratamento"
                    name="Tratamento"
                    stroke="#64748b"
                    strokeWidth={2}
                    dot={{ r: 2 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
        </CardBody>
      </Card>

      {/* Origens ao longo do tempo */}
      <Card>
        <CardHeader
          title="Origens ao longo do tempo"
          subtitle="Top 6 fontes de leads, empilhadas por mês"
        />
        <CardBody>
          {data.sourcesOverTime.length === 0 ? (
            <EmptyState title="Sem origens registradas" />
          ) : (
            <div className="h-80 w-full">
              <ResponsiveContainer>
                <BarChart
                  data={stackedSources}
                  margin={{ top: 10, right: 16, left: 0, bottom: 0 }}
                >
                  <CartesianGrid
                    strokeDasharray="3 3"
                    stroke={GRID_COLOR}
                    vertical={false}
                  />
                  <XAxis
                    dataKey="label"
                    tick={{ fill: AXIS_COLOR, fontSize: 11 }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    tick={{ fill: AXIS_COLOR, fontSize: 11 }}
                    axisLine={false}
                    tickLine={false}
                    width={40}
                  />
                  <Tooltip content={<ChartTooltip />} />
                  <Legend
                    wrapperStyle={{
                      color: "#94a3b8",
                      fontSize: 11,
                      paddingTop: 8,
                    }}
                  />
                  {data.sourcesOverTime.map((s, i) => (
                    <Bar
                      key={s.source}
                      dataKey={s.source}
                      stackId="origem"
                      fill={SERIES_PALETTE[i % SERIES_PALETTE.length]}
                      radius={
                        i === data.sourcesOverTime.length - 1
                          ? [3, 3, 0, 0]
                          : undefined
                      }
                    />
                  ))}
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </CardBody>
      </Card>

      {/* Sazonalidade */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader
            title="Leads por dia da semana"
            subtitle="Padrão semanal de chegada"
          />
          <CardBody>
            <div className="space-y-3">
              {data.weekday.map((w) => {
                const pct = (w.total / weekdayMax) * 100;
                return (
                  <div key={w.weekday}>
                    <div className="mb-1.5 flex items-center justify-between text-xs">
                      <span className="text-slate-300">{w.label}</span>
                      <span className="tabular-nums font-medium text-slate-100">
                        {formatNumber(w.total)}
                      </span>
                    </div>
                    <div className="h-1.5 overflow-hidden rounded-full bg-slate-800/60">
                      <div
                        className="h-full rounded-full bg-indigo-500"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </CardBody>
        </Card>

        <Card>
          <CardHeader
            title="Distribuição por hora"
            subtitle="Quando os leads chegam ao longo do dia"
          />
          <CardBody>
            <div className="flex h-48 items-end gap-[3px]">
              {data.hour.map((h) => {
                const pct = (h.total / hourMax) * 100;
                return (
                  <div
                    key={h.hour}
                    className="flex flex-1 flex-col items-center gap-1.5"
                  >
                    <div className="relative flex w-full flex-1 items-end">
                      <div
                        className="w-full rounded-t-sm bg-indigo-500/70 transition-colors hover:bg-indigo-400"
                        style={{
                          height: `${pct}%`,
                          minHeight: h.total > 0 ? 2 : 1,
                        }}
                        title={`${h.hour}h · ${h.total}`}
                      />
                    </div>
                    {h.hour % 3 === 0 && (
                      <span className="text-[9px] tabular-nums text-slate-500">
                        {String(h.hour).padStart(2, "0")}
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          </CardBody>
        </Card>
      </div>

      {/* Rankings */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader
            title="Maiores altas"
            subtitle="Meses que mais cresceram"
          />
          <CardBody className="p-0">
            <RankingList items={topGrowth} positive />
          </CardBody>
        </Card>

        <Card>
          <CardHeader
            title="Maiores quedas"
            subtitle="Meses de maior retração"
          />
          <CardBody className="p-0">
            <RankingList items={topDrop} positive={false} />
          </CardBody>
        </Card>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
 *  COMPONENTES
 * ═══════════════════════════════════════════════════════════════ */

function DateField({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="relative">
      <Calendar className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-500" />
      <Input
        type="date"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="pl-8"
      />
    </div>
  );
}

/**
 * KPI unificado. Sem ícones coloridos, sem barras decorativas, sem
 * gradientes. Hierarquia clara: label → número grande → hint.
 * Delta (se houver) usa cor semântica sóbria, não como decoração.
 */
function Kpi({
  label,
  value,
  hint,
  delta,
}: {
  label: string;
  value: string | null;
  hint?: string;
  delta?: number;
}) {
  return (
    <div className="rounded-xl border border-slate-800/60 bg-slate-900/30 px-5 py-4">
      <div className="text-[11px] font-medium uppercase tracking-wide text-slate-500">
        {label}
      </div>
      <div className="mt-2 flex items-baseline gap-2">
        <span className="text-[1.65rem] font-semibold leading-none tabular-nums text-slate-50">
          {value ?? <span className="skeleton inline-block h-7 w-20 rounded" />}
        </span>
        {typeof delta === "number" && <DeltaBadge value={delta} />}
      </div>
      {hint && (
        <div className="mt-1.5 text-[11px] text-slate-500">{hint}</div>
      )}
    </div>
  );
}

function DeltaBadge({ value }: { value: number }) {
  const tone =
    value > 0.05
      ? "text-emerald-400"
      : value < -0.05
      ? "text-rose-400"
      : "text-slate-400";
  const Icon =
    value > 0.05 ? ArrowUpRight : value < -0.05 ? ArrowDownRight : Minus;
  return (
    <span className={cn("flex items-center text-xs font-medium", tone)}>
      <Icon className="h-3 w-3" />
    </span>
  );
}

function ChartTooltip({ active, payload, label, suffix = "" }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-md border border-slate-800 bg-slate-950/95 px-3 py-2 text-xs shadow-lg backdrop-blur">
      <p className="mb-1.5 font-medium text-slate-200">{label}</p>
      <div className="space-y-0.5">
        {payload.map((p: any) => (
          <div
            key={p.dataKey}
            className="flex items-center gap-2 text-slate-400"
          >
            <span
              className="h-2 w-2 rounded-full"
              style={{ background: p.color }}
            />
            <span>{p.name}</span>
            <span className="ml-auto font-medium tabular-nums text-slate-100">
              {typeof p.value === "number"
                ? suffix === "%"
                  ? `${p.value.toFixed(1)}%`
                  : formatNumber(p.value)
                : "—"}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function RankingList({
  items,
  positive,
}: {
  items: EvolutionMonthPointDto[];
  positive: boolean;
}) {
  if (items.length === 0) {
    return <EmptyState title="Sem variação para ranquear" />;
  }
  return (
    <ul className="divide-y divide-slate-800/60">
      {items.map((m, i) => {
        const g = m.momGrowthPercent ?? 0;
        const show = (positive && g >= 0) || (!positive && g <= 0);
        if (!show) return null;
        return (
          <li
            key={`${m.label}-${i}`}
            className="flex items-center gap-4 px-5 py-3.5"
          >
            <span className="w-5 text-[11px] font-medium tabular-nums text-slate-500">
              {i + 1}
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-slate-100">{m.label}</p>
              <p className="text-[11px] text-slate-500">
                {formatNumber(m.total)} leads
              </p>
            </div>
            <span
              className={cn(
                "text-sm font-medium tabular-nums",
                g >= 0 ? "text-emerald-400" : "text-rose-400"
              )}
            >
              {g >= 0 ? "+" : ""}
              {g.toFixed(1)}%
            </span>
          </li>
        );
      })}
    </ul>
  );
}

function MonthList({
  data,
  best,
}: {
  data: Array<{ periodo: string; total: number }>;
  best: number;
}) {
  return (
    <ul className="divide-y divide-slate-800/60">
      {data.map((r, i) => {
        const barPct = best > 0 ? (r.total / best) * 100 : 0;
        const isBest = r.total === best && best > 0;
        return (
          <li
            key={`${r.periodo}-${i}`}
            className="flex items-center gap-4 px-5 py-3"
          >
            <div className="w-20 shrink-0 text-sm text-slate-300">
              {r.periodo}
            </div>
            <div className="min-w-0 flex-1">
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-800/60">
                <div
                  className={cn(
                    "h-full rounded-full",
                    isBest ? "bg-indigo-400" : "bg-indigo-500/70"
                  )}
                  style={{ width: `${Math.max(2, barPct)}%` }}
                />
              </div>
            </div>
            <div className="w-20 shrink-0 text-right text-sm font-medium tabular-nums text-slate-100">
              {formatNumber(r.total)}
            </div>
          </li>
        );
      })}
    </ul>
  );
}

/* ═══════════════════════════════════════════════════════════════
 *  HELPERS
 * ═══════════════════════════════════════════════════════════════ */

function buildForecast(monthly: EvolutionMonthPointDto[], steps: number) {
  if (monthly.length < 2) return [];
  const xs = monthly.map((_, i) => i);
  const ys = monthly.map((m) => m.total);
  const n = xs.length;
  const sumX = xs.reduce((a, b) => a + b, 0);
  const sumY = ys.reduce((a, b) => a + b, 0);
  const sumXY = xs.reduce((acc, x, i) => acc + x * ys[i], 0);
  const sumX2 = xs.reduce((acc, x) => acc + x * x, 0);
  const denom = n * sumX2 - sumX * sumX;
  if (denom === 0) return [];
  const m = (n * sumXY - sumX * sumY) / denom;
  const b = (sumY - m * sumX) / n;

  const last = monthly[monthly.length - 1];
  const baseDate = new Date(last.year, last.month - 1, 1);
  const result: Array<{ label: string; value: number }> = [];
  const months = [
    "jan", "fev", "mar", "abr", "mai", "jun",
    "jul", "ago", "set", "out", "nov", "dez",
  ];
  for (let i = 1; i <= steps; i++) {
    const d = new Date(baseDate);
    d.setMonth(d.getMonth() + i);
    const value = Math.max(0, m * (n - 1 + i) + b);
    result.push({
      label: `${months[d.getMonth()]}/${String(d.getFullYear()).slice(-2)}`,
      value,
    });
  }
  return result;
}