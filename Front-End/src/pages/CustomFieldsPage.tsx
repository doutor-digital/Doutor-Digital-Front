import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Loader2 } from "@/components/icons";
import { KpiDrillDown, type KpiDrillTarget } from "@/components/kpi/KpiDrillDown";
import { useClinic } from "@/hooks/useClinic";
import { kpiConfigService, type CustomFieldSummary } from "@/services/kpiConfig";
import { unitsService } from "@/services/units";
import { cn, formatNumber } from "@/lib/utils";

// ─────────────────────────────────────────────────────────────────────────────
// Paleta (inspirada no relatório de referência)
// ─────────────────────────────────────────────────────────────────────────────

const C = {
  bg: "#EEF1FA",
  panel: "#FFFFFF",
  header: "#4F46E5",
  headerDark: "#3730A3",
  primary: "#4F46E5",
  primarySoft: "#A5B4FC",
  teal: "#10B981",
  tealSoft: "#6EE7B7",
  ink: "#1E293B",
  inkSoft: "#64748B",
  rule: "#E5E7EB",
  rowAlt: "#F8FAFC",
} as const;

const PALETTE = [C.primary, C.teal, "#F59E0B", "#EC4899", "#06B6D4", "#A855F7", "#22C55E", "#94A3B8"];

const RANGES: Array<{ key: string; label: string; days: number }> = [
  { key: "7", label: "7 dias", days: 7 },
  { key: "30", label: "30 dias", days: 30 },
  { key: "90", label: "90 dias", days: 90 },
];

function isoDaysAgo(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString().slice(0, 10);
}

// ─────────────────────────────────────────────────────────────────────────────
// Página
// ─────────────────────────────────────────────────────────────────────────────

export default function CustomFieldsPage() {
  const { unitId } = useClinic();
  const queryClient = useQueryClient();
  const [rangeKey, setRangeKey] = useState("30");
  const [search, setSearch] = useState("");
  const [drill, setDrill] = useState<KpiDrillTarget | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [syncMsg, setSyncMsg] = useState<string | null>(null);

  const days = RANGES.find((r) => r.key === rangeKey)?.days ?? 30;
  const dateFrom = useMemo(() => isoDaysAgo(days), [days]);
  const dateTo = useMemo(() => new Date().toISOString().slice(0, 10), []);

  const summary = useQuery({
    queryKey: ["custom-fields-summary", unitId, dateFrom, dateTo],
    queryFn: () =>
      kpiConfigService.customFieldsSummary(unitId, { date_from: dateFrom, date_to: dateTo }),
  });

  const total = summary.data?.total_leads ?? 0;
  const allFields: CustomFieldSummary[] = summary.data?.fields ?? [];

  const filteredFields = useMemo(() => {
    const q = search.trim().toLowerCase();
    return q ? allFields.filter((f) => f.field_name.toLowerCase().includes(q)) : allFields;
  }, [allFields, search]);

  // Métricas agregadas pros KPI cards
  const metrics = useMemo(() => {
    const fieldsWithData = allFields.filter((f) => f.filled > 0);
    const totalFills = allFields.reduce((s, f) => s + f.filled, 0);
    const avgFill =
      allFields.length > 0
        ? allFields.reduce((s, f) => s + f.filled / Math.max(1, total), 0) / allFields.length
        : 0;
    const totalDistinct = allFields.reduce((s, f) => s + f.distinct_values, 0);
    return {
      totalLeads: total,
      fieldsActive: fieldsWithData.length,
      fieldsTotal: allFields.length,
      totalFills,
      avgFillPct: Math.round(avgFill * 100),
      totalDistinct,
    };
  }, [allFields, total]);

  // Top 8 campos por preenchimento → bar chart
  const topFieldsForChart = useMemo(() => {
    return [...filteredFields]
      .sort((a, b) => b.filled - a.filled)
      .slice(0, 8)
      .map((f) => ({
        name: shortLabel(f.field_name, 10),
        fullName: f.field_name,
        preenchido: f.filled,
        vazio: Math.max(0, total - f.filled),
      }));
  }, [filteredFields, total]);

  // Top 3 campos pra gauges circulares
  const topThree = useMemo(() => {
    return [...filteredFields].sort((a, b) => b.filled - a.filled).slice(0, 3);
  }, [filteredFields]);

  // "Analytical" — lista horizontal de barras (top 8 ordenados)
  const analyticalRows = useMemo(() => {
    return [...filteredFields]
      .sort((a, b) => b.filled - a.filled)
      .slice(0, 8)
      .map((f, i) => ({
        label: f.field_name,
        pct: total > 0 ? Math.round((f.filled / total) * 100) : 0,
        count: f.filled,
        color: PALETTE[i % PALETTE.length],
      }));
  }, [filteredFields, total]);

  // "Distribuição" — top values do campo #1 mais preenchido
  const topField = topThree[0];

  async function handleSync() {
    if (!unitId || syncing) return;
    setSyncing(true);
    setSyncMsg("Sincronizando…");
    try {
      const r = await unitsService.syncFromKommo(unitId, { maxLeads: 5000 });
      if (r.success) {
        setSyncMsg(`OK — ${r.leadsPersisted} leads em ${(r.durationMs / 1000).toFixed(1)}s`);
        await queryClient.invalidateQueries({ queryKey: ["custom-fields-summary"] });
      } else {
        setSyncMsg(`Falhou: ${r.error ?? "erro desconhecido"}`);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setSyncMsg(`Erro: ${msg}`);
    } finally {
      setSyncing(false);
      setTimeout(() => setSyncMsg(null), 8000);
    }
  }

  return (
    <div className="-mx-4 md:-mx-6 -mt-2" style={{ background: C.bg, minHeight: "calc(100vh - 3rem)" }}>
      {/* Header bar roxo (estilo dashboard de referência) */}
      <header
        className="flex items-center justify-between px-6 py-3"
        style={{ background: `linear-gradient(90deg, ${C.headerDark} 0%, ${C.header} 100%)` }}
      >
        <div className="flex items-center gap-3">
          <div
            className="h-8 w-8 rounded grid place-items-center text-[11px] font-bold text-white"
            style={{ background: "rgba(255,255,255,0.15)" }}
          >
            DD
          </div>
          <h1 className="text-[14px] font-semibold tracking-wide text-white">
            CAMPOS CUSTOMIZADOS
          </h1>
        </div>
        <div className="flex items-center gap-3">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Filtrar campo…"
            className="w-56 rounded-md bg-white px-3 py-1.5 text-[12px] text-slate-700 placeholder-slate-400 outline-none"
          />
          <button
            type="button"
            onClick={handleSync}
            disabled={!unitId || syncing}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-md bg-white/15 px-3 py-1.5 text-[12px] font-medium text-white",
              "hover:bg-white/25 disabled:opacity-50 disabled:cursor-not-allowed",
            )}
          >
            {syncing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <span>⟳</span>}
            {syncing ? "Sincronizando…" : "Sincronizar Kommo"}
          </button>
        </div>
      </header>

      {/* Conteúdo */}
      <div className="px-6 py-5" style={{ color: C.ink }}>
        {/* Linha do título + filtros de período */}
        <div className="mb-5 flex items-end justify-between gap-4">
          <div>
            <h2 className="text-[26px] font-semibold tracking-tight" style={{ color: C.ink }}>
              Visão Geral
            </h2>
            <p className="mt-0.5 text-[12px]" style={{ color: C.inkSoft }}>
              {formatNumber(total)} leads no período · {dateFrom} → {dateTo}
            </p>
          </div>
          <div className="inline-flex items-center rounded-md border" style={{ borderColor: C.rule, background: C.panel }}>
            {RANGES.map((r) => (
              <button
                key={r.key}
                type="button"
                onClick={() => setRangeKey(r.key)}
                className={cn(
                  "px-3 py-1.5 text-[11.5px] font-medium",
                  rangeKey === r.key ? "text-white" : "text-slate-500 hover:text-slate-700",
                )}
                style={rangeKey === r.key ? { background: C.primary, borderRadius: 4 } : undefined}
              >
                {r.label}
              </button>
            ))}
          </div>
        </div>

        {syncMsg && (
          <div
            className="mb-3 rounded-md px-3 py-2 text-[12px]"
            style={{ background: "#fff", color: C.ink, border: `1px solid ${C.rule}` }}
          >
            {syncMsg}
          </div>
        )}

        {summary.isLoading ? (
          <div className="grid h-72 place-items-center" style={{ color: C.inkSoft }}>
            <Loader2 className="h-8 w-8 animate-spin" />
          </div>
        ) : (
          <div className="grid grid-cols-12 gap-4">
            {/* ───── LINHA 1 ───── */}

            {/* Average Charts (esquerda) */}
            <Panel title="Preenchimento por Campo" className="col-span-12 lg:col-span-8">
              <div className="h-72 px-4 pb-4">
                {topFieldsForChart.length === 0 ? (
                  <EmptyMini text="Sem dados pra exibir" />
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={topFieldsForChart} margin={{ top: 16, right: 12, left: 0, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke={C.rule} vertical={false} />
                      <XAxis dataKey="name" tick={{ fill: C.inkSoft, fontSize: 10 }} interval={0} />
                      <YAxis tick={{ fill: C.inkSoft, fontSize: 10 }} />
                      <Tooltip
                        cursor={{ fill: "rgba(79, 70, 229, 0.06)" }}
                        contentStyle={{
                          background: "#fff",
                          border: `1px solid ${C.rule}`,
                          borderRadius: 6,
                          fontSize: 12,
                          color: C.ink,
                        }}
                        formatter={(v: number, name: string) => [formatNumber(v), name]}
                        labelFormatter={(_, payload) => {
                          const item = payload?.[0]?.payload as { fullName?: string } | undefined;
                          return item?.fullName ?? "";
                        }}
                      />
                      <Bar dataKey="preenchido" fill={C.teal} name="Preenchido" radius={[3, 3, 0, 0]} />
                      <Bar dataKey="vazio" fill={C.primary} name="Vazio" radius={[3, 3, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </div>
            </Panel>

            {/* Calculation (direita) — 3 KPI cards */}
            <Panel title="Resumo" className="col-span-12 lg:col-span-4">
              <div className="grid grid-cols-3 gap-2 px-4 py-4">
                <KpiTile
                  label="Leads"
                  value={formatNumber(metrics.totalLeads)}
                  icon="👥"
                  color={C.primary}
                />
                <KpiTile
                  label="Campos ativos"
                  value={`${metrics.fieldsActive}/${metrics.fieldsTotal}`}
                  icon="↓"
                  color={C.teal}
                />
                <KpiTile
                  label="Preenchimentos"
                  value={formatNumber(metrics.totalFills)}
                  icon="★"
                  color={C.primary}
                />
              </div>
            </Panel>

            {/* ───── LINHA 2 ───── */}

            {/* Distribuição (esquerda) — top values do campo #1 */}
            <Panel
              title={topField ? `Distribuição: ${topField.field_name}` : "Distribuição"}
              className="col-span-12 lg:col-span-8"
            >
              <div className="px-4 py-4">
                {!topField || topField.top_values.length === 0 ? (
                  <EmptyMini text="Selecione um campo com valores preenchidos" />
                ) : (
                  <ul className="space-y-2">
                    {topField.top_values.slice(0, 8).map((v, i) => {
                      const max = topField.top_values[0]?.count ?? 1;
                      const pct = Math.round((v.count / max) * 100);
                      return (
                        <li
                          key={v.value}
                          className="flex items-center gap-3 rounded-md p-2 hover:bg-slate-50 cursor-pointer"
                          onClick={() =>
                            setDrill({
                              kpiKey: `field_${topField.field_id}`,
                              label: `${topField.field_name}: ${v.value}`,
                              source: {
                                source_type: "custom_field_count",
                                config: {
                                  fieldId: topField.field_id,
                                  fieldCode: topField.field_code,
                                  matchValues: [v.value],
                                },
                              },
                            })
                          }
                        >
                          <div className="w-40 truncate text-[12px]" style={{ color: C.ink }}>
                            {v.value}
                          </div>
                          <div className="flex-1 h-2.5 rounded-full" style={{ background: C.rule }}>
                            <div
                              className="h-full rounded-full"
                              style={{ width: `${Math.max(3, pct)}%`, background: PALETTE[i % PALETTE.length] }}
                            />
                          </div>
                          <div className="w-12 text-right text-[12px] font-semibold tabular-nums" style={{ color: C.ink }}>
                            {formatNumber(v.count)}
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
            </Panel>

            {/* 3 Gauges circulares (direita) */}
            <Panel title="Top 3 campos" className="col-span-12 lg:col-span-4">
              <div className="flex flex-col items-center gap-4 px-4 py-4">
                {topThree.length === 0 ? (
                  <EmptyMini text="Sem dados" />
                ) : (
                  topThree.map((f, i) => {
                    const pct = total > 0 ? Math.round((f.filled / total) * 100) : 0;
                    return (
                      <CircleGauge
                        key={f.field_id}
                        label={`Chart 0${i + 1} · ${shortLabel(f.field_name, 14)}`}
                        pct={pct}
                        color={i === 1 ? C.primary : C.primary}
                        filled={i === 1}
                      />
                    );
                  })
                )}
              </div>
            </Panel>

            {/* ───── LINHA 3 ───── */}

            {/* Lista de TODOS os campos (analytical-style) */}
            <Panel title="Todos os Campos" className="col-span-12">
              <div className="px-4 py-3">
                {analyticalRows.length === 0 && filteredFields.length === 0 ? (
                  <EmptyMini text="Nenhum campo no período" />
                ) : (
                  <ul className="space-y-1.5">
                    {filteredFields.map((f, i) => {
                      const pct = total > 0 ? Math.round((f.filled / total) * 100) : 0;
                      const color = PALETTE[i % PALETTE.length];
                      return (
                        <li
                          key={f.field_id}
                          className="grid grid-cols-12 items-center gap-3 rounded-md py-1.5 px-2 hover:bg-slate-50"
                        >
                          <div className="col-span-3 truncate text-[12px]" style={{ color: C.ink }} title={f.field_name}>
                            {f.field_name}
                          </div>
                          <div className="col-span-2 text-[10.5px] uppercase tracking-wide" style={{ color: C.inkSoft }}>
                            {f.type}
                          </div>
                          <div className="col-span-5 h-2 rounded-full" style={{ background: C.rule }}>
                            <div
                              className="h-full rounded-full"
                              style={{ width: `${Math.max(2, pct)}%`, background: color }}
                            />
                          </div>
                          <div className="col-span-1 text-right text-[11.5px] tabular-nums" style={{ color: C.inkSoft }}>
                            {formatNumber(f.filled)}
                          </div>
                          <div
                            className="col-span-1 text-right text-[12px] font-bold tabular-nums"
                            style={{ color: pct >= 50 ? C.teal : pct >= 20 ? C.primary : C.inkSoft }}
                          >
                            {pct}%
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
            </Panel>

            {/* Recent Update — barra fina informativa */}
            <Panel className="col-span-12">
              <div className="px-4 py-3 flex items-center gap-4 text-[12px]" style={{ color: C.inkSoft }}>
                <span className="font-semibold" style={{ color: C.ink }}>{dateTo}</span>
                <span className="font-medium" style={{ color: C.ink }}>Última atualização</span>
                <span>
                  Cache: 1h · Sync periódico Kommo a cada 30min · Clique "Sincronizar Kommo" pra puxar agora.
                </span>
              </div>
            </Panel>
          </div>
        )}
      </div>

      <KpiDrillDown
        target={drill}
        unitId={unitId}
        dateFrom={dateFrom}
        dateTo={dateTo}
        onClose={() => setDrill(null)}
      />
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Sub-componentes
// ─────────────────────────────────────────────────────────────────────────────

function Panel({
  title,
  children,
  className,
}: {
  title?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section
      className={cn("rounded-xl shadow-sm", className)}
      style={{ background: C.panel, border: `1px solid ${C.rule}` }}
    >
      {title && (
        <header className="px-4 py-2.5 border-b" style={{ borderColor: C.rule }}>
          <span className="text-[12.5px] font-semibold" style={{ color: C.ink }}>
            {title}
          </span>
        </header>
      )}
      {children}
    </section>
  );
}

function KpiTile({
  label,
  value,
  icon,
  color,
}: {
  label: string;
  value: string;
  icon: string;
  color: string;
}) {
  return (
    <div className="flex flex-col items-center justify-center text-center">
      <span className="text-[10px] uppercase tracking-widest" style={{ color: C.inkSoft }}>
        {label}
      </span>
      <span className="mt-1.5 text-[24px] font-bold tabular-nums leading-none" style={{ color }}>
        {icon === "👥" || icon === "↓" || icon === "★" ? (
          <span className="block text-[20px]" style={{ color }}>{icon}</span>
        ) : null}
      </span>
      <span className="mt-1 text-[20px] font-extrabold tabular-nums" style={{ color: C.ink }}>
        {value}
      </span>
    </div>
  );
}

function CircleGauge({
  label,
  pct,
  color,
  filled,
}: {
  label: string;
  pct: number;
  color: string;
  filled: boolean;
}) {
  const size = 84;
  const stroke = 8;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const offset = c - (pct / 100) * c;

  return (
    <div className="flex flex-col items-center">
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        {/* Trilho */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke={C.rule}
          strokeWidth={stroke}
          fill="none"
        />
        {/* Preenchimento (estilo "ring 02" da imagem = preenchido sólido) */}
        {filled && (
          <circle cx={size / 2} cy={size / 2} r={r - stroke / 2 - 1} fill={color} />
        )}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke={color}
          strokeWidth={stroke}
          fill="none"
          strokeDasharray={c}
          strokeDashoffset={offset}
          strokeLinecap="round"
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
        <text
          x={size / 2}
          y={size / 2}
          textAnchor="middle"
          dominantBaseline="middle"
          fontSize="16"
          fontWeight="700"
          fill={filled ? "#fff" : color}
        >
          {pct}%
        </text>
      </svg>
      <span className="mt-1 text-[10.5px] text-center" style={{ color: C.inkSoft }}>
        {label}
      </span>
    </div>
  );
}

function EmptyMini({ text }: { text: string }) {
  return (
    <div className="h-full grid place-items-center text-[12px]" style={{ color: C.inkSoft }}>
      {text}
    </div>
  );
}

function shortLabel(s: string, max: number): string {
  if (!s) return "";
  if (s.length <= max) return s;
  return s.slice(0, max - 1) + "…";
}
