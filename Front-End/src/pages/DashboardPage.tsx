import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Bar,
  BarChart,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Loader2 } from "@/components/icons";
import { useClinic } from "@/hooks/useClinic";
import { webhooksService } from "@/services/webhooks";
import { unitsService } from "@/services/units";
import { assignmentsService } from "@/services/assignments";
import { stageLabel as fallbackStageLabel } from "@/lib/stageLabels";
import type { FunnelGroup } from "@/types";

// ─── Helpers ──────────────────────────────────────────────────────────────
const nf = (n?: number | null) =>
  n == null ? "—" : new Intl.NumberFormat("pt-BR").format(n);

const pctStr = (num: number, den: number, digits = 1) =>
  den > 0 ? `${((num / den) * 100).toFixed(digits)}%` : "0%";

function isoStartOfDay(d = new Date()) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x.toISOString();
}
function isoEndOfDay(d = new Date()) {
  const x = new Date(d);
  x.setHours(23, 59, 59, 999);
  return x.toISOString();
}
function fmtBr(iso: string) {
  return new Date(iso).toLocaleDateString("pt-BR");
}

// ─── Filtros: Ano / Mês / Semana / Dia ────────────────────────────────────
type ScopeKey = "ano" | "mes" | "semana" | "dia";

const SCOPES: Array<{ key: ScopeKey; label: string; icon: string }> = [
  { key: "ano",    label: "Ano",    icon: "fi-rr-calendar" },
  { key: "mes",    label: "Mês",    icon: "fi-rr-calendar-clock" },
  { key: "semana", label: "Semana", icon: "fi-rr-calendar-day" },
  { key: "dia",    label: "Dia",    icon: "fi-rr-time-quarter-past" },
];

function computeScopeRange(key: ScopeKey): { from: string; to: string } {
  const now = new Date();
  if (key === "dia") return { from: isoStartOfDay(now), to: isoEndOfDay(now) };
  if (key === "semana") {
    const d = new Date(now);
    d.setDate(d.getDate() - 6);
    return { from: isoStartOfDay(d), to: isoEndOfDay(now) };
  }
  if (key === "mes") {
    const d = new Date(now);
    d.setDate(d.getDate() - 29);
    return { from: isoStartOfDay(d), to: isoEndOfDay(now) };
  }
  // ano
  const d = new Date(now);
  d.setFullYear(d.getFullYear() - 1);
  return { from: isoStartOfDay(d), to: isoEndOfDay(now) };
}

// ─── Cores ────────────────────────────────────────────────────────────────
const COLORS = {
  emerald: "#34d399",
  violet: "#a78bfa",
  cyan: "#22d3ee",
  amber: "#fbbf24",
  rose: "#f472b6",
  sky: "#60a5fa",
  red: "#f87171",
  slate: "#64748b",
};
const PIE_COLORS = ["#a78bfa", "#22d3ee", "#34d399", "#f472b6", "#fbbf24", "#60a5fa", "#f87171", "#64748b"];

const CHANNEL_COLORS: Record<string, string> = {
  instagram: "#e1306c",
  whatsapp: "#25d366",
  facebook: "#1877f2",
  messenger: "#0084ff",
  twilio: "#f22f46",
  telegram: "#26a5e4",
  site: "#a78bfa",
  organic: "#22d3ee",
  google: "#fbbf24",
  email: "#94a3b8",
  kommo: "#34d399",
};
function channelColor(name: string) {
  const k = (name || "").toLowerCase();
  for (const key of Object.keys(CHANNEL_COLORS)) {
    if (k.includes(key)) return CHANNEL_COLORS[key];
  }
  let h = 0;
  for (let i = 0; i < k.length; i++) h = (h * 31 + k.charCodeAt(i)) >>> 0;
  return PIE_COLORS[h % PIE_COLORS.length];
}

// ─── UI building blocks ──────────────────────────────────────────────────
function DarkCard({
  children, className = "", accent,
}: {
  children: React.ReactNode; className?: string; accent?: string;
}) {
  return (
    <div
      className={`relative overflow-hidden rounded-2xl bg-[#0f1f3a]/80 ring-1 ring-white/5 p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)] ${className}`}
      style={accent ? { borderTop: `3px solid ${accent}` } : undefined}
    >
      {children}
    </div>
  );
}

// Ícones do Flaticon UIcons via classe CSS — não precisa de import.
function Fi({ name, className = "", style }: { name: string; className?: string; style?: React.CSSProperties }) {
  return <i className={`fi ${name} ${className}`} style={style} aria-hidden="true" />;
}

// ─── Funnel card (Lead / Cadastro / Resgate) ─────────────────────────────
function FunnelCard({
  title, icon, accent, data, prev, baselineForRates,
}: {
  title: string;
  icon: string;
  accent: string;
  data: FunnelGroup | undefined;
  /** Quando informado, mostra delta vs período anterior */
  prev?: FunnelGroup | undefined;
  /** Sobre o que calcular % das etapas. Default: total. */
  baselineForRates?: "total" | "previous";
}) {
  const d = data ?? { total: 0, interacoes: 0, agendados: 0, consultas: 0, tratamentos: 0, no_show: 0 };
  const total = d.total;

  const rows = [
    { label: "Interações",  value: d.interacoes,  icon: "fi-rr-comment", color: COLORS.cyan },
    { label: "Agendados",   value: d.agendados,   icon: "fi-rr-calendar-clock", color: COLORS.violet },
    { label: "Consultas",   value: d.consultas,   icon: "fi-rr-stethoscope", color: COLORS.sky },
    { label: "Tratamentos", value: d.tratamentos, icon: "fi-rr-tooth", color: COLORS.emerald },
    { label: "No-show",     value: d.no_show,     icon: "fi-rr-cross-circle", color: COLORS.red },
  ];

  return (
    <DarkCard accent={accent} className="h-full">
      <div className="flex items-center justify-between">
        <p className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.12em] text-white/60">
          <Fi name={icon} className="text-sm" style={{ color: accent }} />
          {title}
        </p>
        {prev && (
          <DeltaPill current={d.total} previous={prev.total} />
        )}
      </div>

      <p className="mt-3 text-4xl font-bold leading-none" style={{ color: accent }}>
        {nf(total)}
      </p>
      <p className="mt-1 text-[11px] text-white/40">Total no período</p>

      <div className="my-4 h-px w-full bg-white/10" />

      <ul className="space-y-2.5">
        {rows.map((r) => {
          const base = baselineForRates === "previous" && prev ? prev.total : total;
          return (
            <li key={r.label} className="flex items-center justify-between gap-2">
              <span className="flex items-center gap-2 text-[12px] text-white/80">
                <Fi name={r.icon} className="text-xs" style={{ color: r.color }} />
                {r.label}
              </span>
              <span className="flex items-baseline gap-1.5">
                <span className="font-semibold tabular-nums" style={{ color: r.color }}>
                  {nf(r.value)}
                </span>
                <span className="text-[10px] text-white/40 tabular-nums">
                  {pctStr(r.value, base)}
                </span>
              </span>
            </li>
          );
        })}
      </ul>
    </DarkCard>
  );
}

function DeltaPill({ current, previous }: { current: number; previous: number }) {
  if (previous === 0 && current === 0) return null;
  const delta = previous === 0 ? 100 : ((current - previous) / previous) * 100;
  const up = delta >= 0;
  return (
    <span
      className={`flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold ${
        up ? "bg-emerald-500/20 text-emerald-300" : "bg-rose-500/20 text-rose-300"
      }`}
    >
      <Fi name={up ? "fi-rr-arrow-trend-up" : "fi-rr-arrow-trend-down"} />
      {Math.abs(delta).toFixed(0)}%
    </span>
  );
}

// ─── Tabela por origem ────────────────────────────────────────────────────
type OriginRow = { origem: string; quantidade: number };

function OriginTable({
  title, icon, accent, rows, secondColumnLabel, secondColumnValues,
}: {
  title: string;
  icon: string;
  accent: string;
  rows: OriginRow[];
  secondColumnLabel?: string;
  /** Quando informado, exibe coluna extra (e %). Senão exibe só Qtd. */
  secondColumnValues?: Map<string, number>;
}) {
  const total = rows.reduce((s, r) => s + r.quantidade, 0);
  return (
    <DarkCard accent={accent} className="h-full">
      <p className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.12em] text-white/60">
        <Fi name={icon} className="text-sm" style={{ color: accent }} />
        {title}
      </p>

      <div className="mt-4 overflow-hidden rounded-lg ring-1 ring-white/5">
        <table className="w-full text-[12px]">
          <thead className="bg-white/5 text-[10px] uppercase tracking-wider text-white/50">
            <tr>
              <th className="px-3 py-2 text-left">Origem</th>
              <th className="px-3 py-2 text-right">Qtd</th>
              {secondColumnValues && (
                <>
                  <th className="px-3 py-2 text-right">{secondColumnLabel ?? "—"}</th>
                  <th className="px-3 py-2 text-right">%</th>
                </>
              )}
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr><td colSpan={4} className="px-3 py-4 text-center text-white/40">Sem dados</td></tr>
            )}
            {rows.map((r) => {
              const v2 = secondColumnValues?.get(r.origem) ?? 0;
              return (
                <tr key={r.origem} className="border-t border-white/5">
                  <td className="px-3 py-2 text-white/85 flex items-center gap-2">
                    <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: channelColor(r.origem) }} />
                    <span className="truncate">{r.origem || "—"}</span>
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums text-white/90">{nf(r.quantidade)}</td>
                  {secondColumnValues && (
                    <>
                      <td className="px-3 py-2 text-right tabular-nums text-white/75">{nf(v2)}</td>
                      <td className="px-3 py-2 text-right tabular-nums text-white/60">{pctStr(v2, r.quantidade)}</td>
                    </>
                  )}
                </tr>
              );
            })}
          </tbody>
          {rows.length > 0 && (
            <tfoot>
              <tr className="border-t border-white/10 bg-white/5 text-white/70">
                <td className="px-3 py-2 text-[10px] uppercase tracking-wider">Total</td>
                <td className="px-3 py-2 text-right tabular-nums font-semibold text-white">{nf(total)}</td>
                {secondColumnValues && (<><td /><td /></>)}
              </tr>
            </tfoot>
          )}
        </table>
      </div>
    </DarkCard>
  );
}

// ─── Donut por semana ─────────────────────────────────────────────────────
function WeekDonut({
  title, icon, accent, data,
}: {
  title: string;
  icon: string;
  accent: string;
  data: Array<{ periodo: string; quantidade: number }>;
}) {
  const total = data.reduce((s, d) => s + d.quantidade, 0);
  return (
    <DarkCard accent={accent} className="h-full">
      <p className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.12em] text-white/60">
        <Fi name={icon} className="text-sm" style={{ color: accent }} />
        {title}
      </p>
      <div className="mt-2 flex items-center gap-3">
        <div className="relative h-44 w-44 shrink-0">
          {total === 0 ? (
            <div className="flex h-full items-center justify-center text-xs text-white/40">Sem dados</div>
          ) : (
            <>
              <ResponsiveContainer>
                <PieChart>
                  <Pie
                    data={data}
                    dataKey="quantidade"
                    nameKey="periodo"
                    innerRadius="65%"
                    outerRadius="92%"
                    paddingAngle={2}
                  >
                    {data.map((_, i) => (
                      <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} stroke="#0f1f3a" strokeWidth={2} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      background: "#0a1a36",
                      border: "1px solid rgba(255,255,255,.1)",
                      borderRadius: 8,
                      color: "#fff",
                      fontSize: 12,
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
              <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-2xl font-bold" style={{ color: accent }}>{nf(total)}</span>
                <span className="text-[10px] uppercase tracking-wider text-white/40">Total</span>
              </div>
            </>
          )}
        </div>
        <ul className="min-w-0 flex-1 space-y-1 text-[11px]">
          {data.slice(0, 6).map((d, i) => (
            <li key={d.periodo} className="flex items-center justify-between gap-2">
              <span className="flex items-center gap-2 truncate text-white/70">
                <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: PIE_COLORS[i % PIE_COLORS.length] }} />
                <span className="truncate">{d.periodo}</span>
              </span>
              <span className="tabular-nums text-white/85">{nf(d.quantidade)}</span>
            </li>
          ))}
          {data.length > 6 && (
            <li className="text-[10px] text-white/40">+ {data.length - 6} sem.</li>
          )}
        </ul>
      </div>
    </DarkCard>
  );
}

// ─── Bar chart por dia da semana ──────────────────────────────────────────
const DOW_LABELS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

function WeekdayBarChart({
  data,
}: {
  data: Array<{ dia: number; quantidade: number }>;
}) {
  const enriched = data.map((d) => ({
    nome: DOW_LABELS[(d.dia - 1) % 7],
    quantidade: d.quantidade,
  }));
  return (
    <DarkCard accent={COLORS.emerald} className="h-full">
      <p className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.12em] text-white/60">
        <Fi name="fi-rr-chart-histogram" className="text-sm text-emerald-400" />
        Total de leads por dia da semana
      </p>
      <div className="mt-4 h-72">
        <ResponsiveContainer>
          <BarChart data={enriched} margin={{ top: 12, right: 16, left: 0, bottom: 4 }}>
            <XAxis
              dataKey="nome"
              stroke="rgba(255,255,255,0.4)"
              tick={{ fontSize: 11, fill: "rgba(255,255,255,0.6)" }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              stroke="rgba(255,255,255,0.4)"
              tick={{ fontSize: 11, fill: "rgba(255,255,255,0.5)" }}
              axisLine={false}
              tickLine={false}
              width={32}
            />
            <Tooltip
              cursor={{ fill: "rgba(167,139,250,0.1)" }}
              contentStyle={{
                background: "#0a1a36",
                border: "1px solid rgba(255,255,255,.1)",
                borderRadius: 8,
                color: "#fff",
                fontSize: 12,
              }}
            />
            <Bar dataKey="quantidade" radius={[6, 6, 0, 0]}>
              {enriched.map((_, i) => (
                <Cell key={i} fill={i === 0 || i === 6 ? COLORS.violet : COLORS.emerald} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </DarkCard>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────
export default function DashboardPage() {
  const { tenantId, unitId } = useClinic();
  const [scope, setScope] = useState<ScopeKey>("mes");

  const [showAdvanced, setShowAdvanced] = useState(false);
  const [sourceFilter, setSourceFilter] = useState<string>("");
  const [attendantFilter, setAttendantFilter] = useState<string>("");
  const [customFrom, setCustomFrom] = useState<string>("");
  const [customTo, setCustomTo] = useState<string>("");
  const isCustom = customFrom !== "" && customTo !== "";

  const range = useMemo(() => {
    if (isCustom) {
      return { from: isoStartOfDay(new Date(customFrom)), to: isoEndOfDay(new Date(customTo)) };
    }
    return computeScopeRange(scope);
  }, [scope, customFrom, customTo, isCustom]);
  const rangeLabel = `${fmtBr(range.from)} – ${fmtBr(range.to)}`;

  const units = useQuery({
    queryKey: ["dash-funnel", "units"],
    queryFn: () => unitsService.list(),
    staleTime: 5 * 60_000,
  });

  const attendants = useQuery({
    queryKey: ["dash-funnel", "attendants"],
    queryFn: () => assignmentsService.listAttendants(),
    staleTime: 5 * 60_000,
  });

  const pipelines = useQuery({
    queryKey: ["dash-funnel", "pipelines", unitId],
    queryFn: () => unitsService.kommoPipelines(unitId!),
    enabled: unitId != null,
    staleTime: 10 * 60_000,
    retry: false,
  });

  const stageNameMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const p of pipelines.data ?? []) {
      for (const s of p.statuses ?? []) {
        map.set(String(s.id), s.name);
      }
    }
    return map;
  }, [pipelines.data]);
  const stageLabel = (raw?: string | null): string => {
    if (!raw) return "—";
    const t = String(raw).trim();
    if (stageNameMap.has(t)) return stageNameMap.get(t)!;
    return fallbackStageLabel(t);
  };

  const sources = useQuery({
    queryKey: ["dash-funnel", "sources", tenantId, unitId],
    queryFn: () => webhooksService.distinctSources({
      clinicId: tenantId ?? undefined,
      unitId: unitId ?? undefined,
    }),
    enabled: tenantId != null,
    staleTime: 5 * 60_000,
  });

  const overview = useQuery({
    queryKey: ["dash-funnel", "overview", tenantId, unitId, range.from, range.to, sourceFilter, attendantFilter],
    queryFn: () => webhooksService.dashboardOverview({
      clinicId: tenantId ?? undefined,
      unitId: unitId ?? undefined,
      dateFrom: range.from,
      dateTo: range.to,
      source: sourceFilter || undefined,
      attendantId: attendantFilter ? Number(attendantFilter) : undefined,
    }),
    enabled: tenantId != null,
    staleTime: 60_000,
  });

  // Período anterior (pra calcular delta nos cards-funnel)
  const prevRange = useMemo(() => {
    const fromMs = new Date(range.from).getTime();
    const toMs = new Date(range.to).getTime();
    const lenMs = toMs - fromMs;
    return {
      from: new Date(fromMs - lenMs - 1).toISOString(),
      to: new Date(fromMs - 1).toISOString(),
    };
  }, [range.from, range.to]);

  const overviewPrev = useQuery({
    queryKey: ["dash-funnel", "overview-prev", tenantId, unitId, prevRange.from, prevRange.to, sourceFilter, attendantFilter],
    queryFn: () => webhooksService.dashboardOverview({
      clinicId: tenantId ?? undefined,
      unitId: unitId ?? undefined,
      dateFrom: prevRange.from,
      dateTo: prevRange.to,
      source: sourceFilter || undefined,
      attendantId: attendantFilter ? Number(attendantFilter) : undefined,
    }),
    enabled: tenantId != null,
    staleTime: 60_000,
  });

  const ov = overview.data;
  const ovPrev = overviewPrev.data;
  const isLoading = overview.isLoading && !ov;

  const agencyName = useMemo(() => {
    if (!unitId) return "Todas as unidades";
    const u = units.data?.find((x) => String(x.id) === String(unitId));
    return u?.name ?? "Dashboard";
  }, [unitId, units.data]);

  const hasActiveFilters =
    sourceFilter !== "" || attendantFilter !== "" || isCustom;
  const filterCount =
    (sourceFilter ? 1 : 0) + (attendantFilter ? 1 : 0) + (isCustom ? 1 : 0);

  // ─── Derivados ────────────────────────────────────────────────────────
  const origensLeads: OriginRow[] = useMemo(
    () => (ov?.origens ?? []).map((o) => ({ origem: o.origem ?? "—", quantidade: o.quantidade ?? 0 })),
    [ov],
  );
  const origensConsultas: OriginRow[] = useMemo(
    () => (ov?.origens_consultas ?? []).map((o) => ({ origem: o.origem ?? "—", quantidade: o.quantidade ?? 0 })),
    [ov],
  );
  const origensTratamentos: OriginRow[] = useMemo(
    () => (ov?.origens_tratamentos ?? []).map((o) => ({ origem: o.origem ?? "—", quantidade: o.quantidade ?? 0 })),
    [ov],
  );

  // Mapas pras colunas extras nas tabelas
  const agendadosByOrigem = useMemo(() => {
    // Não temos o split exato por origem do "agendados". Aproximação: usa origens_consultas
    // (que inclui agendados+) como upper-bound. Pode trocar quando o backend devolver split.
    const m = new Map<string, number>();
    for (const o of ov?.origens_consultas ?? []) m.set(o.origem ?? "—", o.quantidade ?? 0);
    return m;
  }, [ov]);
  const compareceuByOrigem = useMemo(() => {
    // Aproximação: usa origens_tratamentos como proxy de "compareceu e seguiu". Idem acima.
    const m = new Map<string, number>();
    for (const o of ov?.origens_tratamentos ?? []) m.set(o.origem ?? "—", o.quantidade ?? 0);
    return m;
  }, [ov]);

  // Topo de etapas (com nomes resolvidos da Kommo)
  const etapasTop = useMemo(() => {
    const arr = ov?.etapas ?? [];
    return [...arr]
      .filter((e) => (e.quantidade ?? 0) > 0)
      .sort((a, b) => (b.quantidade ?? 0) - (a.quantidade ?? 0))
      .slice(0, 8)
      .map((e) => ({ raw: e.etapa, label: stageLabel(e.etapa), value: e.quantidade ?? 0 }));
  }, [ov, stageNameMap]);

  // ─── Render ───────────────────────────────────────────────────────────
  return (
    <div
      className="-m-4 lg:-m-6 min-h-[calc(100vh-4rem)] text-white"
      style={{
        background: "radial-gradient(ellipse at top, #1a3565 0%, #0a1a36 45%, #050d22 100%)",
        fontFamily: "'PT Sans', ui-sans-serif, system-ui, sans-serif",
        fontWeight: 400,
      }}
    >
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.06]"
        style={{
          backgroundImage: "radial-gradient(rgba(255,255,255,0.6) 1px, transparent 1px)",
          backgroundSize: "22px 22px",
        }}
      />

      <div className="relative mx-auto max-w-[1500px] px-4 py-6 lg:px-8 lg:py-10">
        {/* ─── HEADER ─────────────────────────────────────────────── */}
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-[11px] uppercase tracking-[0.18em] text-white/40">Dashboard</p>
            <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">{agencyName}</h1>
            <p className="mt-1 text-xs text-white/50">{rangeLabel}</p>
          </div>

          <button
            type="button"
            onClick={() => setShowAdvanced((v) => !v)}
            className={`flex items-center gap-1.5 rounded-full border px-4 py-2 text-xs font-medium transition ${
              hasActiveFilters
                ? "border-violet-400/60 bg-violet-500/20 text-white"
                : "border-white/15 bg-white/5 text-white/80 hover:bg-white/10"
            }`}
          >
            <Fi name="fi-rr-settings-sliders" />
            Filtros{hasActiveFilters ? ` (${filterCount})` : ""}
          </button>
        </div>

        {/* ─── 1. FILTROS PRINCIPAIS (Ano / Mês / Semana / Dia) ───── */}
        <div className="mt-5 flex flex-wrap items-center gap-1 rounded-full border border-white/15 bg-white/5 p-1 backdrop-blur w-fit">
          {SCOPES.map((s) => {
            const active = !isCustom && scope === s.key;
            return (
              <button
                key={s.key}
                type="button"
                onClick={() => {
                  setScope(s.key);
                  setCustomFrom("");
                  setCustomTo("");
                }}
                className={`flex items-center gap-1.5 rounded-full px-4 py-1.5 text-xs font-medium transition ${
                  active ? "bg-white text-slate-900" : "text-white/70 hover:text-white"
                }`}
              >
                <Fi name={s.icon} />
                {s.label}
              </button>
            );
          })}
          {isCustom && (
            <span className="rounded-full bg-white px-4 py-1.5 text-xs font-semibold text-slate-900">
              Personalizado
            </span>
          )}
        </div>

        {/* ─── Painel avançado ────────────────────────────────────── */}
        {showAdvanced && (
          <DarkCard className="mt-4" accent={COLORS.violet}>
            <div className="flex items-center justify-between">
              <p className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.12em] text-white/60">
                <Fi name="fi-rr-filter" className="text-violet-300" />
                Filtros avançados
              </p>
              {hasActiveFilters && (
                <button
                  type="button"
                  onClick={() => {
                    setSourceFilter("");
                    setAttendantFilter("");
                    setCustomFrom("");
                    setCustomTo("");
                  }}
                  className="text-[11px] text-violet-300 hover:text-violet-200"
                >
                  Limpar tudo
                </button>
              )}
            </div>
            <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <div>
                <label className="text-[11px] font-medium text-white/60">Origem</label>
                <select
                  value={sourceFilter}
                  onChange={(e) => setSourceFilter(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs text-white outline-none focus:border-violet-400/50"
                >
                  <option value="" className="bg-slate-900">Todas</option>
                  {(sources.data ?? []).map((s) => (
                    <option key={s} value={s} className="bg-slate-900">{s}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-[11px] font-medium text-white/60">Atendente</label>
                <select
                  value={attendantFilter}
                  onChange={(e) => setAttendantFilter(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs text-white outline-none focus:border-violet-400/50"
                >
                  <option value="" className="bg-slate-900">Todos</option>
                  {(attendants.data ?? []).map((a) => (
                    <option key={a.id} value={a.id} className="bg-slate-900">{a.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-[11px] font-medium text-white/60">Período customizado</label>
                <div className="mt-1 flex items-center gap-1.5">
                  <input
                    type="date"
                    value={customFrom}
                    onChange={(e) => setCustomFrom(e.target.value)}
                    className="w-full rounded-lg border border-white/10 bg-white/5 px-2 py-2 text-xs text-white outline-none focus:border-violet-400/50"
                  />
                  <span className="text-white/40">–</span>
                  <input
                    type="date"
                    value={customTo}
                    onChange={(e) => setCustomTo(e.target.value)}
                    className="w-full rounded-lg border border-white/10 bg-white/5 px-2 py-2 text-xs text-white outline-none focus:border-violet-400/50"
                  />
                </div>
              </div>
            </div>
            {etapasTop.length > 0 && (
              <div className="mt-4">
                <label className="text-[11px] font-medium text-white/60">Etapas do funil (live)</label>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {etapasTop.map((e) => (
                    <span
                      key={e.raw}
                      className="rounded-full border border-white/15 bg-white/5 px-3 py-1 text-[11px] text-white/70"
                    >
                      {e.label} <span className="ml-1 opacity-60">{nf(e.value)}</span>
                    </span>
                  ))}
                </div>
              </div>
            )}
          </DarkCard>
        )}

        {isLoading ? (
          <div className="mt-12 flex items-center justify-center">
            <Loader2 className="h-7 w-7 animate-spin text-white/50" />
          </div>
        ) : (
          <>
            {/* ─── 2. CARDS DE TOTAIS (3 colunas — Leads / Cadastro / Resgate) ── */}
            <div className="mt-6 grid gap-4 lg:grid-cols-3">
              <FunnelCard
                title="Total de Leads"
                icon="fi-rr-users-alt"
                accent={COLORS.emerald}
                data={ov?.funnel_leads}
                prev={ovPrev?.funnel_leads}
              />
              <FunnelCard
                title="Total Cadastro"
                icon="fi-rr-user-add"
                accent={COLORS.violet}
                data={ov?.funnel_cadastro}
                prev={ovPrev?.funnel_cadastro}
              />
              <FunnelCard
                title="Total Resgate"
                icon="fi-rr-rotate-right"
                accent={COLORS.amber}
                data={ov?.funnel_resgate}
                prev={ovPrev?.funnel_resgate}
              />
            </div>

            {/* ─── 3. TABELAS POR ORIGEM ─────────────────────────────────── */}
            <div className="mt-4 grid gap-4 lg:grid-cols-3">
              <OriginTable
                title="Origem dos Leads"
                icon="fi-rr-marker"
                accent={COLORS.emerald}
                rows={origensLeads}
                secondColumnLabel="Agendados"
                secondColumnValues={agendadosByOrigem}
              />
              <OriginTable
                title="Origem das Consultas"
                icon="fi-rr-stethoscope"
                accent={COLORS.sky}
                rows={origensConsultas}
                secondColumnLabel="Compareceram"
                secondColumnValues={compareceuByOrigem}
              />
              <OriginTable
                title="Origem dos Tratamentos"
                icon="fi-rr-tooth"
                accent={COLORS.amber}
                rows={origensTratamentos}
              />
            </div>

            {/* ─── 4. ROSCA por SEMANA ───────────────────────────────────── */}
            <div className="mt-4 grid gap-4 lg:grid-cols-3">
              <WeekDonut
                title="Leads por semana"
                icon="fi-rr-calendar-day"
                accent={COLORS.emerald}
                data={ov?.leads_por_semana ?? []}
              />
              <WeekDonut
                title="Consultas por semana"
                icon="fi-rr-stethoscope"
                accent={COLORS.sky}
                data={ov?.consultas_por_semana ?? []}
              />
              <WeekDonut
                title="Tratamentos por semana"
                icon="fi-rr-tooth"
                accent={COLORS.amber}
                data={ov?.tratamentos_por_semana ?? []}
              />
            </div>

            {/* ─── 5. BARRAS POR DIA DA SEMANA ───────────────────────────── */}
            <div className="mt-4">
              <WeekdayBarChart data={ov?.leads_por_dia_semana ?? []} />
            </div>
          </>
        )}
      </div>
    </div>
  );
}
