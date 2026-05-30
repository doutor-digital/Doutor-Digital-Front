import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  PolarAngleAxis,
  RadialBar,
  RadialBarChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  ArrowDownRight,
  ArrowUpRight,
  Building2,
  CalendarDays,
  CheckCircle2,
  Clock,
  DollarSign,
  Flame,
  Loader2,
  TrendingUp,
  Users,
  Webhook,
  XCircle,
} from "@/components/icons";
import { useClinic } from "@/hooks/useClinic";
import { webhooksService } from "@/services/webhooks";
import { unitsService } from "@/services/units";

// ─── Paleta (Power BI-inspired) ───────────────────────────────────────────
const PALETTE = {
  brand: "#8b5cf6",
  emerald: "#10b981",
  blue: "#3b82f6",
  amber: "#f59e0b",
  rose: "#f43f5e",
  cyan: "#06b6d4",
  slate: "#64748b",
};
const DONUT_COLORS = [
  PALETTE.brand, PALETTE.blue, PALETTE.emerald, PALETTE.amber,
  PALETTE.cyan, PALETTE.rose, PALETTE.slate,
];

const PERIODS = [
  { key: "7d", label: "7 dias", days: 7 },
  { key: "30d", label: "30 dias", days: 30 },
  { key: "90d", label: "90 dias", days: 90 },
  { key: "1y", label: "12 meses", days: 365 },
] as const;
type PeriodKey = typeof PERIODS[number]["key"];

function isoDaysAgo(days: number) {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString();
}

function nf(n?: number | null): string {
  if (n == null) return "—";
  return new Intl.NumberFormat("pt-BR").format(n);
}

function pct(n?: number | null, digits = 1): string {
  if (n == null) return "—";
  return `${n.toFixed(digits)}%`;
}

// ─── KPI Card ─────────────────────────────────────────────────────────────
function Kpi({
  label, value, delta, icon: Icon, tone = "brand", sparkData,
}: {
  label: string;
  value: string | number;
  delta?: number;
  icon: typeof Users;
  tone?: keyof typeof PALETTE;
  sparkData?: Array<{ v: number }>;
}) {
  const color = PALETTE[tone];
  const deltaPositive = (delta ?? 0) >= 0;
  return (
    <div className="relative overflow-hidden rounded-2xl border border-white/[0.06] bg-gradient-to-br from-white/[0.04] to-white/[0.01] p-4 transition hover:border-white/[0.12] hover:bg-white/[0.06]">
      <div className="flex items-start justify-between">
        <div className="flex h-9 w-9 items-center justify-center rounded-xl" style={{ background: `${color}1f`, color }}>
          <Icon className="h-4 w-4" />
        </div>
        {delta != null && Number.isFinite(delta) && (
          <div className={`flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${deltaPositive ? "bg-emerald-500/15 text-emerald-300" : "bg-rose-500/15 text-rose-300"}`}>
            {deltaPositive ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
            {Math.abs(delta).toFixed(1)}%
          </div>
        )}
      </div>
      <div className="mt-3">
        <p className="text-[11px] uppercase tracking-wider text-slate-400">{label}</p>
        <p className="mt-0.5 text-2xl font-bold text-white">{value}</p>
      </div>
      {sparkData && sparkData.length > 1 && (
        <div className="-mx-1 mt-2 h-8">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={sparkData}>
              <Line type="monotone" dataKey="v" stroke={color} strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}

// ─── Tooltip custom ───────────────────────────────────────────────────────
type TooltipPayloadItem = { color?: string; name?: string; value?: number | string };
function ChartTooltip({ active, payload, label }: { active?: boolean; payload?: TooltipPayloadItem[]; label?: string }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border border-white/10 bg-[#0a0a0d]/95 p-2.5 text-xs shadow-2xl backdrop-blur">
      {label && <p className="mb-1 font-semibold text-slate-200">{label}</p>}
      {payload.map((p, i) => (
        <div key={i} className="flex items-center gap-2">
          <span className="h-2 w-2 rounded-full" style={{ background: p.color }} />
          <span className="text-slate-400">{p.name}:</span>
          <span className="font-mono font-semibold text-white">{typeof p.value === "number" ? nf(p.value) : p.value}</span>
        </div>
      ))}
    </div>
  );
}

// ─── Card wrapper ─────────────────────────────────────────────────────────
function Card({
  title, subtitle, children, className = "", action,
}: {
  title: string; subtitle?: string; children: React.ReactNode; className?: string; action?: React.ReactNode;
}) {
  return (
    <div className={`flex flex-col rounded-2xl border border-white/[0.06] bg-gradient-to-br from-white/[0.03] to-transparent p-4 ${className}`}>
      <div className="mb-3 flex items-start justify-between">
        <div>
          <h3 className="text-sm font-semibold text-white">{title}</h3>
          {subtitle && <p className="text-[11px] text-slate-500">{subtitle}</p>}
        </div>
        {action}
      </div>
      <div className="min-h-0 flex-1">{children}</div>
    </div>
  );
}

function CardSkeleton({ height = "h-64" }: { height?: string }) {
  return <div className={`animate-pulse rounded-2xl border border-white/[0.04] bg-white/[0.015] ${height}`} />;
}

function emptyEvolution() {
  return Array.from({ length: 14 }).map((_, i) => ({
    periodo: `D${i + 1}`,
    total: 0,
  }));
}

// ─── Main ─────────────────────────────────────────────────────────────────
export default function DashboardPage() {
  const { tenantId, unitId } = useClinic();
  const [period, setPeriod] = useState<PeriodKey>("30d");
  const periodDays = PERIODS.find((p) => p.key === period)!.days;

  const dateFrom = useMemo(() => isoDaysAgo(periodDays), [periodDays]);
  const dateTo = useMemo(() => new Date().toISOString(), [periodDays]); // recalcula com periodo

  const overview = useQuery({
    queryKey: ["dash", "overview", tenantId, unitId, dateFrom, dateTo],
    queryFn: () =>
      webhooksService.dashboardOverview({
        clinicId: tenantId ?? undefined,
        dateFrom,
        dateTo,
        unitId: unitId ?? undefined,
      }),
    enabled: tenantId != null,
    staleTime: 60_000,
  });

  const evolution = useQuery({
    queryKey: ["dash", "evolution", tenantId, unitId, dateFrom, dateTo],
    queryFn: () =>
      webhooksService.evolutionRange({
        clinicId: tenantId ?? undefined,
        dateFrom,
        dateTo,
        unitId: unitId ?? undefined,
        groupBy: periodDays > 90 ? "month" : periodDays > 30 ? "week" : "day",
        compare: "previous_period",
      }),
    enabled: tenantId != null,
    staleTime: 60_000,
  });

  const units = useQuery({
    queryKey: ["dash", "units"],
    queryFn: () => unitsService.list(),
    staleTime: 5 * 60_000,
  });

  const active = useQuery({
    queryKey: ["dash", "active", unitId],
    queryFn: () => webhooksService.activeLeads({ limit: 8, unitId: unitId ?? undefined }),
    enabled: tenantId != null,
    staleTime: 30_000,
  });

  const ov = overview.data;

  const evoData = useMemo(() => {
    const series = evolution.data?.series ?? [];
    if (series.length === 0) return emptyEvolution();
    return series.map((p) => ({ periodo: p.periodo, total: p.total }));
  }, [evolution.data]);

  const evoCompare = useMemo(() => {
    const compare = evolution.data?.compareSeries ?? [];
    return compare.map((p) => ({ periodo: p.periodo, total: p.total }));
  }, [evolution.data]);

  const spark = useMemo(() => evoData.slice(-12).map((p) => ({ v: p.total })), [evoData]);

  const origensTop = useMemo(() => {
    const arr = ov?.origens ?? [];
    return [...arr]
      .sort((a, b) => (b.quantidade ?? 0) - (a.quantidade ?? 0))
      .slice(0, 6);
  }, [ov]);

  const etapas = useMemo(() => {
    const arr = ov?.etapas ?? [];
    return [...arr]
      .sort((a, b) => (b.quantidade ?? 0) - (a.quantidade ?? 0))
      .slice(0, 10);
  }, [ov]);

  const unitsRanking = useMemo(() => {
    const list = units.data ?? [];
    return [...list]
      .map((u) => ({
        name: u.name ?? `Unidade ${u.clinicId}`,
        leads: u.leadCount ?? u.leadsCount ?? u.totalLeads ?? 0,
        active: u.isActive !== false,
      }))
      .sort((a, b) => b.leads - a.leads)
      .slice(0, 8);
  }, [units.data]);

  const totalAtual = evoData.reduce((s, p) => s + p.total, 0);
  const totalAnterior = evoCompare.reduce((s, p) => s + p.total, 0);
  const deltaTotal = totalAnterior > 0 ? ((totalAtual - totalAnterior) / totalAnterior) * 100 : 0;

  const conversaoRate = ov?.conversao_rate ?? 0;
  const radialData = [{ name: "Conversão", value: Math.min(conversaoRate, 100), fill: PALETTE.emerald }];

  const isLoading = overview.isLoading && !ov;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white sm:text-3xl">Dashboard</h1>
          <p className="text-sm text-slate-400">
            Visão geral do funil — {PERIODS.find((p) => p.key === period)?.label.toLowerCase()}
          </p>
        </div>
        <div className="flex flex-wrap gap-1 rounded-xl border border-white/10 bg-white/[0.02] p-1">
          {PERIODS.map((p) => (
            <button
              key={p.key}
              onClick={() => setPeriod(p.key)}
              className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                period === p.key
                  ? "bg-brand-500 text-white shadow-lg shadow-brand-500/30"
                  : "text-slate-400 hover:bg-white/5 hover:text-white"
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {/* Linha 1: KPIs */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        {isLoading ? (
          Array.from({ length: 6 }).map((_, i) => <CardSkeleton key={i} height="h-32" />)
        ) : (
          <>
            <Kpi label="Total de Leads" value={nf(ov?.total_leads)} delta={deltaTotal} icon={Users} tone="brand" sparkData={spark} />
            <Kpi label="Consultas agendadas" value={nf(ov?.consultas_agendadas)} icon={CalendarDays} tone="blue" />
            <Kpi label="Compareceram" value={nf(ov?.compareceu)} delta={ov?.comparecimento_rate} icon={CheckCircle2} tone="emerald" />
            <Kpi label="Faltas" value={nf(ov?.faltou)} icon={XCircle} tone="rose" />
            <Kpi label="Fechou tratamento" value={nf(ov?.fechou)} delta={ov?.fechamento_rate} icon={Flame} tone="amber" />
            <Kpi label="Com pagamento" value={nf(ov?.com_pagamento)} delta={ov?.pagamento_rate} icon={DollarSign} tone="emerald" />
          </>
        )}
      </div>

      {/* Linha 2: Evolução + Funil */}
      <div className="grid gap-3 lg:grid-cols-3">
        <Card title="Evolução de Leads" subtitle={`vs período anterior · ${evoData.length} pontos`} className="h-80 lg:col-span-2">
          {evolution.isLoading ? (
            <div className="flex h-full items-center justify-center text-slate-500"><Loader2 className="h-5 w-5 animate-spin" /></div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={evoData}>
                <defs>
                  <linearGradient id="gradTotal" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={PALETTE.brand} stopOpacity={0.4} />
                    <stop offset="95%" stopColor={PALETTE.brand} stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="gradPrev" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={PALETTE.slate} stopOpacity={0.3} />
                    <stop offset="95%" stopColor={PALETTE.slate} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#ffffff10" />
                <XAxis dataKey="periodo" tick={{ fill: "#64748b", fontSize: 11 }} tickLine={false} axisLine={false} />
                <YAxis tick={{ fill: "#64748b", fontSize: 11 }} tickLine={false} axisLine={false} />
                <Tooltip content={<ChartTooltip />} />
                {evoCompare.length > 0 && (
                  <Area type="monotone" dataKey="total" data={evoCompare} stroke={PALETTE.slate} strokeWidth={1.5} strokeDasharray="4 3" fill="url(#gradPrev)" name="Período anterior" />
                )}
                <Area type="monotone" dataKey="total" stroke={PALETTE.brand} strokeWidth={2.5} fill="url(#gradTotal)" name="Leads" />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </Card>

        <Card title="Funil de Etapas" subtitle="Distribuição por status atual" className="h-80">
          {etapas.length === 0 ? (
            <div className="flex h-full flex-col items-center justify-center gap-2 text-slate-500">
              <TrendingUp className="h-6 w-6 opacity-40" />
              <p className="text-xs">Sem etapas mapeadas ainda</p>
            </div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={etapas} layout="vertical" margin={{ left: 10 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#ffffff08" horizontal={false} />
                <XAxis type="number" tick={{ fill: "#64748b", fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis dataKey="etapa" type="category" tick={{ fill: "#94a3b8", fontSize: 11 }} axisLine={false} tickLine={false} width={90} tickFormatter={(s: string) => s.length > 14 ? s.slice(0, 14) + "…" : s} />
                <Tooltip content={<ChartTooltip />} />
                <Bar dataKey="quantidade" radius={[0, 4, 4, 0]}>
                  {etapas.map((_, i) => (<Cell key={i} fill={DONUT_COLORS[i % DONUT_COLORS.length]} />))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </Card>
      </div>

      {/* Linha 3: Origens / Conversão / Estados */}
      <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
        <Card title="Origens de Lead" subtitle="Top 6 por volume" className="h-72">
          {origensTop.length === 0 ? (
            <div className="flex h-full items-center justify-center text-xs text-slate-500">Sem dados</div>
          ) : (
            <div className="flex h-full items-center gap-2">
              <div className="h-full w-1/2">
                <ResponsiveContainer>
                  <PieChart>
                    <Pie data={origensTop} dataKey="quantidade" nameKey="origem" cx="50%" cy="50%" innerRadius="55%" outerRadius="85%" paddingAngle={2}>
                      {origensTop.map((_, i) => (<Cell key={i} fill={DONUT_COLORS[i % DONUT_COLORS.length]} stroke="transparent" />))}
                    </Pie>
                    <Tooltip content={<ChartTooltip />} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <ul className="w-1/2 space-y-1.5 overflow-y-auto pr-1 text-xs">
                {origensTop.map((o, i) => (
                  <li key={o.origem ?? i} className="flex items-center justify-between gap-2">
                    <span className="flex min-w-0 items-center gap-1.5">
                      <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: DONUT_COLORS[i % DONUT_COLORS.length] }} />
                      <span className="truncate text-slate-300">{o.origem ?? "—"}</span>
                    </span>
                    <span className="shrink-0 font-mono font-semibold text-white">{nf(o.quantidade)}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </Card>

        <Card title="Taxa de Conversão" subtitle="Compareceu → Fechou" className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <RadialBarChart innerRadius="60%" outerRadius="100%" data={radialData} startAngle={210} endAngle={-30}>
              <PolarAngleAxis type="number" domain={[0, 100]} tick={false} />
              <RadialBar background={{ fill: "#ffffff08" }} dataKey="value" cornerRadius={10} />
              <text x="50%" y="50%" textAnchor="middle" dominantBaseline="middle" className="fill-white" fontSize="36" fontWeight={700}>
                {pct(conversaoRate, 0)}
              </text>
              <text x="50%" y="62%" textAnchor="middle" className="fill-slate-500" fontSize="11">
                {nf(ov?.fechou)} de {nf(ov?.compareceu)}
              </text>
            </RadialBarChart>
          </ResponsiveContainer>
        </Card>

        <Card title="Estados do Lead" subtitle="Distribuição operacional" className="h-72">
          {ov?.states ? (
            <div className="grid h-full grid-cols-2 gap-2">
              <StateBox label="Bot" value={ov.states.bot} color={PALETTE.cyan} />
              <StateBox label="Fila" value={ov.states.queue} color={PALETTE.amber} />
              <StateBox label="Atendimento" value={ov.states.service} color={PALETTE.brand} />
              <StateBox label="Concluído" value={ov.states.concluido} color={PALETTE.emerald} />
            </div>
          ) : (
            <CardSkeleton height="h-full" />
          )}
        </Card>
      </div>

      {/* Linha 4: Ranking + Atividade */}
      <div className="grid gap-3 lg:grid-cols-3">
        <Card title="Ranking de Unidades" subtitle="Top 8 por leads totais" className="h-80 lg:col-span-2">
          {unitsRanking.length === 0 ? (
            <div className="flex h-full items-center justify-center text-slate-500"><Loader2 className="h-5 w-5 animate-spin" /></div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={unitsRanking} layout="vertical" margin={{ left: 10 }}>
                <defs>
                  <linearGradient id="gradBar" x1="0" y1="0" x2="1" y2="0">
                    <stop offset="0%" stopColor={PALETTE.brand} />
                    <stop offset="100%" stopColor={PALETTE.cyan} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#ffffff08" horizontal={false} />
                <XAxis type="number" tick={{ fill: "#64748b", fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis dataKey="name" type="category" tick={{ fill: "#94a3b8", fontSize: 11 }} axisLine={false} tickLine={false} width={140} />
                <Tooltip content={<ChartTooltip />} />
                <Bar dataKey="leads" fill="url(#gradBar)" radius={[0, 6, 6, 0]} name="Leads" />
              </BarChart>
            </ResponsiveContainer>
          )}
        </Card>

        <Card title="Atividade Recente" subtitle="Últimos leads em movimento" className="h-80">
          {active.isLoading ? (
            <div className="flex h-full items-center justify-center"><Loader2 className="h-5 w-5 animate-spin text-slate-500" /></div>
          ) : (active.data?.length ?? 0) === 0 ? (
            <div className="flex h-full flex-col items-center justify-center gap-2 text-slate-500">
              <Webhook className="h-6 w-6 opacity-40" />
              <p className="text-xs">Nenhum lead ativo</p>
            </div>
          ) : (
            <ul className="-mx-1 max-h-full space-y-1 overflow-y-auto px-1">
              {active.data!.map((l) => (
                <li key={l.id}>
                  <Link to={`/leads/${l.id}`} className="flex items-center gap-2 rounded-lg p-2 transition hover:bg-white/[0.04]">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand-500/15 text-[11px] font-semibold text-brand-300">
                      {(l.name ?? "L").slice(0, 2).toUpperCase()}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-xs font-medium text-white">{l.name ?? "—"}</p>
                      <p className="truncate text-[11px] text-slate-500">
                        {l.conversationState ?? "—"} · {l.phone ?? "—"}
                      </p>
                    </div>
                    <Clock className="h-3 w-3 text-slate-600" />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      {/* Linha 5: Mini boxes */}
      <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
        <MiniBox icon={Building2} label="Unidades ativas" value={units.data?.filter(u => u.isActive !== false).length ?? 0} hint={`${units.data?.length ?? 0} cadastradas`} />
        <MiniBox icon={Users} label="Leads no período" value={ov?.total_leads ?? 0} hint={PERIODS.find((p) => p.key === period)?.label} />
        <MiniBox icon={CalendarDays} label="Com pagamento" value={ov?.com_pagamento ?? 0} hint={`${pct(ov?.pagamento_rate)} do total`} />
        <MiniBox icon={Flame} label="Recuperáveis" value={ov?.nao_fechou ?? 0} hint="Compareceu e não fechou" />
      </div>
    </div>
  );
}

function StateBox({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="flex flex-col justify-center rounded-xl border border-white/[0.06] p-3" style={{ background: `${color}0d` }}>
      <p className="text-[11px] uppercase tracking-wider text-slate-400">{label}</p>
      <p className="mt-0.5 text-xl font-bold" style={{ color }}>{nf(value)}</p>
    </div>
  );
}

function MiniBox({ icon: Icon, label, value, hint }: { icon: typeof Users; label: string; value: number; hint?: string }) {
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-white/[0.06] bg-white/[0.02] p-3">
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/[0.05] text-slate-300">
        <Icon className="h-4 w-4" />
      </div>
      <div className="min-w-0">
        <p className="text-[11px] uppercase tracking-wider text-slate-500">{label}</p>
        <p className="text-lg font-bold leading-none text-white">{nf(value)}</p>
        {hint && <p className="mt-0.5 text-[10px] text-slate-500">{hint}</p>}
      </div>
    </div>
  );
}
