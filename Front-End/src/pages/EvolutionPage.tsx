import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import {
  Calendar, Trophy, Users, CalendarRange, Activity, BarChart3,
  TrendingUp, TrendingDown, LayoutGrid, Sparkles, Flame, Clock,
  PieChart as PieIcon, Target, Zap, CheckCircle2,
} from "lucide-react";
import {
  Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, ComposedChart,
  Legend, Line, LineChart, ReferenceLine, ResponsiveContainer,
  Tooltip, XAxis, YAxis,
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

const MODE_BASIC = "basic";
const MODE_ADVANCED = "advanced";

const SOURCE_COLORS = [
  "#6366f1", "#f97316", "#14b8a6", "#f43f5e", "#eab308", "#22d3ee", "#94a3b8",
];

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
        title="Evolução dos leads"
        description="Veja a trajetória do volume de leads — do resumo simples à análise profunda."
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

      {/* ── Tabs Básico / Avançado ─────────────────────────────── */}
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <Tabs
          value={mode}
          onChange={setMode}
          tabs={[
            { value: MODE_BASIC, label: (<span className="flex items-center gap-1.5"><LayoutGrid className="h-3 w-3" /> Básico</span>) },
            { value: MODE_ADVANCED, label: (<span className="flex items-center gap-1.5"><BarChart3 className="h-3 w-3" /> Avançado</span>) },
          ]}
        />
        <p className="text-[11px] text-slate-500">
          {mode === MODE_BASIC
            ? "Resumo simples para acompanhar volume mês a mês"
            : "Análises aprofundadas · MoM · YoY · sazonalidade · conversão"}
        </p>
      </div>

      {mode === MODE_BASIC ? (
        <BasicMode data={basic.data ?? []} loading={basic.isLoading} />
      ) : (
        <AdvancedMode data={advanced.data} loading={advanced.isLoading} />
      )}
    </>
  );
}

/* ═══════════════════════════════════════════════════════════════ */
/*  MODO BÁSICO                                                     */
/* ═══════════════════════════════════════════════════════════════ */

function BasicMode({
  data,
  loading,
}: {
  data: Array<{ periodo: string; total: number }>;
  loading: boolean;
}) {
  const stats = useMemo(() => {
    if (data.length === 0) {
      return { total: 0, avg: 0, bestMonth: null as null | { periodo: string; total: number } };
    }
    const total = data.reduce((a, d) => a + d.total, 0);
    const avg = total / data.length;
    const bestMonth = data.reduce((a, d) => (d.total > a.total ? d : a), data[0]);
    return { total, avg, bestMonth };
  }, [data]);

  return (
    <>
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

      <Card className="mb-4">
        <CardHeader title="Leads por mês" subtitle="Cada ponto representa um mês" />
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
          <CardHeader title="Mês a mês" subtitle="A barra compara cada mês com o melhor do período" />
          <CardBody className="p-0">
            <MonthList data={data} best={stats.bestMonth?.total ?? 0} />
          </CardBody>
        </Card>
      )}
    </>
  );
}

/* ═══════════════════════════════════════════════════════════════ */
/*  MODO AVANÇADO                                                   */
/* ═══════════════════════════════════════════════════════════════ */

function AdvancedMode({
  data,
  loading,
}: {
  data: import("@/types").EvolutionAdvancedDto | undefined;
  loading: boolean;
}) {
  if (loading || !data) {
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-6 gap-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="skeleton h-28 rounded-2xl" />
          ))}
        </div>
        <div className="skeleton h-80 w-full rounded-2xl" />
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="skeleton h-64 rounded-2xl" />
          <div className="skeleton h-64 rounded-2xl" />
        </div>
      </div>
    );
  }

  const monthly = data.monthly;
  const growthPositive = data.growthPercentFirstToLast >= 0;

  // ── Projeção simples (regressão linear) ────────────────────
  const forecast = useMemo(() => buildForecast(monthly, 3), [monthly]);

  const mergedSeries = useMemo(
    () => [
      ...monthly.map((m) => ({
        label: m.label,
        total: m.total,
        cumulative: m.cumulative,
        mom: m.momGrowthPercent,
        mm3: m.movingAverage3,
        forecast: null as number | null,
      })),
      ...forecast.map((f) => ({
        label: f.label,
        total: null as number | null,
        cumulative: null,
        mom: null,
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
        .sort((a, b) => (b.momGrowthPercent ?? 0) - (a.momGrowthPercent ?? 0))
        .slice(0, 3),
    [monthly]
  );
  const topDrop = useMemo(
    () =>
      monthly
        .filter((m) => m.momGrowthPercent !== null)
        .slice()
        .sort((a, b) => (a.momGrowthPercent ?? 0) - (b.momGrowthPercent ?? 0))
        .slice(0, 3),
    [monthly]
  );

  // ── Dados stack origens ─────────────────────────────────────
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
    <div className="space-y-4">
      {/* ── KPIs avançados ─────────────────────────────────────── */}
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
        <AdvancedKpi
          icon={<Users className="h-4 w-4" />}
          label="Total"
          value={formatNumber(data.totalLeads)}
          hint={`${monthly.length} meses`}
          tone="brand"
          sparkline={monthly.map((m) => m.total)}
        />
        <AdvancedKpi
          icon={<Activity className="h-4 w-4" />}
          label="Média mensal"
          value={formatNumber(Math.round(data.averageMonthly))}
          hint={`mediana ${formatNumber(Math.round(data.medianMonthly))}`}
          tone="violet"
          sparkline={monthly.map((m) => m.total)}
        />
        <AdvancedKpi
          icon={growthPositive ? <TrendingUp className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />}
          label="Crescimento"
          value={formatPercent(data.growthPercentFirstToLast)}
          hint="1º mês vs último mês"
          tone={growthPositive ? "emerald" : "red"}
          sparkline={monthly.map((m) => m.total)}
        />
        <AdvancedKpi
          icon={<Trophy className="h-4 w-4" />}
          label="Melhor mês"
          value={formatNumber(data.bestMonthTotal)}
          hint={data.bestMonthLabel}
          tone="amber"
          sparkline={monthly.map((m) => m.total)}
        />
        <AdvancedKpi
          icon={<Flame className="h-4 w-4" />}
          label="Desvio padrão"
          value={formatNumber(Math.round(data.stdDevMonthly))}
          hint="volatilidade mensal"
          tone="rose"
          sparkline={monthly.map((m) => m.total)}
        />
        <AdvancedKpi
          icon={<Sparkles className="h-4 w-4" />}
          label="Projeção próximo mês"
          value={forecast[0] ? formatNumber(Math.round(forecast[0].value)) : "—"}
          hint="tendência linear"
          tone="cyan"
          sparkline={[...monthly.map((m) => m.total), ...forecast.map((f) => f.value)]}
        />
      </div>

      {/* ── Evolução + Média móvel + Projeção ────────────────── */}
      <Card>
        <CardHeader
          title="Volume, média móvel (3 meses) e projeção"
          subtitle="Combina dados reais, tendência suavizada e previsão de 3 meses"
        />
        <CardBody>
          {monthly.length === 0 ? (
            <EmptyState title="Sem dados no período escolhido" />
          ) : (
            <div className="h-80 w-full">
              <ResponsiveContainer>
                <ComposedChart data={mergedSeries} margin={{ top: 12, right: 16, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="fill-volume" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#6366f1" stopOpacity={0.45} />
                      <stop offset="100%" stopColor="#6366f1" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,.15)" vertical={false} />
                  <XAxis dataKey="label" tick={{ fill: "#94a3b8", fontSize: 11 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fill: "#94a3b8", fontSize: 11 }} axisLine={false} tickLine={false} width={40} />
                  <Tooltip content={<ChartTooltip />} />
                  <Legend wrapperStyle={{ color: "#cbd5e1", fontSize: 11 }} />
                  <Area type="monotone" dataKey="total" name="Volume" stroke="#6366f1" strokeWidth={2.5} fill="url(#fill-volume)" />
                  <Line type="monotone" dataKey="mm3" name="Média móvel (3m)" stroke="#22d3ee" strokeWidth={2} dot={false} />
                  <Line type="monotone" dataKey="forecast" name="Projeção" stroke="#f97316" strokeWidth={2} strokeDasharray="6 4" dot={{ r: 3, fill: "#f97316" }} />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          )}
        </CardBody>
      </Card>

      {/* ── MoM + Acumulado ────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader
            title="Crescimento mês a mês (MoM)"
            subtitle="Variação % em relação ao mês anterior"
          />
          <CardBody>
            {monthly.length < 2 ? (
              <EmptyState title="É necessário ao menos 2 meses" />
            ) : (
              <div className="h-64 w-full">
                <ResponsiveContainer>
                  <BarChart data={monthly.slice(1)} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,.15)" vertical={false} />
                    <XAxis dataKey="label" tick={{ fill: "#94a3b8", fontSize: 11 }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fill: "#94a3b8", fontSize: 11 }} axisLine={false} tickLine={false} width={40} tickFormatter={(v) => `${v}%`} />
                    <Tooltip content={<ChartTooltip suffix="%" />} />
                    <ReferenceLine y={0} stroke="rgba(148,163,184,.35)" />
                    <Bar dataKey="momGrowthPercent" name="MoM" radius={[6, 6, 0, 0]}>
                      {monthly.slice(1).map((m, i) => (
                        <Cell key={i} fill={(m.momGrowthPercent ?? 0) >= 0 ? "#10b981" : "#f43f5e"} />
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
            subtitle="Total corrente ao longo do período"
          />
          <CardBody>
            {monthly.length === 0 ? (
              <EmptyState title="Sem dados" />
            ) : (
              <div className="h-64 w-full">
                <ResponsiveContainer>
                  <AreaChart data={monthly} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                    <defs>
                      <linearGradient id="fill-cumul" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#14b8a6" stopOpacity={0.55} />
                        <stop offset="100%" stopColor="#14b8a6" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,.15)" vertical={false} />
                    <XAxis dataKey="label" tick={{ fill: "#94a3b8", fontSize: 11 }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fill: "#94a3b8", fontSize: 11 }} axisLine={false} tickLine={false} width={48} tickFormatter={(v) => formatNumber(Number(v))} />
                    <Tooltip content={<ChartTooltip />} />
                    <Area type="monotone" dataKey="cumulative" name="Acumulado" stroke="#14b8a6" strokeWidth={2.5} fill="url(#fill-cumul)" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            )}
          </CardBody>
        </Card>
      </div>

      {/* ── Funil mensal (total / agendado / pago) ─────────────── */}
      <Card>
        <CardHeader
          title="Funil de conversão mês a mês"
          subtitle="Como o volume se transforma em agendamento e pagamento"
          action={
            <span className="rounded-full bg-emerald-500/15 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-emerald-300 ring-1 ring-emerald-500/25">
              <CheckCircle2 className="mr-1 inline h-3 w-3" />
              conversão
            </span>
          }
        />
        <CardBody>
          {data.conversionOverTime.length === 0 ? (
            <EmptyState title="Sem dados" />
          ) : (
            <div className="h-72 w-full">
              <ResponsiveContainer>
                <LineChart data={data.conversionOverTime} margin={{ top: 10, right: 16, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,.15)" vertical={false} />
                  <XAxis dataKey="label" tick={{ fill: "#94a3b8", fontSize: 11 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fill: "#94a3b8", fontSize: 11 }} axisLine={false} tickLine={false} width={40} />
                  <Tooltip content={<ChartTooltip />} />
                  <Legend wrapperStyle={{ color: "#cbd5e1", fontSize: 11 }} />
                  <Line type="monotone" dataKey="total" name="Total" stroke="#6366f1" strokeWidth={2.5} dot={{ r: 3 }} />
                  <Line type="monotone" dataKey="agendado" name="Agendado" stroke="#f59e0b" strokeWidth={2.5} dot={{ r: 3 }} />
                  <Line type="monotone" dataKey="pago" name="Pago" stroke="#10b981" strokeWidth={2.5} dot={{ r: 3 }} />
                  <Line type="monotone" dataKey="tratamento" name="Tratamento" stroke="#22d3ee" strokeWidth={2.5} dot={{ r: 3 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
        </CardBody>
      </Card>

      {/* ── Origens ao longo do tempo ──────────────────────────── */}
      <Card>
        <CardHeader
          title="Origens ao longo do tempo"
          subtitle="Top 6 fontes empilhadas mês a mês"
          action={<PieIcon className="h-4 w-4 text-slate-400" />}
        />
        <CardBody>
          {data.sourcesOverTime.length === 0 ? (
            <EmptyState title="Sem origens registradas" />
          ) : (
            <div className="h-80 w-full">
              <ResponsiveContainer>
                <BarChart data={stackedSources} margin={{ top: 10, right: 16, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,.15)" vertical={false} />
                  <XAxis dataKey="label" tick={{ fill: "#94a3b8", fontSize: 11 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fill: "#94a3b8", fontSize: 11 }} axisLine={false} tickLine={false} width={40} />
                  <Tooltip content={<ChartTooltip />} />
                  <Legend wrapperStyle={{ color: "#cbd5e1", fontSize: 11 }} />
                  {data.sourcesOverTime.map((s, i) => (
                    <Bar
                      key={s.source}
                      dataKey={s.source}
                      stackId="origem"
                      fill={SOURCE_COLORS[i % SOURCE_COLORS.length]}
                      radius={i === data.sourcesOverTime.length - 1 ? [6, 6, 0, 0] : undefined}
                    />
                  ))}
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </CardBody>
      </Card>

      {/* ── Sazonalidade: dia da semana + hora do dia ──────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader
            title="Leads por dia da semana"
            subtitle="Padrão de chegadas semanais"
            action={<Zap className="h-4 w-4 text-amber-400" />}
          />
          <CardBody>
            <div className="space-y-2.5">
              {data.weekday.map((w) => {
                const pct = (w.total / weekdayMax) * 100;
                return (
                  <div key={w.weekday}>
                    <div className="mb-1 flex items-center justify-between text-xs">
                      <span className="font-medium text-slate-300">{w.label}</span>
                      <span className="tabular-nums font-semibold text-slate-100">
                        {formatNumber(w.total)}
                      </span>
                    </div>
                    <div className="h-2.5 overflow-hidden rounded-full bg-white/5">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-indigo-500 via-violet-500 to-fuchsia-500"
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
            subtitle="Quando os leads chegam no dia"
            action={<Clock className="h-4 w-4 text-indigo-400" />}
          />
          <CardBody>
            <div className="flex h-48 items-end gap-1">
              {data.hour.map((h) => {
                const pct = (h.total / hourMax) * 100;
                const isNight = h.hour < 6 || h.hour >= 20;
                return (
                  <div key={h.hour} className="flex flex-1 flex-col items-center gap-1">
                    <div className="relative flex w-full flex-1 items-end">
                      <div
                        className={cn(
                          "w-full rounded-t transition-all duration-300",
                          isNight ? "bg-indigo-500/70" : "bg-amber-400/70"
                        )}
                        style={{ height: `${pct}%`, minHeight: h.total > 0 ? 3 : 2 }}
                        title={`${h.hour}h · ${h.total}`}
                      />
                    </div>
                    {h.hour % 3 === 0 && (
                      <span className="text-[9px] text-slate-500">
                        {String(h.hour).padStart(2, "0")}h
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
            <div className="mt-4 flex items-center justify-center gap-4 text-[10px] text-slate-500">
              <span className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-indigo-500/70" /> Noite (20h–05h)
              </span>
              <span className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-amber-400/70" /> Dia (06h–19h)
              </span>
            </div>
          </CardBody>
        </Card>
      </div>

      {/* ── Top crescimentos / quedas ──────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader
            title="Top 3 crescimentos"
            subtitle="Meses que mais cresceram vs anterior"
            action={<TrendingUp className="h-4 w-4 text-emerald-400" />}
          />
          <CardBody className="p-0">
            <RankingList items={topGrowth} positive />
          </CardBody>
        </Card>

        <Card>
          <CardHeader
            title="Top 3 quedas"
            subtitle="Meses com maior retração"
            action={<TrendingDown className="h-4 w-4 text-rose-400" />}
          />
          <CardBody className="p-0">
            <RankingList items={topDrop} positive={false} />
          </CardBody>
        </Card>
      </div>

      {/* ── Dicas profissionais ────────────────────────────────── */}
      <Card>
        <CardHeader
          title="Sugestões para ir além"
          subtitle="O que ainda pode ser adicionado ao back-end"
          action={<Target className="h-4 w-4 text-violet-400" />}
        />
        <CardBody>
          <ul className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-2 text-[12.5px] text-slate-400">
            <li>• Heatmap dia-da-semana × hora</li>
            <li>• Coorte de retenção por mês de entrada</li>
            <li>• CAC e ROI cruzando custos de ads</li>
            <li>• Tempo médio lead → atendimento</li>
            <li>• Comparação YoY automática</li>
            <li>• Segmentação por atendente / campanha</li>
            <li>• Meta mensal + status de atingimento</li>
            <li>• Alertas automáticos de queda anormal</li>
          </ul>
        </CardBody>
      </Card>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════ */
/*  HELPERS                                                         */
/* ═══════════════════════════════════════════════════════════════ */

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
  for (let i = 1; i <= steps; i++) {
    const d = new Date(baseDate);
    d.setMonth(d.getMonth() + i);
    const value = Math.max(0, m * (n - 1 + i) + b);
    const months = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
    result.push({
      label: `${months[d.getMonth()]}/${String(d.getFullYear()).slice(-2)}`,
      value,
    });
  }
  return result;
}

function ChartTooltip({ active, payload, label, suffix = "" }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border border-white/10 bg-[rgba(11,16,32,0.98)] px-3 py-2 text-xs shadow-xl">
      <p className="mb-1 font-semibold text-slate-200">{label}</p>
      {payload.map((p: any) => (
        <p key={p.dataKey} className="flex items-center gap-2 text-slate-400">
          <span className="h-2 w-2 rounded-full" style={{ background: p.color }} />
          <span>{p.name}:</span>
          <span className="font-semibold text-slate-100 tabular-nums">
            {typeof p.value === "number"
              ? suffix === "%"
                ? `${p.value.toFixed(1)}%`
                : formatNumber(p.value)
              : "—"}
          </span>
        </p>
      ))}
    </div>
  );
}

function AdvancedKpi({
  icon,
  label,
  value,
  hint,
  tone,
  sparkline,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  hint?: string;
  tone: "brand" | "violet" | "emerald" | "red" | "amber" | "rose" | "cyan";
  sparkline?: number[];
}) {
  const tones = {
    brand: { bg: "bg-brand-500/10", text: "text-brand-300", stroke: "#3b63f5" },
    violet: { bg: "bg-violet-500/10", text: "text-violet-300", stroke: "#8b5cf6" },
    emerald: { bg: "bg-emerald-500/10", text: "text-emerald-300", stroke: "#10b981" },
    red: { bg: "bg-red-500/10", text: "text-red-300", stroke: "#f43f5e" },
    amber: { bg: "bg-amber-500/10", text: "text-amber-300", stroke: "#f59e0b" },
    rose: { bg: "bg-rose-500/10", text: "text-rose-300", stroke: "#f43f5e" },
    cyan: { bg: "bg-cyan-500/10", text: "text-cyan-300", stroke: "#22d3ee" },
  }[tone];

  const points = useMemo(() => {
    if (!sparkline || sparkline.length < 2) return [];
    const max = Math.max(...sparkline);
    const min = Math.min(...sparkline);
    const range = max - min || 1;
    return sparkline.map((v, i) => ({
      x: (i / (sparkline.length - 1)) * 100,
      y: 100 - ((v - min) / range) * 100,
    }));
  }, [sparkline]);

  return (
    <div className={cn(
      "relative overflow-hidden rounded-2xl border border-white/8 bg-white/[0.03] px-4 py-4",
      "shadow-[0_1px_3px_rgba(0,0,0,0.2),inset_0_1px_0_rgba(255,255,255,0.04)]"
    )}>
      <div className="flex items-center gap-2">
        <span className={cn("flex h-8 w-8 items-center justify-center rounded-lg", tones.bg, tones.text)}>
          {icon}
        </span>
        <span className="text-[10.5px] font-bold uppercase tracking-wider text-slate-500">
          {label}
        </span>
      </div>
      <div className="mt-2 text-[1.45rem] font-extrabold leading-none tabular-nums text-slate-50">
        {value}
      </div>
      {hint && <div className="mt-1 text-[10.5px] text-slate-500">{hint}</div>}
      {points.length > 0 && (
        <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="mt-2 h-8 w-full opacity-70">
          <polyline
            fill="none"
            stroke={tones.stroke}
            strokeWidth="3"
            vectorEffect="non-scaling-stroke"
            points={points.map((p) => `${p.x},${p.y}`).join(" ")}
          />
        </svg>
      )}
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
    <ul className="divide-y divide-white/5">
      {items.map((m, i) => {
        const g = m.momGrowthPercent ?? 0;
        const show = (positive && g >= 0) || (!positive && g <= 0);
        if (!show) return null;
        return (
          <li key={`${m.label}-${i}`} className="flex items-center gap-3 px-5 py-3.5 hover:bg-white/[0.03]">
            <div className={cn(
              "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-[11px] font-bold",
              i === 0 ? "bg-amber-500/15 text-amber-300" :
              i === 1 ? "bg-slate-500/15 text-slate-300" :
              "bg-orange-500/10 text-orange-400"
            )}>
              #{i + 1}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[13px] font-semibold text-slate-100">{m.label}</p>
              <p className="text-[11px] text-slate-500">
                {formatNumber(m.total)} leads
              </p>
            </div>
            <span className={cn(
              "rounded-md px-2 py-1 text-[11px] font-bold tabular-nums",
              g >= 0 ? "bg-emerald-500/15 text-emerald-300" : "bg-rose-500/15 text-rose-300"
            )}>
              {g >= 0 ? "+" : ""}{g.toFixed(1)}%
            </span>
          </li>
        );
      })}
    </ul>
  );
}

/* ─── SimpleStat + MonthList (modo básico) ─────────────────────── */

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
    brand: { iconBg: "bg-brand-500/12 text-brand-600 dark:text-brand-300", bar: "bg-brand-500" },
    accent: { iconBg: "bg-accent-500/15 text-accent-700 dark:text-accent-400", bar: "bg-accent-500" },
  }[tone];

  return (
    <div className={cn(
      "relative overflow-hidden rounded-2xl",
      "bg-surface border border-hairline shadow-card",
      "px-5 py-4"
    )}>
      <div className="flex items-center gap-3">
        <span className={cn(
          "flex h-9 w-9 shrink-0 items-center justify-center rounded-xl",
          toneMap.iconBg
        )}>
          {icon}
        </span>
        <div className="min-w-0">
          <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
            {label}
          </div>
          <div className="mt-0.5 text-2xl font-bold leading-none tabular-nums text-slate-50">
            {value ?? <span className="inline-block skeleton h-7 w-20 rounded" />}
          </div>
          {hint && <div className="mt-1 text-[11px] text-slate-500">{hint}</div>}
        </div>
      </div>
      <div className={cn("absolute bottom-0 left-0 right-0 h-[2px] opacity-60", toneMap.bar)} />
    </div>
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
    <ul className="divide-y divide-hairline">
      {data.map((r, i) => {
        const barPct = best > 0 ? (r.total / best) * 100 : 0;
        const isBest = r.total === best && best > 0;
        return (
          <li
            key={`${r.periodo}-${i}`}
            className="flex items-center gap-4 px-5 py-3.5 transition-colors hover:bg-white/[0.04]"
          >
            <div className="w-20 shrink-0 font-medium text-slate-200">{r.periodo}</div>
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
