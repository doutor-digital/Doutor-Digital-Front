import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  LabelList,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { CalendarDays, Filter, Loader2 } from "@/components/icons";
import { useClinic } from "@/hooks/useClinic";
import { webhooksService } from "@/services/webhooks";
import { unitsService } from "@/services/units";

// ─── Helpers ──────────────────────────────────────────────────────────────
const nf = (n?: number | null) =>
  n == null ? "—" : new Intl.NumberFormat("pt-BR").format(n);

const pct = (n?: number | null, digits = 1) =>
  n == null ? "—" : `${n.toFixed(digits)}%`;

function isoDaysAgo(days: number) {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString();
}

// ─── Paleta (UX clean, pastel) ────────────────────────────────────────────
const KPI_TONES = {
  green: {
    card: "bg-emerald-50 border-emerald-100",
    label: "text-emerald-600",
    value: "text-emerald-900",
  },
  yellow: {
    card: "bg-amber-50 border-amber-100",
    label: "text-amber-600",
    value: "text-amber-900",
  },
  pink: {
    card: "bg-rose-50 border-rose-100",
    label: "text-rose-600",
    value: "text-rose-900",
  },
  blue: {
    card: "bg-sky-50 border-sky-100",
    label: "text-sky-600",
    value: "text-sky-900",
  },
} as const;

const CHART_BLUE = "#2563eb";
const CHART_BLUE_LIGHT = "#60a5fa";
const PIE_COLORS = [
  "#2563eb", "#1e3a8a", "#60a5fa", "#3b82f6", "#1d4ed8", "#93c5fd",
];

const PERIODS = [
  { key: "7d", label: "Últimos 7 dias", days: 7, groupBy: "day" as const },
  { key: "30d", label: "Últimos 30 dias", days: 30, groupBy: "day" as const },
  { key: "90d", label: "Últimos 90 dias", days: 90, groupBy: "week" as const },
  { key: "1y", label: "Últimos 12 meses", days: 365, groupBy: "month" as const },
];
type PeriodKey = (typeof PERIODS)[number]["key"];

// ─── Tooltip clean ────────────────────────────────────────────────────────
type TooltipPayloadItem = { color?: string; name?: string; value?: number | string };
function ChartTooltip({ active, payload, label }: {
  active?: boolean; payload?: TooltipPayloadItem[]; label?: string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs shadow-lg">
      {label && <p className="mb-1 font-semibold text-slate-700">{label}</p>}
      {payload.map((p, i) => (
        <div key={i} className="flex items-center gap-2">
          <span className="h-2 w-2 rounded-full" style={{ background: p.color }} />
          <span className="text-slate-500">{p.name}:</span>
          <span className="font-semibold text-slate-900">
            {typeof p.value === "number" ? nf(p.value) : p.value}
          </span>
        </div>
      ))}
    </div>
  );
}

// ─── Filtro (estilo input claro) ─────────────────────────────────────────
function FilterSelect({
  label, value, onChange, options,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: Array<{ value: string; label: string }>;
}) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-[11px] font-medium text-white/80">{label}</label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="min-w-[140px] cursor-pointer rounded-md border border-white/30 bg-white/95 px-3 py-2 text-xs font-medium text-slate-700 shadow-sm outline-none transition focus:border-white focus:ring-2 focus:ring-white/40"
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
    </div>
  );
}

// ─── KPI Card (pastel, limpo) ─────────────────────────────────────────────
function KpiCard({
  label, value, tone,
}: {
  label: string; value: string | number; tone: keyof typeof KPI_TONES;
}) {
  const t = KPI_TONES[tone];
  return (
    <div className={`rounded-xl border ${t.card} p-4 transition hover:shadow-md`}>
      <p className={`text-[12px] italic ${t.label}`}>{label}</p>
      <p className={`mt-2 text-2xl font-bold ${t.value}`}>{value}</p>
    </div>
  );
}

// ─── Card branco com título ──────────────────────────────────────────────
function Card({
  title, subtitle, children, className = "",
}: {
  title: string; subtitle?: string; children: React.ReactNode; className?: string;
}) {
  return (
    <div className={`flex flex-col rounded-xl border border-slate-200 bg-white p-5 shadow-sm ${className}`}>
      <div className="mb-4">
        <h3 className="text-sm font-semibold text-slate-800">{title}</h3>
        {subtitle && <p className="mt-0.5 text-[11px] text-slate-500">{subtitle}</p>}
      </div>
      <div className="min-h-0 flex-1">{children}</div>
    </div>
  );
}

function EmptyChart({ message }: { message: string }) {
  return (
    <div className="flex h-full items-center justify-center text-xs text-slate-400">
      {message}
    </div>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────
export default function DashboardPage() {
  const { tenantId, unitId } = useClinic();
  const [period, setPeriod] = useState<PeriodKey>("90d");
  const [source, setSource] = useState("");
  const [unitFilter, setUnitFilter] = useState<string>(unitId ? String(unitId) : "");

  const periodCfg = PERIODS.find((p) => p.key === period)!;
  const dateFrom = useMemo(() => isoDaysAgo(periodCfg.days), [periodCfg.days]);
  const dateTo = useMemo(() => new Date().toISOString(), [periodCfg.days]);

  const activeUnitId = unitFilter ? Number(unitFilter) : unitId ?? undefined;

  const sources = useQuery({
    queryKey: ["dash-v2", "sources", tenantId, activeUnitId],
    queryFn: () => webhooksService.distinctSources({
      clinicId: tenantId ?? undefined,
      unitId: activeUnitId,
    }),
    enabled: tenantId != null,
    staleTime: 5 * 60_000,
  });

  const units = useQuery({
    queryKey: ["dash-v2", "units"],
    queryFn: () => unitsService.list(),
    staleTime: 5 * 60_000,
  });

  const overview = useQuery({
    queryKey: ["dash-v2", "overview", tenantId, activeUnitId, dateFrom, dateTo, source],
    queryFn: () => webhooksService.dashboardOverview({
      clinicId: tenantId ?? undefined,
      unitId: activeUnitId,
      dateFrom,
      dateTo,
      source: source || undefined,
    }),
    enabled: tenantId != null,
    staleTime: 60_000,
  });

  const evolution = useQuery({
    queryKey: ["dash-v2", "evo", tenantId, activeUnitId, dateFrom, dateTo, source],
    queryFn: () => webhooksService.evolutionRange({
      clinicId: tenantId ?? undefined,
      unitId: activeUnitId,
      dateFrom,
      dateTo,
      source: source || undefined,
      groupBy: periodCfg.groupBy,
    }),
    enabled: tenantId != null,
    staleTime: 60_000,
  });

  // ─── Derivados ────────────────────────────────────────────────────────
  const ov = overview.data;

  const evoData = useMemo(() => {
    const series = evolution.data?.series ?? [];
    return series.map((p) => ({ periodo: p.periodo, total: p.total }));
  }, [evolution.data]);

  const totalLeads = ov?.total_leads ?? 0;
  const convertidos = ov?.fechou ?? 0;
  const taxaConversao = ov?.conversao_rate ?? 0;
  const mediaDia = totalLeads / Math.max(periodCfg.days, 1);

  const unidadesData = useMemo(() => {
    const list = units.data ?? [];
    return [...list]
      .filter((u) => u.isActive !== false)
      .map((u) => ({
        name: u.name ?? `Unidade ${u.clinicId}`,
        value: u.leadCount ?? u.leadsCount ?? u.totalLeads ?? 0,
      }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 5);
  }, [units.data]);

  const origensData = useMemo(() => {
    const arr = ov?.origens ?? [];
    const filtered = arr.filter((o) => (o.quantidade ?? 0) > 0);
    return [...filtered]
      .sort((a, b) => (b.quantidade ?? 0) - (a.quantidade ?? 0))
      .slice(0, 6)
      .map((o) => ({
        name: o.origem ?? "—",
        value: o.quantidade ?? 0,
      }));
  }, [ov]);

  const origensTotal = useMemo(
    () => origensData.reduce((s, o) => s + o.value, 0),
    [origensData],
  );

  const etapasData = useMemo(() => {
    const arr = ov?.etapas ?? [];
    return [...arr]
      .filter((e) => (e.quantidade ?? 0) > 0)
      .sort((a, b) => (b.quantidade ?? 0) - (a.quantidade ?? 0))
      .slice(0, 5)
      .map((e) => ({
        name: e.etapa.length > 16 ? e.etapa.slice(0, 16) + "…" : e.etapa,
        fullName: e.etapa,
        value: e.quantidade ?? 0,
      }));
  }, [ov]);

  const isLoading = overview.isLoading && !ov;

  // ─── Render ───────────────────────────────────────────────────────────
  return (
    // Fundo claro estendido por todo o conteúdo (sai do layout dark)
    <div className="-m-4 min-h-[calc(100vh-4rem)] bg-gradient-to-br from-violet-50 via-slate-50 to-slate-100 p-4 lg:-m-6 lg:p-6">
      <div className="mx-auto max-w-[1400px]">
        <div className="overflow-hidden rounded-3xl bg-white shadow-xl ring-1 ring-slate-200/50">
          {/* ─── HEADER ─────────────────────────────────────────────── */}
          <div className="relative bg-gradient-to-br from-violet-600 via-violet-500 to-indigo-500 px-6 py-5 sm:px-8 sm:py-6">
            <div className="flex flex-wrap items-end justify-between gap-4">
              <div>
                <h1 className="text-2xl font-bold leading-tight text-white sm:text-[28px]">
                  Dashboard de Leads
                </h1>
                <p className="mt-0.5 text-xs text-violet-100/80">
                  Visão geral do funil · Kommo CRM
                </p>
              </div>

              <div className="flex flex-wrap items-end gap-3">
                <FilterSelect
                  label="Período"
                  value={period}
                  onChange={(v) => setPeriod(v as PeriodKey)}
                  options={PERIODS.map((p) => ({ value: p.key, label: p.label }))}
                />
                <FilterSelect
                  label="Unidade"
                  value={unitFilter}
                  onChange={setUnitFilter}
                  options={[
                    { value: "", label: "Todas" },
                    ...(units.data ?? []).map((u) => ({
                      value: String(u.id),
                      label: u.name ?? `Unidade ${u.clinicId}`,
                    })),
                  ]}
                />
                <FilterSelect
                  label="Origem"
                  value={source}
                  onChange={setSource}
                  options={[
                    { value: "", label: "Todas" },
                    ...(sources.data ?? []).map((s) => ({ value: s, label: s })),
                  ]}
                />
              </div>
            </div>
          </div>

          {/* ─── CORPO ──────────────────────────────────────────────── */}
          <div className="space-y-5 bg-slate-50/50 p-5 sm:space-y-6 sm:p-7">
            {/* TOP: KPIs (esquerda) + Linha (direita) */}
            <div className="grid gap-5 lg:grid-cols-12 sm:gap-6">
              {/* Painel de KPIs */}
              <div className="lg:col-span-5">
                <Card
                  title="Informações Gerais"
                  subtitle="Convertidos + Não convertidos = Total"
                  className="h-full"
                >
                  {isLoading ? (
                    <div className="grid grid-cols-2 gap-3">
                      {[0, 1, 2, 3].map((i) => (
                        <div key={i} className="h-24 animate-pulse rounded-xl bg-slate-100" />
                      ))}
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 gap-3">
                      <KpiCard tone="green" label="Total de leads" value={nf(totalLeads)} />
                      <KpiCard tone="yellow" label="Convertidos" value={nf(convertidos)} />
                      <KpiCard tone="pink" label="Taxa de conversão" value={pct(taxaConversao)} />
                      <KpiCard tone="blue" label="Leads / dia" value={mediaDia.toFixed(1)} />
                    </div>
                  )}
                </Card>
              </div>

              {/* Line chart */}
              <div className="lg:col-span-7">
                <Card title="Leads por Período" subtitle={periodCfg.label} className="h-full">
                  <div className="h-64">
                    {evolution.isLoading ? (
                      <div className="flex h-full items-center justify-center">
                        <Loader2 className="h-5 w-5 animate-spin text-slate-400" />
                      </div>
                    ) : evoData.length === 0 ? (
                      <EmptyChart message="Sem dados no período" />
                    ) : (
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={evoData} margin={{ top: 20, right: 20, left: 0, bottom: 5 }}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                          <XAxis
                            dataKey="periodo"
                            tick={{ fill: "#64748b", fontSize: 11 }}
                            tickLine={false}
                            axisLine={{ stroke: "#cbd5e1" }}
                          />
                          <YAxis hide />
                          <Tooltip content={<ChartTooltip />} />
                          <Line
                            type="linear"
                            dataKey="total"
                            stroke={CHART_BLUE}
                            strokeWidth={2.5}
                            dot={{ r: 5, fill: CHART_BLUE, stroke: "#fff", strokeWidth: 2 }}
                            activeDot={{ r: 7 }}
                            name="Leads"
                          >
                            <LabelList
                              dataKey="total"
                              position="top"
                              offset={10}
                              fill="#475569"
                              fontSize={11}
                              fontWeight={600}
                              formatter={(v: number) => nf(v)}
                            />
                          </Line>
                        </LineChart>
                      </ResponsiveContainer>
                    )}
                  </div>
                </Card>
              </div>
            </div>

            {/* BOTTOM: 3 charts */}
            <div className="grid gap-5 lg:grid-cols-3 sm:gap-6">
              {/* Por Unidade */}
              <Card title="Leads por Unidade" subtitle="Top 5">
                <div className="h-64">
                  {unidadesData.length === 0 ? (
                    <EmptyChart message="Sem unidades com leads" />
                  ) : (
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart
                        data={unidadesData}
                        layout="vertical"
                        margin={{ top: 5, right: 60, left: 0, bottom: 5 }}
                      >
                        <XAxis type="number" hide />
                        <YAxis
                          type="category"
                          dataKey="name"
                          tick={{ fill: "#475569", fontSize: 11, fontWeight: 500 }}
                          tickLine={false}
                          axisLine={false}
                          width={90}
                        />
                        <Tooltip content={<ChartTooltip />} cursor={{ fill: "#f1f5f9" }} />
                        <Bar dataKey="value" fill={CHART_BLUE} radius={[0, 6, 6, 0]} barSize={22}>
                          <LabelList
                            dataKey="value"
                            position="right"
                            offset={8}
                            fill="#1e293b"
                            fontSize={11}
                            fontWeight={600}
                            formatter={(v: number) => nf(v)}
                          />
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  )}
                </div>
              </Card>

              {/* Por Origem */}
              <Card title="Leads por Origem" subtitle="Distribuição">
                <div className="h-64">
                  {origensData.length === 0 ? (
                    <EmptyChart message="Sem dados de origem" />
                  ) : (
                    <div className="flex h-full items-center gap-4">
                      <div className="h-full flex-1">
                        <ResponsiveContainer>
                          <PieChart>
                            <Pie
                              data={origensData}
                              dataKey="value"
                              nameKey="name"
                              cx="50%"
                              cy="50%"
                              outerRadius="90%"
                              labelLine={false}
                              label={(props) => {
                                const v = (props as { value?: number }).value ?? 0;
                                const pctVal = origensTotal > 0 ? Math.round((v / origensTotal) * 100) : 0;
                                if (pctVal < 5) return "";
                                return `${pctVal}%`;
                              }}
                            >
                              {origensData.map((_, i) => (
                                <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} stroke="#fff" strokeWidth={2} />
                              ))}
                            </Pie>
                            <Tooltip content={<ChartTooltip />} />
                          </PieChart>
                        </ResponsiveContainer>
                      </div>
                      <ul className="space-y-1.5 text-[11px]">
                        {origensData.map((o, i) => (
                          <li key={o.name} className="flex items-center gap-2">
                            <span
                              className="h-2.5 w-2.5 shrink-0 rounded-sm"
                              style={{ background: PIE_COLORS[i % PIE_COLORS.length] }}
                            />
                            <span className="text-slate-600">{o.name}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              </Card>

              {/* Por Etapa */}
              <Card title="Leads por Etapa" subtitle="Funil atual">
                <div className="h-64">
                  {etapasData.length === 0 ? (
                    <EmptyChart message="Sem leads em etapas" />
                  ) : (
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart
                        data={etapasData}
                        layout="vertical"
                        margin={{ top: 5, right: 60, left: 0, bottom: 5 }}
                      >
                        <XAxis type="number" hide />
                        <YAxis
                          type="category"
                          dataKey="name"
                          tick={{ fill: "#475569", fontSize: 11, fontWeight: 500 }}
                          tickLine={false}
                          axisLine={false}
                          width={90}
                        />
                        <Tooltip content={<ChartTooltip />} cursor={{ fill: "#f1f5f9" }} />
                        <Bar dataKey="value" fill={CHART_BLUE_LIGHT} radius={[0, 6, 6, 0]} barSize={22}>
                          <LabelList
                            dataKey="value"
                            position="right"
                            offset={8}
                            fill="#1e293b"
                            fontSize={11}
                            fontWeight={600}
                            formatter={(v: number) => nf(v)}
                          />
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  )}
                </div>
              </Card>
            </div>
          </div>
        </div>

        {/* Rodapé sutil */}
        <p className="mt-4 text-center text-[11px] text-slate-500">
          <CalendarDays className="-mt-0.5 mr-1 inline h-3 w-3" />
          {new Date().toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" })}
          <span className="mx-2">·</span>
          <Filter className="-mt-0.5 mr-1 inline h-3 w-3" />
          {[periodCfg.label, unitFilter && (units.data?.find((u) => String(u.id) === unitFilter)?.name), source]
            .filter(Boolean)
            .join(" · ")}
        </p>
      </div>
    </div>
  );
}
