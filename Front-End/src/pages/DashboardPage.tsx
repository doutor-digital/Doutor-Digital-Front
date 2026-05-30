import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Cog, Loader2 } from "@/components/icons";
import { useClinic } from "@/hooks/useClinic";
import { webhooksService } from "@/services/webhooks";
import { unitsService } from "@/services/units";

// ─── Helpers ──────────────────────────────────────────────────────────────
const nf = (n?: number | null) =>
  n == null ? "—" : new Intl.NumberFormat("pt-BR").format(n);

function isoDaysAgo(days: number) {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - days);
  return d.toISOString();
}
function isoStartOfDay(date = new Date()) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d.toISOString();
}
function isoEndOfDay(date = new Date()) {
  const d = new Date(date);
  d.setHours(23, 59, 59, 999);
  return d.toISOString();
}
function fmtDateBr(iso: string) {
  return new Date(iso).toLocaleDateString("pt-BR");
}

// ─── Filtros (pílulas Today/Yesterday/Week/Month) ─────────────────────────
type RangeKey = "today" | "yesterday" | "week" | "month" | "custom";

const RANGES: Array<{ key: RangeKey; label: string }> = [
  { key: "today", label: "Hoje" },
  { key: "yesterday", label: "Ontem" },
  { key: "week", label: "Semana" },
  { key: "month", label: "Mês" },
];

function computeRange(key: RangeKey): { from: string; to: string } {
  const now = new Date();
  if (key === "today") return { from: isoStartOfDay(now), to: isoEndOfDay(now) };
  if (key === "yesterday") {
    const d = new Date(now);
    d.setDate(d.getDate() - 1);
    return { from: isoStartOfDay(d), to: isoEndOfDay(d) };
  }
  if (key === "week") return { from: isoDaysAgo(6), to: isoEndOfDay(now) };
  if (key === "month") return { from: isoDaysAgo(29), to: isoEndOfDay(now) };
  return { from: isoDaysAgo(29), to: isoEndOfDay(now) };
}

// ─── Cores por canal (matching amoCRM) ────────────────────────────────────
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
};
function channelColor(name: string) {
  const k = (name || "").toLowerCase();
  for (const key of Object.keys(CHANNEL_COLORS)) {
    if (k.includes(key)) return CHANNEL_COLORS[key];
  }
  // fallback determinístico
  const palette = ["#a78bfa", "#22d3ee", "#34d399", "#f472b6", "#fbbf24", "#60a5fa"];
  let h = 0;
  for (let i = 0; i < k.length; i++) h = (h * 31 + k.charCodeAt(i)) >>> 0;
  return palette[h % palette.length];
}

// ─── Donut concêntrico (LEAD SOURCES) ─────────────────────────────────────
function ConcentricDonut({
  data,
  size = 240,
}: {
  data: Array<{ name: string; value: number; color: string }>;
  size?: number;
}) {
  const max = Math.max(1, ...data.map((d) => d.value));
  const center = size / 2;
  const ringGap = 6;
  const ringWidth = 10;
  const innerRadius = 36;

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      {data.map((d, i) => {
        const r = innerRadius + i * (ringWidth + ringGap);
        const circ = 2 * Math.PI * r;
        const ratio = Math.min(1, d.value / max);
        const dash = ratio * circ;
        return (
          <g key={i} transform={`rotate(-90 ${center} ${center})`}>
            <circle
              cx={center}
              cy={center}
              r={r}
              fill="none"
              stroke="rgba(255,255,255,0.06)"
              strokeWidth={ringWidth}
            />
            <circle
              cx={center}
              cy={center}
              r={r}
              fill="none"
              stroke={d.color}
              strokeWidth={ringWidth}
              strokeLinecap="round"
              strokeDasharray={`${dash} ${circ - dash}`}
            />
          </g>
        );
      })}
    </svg>
  );
}

// ─── Card escuro (base navy) ──────────────────────────────────────────────
function DarkCard({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`relative overflow-hidden rounded-2xl bg-[#0f1f3a]/80 ring-1 ring-white/5 p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)] ${className}`}
    >
      {children}
    </div>
  );
}

function MetricCard({
  label,
  value,
  range,
  valueClass = "text-violet-400",
  children,
  className = "",
}: {
  label: string;
  value: string | number;
  range?: string;
  valueClass?: string;
  children?: React.ReactNode;
  className?: string;
}) {
  return (
    <DarkCard className={className}>
      <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-white/60">
        {label}
      </p>
      <p className={`mt-3 text-5xl font-bold leading-none ${valueClass}`}>
        {value}
      </p>
      <div className="mt-3 h-px w-1/3 bg-white/10" />
      {range && (
        <p className="mt-3 text-[11px] text-white/40">{range}</p>
      )}
      {children}
    </DarkCard>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────
export default function DashboardPage() {
  const { tenantId, unitId } = useClinic();
  const [rangeKey, setRangeKey] = useState<RangeKey>("month");

  const range = useMemo(() => computeRange(rangeKey), [rangeKey]);
  const rangeLabel = `${fmtDateBr(range.from)} - ${fmtDateBr(range.to)}`;

  const units = useQuery({
    queryKey: ["dash-amo", "units"],
    queryFn: () => unitsService.list(),
    staleTime: 5 * 60_000,
  });

  const overview = useQuery({
    queryKey: ["dash-amo", "overview", tenantId, unitId, range.from, range.to],
    queryFn: () =>
      webhooksService.dashboardOverview({
        clinicId: tenantId ?? undefined,
        unitId: unitId ?? undefined,
        dateFrom: range.from,
        dateTo: range.to,
      }),
    enabled: tenantId != null,
    staleTime: 60_000,
  });

  const ov = overview.data;

  const agencyName = useMemo(() => {
    if (!unitId) return "Todas as unidades";
    const u = units.data?.find((x) => String(x.id) === String(unitId));
    return u?.name ?? "Dashboard";
  }, [unitId, units.data]);

  // ─── Canais (origens com cor + barra proporcional) ────────────────────
  const channels = useMemo(() => {
    const arr = (ov?.origens ?? []).filter((o) => (o.quantidade ?? 0) > 0);
    const sorted = [...arr].sort(
      (a, b) => (b.quantidade ?? 0) - (a.quantidade ?? 0),
    );
    const top = sorted.slice(0, 5);
    const otherTotal = sorted.slice(5).reduce(
      (s, o) => s + (o.quantidade ?? 0),
      0,
    );
    const items = top.map((o) => ({
      name: o.origem ?? "—",
      value: o.quantidade ?? 0,
      color: channelColor(o.origem ?? ""),
    }));
    if (otherTotal > 0) {
      items.push({ name: "Other", value: otherTotal, color: "#64748b" });
    }
    return items;
  }, [ov]);

  const channelMax = useMemo(
    () => Math.max(1, ...channels.map((c) => c.value)),
    [channels],
  );

  const totalLeads = ov?.total_leads ?? 0;
  const ongoing = ov?.consultas_agendadas ?? 0;
  const unanswered = Math.max(0, (ov?.total_leads ?? 0) - (ov?.consultas ?? 0));
  const wonLeads = ov?.fechou ?? 0;
  const activeLeads = Math.max(
    0,
    (ov?.consultas ?? 0) - (ov?.fechou ?? 0) - (ov?.nao_fechou ?? 0),
  );
  const tasks = ov?.faltou ?? 0;

  const isLoading = overview.isLoading && !ov;

  // ─── Render ───────────────────────────────────────────────────────────
  return (
    <div
      className="-m-4 lg:-m-6 min-h-[calc(100vh-4rem)] text-white"
      style={{
        background:
          "radial-gradient(ellipse at top, #1a3565 0%, #0a1a36 45%, #050d22 100%)",
      }}
    >
      {/* Padrão pontilhado sutil */}
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.06]"
        style={{
          backgroundImage:
            "radial-gradient(rgba(255,255,255,0.6) 1px, transparent 1px)",
          backgroundSize: "22px 22px",
        }}
      />

      <div className="relative mx-auto max-w-[1400px] px-4 py-6 lg:px-8 lg:py-10">
        {/* ─── HEADER: Título ─────────────────────────────────────────── */}
        <h1 className="text-center text-4xl font-bold tracking-tight sm:text-5xl">
          {agencyName}
        </h1>

        {/* ─── FILTROS ─────────────────────────────────────────────────── */}
        <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
          {/* Pílulas centralizadas */}
          <div className="mx-auto flex flex-wrap items-center gap-1 rounded-full border border-white/15 bg-white/5 p-1 backdrop-blur">
            {RANGES.map((r) => (
              <button
                key={r.key}
                type="button"
                onClick={() => setRangeKey(r.key)}
                className={`rounded-full px-4 py-1.5 text-xs font-medium transition ${
                  rangeKey === r.key
                    ? "bg-white text-slate-900"
                    : "text-white/70 hover:text-white"
                }`}
              >
                {r.label}
              </button>
            ))}
            <span className="rounded-full bg-white px-4 py-1.5 text-xs font-semibold text-slate-900">
              {rangeLabel}
            </span>
          </div>

          {/* All / Select user / Setup */}
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1 rounded-full border border-white/15 bg-white/5 p-1">
              <button
                type="button"
                className="rounded-full bg-white px-4 py-1.5 text-xs font-semibold text-slate-900"
              >
                Todos
              </button>
              <button
                type="button"
                className="flex items-center gap-1 rounded-full px-3 py-1.5 text-xs text-white/70 hover:text-white"
              >
                Selecionar usuário
                <svg
                  width="10"
                  height="10"
                  viewBox="0 0 12 12"
                  fill="none"
                  className="opacity-70"
                >
                  <path
                    d="M3 4.5L6 7.5L9 4.5"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </button>
            </div>
            <button
              type="button"
              className="flex items-center gap-1.5 rounded-full border border-white/15 bg-white/5 px-4 py-1.5 text-xs font-medium text-white/80 hover:bg-white/10"
            >
              <Cog className="h-3.5 w-3.5" />
              Configurar
            </button>
          </div>
        </div>

        {/* ─── LOADING ─────────────────────────────────────────────────── */}
        {isLoading ? (
          <div className="mt-12 flex items-center justify-center">
            <Loader2 className="h-7 w-7 animate-spin text-white/50" />
          </div>
        ) : (
          <>
            {/* ─── GRID PRINCIPAL ─────────────────────────────────────── */}
            <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {/* INCOMING MESSAGES (col 1, span 2 rows) */}
              <DarkCard className="lg:row-span-2">
                <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-white/60">
                  Mensagens recebidas
                </p>
                <p className="mt-3 text-right text-5xl font-bold leading-none text-emerald-400">
                  {nf(totalLeads)}
                </p>
                <p className="mt-3 text-[11px] text-white/40">{rangeLabel}</p>
                <div className="mt-4 h-px w-full bg-white/10" />

                {/* Canais */}
                <ul className="mt-4 space-y-3">
                  {channels.length === 0 && (
                    <li className="text-xs text-white/40">Sem dados</li>
                  )}
                  {channels.map((c) => {
                    const ratio = c.value / channelMax;
                    return (
                      <li key={c.name}>
                        <div className="flex items-center justify-between text-[12px] text-white/80">
                          <span className="flex items-center gap-2">
                            <span
                              className="inline-block h-2 w-2 rounded-full"
                              style={{ background: c.color }}
                            />
                            <span className="truncate">{c.name}</span>
                          </span>
                          <span
                            className="font-semibold"
                            style={{ color: c.color }}
                          >
                            {nf(c.value)}
                          </span>
                        </div>
                        <div className="mt-1 h-1 w-full overflow-hidden rounded-full bg-white/5">
                          <div
                            className="h-full rounded-full transition-all"
                            style={{
                              width: `${Math.max(4, ratio * 100)}%`,
                              background: c.color,
                            }}
                          />
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </DarkCard>

              {/* ONGOING CONVERSATIONS */}
              <MetricCard
                label="Conversas em andamento"
                value={nf(ongoing)}
                range={rangeLabel}
              />

              {/* UNANSWERED CONVERSATIONS */}
              <MetricCard
                label="Sem resposta"
                value={nf(unanswered)}
                range={rangeLabel}
              />

              {/* LEAD SOURCES (col 4, span 2 rows) */}
              <DarkCard className="lg:row-span-2">
                <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-white/60">
                  Origens de leads
                </p>
                <div className="mt-4 flex items-center justify-between gap-3">
                  <ul className="flex-1 space-y-1.5 text-[11px]">
                    {channels.length === 0 && (
                      <li className="text-white/40">Sem dados</li>
                    )}
                    {channels.map((c) => (
                      <li
                        key={c.name}
                        className="flex items-center gap-2 truncate"
                        style={{ color: c.color }}
                      >
                        <span
                          className="inline-block h-1.5 w-1.5 shrink-0 rounded-full"
                          style={{ background: c.color }}
                        />
                        <span className="truncate uppercase tracking-wide">
                          {c.name}
                        </span>
                      </li>
                    ))}
                  </ul>
                  <div className="shrink-0">
                    <ConcentricDonut
                      data={channels.length ? channels : [
                        { name: "—", value: 1, color: "#1e293b" },
                      ]}
                      size={200}
                    />
                  </div>
                </div>
              </DarkCard>

              {/* MEDIAN REPLY TIME */}
              <MetricCard
                label="Tempo médio de resposta"
                value={ov?.comparecimento_rate != null ? `${Math.round(ov.comparecimento_rate)}%` : "—"}
                range={rangeLabel}
              />

              {/* LONGEST AWAITING REPLY */}
              <MetricCard
                label="Maior tempo de espera"
                value={ov?.fechamento_rate != null ? `${Math.round(ov.fechamento_rate)}%` : "—"}
                range={rangeLabel}
              />
            </div>

            {/* ─── SEGUNDA FILEIRA: Won / Active / Tasks ─────────────── */}
            <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <MetricCard label="Leads ganhos" value={nf(wonLeads)} />
              <MetricCard label="Leads ativos" value={nf(activeLeads)} />
              <DarkCard>
                <div className="flex items-start justify-between">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-white/60">
                    Tarefas
                  </p>
                  <Cog className="h-3.5 w-3.5 text-white/40" />
                </div>
                <p className="mt-3 text-5xl font-bold leading-none text-violet-400">
                  {nf(tasks)}
                </p>
                <div className="mt-3 h-px w-1/3 bg-white/10" />
              </DarkCard>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
