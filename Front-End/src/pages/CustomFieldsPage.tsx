import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis, Legend, Cell } from "recharts";
import { Loader2, Users2 } from "@/components/icons";
import { KpiDrillDown, type KpiDrillTarget } from "@/components/kpi/KpiDrillDown";
import { useClinic } from "@/hooks/useClinic";
import {
  kpiConfigService,
  type CustomFieldSummary,
  type ValueCount,
} from "@/services/kpiConfig";
import { unitsService } from "@/services/units";
import { cn, formatNumber } from "@/lib/utils";

// ─────────────────────────────────────────────────────────────────────────────
// Paleta
// ─────────────────────────────────────────────────────────────────────────────

const C = {
  bg: "#EEF1FA",
  panel: "#FFFFFF",
  header: "#4F46E5",
  headerDark: "#3730A3",
  primary: "#4F46E5",
  teal: "#10B981",
  amber: "#F59E0B",
  rose: "#EC4899",
  cyan: "#06B6D4",
  purple: "#A855F7",
  green: "#22C55E",
  ink: "#1E293B",
  inkSoft: "#64748B",
  rule: "#E5E7EB",
} as const;

const PALETTE = [C.primary, C.teal, C.amber, C.rose, C.cyan, C.purple, C.green, "#94A3B8"];

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
  const [detailField, setDetailField] = useState<CustomFieldSummary | null>(null);

  const days = RANGES.find((r) => r.key === rangeKey)?.days ?? 30;
  const dateFrom = useMemo(() => isoDaysAgo(days), [days]);
  const dateTo = useMemo(() => new Date().toISOString().slice(0, 10), []);
  const dateRangeLabel = `${dateFrom} → ${dateTo}`;

  const summary = useQuery({
    queryKey: ["custom-fields-summary", unitId, dateFrom, dateTo],
    queryFn: () =>
      kpiConfigService.customFieldsSummary(unitId, { date_from: dateFrom, date_to: dateTo }),
    enabled: unitId != null,
  });

  const cross = useQuery({
    queryKey: ["custom-fields-cross", unitId, dateFrom, dateTo],
    queryFn: () =>
      kpiConfigService.customFieldsCrossAnalysis(unitId, { date_from: dateFrom, date_to: dateTo }),
    enabled: unitId != null,
  });

  const total = summary.data?.total_leads ?? 0;
  const allFields: CustomFieldSummary[] = summary.data?.fields ?? [];

  const filteredFields = useMemo(() => {
    const q = search.trim().toLowerCase();
    return q ? allFields.filter((f) => f.field_name.toLowerCase().includes(q)) : allFields;
  }, [allFields, search]);

  async function handleSync() {
    if (!unitId || syncing) return;
    setSyncing(true);
    setSyncMsg("Sincronizando…");
    try {
      const r = await unitsService.syncFromKommo(unitId, { maxLeads: 5000 });
      if (r.success) {
        setSyncMsg(`OK — ${r.leadsPersisted} leads em ${(r.durationMs / 1000).toFixed(1)}s`);
        await queryClient.invalidateQueries({ queryKey: ["custom-fields-summary"] });
        await queryClient.invalidateQueries({ queryKey: ["custom-fields-cross"] });
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

  // Sem unit selecionada → tela informativa
  if (unitId == null) {
    return (
      <div className="-mx-4 md:-mx-6 -mt-2 min-h-[calc(100vh-3rem)]" style={{ background: C.bg }}>
        <header
          className="flex items-center px-6 py-3"
          style={{ background: `linear-gradient(90deg, ${C.headerDark} 0%, ${C.header} 100%)` }}
        >
          <h1 className="text-[14px] font-semibold tracking-wide text-white">CAMPOS CUSTOMIZADOS</h1>
        </header>
        <div className="px-6 py-10 max-w-xl mx-auto">
          <div className="rounded-xl p-8 text-center" style={{ background: C.panel, border: `1px solid ${C.rule}` }}>
            <Users2 className="h-10 w-10 mx-auto mb-3" style={{ color: C.inkSoft }} />
            <h2 className="text-[18px] font-semibold mb-1" style={{ color: C.ink }}>
              Selecione uma unidade
            </h2>
            <p className="text-[13px]" style={{ color: C.inkSoft }}>
              Pra ver os campos customizados de uma clínica específica, escolha a unidade no topo do painel.
              <br />
              Sem unidade, o dado fica agregado entre todas e perde sentido.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="-mx-4 md:-mx-6 -mt-2" style={{ background: C.bg, minHeight: "calc(100vh - 3rem)" }}>
      {/* Header */}
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
          <div>
            <h1 className="font-display text-[16px] font-semibold tracking-wide text-white">Campos Customizados</h1>
            <p className="text-[10.5px] text-white/70 mt-0.5">Unidade {unitId}</p>
          </div>
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
        <div className="mb-5 flex items-end justify-between gap-4">
          <div>
            <h2 className="font-display text-[30px] font-semibold tracking-tight" style={{ color: C.ink }}>
              Visão Geral
            </h2>
            <p className="mt-0.5 text-[12px]" style={{ color: C.inkSoft }}>
              {formatNumber(total)} leads · {dateFrom} → {dateTo}
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

        {summary.isLoading || cross.isLoading ? (
          <div className="grid h-72 place-items-center" style={{ color: C.inkSoft }}>
            <Loader2 className="h-8 w-8 animate-spin" />
          </div>
        ) : (
          <div className="space-y-4">
            {/* ───── ANÁLISES CRUZADAS ───── */}
            <h3 className="font-display text-[22px] font-semibold pt-2 tracking-tight" style={{ color: C.ink }}>
              Análises Cruzadas
            </h3>

            <div className="grid grid-cols-12 gap-4">
              {/* Sexo × desfecho — bar chart agrupado */}
              <Panel title="Sexo × Desfecho" subtitle="Quem agendou, compareceu e fechou — por sexo" className="col-span-12 lg:col-span-8">
                {(cross.data?.sexo_by_outcome.length ?? 0) === 0 ? (
                  <EmptyMini text="Campo 'Sexo' não preenchido em leads do período" />
                ) : (
                  <div className="h-72 px-4 pb-4">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={cross.data?.sexo_by_outcome ?? []} margin={{ top: 16, right: 12, left: 0, bottom: 4 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke={C.rule} vertical={false} />
                        <XAxis dataKey="sexo" tick={{ fill: C.inkSoft, fontSize: 11 }} />
                        <YAxis tick={{ fill: C.inkSoft, fontSize: 10 }} />
                        <Tooltip
                          contentStyle={{ background: "#fff", border: `1px solid ${C.rule}`, borderRadius: 6, fontSize: 12 }}
                        />
                        <Legend wrapperStyle={{ fontSize: 11 }} />
                        <Bar dataKey="total" fill={C.inkSoft} name="Total" radius={[2, 2, 0, 0]} />
                        <Bar dataKey="agendou" fill={C.primary} name="Agendou" radius={[2, 2, 0, 0]} />
                        <Bar dataKey="compareceu" fill={C.teal} name="Compareceu" radius={[2, 2, 0, 0]} />
                        <Bar dataKey="fechou" fill={C.green} name="Fechou" radius={[2, 2, 0, 0]} />
                        <Bar dataKey="faltou" fill={C.amber} name="Faltou" radius={[2, 2, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </Panel>

              {/* KPI lateral — taxas de fechamento por sexo */}
              <Panel title="Taxa de Fechamento" subtitle="Fechou / Total — por sexo" className="col-span-12 lg:col-span-4">
                <div className="px-4 py-4 space-y-3">
                  {(cross.data?.sexo_by_outcome ?? []).slice(0, 5).map((row) => {
                    const pct = row.total > 0 ? Math.round((row.fechou / row.total) * 100) : 0;
                    return (
                      <div key={row.sexo}>
                        <div className="flex items-center justify-between text-[12px]" style={{ color: C.ink }}>
                          <span className="flex items-center gap-2 font-medium">
                            <IconDot url={sexoIcon(row.sexo)} color={C.rose} />
                            {row.sexo}
                          </span>
                          <span className="tabular-nums" style={{ color: C.inkSoft }}>
                            {row.fechou} / {row.total} ({pct}%)
                          </span>
                        </div>
                        <div className="mt-1 h-2 rounded-full" style={{ background: C.rule }}>
                          <div className="h-full rounded-full" style={{ width: `${Math.max(2, pct)}%`, background: C.green }} />
                        </div>
                      </div>
                    );
                  })}
                  {(cross.data?.sexo_by_outcome.length ?? 0) === 0 && <EmptyMini text="Sem dados" />}
                </div>
              </Panel>

              {/* Origem */}
              <KommoWidget
                title="Origem"
                data={cross.data?.origem ?? []}
                color={C.primary}
                dateLabel={dateRangeLabel}
                icon={sourceIcon}
                className="col-span-12 lg:col-span-6"
                onClick={(value) =>
                  drillByFieldName(setDrill, "Origem", "Origem", value, allFields)
                }
              />

              {/* Tratamento indicado */}
              <KommoWidget
                title="Tratamento Indicado"
                data={cross.data?.tratamento_indicado ?? []}
                color={C.teal}
                dateLabel={dateRangeLabel}
                icon={tratamentoIcon}
                className="col-span-12 lg:col-span-6"
                onClick={(value) =>
                  drillByFieldName(setDrill, "Tratamento Indicado", "Tratamento indicado", value, allFields)
                }
              />

              {/* Motivo do não agendamento */}
              <KommoWidget
                title="Motivo do Não Agendamento"
                data={cross.data?.motivo_nao_agendamento ?? []}
                color={C.amber}
                dateLabel={dateRangeLabel}
                className="col-span-12 lg:col-span-6"
                onClick={(value) =>
                  drillByFieldName(setDrill, "Motivo do não agendamento", "Motivo do não agendamento", value, allFields)
                }
              />

              {/* Tratamento fechado */}
              <KommoWidget
                title="Tratamento Fechado"
                data={cross.data?.tratamento_fechado ?? []}
                color={C.green}
                dateLabel={dateRangeLabel}
                icon={tratamentoIcon}
                className="col-span-12 lg:col-span-6"
                onClick={(value) =>
                  drillByFieldName(setDrill, "Tratamento Fechado", "Tratamento fechado", value, allFields)
                }
              />

              {/* Profissão */}
              <KommoWidget
                title="Profissão"
                data={cross.data?.profissao ?? []}
                color={C.purple}
                dateLabel={dateRangeLabel}
                className="col-span-12 lg:col-span-6"
                onClick={(value) =>
                  drillByFieldName(setDrill, "Profissão", "Profissão", value, allFields)
                }
              />

              {/* Qualificação do lead */}
              <KommoWidget
                title="Qualificação do Lead"
                data={cross.data?.qualificacao ?? []}
                color={C.rose}
                dateLabel={dateRangeLabel}
                className="col-span-12 lg:col-span-6"
                onClick={(value) =>
                  drillByFieldName(setDrill, "Qualificação do lead", "Qualificação do lead", value, allFields)
                }
              />

              {/* Responsável agendamento */}
              <KommoWidget
                title="Responsável pelo Agendamento"
                data={cross.data?.responsavel_agendamento ?? []}
                color={C.cyan}
                dateLabel={dateRangeLabel}
                className="col-span-12"
                onClick={(value) =>
                  drillByFieldName(setDrill, "Responsável agendamento", "Responsável agendamento", value, allFields)
                }
              />
            </div>

            {/* ───── LISTA COMPLETA DE CAMPOS (clicável) ───── */}
            <h3 className="font-display text-[22px] font-semibold pt-4 tracking-tight" style={{ color: C.ink }}>
              Todos os Campos · clique para ver detalhes
            </h3>

            <Panel className="col-span-12">
              <div className="px-4 py-3">
                {filteredFields.length === 0 ? (
                  <EmptyMini text="Nenhum campo no período" />
                ) : (
                  <ul className="space-y-1.5">
                    {filteredFields.map((f, i) => {
                      const pct = total > 0 ? Math.round((f.filled / total) * 100) : 0;
                      const color = PALETTE[i % PALETTE.length];
                      const disabled = f.filled === 0;
                      return (
                        <li
                          key={f.field_id}
                          onClick={() => !disabled && setDetailField(f)}
                          className={cn(
                            "grid grid-cols-12 items-center gap-3 rounded-md py-2 px-2",
                            disabled ? "opacity-50" : "hover:bg-slate-50 cursor-pointer",
                          )}
                        >
                          <div className="col-span-3 truncate text-[12px] font-medium" style={{ color: C.ink }} title={f.field_name}>
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
          </div>
        )}
      </div>

      {/* Modal: detalhe do campo */}
      {detailField && (
        <FieldDetailModal
          field={detailField}
          totalLeads={total}
          onClose={() => setDetailField(null)}
          onDrillValue={(value) =>
            setDrill({
              kpiKey: `field_${detailField.field_id}`,
              label: `${detailField.field_name}: ${value}`,
              source: {
                source_type: "custom_field_count",
                config: {
                  fieldId: detailField.field_id,
                  fieldCode: detailField.field_code,
                  matchValues: [value],
                },
              },
            })
          }
        />
      )}

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
  subtitle,
  children,
  className,
}: {
  title?: string;
  subtitle?: string;
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
          <div className="flex items-baseline gap-2">
            <span className="text-[12.5px] font-semibold" style={{ color: C.ink }}>
              {title}
            </span>
            {subtitle && (
              <span className="text-[10.5px]" style={{ color: C.inkSoft }}>
                · {subtitle}
              </span>
            )}
          </div>
        </header>
      )}
      {children}
    </section>
  );
}

// ─── Estilo Kommo: card com total + lista (ícone/bolinha · rótulo · valor) ──────

function stripAccent(s: string): string {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();
}

/** Ícone da origem (reaproveita os PNGs de /public/source-icons). */
function sourceIcon(value: string): string {
  const v = stripAccent(value);
  if (v.includes("instagram")) return "/source-icons/instagram.png";
  if (v.includes("facebook") || v.includes("meta")) return "/source-icons/facebook.png";
  if (v.includes("google")) return "/source-icons/google.png";
  if (v.includes("indica")) return "/source-icons/indicacao.png";
  return "/source-icons/sem-origem.png";
}

/** Ícone do sexo. Os PNGs devem estar em /public/icons/. */
function sexoIcon(value: string): string | null {
  const v = stripAccent(value);
  if (v.startsWith("f")) return "/icons/sexo-feminino.png";
  if (v.startsWith("m")) return "/icons/sexo-masculino.png";
  return null;
}

/** Ícone de tratamento — o mesmo pra todos os itens (pedido do cliente). */
const tratamentoIcon = (): string => "/icons/tratamento.png";

/** <img> do ícone; se a imagem não existir/cai em erro, mostra uma bolinha colorida. */
function IconDot({ url, color }: { url?: string | null; color: string }) {
  const [err, setErr] = useState(false);
  if (url && !err) {
    return (
      <img
        src={url}
        alt=""
        className="h-5 w-5 shrink-0 rounded-full object-cover"
        onError={() => setErr(true)}
      />
    );
  }
  return <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: color }} />;
}

/** Widget no estilo da dashboard da Kommo: título, total grande (verde), período e lista. */
function KommoWidget({
  title,
  data,
  color,
  dateLabel,
  icon,
  className,
  onClick,
}: {
  title: string;
  data: ValueCount[];
  color: string;
  dateLabel: string;
  icon?: (value: string) => string | null;
  className?: string;
  onClick?: (value: string) => void;
}) {
  const total = data.reduce((s, d) => s + d.count, 0);
  return (
    <section
      className={cn("flex flex-col rounded-xl shadow-sm", className)}
      style={{ background: C.panel, border: `1px solid ${C.rule}` }}
    >
      <div className="px-4 pt-3 pb-2.5">
        <div className="flex items-start justify-between gap-2">
          <span className="text-[11px] font-semibold uppercase tracking-wide" style={{ color: C.inkSoft }}>
            {title}
          </span>
          <span className="text-[26px] font-bold leading-none tabular-nums" style={{ color: C.green }}>
            {formatNumber(total)}
          </span>
        </div>
        <p className="mt-1 text-[10px]" style={{ color: C.inkSoft }}>
          {dateLabel}
        </p>
      </div>
      {data.length === 0 ? (
        <div className="grid h-28 place-items-center">
          <EmptyMini text="Sem dados no período" />
        </div>
      ) : (
        <ul className="max-h-72 overflow-y-auto">
          {data.map((v) => (
            <li
              key={v.value}
              onClick={() => onClick?.(v.value)}
              className={cn(
                "flex items-center gap-2.5 border-t px-4 py-2",
                onClick && "cursor-pointer hover:bg-slate-50",
              )}
              style={{ borderColor: C.rule }}
            >
              <IconDot url={icon?.(v.value)} color={color} />
              <span className="flex-1 truncate text-[12px]" style={{ color: C.ink }} title={v.value}>
                {v.value}
              </span>
              <span className="text-[12px] font-semibold tabular-nums" style={{ color: C.ink }}>
                {formatNumber(v.count)}
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function FieldDetailModal({
  field,
  totalLeads,
  onClose,
  onDrillValue,
}: {
  field: CustomFieldSummary;
  totalLeads: number;
  onClose: () => void;
  onDrillValue: (value: string) => void;
}) {
  const fillPct = totalLeads > 0 ? Math.round((field.filled / totalLeads) * 100) : 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.5)" }}>
      <div
        className="w-full max-w-2xl max-h-[90vh] overflow-hidden rounded-xl flex flex-col"
        style={{ background: C.panel }}
      >
        {/* Header */}
        <header className="flex items-start justify-between px-5 py-3 border-b" style={{ borderColor: C.rule }}>
          <div>
            <h2 className="font-display text-[20px] font-semibold tracking-tight" style={{ color: C.ink }}>
              {field.field_name}
            </h2>
            <p className="text-[11px] mt-0.5" style={{ color: C.inkSoft }}>
              tipo: {field.type} · {formatNumber(field.filled)} leads preenchidos ({fillPct}%) ·{" "}
              {field.distinct_values} valores distintos
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-[20px] leading-none hover:opacity-60 px-2"
            style={{ color: C.inkSoft }}
            aria-label="Fechar"
          >
            ×
          </button>
        </header>

        {/* Bar chart top 12 */}
        {field.top_values.length === 0 ? (
          <div className="p-8 text-center" style={{ color: C.inkSoft }}>
            Nenhum valor preenchido no período.
          </div>
        ) : (
          <>
            <div className="px-5 pt-4 pb-2">
              <p className="text-[11px] uppercase tracking-widest mb-2" style={{ color: C.inkSoft }}>
                Mais comum → Menos comum
              </p>
              <div className="h-56">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={field.top_values.slice(0, 12)} margin={{ top: 8, right: 12, left: 0, bottom: 24 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke={C.rule} vertical={false} />
                    <XAxis
                      dataKey="value"
                      tick={{ fill: C.inkSoft, fontSize: 9 }}
                      angle={-25}
                      textAnchor="end"
                      interval={0}
                      height={60}
                    />
                    <YAxis tick={{ fill: C.inkSoft, fontSize: 10 }} />
                    <Tooltip
                      contentStyle={{ background: "#fff", border: `1px solid ${C.rule}`, borderRadius: 6, fontSize: 12 }}
                    />
                    <Bar dataKey="count" radius={[3, 3, 0, 0]}>
                      {field.top_values.slice(0, 12).map((_, i) => (
                        <Cell key={i} fill={PALETTE[i % PALETTE.length]} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="overflow-y-auto px-5 pb-5">
              <p className="text-[11px] uppercase tracking-widest mb-2 mt-2" style={{ color: C.inkSoft }}>
                Lista completa (clique para ver leads)
              </p>
              <ul className="space-y-1">
                {field.top_values.map((v, i) => {
                  const max = field.top_values[0]?.count ?? 1;
                  const pct = Math.round((v.count / max) * 100);
                  return (
                    <li
                      key={v.value}
                      onClick={() => onDrillValue(v.value)}
                      className="flex items-center gap-3 rounded-md p-2 hover:bg-slate-50 cursor-pointer"
                    >
                      <div className="w-44 truncate text-[12px]" style={{ color: C.ink }} title={v.value}>
                        {v.value}
                      </div>
                      <div className="flex-1 h-2 rounded-full" style={{ background: C.rule }}>
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
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function EmptyMini({ text }: { text: string }) {
  return (
    <div className="grid place-items-center text-[12px] py-4" style={{ color: C.inkSoft }}>
      {text}
    </div>
  );
}

/**
 * Resolve o field_id pelo nome (vem dos campos sincronizados) pra abrir o drill-down
 * sem precisar saber o id antes. Casa por substring case-insensitive.
 */
function drillByFieldName(
  setDrill: (t: KpiDrillTarget) => void,
  label: string,
  nameNeedle: string,
  value: string,
  allFields: CustomFieldSummary[],
) {
  const needle = nameNeedle.toLowerCase();
  const found = allFields.find((f) => f.field_name.toLowerCase().includes(needle));
  if (!found) return;
  setDrill({
    kpiKey: `field_${found.field_id}`,
    label: `${label}: ${value}`,
    source: {
      source_type: "custom_field_count",
      config: { fieldId: found.field_id, fieldCode: found.field_code, matchValues: [value] },
    },
  });
}

