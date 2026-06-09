import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis, Legend, Cell } from "recharts";
import {
  Loader2,
  Users2,
  RefreshCw,
  SlidersHorizontal,
  Eye,
  EyeOff,
  ChevronDown,
  X,
} from "@/components/icons";
import { KpiDrillDown, type KpiDrillTarget } from "@/components/kpi/KpiDrillDown";
import { useClinic } from "@/hooks/useClinic";
import {
  kpiConfigService,
  type CustomFieldSummary,
  type ValueCount,
  type OutcomeRow,
  type PairCount,
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
  { key: "hoje", label: "Hoje", days: 0 },
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
// Blocos de análise cruzada — data-driven pra dar liga/desliga + reordenar
// ─────────────────────────────────────────────────────────────────────────────

interface CrossBlock {
  id: string;
  label: string;
  /** col-span padrão no grid de 12 colunas. */
  col: string;
}

const CROSS_BLOCKS: CrossBlock[] = [
  { id: "sexo_desfecho", label: "Sexo × Desfecho", col: "col-span-12 lg:col-span-8" },
  { id: "taxa_fechamento", label: "Taxa de Fechamento", col: "col-span-12 lg:col-span-4" },
  { id: "origem", label: "Origem", col: "col-span-12 lg:col-span-6" },
  { id: "tratamento_indicado", label: "Tratamento Indicado", col: "col-span-12 lg:col-span-6" },
  { id: "motivo_nao_agendamento", label: "Motivo do Não Agendamento", col: "col-span-12 lg:col-span-6" },
  { id: "tratamento_fechado", label: "Tratamento Fechado", col: "col-span-12 lg:col-span-6" },
  { id: "profissao", label: "Profissão", col: "col-span-12 lg:col-span-6" },
  { id: "qualificacao", label: "Qualificação do Lead", col: "col-span-12 lg:col-span-6" },
  { id: "responsavel_agendamento", label: "Responsável pelo Agendamento", col: "col-span-12" },
  { id: "atendente_outcome", label: "Atendente × Desfecho", col: "col-span-12 lg:col-span-6" },
  { id: "origem_outcome", label: "Origem × Desfecho", col: "col-span-12 lg:col-span-6" },
  { id: "qualificacao_outcome", label: "Qualificação × Desfecho", col: "col-span-12 lg:col-span-6" },
  { id: "motivo_atendente", label: "Motivo × Atendente", col: "col-span-12 lg:col-span-6" },
];

const BLOCK_CFG_KEY = "cf-blocks-cfg-v1";

interface BlockCfg {
  order: string[];
  hidden: string[];
}

function defaultBlockCfg(): BlockCfg {
  return { order: CROSS_BLOCKS.map((b) => b.id), hidden: [] };
}

function loadBlockCfg(): BlockCfg {
  try {
    const raw = localStorage.getItem(BLOCK_CFG_KEY);
    if (!raw) return defaultBlockCfg();
    const parsed = JSON.parse(raw) as Partial<BlockCfg>;
    const known = new Set(CROSS_BLOCKS.map((b) => b.id));
    // Mantém só ids conhecidos e acrescenta blocos novos no fim (forward-compat).
    const order = (parsed.order ?? []).filter((id) => known.has(id));
    for (const b of CROSS_BLOCKS) if (!order.includes(b.id)) order.push(b.id);
    const hidden = (parsed.hidden ?? []).filter((id) => known.has(id));
    return { order, hidden };
  } catch {
    return defaultBlockCfg();
  }
}

function saveBlockCfg(cfg: BlockCfg) {
  try {
    localStorage.setItem(BLOCK_CFG_KEY, JSON.stringify(cfg));
  } catch {
    /* localStorage indisponível — ignora */
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Página
// ─────────────────────────────────────────────────────────────────────────────

export default function CustomFieldsPage() {
  const { unitId } = useClinic();
  const queryClient = useQueryClient();
  const [rangeKey, setRangeKey] = useState("30");
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");
  const [search, setSearch] = useState("");
  const [drill, setDrill] = useState<KpiDrillTarget | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [syncMsg, setSyncMsg] = useState<string | null>(null);
  const [detailField, setDetailField] = useState<CustomFieldSummary | null>(null);
  const [showBlockCfg, setShowBlockCfg] = useState(false);
  const [blockCfg, setBlockCfg] = useState<BlockCfg>(() => loadBlockCfg());

  const updateBlockCfg = (next: BlockCfg) => {
    setBlockCfg(next);
    saveBlockCfg(next);
  };

  const today = useMemo(() => new Date().toISOString().slice(0, 10), []);
  const days = RANGES.find((r) => r.key === rangeKey)?.days ?? 30;
  const isCustom = rangeKey === "custom";
  const dateFrom = useMemo(
    () => (isCustom ? customFrom || today : isoDaysAgo(days)),
    [isCustom, customFrom, today, days],
  );
  const dateTo = useMemo(
    () => (isCustom ? customTo || today : today),
    [isCustom, customTo, today],
  );
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

  const orderedVisibleBlocks = useMemo(
    () => blockCfg.order.filter((id) => !blockCfg.hidden.includes(id)),
    [blockCfg],
  );

  // Renderiza um bloco de análise cruzada pelo id. col-span vem do descritor.
  function renderBlock(id: string): React.ReactNode {
    const col = CROSS_BLOCKS.find((b) => b.id === id)?.col ?? "col-span-12 lg:col-span-6";
    switch (id) {
      case "sexo_desfecho":
        return (
          <Panel key={id} title="Sexo × Desfecho" subtitle="Quem agendou, compareceu e fechou — por sexo" className={col}>
            {(cross.data?.sexo_by_outcome.length ?? 0) === 0 ? (
              <EmptyMini text="Campo 'Sexo' não preenchido em leads do período" />
            ) : (
              <div className="h-72 px-4 pb-4">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={cross.data?.sexo_by_outcome ?? []} margin={{ top: 16, right: 12, left: 0, bottom: 4 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke={C.rule} vertical={false} />
                    <XAxis dataKey="sexo" tick={{ fill: C.inkSoft, fontSize: 11 }} />
                    <YAxis tick={{ fill: C.inkSoft, fontSize: 10 }} />
                    <Tooltip contentStyle={{ background: "#fff", border: `1px solid ${C.rule}`, borderRadius: 6, fontSize: 12 }} />
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
        );
      case "taxa_fechamento":
        return (
          <Panel key={id} title="Taxa de Fechamento" subtitle="Fechou / Total — por sexo" className={col}>
            <div className="px-4 py-4 space-y-3">
              {(cross.data?.sexo_by_outcome ?? []).slice(0, 5).map((row) => {
                const pct = row.total > 0 ? Math.round((row.fechou / row.total) * 100) : 0;
                return (
                  <div key={row.sexo}>
                    <div className="flex items-center justify-between text-[12px]" style={{ color: C.ink }}>
                      <span className="flex items-center gap-2 font-medium">
                        <IconDot url={sexoIcon(row.sexo)} color={C.rose} glyph={sexoGlyph(row.sexo)} />
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
        );
      case "origem":
        return (
          <KommoWidget key={id} title="Origem" data={cross.data?.origem ?? []} color={C.primary} dateLabel={dateRangeLabel} icon={sourceIcon} className={col}
            onClick={(value) => drillByFieldName(setDrill, "Origem", "Origem", value, allFields)} />
        );
      case "tratamento_indicado":
        return (
          <KommoWidget key={id} title="Tratamento Indicado" data={cross.data?.tratamento_indicado ?? []} color={C.teal} dateLabel={dateRangeLabel} icon={tratamentoIcon} glyph={() => "✚"} className={col}
            onClick={(value) => drillByFieldName(setDrill, "Tratamento Indicado", "Tratamento indicado", value, allFields)} />
        );
      case "motivo_nao_agendamento":
        return (
          <KommoWidget key={id} title="Motivo do Não Agendamento" data={cross.data?.motivo_nao_agendamento ?? []} color={C.amber} dateLabel={dateRangeLabel} className={col}
            onClick={(value) => drillByFieldName(setDrill, "Motivo do não agendamento", "Motivo do não agendamento", value, allFields)} />
        );
      case "tratamento_fechado":
        return (
          <KommoWidget key={id} title="Tratamento Fechado" data={cross.data?.tratamento_fechado ?? []} color={C.green} dateLabel={dateRangeLabel} icon={tratamentoIcon} glyph={() => "✚"} className={col}
            onClick={(value) => drillByFieldName(setDrill, "Tratamento Fechado", "Tratamento fechado", value, allFields)} />
        );
      case "profissao":
        return (
          <KommoWidget key={id} title="Profissão" data={cross.data?.profissao ?? []} color={C.purple} dateLabel={dateRangeLabel} className={col}
            onClick={(value) => drillByFieldName(setDrill, "Profissão", "Profissão", value, allFields)} />
        );
      case "qualificacao":
        return (
          <KommoWidget key={id} title="Qualificação do Lead" data={cross.data?.qualificacao ?? []} color={C.rose} dateLabel={dateRangeLabel} className={col}
            onClick={(value) => drillByFieldName(setDrill, "Qualificação do lead", "Qualificação do lead", value, allFields)} />
        );
      case "responsavel_agendamento":
        return (
          <KommoWidget key={id} title="Responsável pelo Agendamento" data={cross.data?.responsavel_agendamento ?? []} color={C.cyan} dateLabel={dateRangeLabel} className={col}
            onClick={(value) => drillByFieldName(setDrill, "Responsável agendamento", "Responsável agendamento", value, allFields)} />
        );
      case "atendente_outcome":
        return <OutcomeWidget key={id} title="Atendente × Desfecho" subtitle="Quem converte, não só volume" data={cross.data?.atendente_by_outcome ?? []} className={col} />;
      case "origem_outcome":
        return <OutcomeWidget key={id} title="Origem × Desfecho" subtitle="Taxa de fechamento por canal" data={cross.data?.origem_by_outcome ?? []} className={col} />;
      case "qualificacao_outcome":
        return <OutcomeWidget key={id} title="Qualificação × Desfecho" subtitle="Quanto cada faixa fecha" data={cross.data?.qualificacao_by_outcome ?? []} className={col} />;
      case "motivo_atendente":
        return <PairWidget key={id} title="Motivo × Atendente" subtitle="Top combinações de não-agendamento" data={cross.data?.motivo_by_atendente ?? []} className={col} />;
      default:
        return null;
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
            onClick={() => setShowBlockCfg(true)}
            className="inline-flex items-center gap-1.5 rounded-md bg-white/15 px-3 py-1.5 text-[12px] font-medium text-white hover:bg-white/25"
          >
            <SlidersHorizontal className="h-3.5 w-3.5" />
            Configurar
          </button>
          <button
            type="button"
            onClick={handleSync}
            disabled={!unitId || syncing}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-md bg-white/15 px-3 py-1.5 text-[12px] font-medium text-white",
              "hover:bg-white/25 disabled:opacity-50 disabled:cursor-not-allowed",
            )}
          >
            <RefreshCw className={cn("h-3.5 w-3.5", syncing && "animate-spin")} />
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
          <div className="flex flex-wrap items-center gap-2">
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
              <button
                type="button"
                onClick={() => setRangeKey("custom")}
                className={cn(
                  "px-3 py-1.5 text-[11.5px] font-medium",
                  isCustom ? "text-white" : "text-slate-500 hover:text-slate-700",
                )}
                style={isCustom ? { background: C.primary, borderRadius: 4 } : undefined}
              >
                Personalizado
              </button>
            </div>
            {isCustom && (
              <div className="inline-flex items-center gap-1.5 text-[11.5px]" style={{ color: C.inkSoft }}>
                <input
                  type="date"
                  value={customFrom}
                  max={customTo || today}
                  onChange={(e) => setCustomFrom(e.target.value)}
                  className="rounded-md border px-2 py-1 text-[12px] outline-none"
                  style={{ borderColor: C.rule, background: C.panel, color: C.ink }}
                />
                <span>até</span>
                <input
                  type="date"
                  value={customTo}
                  min={customFrom || undefined}
                  max={today}
                  onChange={(e) => setCustomTo(e.target.value)}
                  className="rounded-md border px-2 py-1 text-[12px] outline-none"
                  style={{ borderColor: C.rule, background: C.panel, color: C.ink }}
                />
              </div>
            )}
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

            {orderedVisibleBlocks.length === 0 ? (
              <EmptyMini text="Nenhum bloco visível — clique em Configurar pra ativar." />
            ) : (
              <div className="grid grid-cols-12 gap-4">
                {orderedVisibleBlocks.map((id) => renderBlock(id))}
              </div>
            )}

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

      {showBlockCfg && (
        <BlockConfigModal
          cfg={blockCfg}
          onChange={updateBlockCfg}
          onReset={() => updateBlockCfg(defaultBlockCfg())}
          onClose={() => setShowBlockCfg(false)}
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

/** Símbolo de fallback do sexo (enquanto o PNG não está em /public/icons/). */
function sexoGlyph(value: string): string | undefined {
  const v = stripAccent(value);
  if (v.startsWith("f")) return "♀";
  if (v.startsWith("m")) return "♂";
  return undefined;
}

/** Ícone de tratamento — o mesmo pra todos os itens (pedido do cliente). */
const tratamentoIcon = (): string => "/icons/tratamento.png";

/**
 * <img> do ícone; se a imagem não existir/cai em erro, usa um símbolo (♀/♂/✚)
 * num círculo colorido; sem símbolo, cai numa bolinha colorida.
 */
function IconDot({ url, color, glyph }: { url?: string | null; color: string; glyph?: string }) {
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
  if (glyph) {
    return (
      <span
        className="grid h-5 w-5 shrink-0 place-items-center rounded-full text-[11px] font-bold leading-none text-white"
        style={{ background: color }}
      >
        {glyph}
      </span>
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
  glyph,
  className,
  onClick,
}: {
  title: string;
  data: ValueCount[];
  color: string;
  dateLabel: string;
  icon?: (value: string) => string | null;
  glyph?: (value: string) => string | undefined;
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
              <IconDot url={icon?.(v.value)} color={color} glyph={glyph?.(v.value)} />
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

/** Widget "rótulo × desfecho": lista com total + taxa de fechamento por linha. */
function OutcomeWidget({
  title,
  subtitle,
  data,
  className,
}: {
  title: string;
  subtitle?: string;
  data: OutcomeRow[];
  className?: string;
}) {
  return (
    <Panel title={title} subtitle={subtitle} className={className}>
      {data.length === 0 ? (
        <div className="grid h-28 place-items-center">
          <EmptyMini text="Sem dados no período" />
        </div>
      ) : (
        <ul className="max-h-72 overflow-y-auto px-4 py-2">
          {data.map((row) => {
            const pct = row.total > 0 ? Math.round((row.fechou / row.total) * 100) : 0;
            return (
              <li key={row.label} className="border-t py-2 first:border-t-0" style={{ borderColor: C.rule }}>
                <div className="flex items-center justify-between gap-2">
                  <span className="truncate text-[12px] font-medium" style={{ color: C.ink }} title={row.label}>
                    {row.label}
                  </span>
                  <span className="shrink-0 text-[12px] font-bold tabular-nums" style={{ color: pct >= 30 ? C.green : C.inkSoft }}>
                    {pct}% fechou
                  </span>
                </div>
                <div className="mt-1 flex items-center gap-3 text-[10.5px] tabular-nums" style={{ color: C.inkSoft }}>
                  <span>total {row.total}</span>
                  <span>ag. {row.agendou}</span>
                  <span>comp. {row.compareceu}</span>
                  <span style={{ color: C.green }}>fechou {row.fechou}</span>
                  <span style={{ color: C.amber }}>faltou {row.faltou}</span>
                </div>
                <div className="mt-1 h-1.5 rounded-full" style={{ background: C.rule }}>
                  <div className="h-full rounded-full" style={{ width: `${Math.max(2, pct)}%`, background: C.green }} />
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </Panel>
  );
}

/** Widget de pares (cruzamento 2D): "Atendente · Motivo" → contagem. */
function PairWidget({
  title,
  subtitle,
  data,
  className,
}: {
  title: string;
  subtitle?: string;
  data: PairCount[];
  className?: string;
}) {
  const max = data.reduce((m, d) => Math.max(m, d.count), 0) || 1;
  return (
    <Panel title={title} subtitle={subtitle} className={className}>
      {data.length === 0 ? (
        <div className="grid h-28 place-items-center">
          <EmptyMini text="Sem dados no período" />
        </div>
      ) : (
        <ul className="max-h-72 overflow-y-auto px-4 py-2">
          {data.map((p) => (
            <li key={`${p.group_a}|${p.group_b}`} className="border-t py-2 first:border-t-0" style={{ borderColor: C.rule }}>
              <div className="flex items-center justify-between gap-2">
                <span className="truncate text-[12px]" style={{ color: C.ink }} title={`${p.group_a} · ${p.group_b}`}>
                  <span className="font-medium">{p.group_a}</span>
                  <span style={{ color: C.inkSoft }}> · {p.group_b}</span>
                </span>
                <span className="shrink-0 text-[12px] font-semibold tabular-nums" style={{ color: C.ink }}>
                  {formatNumber(p.count)}
                </span>
              </div>
              <div className="mt-1 h-1.5 rounded-full" style={{ background: C.rule }}>
                <div className="h-full rounded-full" style={{ width: `${Math.max(3, Math.round((p.count / max) * 100))}%`, background: C.amber }} />
              </div>
            </li>
          ))}
        </ul>
      )}
    </Panel>
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

/** Modal pra ligar/desligar e reordenar os blocos de análise cruzada. */
function BlockConfigModal({
  cfg,
  onChange,
  onReset,
  onClose,
}: {
  cfg: BlockCfg;
  onChange: (next: BlockCfg) => void;
  onReset: () => void;
  onClose: () => void;
}) {
  const labelById = new Map(CROSS_BLOCKS.map((b) => [b.id, b.label]));

  const toggle = (id: string) => {
    const hidden = cfg.hidden.includes(id)
      ? cfg.hidden.filter((x) => x !== id)
      : [...cfg.hidden, id];
    onChange({ ...cfg, hidden });
  };

  const move = (index: number, dir: -1 | 1) => {
    const target = index + dir;
    if (target < 0 || target >= cfg.order.length) return;
    const order = [...cfg.order];
    [order[index], order[target]] = [order[target], order[index]];
    onChange({ ...cfg, order });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.5)" }}>
      <div className="w-full max-w-md max-h-[85vh] overflow-hidden rounded-xl flex flex-col" style={{ background: C.panel }}>
        <header className="flex items-center justify-between px-5 py-3 border-b" style={{ borderColor: C.rule }}>
          <div>
            <h2 className="font-display text-[18px] font-semibold tracking-tight" style={{ color: C.ink }}>
              Configurar blocos
            </h2>
            <p className="text-[11px] mt-0.5" style={{ color: C.inkSoft }}>
              Escolha quais aparecem e em que ordem.
            </p>
          </div>
          <button onClick={onClose} className="px-2 hover:opacity-60" style={{ color: C.inkSoft }} aria-label="Fechar">
            <X className="h-5 w-5" />
          </button>
        </header>

        <ul className="overflow-y-auto px-3 py-3 space-y-1">
          {cfg.order.map((id, i) => {
            const hidden = cfg.hidden.includes(id);
            return (
              <li
                key={id}
                className="flex items-center gap-2 rounded-md px-2 py-2"
                style={{ background: hidden ? "transparent" : "#F9FAFB", opacity: hidden ? 0.55 : 1 }}
              >
                <button onClick={() => toggle(id)} className="shrink-0" title={hidden ? "Mostrar" : "Ocultar"} style={{ color: hidden ? C.inkSoft : C.primary }}>
                  {hidden ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
                <span className="flex-1 truncate text-[12.5px]" style={{ color: C.ink }}>
                  {labelById.get(id) ?? id}
                </span>
                <button onClick={() => move(i, -1)} disabled={i === 0} className="shrink-0 disabled:opacity-30" title="Subir" style={{ color: C.inkSoft }}>
                  <ChevronDown className="h-4 w-4 rotate-180" />
                </button>
                <button onClick={() => move(i, 1)} disabled={i === cfg.order.length - 1} className="shrink-0 disabled:opacity-30" title="Descer" style={{ color: C.inkSoft }}>
                  <ChevronDown className="h-4 w-4" />
                </button>
              </li>
            );
          })}
        </ul>

        <footer className="flex items-center justify-between px-5 py-3 border-t" style={{ borderColor: C.rule }}>
          <button onClick={onReset} className="text-[12px] font-medium hover:underline" style={{ color: C.inkSoft }}>
            Restaurar padrão
          </button>
          <button onClick={onClose} className="rounded-md px-4 py-1.5 text-[12px] font-semibold text-white" style={{ background: C.primary }}>
            Pronto
          </button>
        </footer>
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

