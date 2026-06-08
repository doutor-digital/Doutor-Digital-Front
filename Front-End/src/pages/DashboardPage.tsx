import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Cog, Loader2, Pencil, Plus } from "@/components/icons";
import { Bar, BarChart, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { useClinic } from "@/hooks/useClinic";
import { kpiKey } from "@/hooks/useKpiOverrides";
import { EditableKpiValue } from "@/components/kpi/EditableKpiValue";
import { KpiDrillDown, type KpiDrillTarget } from "@/components/kpi/KpiDrillDown";
import { KpiSourceButton } from "@/components/kpi/KpiSourceButton";
import { CustomKpiModal } from "@/components/kpi/CustomKpiModal";
import { CustomKpiChartCard } from "@/components/kpi/CustomKpiChartCard";
import { CustomFieldsPanel } from "@/components/dashboard/CustomFieldsPanel";
import { LeadProfilePanel } from "@/components/dashboard/LeadProfilePanel";
import { CrmKanban, type KanbanColumn, type KanbanTone } from "@/components/charts/CrmKanban";
import { useAuth } from "@/hooks/useAuth";
import { isAdminLevel } from "@/lib/roles";
import { webhooksService } from "@/services/webhooks";
import { unitsService } from "@/services/units";
import { kpiConfigService, type KpiConfigItem } from "@/services/kpiConfig";
import { assignmentsService } from "@/services/assignments";
import { stageLabel as fallbackStageLabel } from "@/lib/stageLabels";
import { channelVisual } from "@/lib/channelIcons";
import type { FunnelGroup } from "@/types";

// Helper de ícones Flaticon UIcons (CSS carregado no index.html).
function Fi({ name, className = "", style }: { name: string; className?: string; style?: React.CSSProperties }) {
  return <i className={`fi ${name} ${className}`} style={style} aria-hidden="true" />;
}

const pctStr = (num: number, den: number, digits = 0) =>
  den > 0 ? `${((num / den) * 100).toFixed(digits)}%` : "0%";

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

// ─── Filtros (pílulas Ano / Mês / Semana / Dia) ───────────────────────────
type RangeKey = "ano" | "mes" | "semana" | "dia" | "custom";

const RANGES: Array<{ key: RangeKey; label: string; icon: string }> = [
  { key: "ano",    label: "Ano",    icon: "fi-rr-calendar" },
  { key: "mes",    label: "Mês",    icon: "fi-rr-calendar-clock" },
  { key: "semana", label: "Semana", icon: "fi-rr-calendar-day" },
  { key: "dia",    label: "Dia",    icon: "fi-rr-time-quarter-past" },
];

function computeRange(key: RangeKey): { from: string; to: string } {
  const now = new Date();
  if (key === "dia") return { from: isoStartOfDay(now), to: isoEndOfDay(now) };
  if (key === "semana") return { from: isoDaysAgo(6), to: isoEndOfDay(now) };
  if (key === "mes") return { from: isoDaysAgo(29), to: isoEndOfDay(now) };
  if (key === "ano") {
    const d = new Date(now);
    d.setFullYear(d.getFullYear() - 1);
    return { from: isoStartOfDay(d), to: isoEndOfDay(now) };
  }
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
  accent,
}: {
  children: React.ReactNode;
  className?: string;
  /** Cor da borda superior sólida do card. */
  accent?: string;
}) {
  return (
    <div
      className={`relative overflow-hidden rounded-2xl bg-[#0f1f3a]/80 ring-1 ring-white/5 p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)] ${className}`}
      style={accent ? { borderTop: `4px solid ${accent}` } : undefined}
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
  accent = "#a78bfa",
  children,
  className = "",
}: {
  label: string;
  value: string | number;
  range?: string;
  valueClass?: string;
  accent?: string;
  children?: React.ReactNode;
  className?: string;
}) {
  return (
    <DarkCard className={className} accent={accent}>
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
  const [drill, setDrill] = useState<KpiDrillTarget | null>(null);
  // Modal de KPI custom: null = fechado; { existing } = abrindo p/ criar (undefined) ou editar.
  const [kpiModal, setKpiModal] = useState<{ existing: KpiConfigItem | null } | null>(null);
  const { user } = useAuth();
  const canEditKpis = isAdminLevel(user?.role) && unitId != null;
  const [rangeKey, setRangeKey] = useState<RangeKey>("mes");

  // ─── Filtros avançados ─────────────────────────────────────────────
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [sourceFilter, setSourceFilter] = useState<string>("");
  const [attendantFilter, setAttendantFilter] = useState<string>("");
  const [stageFilter, setStageFilter] = useState<Set<string>>(new Set());
  const [customFrom, setCustomFrom] = useState<string>("");
  const [customTo, setCustomTo] = useState<string>("");
  const isCustom = customFrom !== "" && customTo !== "";

  const range = useMemo(() => {
    if (isCustom) {
      return { from: isoStartOfDay(new Date(customFrom)), to: isoEndOfDay(new Date(customTo)) };
    }
    return computeRange(rangeKey);
  }, [rangeKey, customFrom, customTo, isCustom]);
  const rangeLabel = `${fmtDateBr(range.from)} - ${fmtDateBr(range.to)}`;

  const units = useQuery({
    queryKey: ["dash-amo", "units"],
    queryFn: () => unitsService.list(),
    staleTime: 5 * 60_000,
  });

  const attendants = useQuery({
    queryKey: ["dash-amo", "attendants"],
    queryFn: () => assignmentsService.listAttendants(),
    staleTime: 5 * 60_000,
  });

  // Pipelines da Kommo (statuses) — usados pra traduzir status_id em nome amigável.
  // Só consulta quando há unidade selecionada (endpoint precisa de token/subdomain da unidade).
  const pipelines = useQuery({
    queryKey: ["dash-amo", "kommo-pipelines", unitId],
    queryFn: () => unitsService.kommoPipelines(unitId!),
    enabled: unitId != null,
    staleTime: 10 * 60_000,
    retry: false,
  });

  // Custom fields da Kommo (definições) — usados pra montar filtros dinâmicos.
  const customFields = useQuery({
    queryKey: ["dash-amo", "kommo-custom-fields", unitId],
    queryFn: () => unitsService.kommoCustomFields(unitId!),
    enabled: unitId != null,
    staleTime: 10 * 60_000,
    retry: false,
  });

  // Mapeamentos de KPI salvos (Configurações Técnicas) — pra mostrar a fonte no card.
  const savedKpis = useQuery({
    queryKey: ["kpi-config", unitId],
    queryFn: () => kpiConfigService.list(unitId!),
    enabled: unitId != null,
    retry: false,
  });
  const savedKpiByKey = useMemo(() => {
    const m = new Map<string, KpiConfigItem>();
    for (const it of savedKpis.data ?? []) m.set(it.kpi_key, it);
    return m;
  }, [savedKpis.data]);

  // Map<status_id, status_name> a partir de todos os pipelines.
  const stageNameMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const p of pipelines.data ?? []) {
      for (const s of p.statuses ?? []) {
        map.set(String(s.id), s.name);
      }
    }
    return map;
  }, [pipelines.data]);

  // Tradução robusta: prefere o nome ao vivo da Kommo, cai pro mapa estático, e pro raw como último recurso.
  const stageLabel = (raw?: string | null): string => {
    if (!raw) return "—";
    const t = String(raw).trim();
    if (stageNameMap.has(t)) return stageNameMap.get(t)!;
    return fallbackStageLabel(t);
  };

  const sources = useQuery({
    queryKey: ["dash-amo", "sources", tenantId, unitId],
    queryFn: () => webhooksService.distinctSources({
      clinicId: tenantId ?? undefined,
      unitId: unitId ?? undefined,
    }),
    enabled: tenantId != null,
    staleTime: 5 * 60_000,
  });

  const overview = useQuery({
    queryKey: [
      "dash-amo",
      "overview",
      tenantId,
      unitId,
      range.from,
      range.to,
      sourceFilter,
      attendantFilter,
    ],
    queryFn: () =>
      webhooksService.dashboardOverview({
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

  const ov = overview.data;

  // Negócios (leads) para o board de funil estilo CRM — agrupados por etapa.
  const leadsBoard = useQuery({
    queryKey: ["dash-amo", "leads-board", tenantId, unitId, range.from, range.to, sourceFilter, stageFilter.size],
    queryFn: () =>
      webhooksService.listLeads({
        clinicId: unitId ?? tenantId ?? undefined,
        startDate: range.from,
        endDate: range.to,
        source: sourceFilter || undefined,
        pageSize: 500,
      }),
    enabled: tenantId != null,
    staleTime: 60_000,
  });

  const hasActiveFilters =
    sourceFilter !== "" ||
    attendantFilter !== "" ||
    stageFilter.size > 0 ||
    isCustom;

  const resetFilters = () => {
    setSourceFilter("");
    setAttendantFilter("");
    setStageFilter(new Set());
    setCustomFrom("");
    setCustomTo("");
  };

  const toggleStage = (stage: string) => {
    setStageFilter((prev) => {
      const next = new Set(prev);
      if (next.has(stage)) next.delete(stage);
      else next.add(stage);
      return next;
    });
  };

  const agencyName = useMemo(() => {
    if (!unitId) return "Todas as unidades";
    const u = units.data?.find((x) => String(x.id) === String(unitId));
    return u?.name ?? "Dashboard";
  }, [unitId, units.data]);

  // ─── Canais (origens com cor + barra proporcional) ────────────────────
  const channels = useMemo(() => {
    // Prefere o breakdown do KPI de origens (campo customizado: Instagram/Facebook/…),
    // que traz as origens REAIS. Cai pra ov.origens só se não houver KPI configurado —
    // ov.origens agrupa Lead.Source, que pra leads da Kommo é sempre "Kommo".
    const sourceKpi = ov?.custom_kpis?.find((k) => k.display_type === "source_chart");
    const arr = sourceKpi?.breakdown?.length
      ? sourceKpi.breakdown.map((b) => ({ origem: b.label, quantidade: b.value }))
      : (ov?.origens ?? []);
    const sorted = [...arr]
      .filter((o) => (o.quantidade ?? 0) > 0)
      .sort((a, b) => (b.quantidade ?? 0) - (a.quantidade ?? 0));
    const top = sorted.slice(0, 5);
    const otherTotal = sorted.slice(5).reduce(
      (s, o) => s + (o.quantidade ?? 0),
      0,
    );
    const items = top.map((o) => ({
      name: o.origem ?? "—",
      value: o.quantidade ?? 0,
      color: channelVisual(o.origem ?? "").color,
      iconUrl: channelVisual(o.origem ?? "").iconUrl,
    }));
    if (otherTotal > 0) {
      items.push({ name: "Outros", value: otherTotal, color: "#64748b", iconUrl: undefined });
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
  // Usa o novo campo leads_ativos do backend (puxa da Kommo via CurrentStage canonicalizado).
  // Fallback: total - fechou - nao_fechou - faltou para overviews antigos.
  const activeLeads =
    ov?.leads_ativos ??
    Math.max(
      0,
      (ov?.total_leads ?? 0) - (ov?.fechou ?? 0) - (ov?.nao_fechou ?? 0) - (ov?.faltou ?? 0),
    );
  const comPagamento = ov?.com_pagamento ?? 0;
  const semPagamento = ov?.sem_pagamento ?? 0;
  const tasks = ov?.faltou ?? 0;

  // Etapas com nome amigável (Kommo pipeline ao vivo > mapa estático > raw).
  // Filtragem opcional: se houver stageFilter ativo, restringe à seleção.
  const etapasComNome = useMemo(() => {
    const arr = ov?.etapas ?? [];
    return [...arr]
      .filter((e) => (e.quantidade ?? 0) > 0)
      .filter((e) => stageFilter.size === 0 || stageFilter.has(e.etapa))
      .sort((a, b) => (b.quantidade ?? 0) - (a.quantidade ?? 0))
      .slice(0, 12)
      .map((e) => ({
        raw: e.etapa,
        label: stageLabel(e.etapa),
        value: e.quantidade ?? 0,
      }));
  }, [ov, stageFilter, stageNameMap]);

  // Lista completa de etapas pro filtro (com nome traduzido) — usa o overview pra saber o universo.
  const allStagesForFilter = useMemo(() => {
    const arr = ov?.etapas ?? [];
    return [...arr]
      .sort((a, b) => (b.quantidade ?? 0) - (a.quantidade ?? 0))
      .map((e) => ({ raw: e.etapa, label: stageLabel(e.etapa), value: e.quantidade ?? 0 }));
  }, [ov, stageNameMap]);
  const etapasMax = useMemo(
    () => Math.max(1, ...etapasComNome.map((e) => e.value)),
    [etapasComNome],
  );

  // ─── Board de funil estilo CRM (colunas por etapa + cards de negócio) ──
  const kanbanColumns = useMemo<KanbanColumn[]>(() => {
    const leads = leadsBoard.data ?? [];

    // Tom da bolinha por recência da última atividade (proxy de "tarefa").
    const toneOf = (lead: (typeof leads)[number]): KanbanTone => {
      const ts = (lead.updatedAt as string) || (lead.createdAt as string);
      if (!ts) return "red";
      const days = (Date.now() - new Date(ts).getTime()) / 86_400_000;
      if (days <= 2) return "green";
      if (days <= 7) return "yellow";
      return "red";
    };

    // Valor do negócio (R$): price da Kommo > tratamento fechado > orçamento > consulta.
    const valueOf = (lead: (typeof leads)[number]): number | null => {
      const v =
        (lead.price as number | undefined) ??
        (lead.treatmentPlanValue as number | undefined) ??
        (lead.treatmentBudget as number | undefined) ??
        (lead.consultationValue as number | undefined);
      return typeof v === "number" && v > 0 ? v : null;
    };

    // Inicia as colunas na ordem do pipeline da Kommo (mantém etapas vazias, ex.: Fechamento).
    const groups = new Map<string, KanbanColumn["cards"]>();
    for (const p of pipelines.data ?? []) {
      for (const s of p.statuses ?? []) {
        if (!groups.has(s.name)) groups.set(s.name, []);
      }
    }

    for (const lead of leads) {
      const raw = lead.currentStage ?? "";
      if (stageFilter.size > 0 && !stageFilter.has(raw)) continue;
      // Alinha o lead à coluna do pipeline pelo status_id da Kommo (currentStageId);
      // se não houver, cai pro nome amigável do estágio canônico.
      const stageId = lead.currentStageId as number | string | null | undefined;
      const byId = stageId != null ? stageNameMap.get(String(stageId)) : undefined;
      const label = byId ?? stageLabel(raw);
      if (!groups.has(label)) groups.set(label, []);
      groups.get(label)!.push({
        id: lead.id,
        name: lead.name || `Lead #${lead.id}`,
        subtitle: (lead.source as string) || lead.attendantName || "—",
        value: valueOf(lead),
        tone: toneOf(lead),
      });
    }

    return Array.from(groups.entries()).map(([title, cards], i) => ({
      id: `${title}-${i}`,
      title,
      cards,
    }));
  }, [leadsBoard.data, pipelines.data, stageNameMap, stageFilter]);


  // ─── Derivados da nova estrutura (funnel + origens + semanas) ──────
  const funnelLeads = ov?.funnel_leads ?? { total: 0, interacoes: 0, agendados: 0, consultas: 0, tratamentos: 0, no_show: 0 };
  const funnelCadastro = ov?.funnel_cadastro ?? funnelLeads;
  const funnelResgate = ov?.funnel_resgate ?? { total: 0, interacoes: 0, agendados: 0, consultas: 0, tratamentos: 0, no_show: 0 };

  // Prefere o valor mapeado nas Configurações Técnicas (kpi_overrides), quando existir;
  // senão usa o cálculo padrão. O override manual (localStorage) ainda fica por cima.
  const kpiLive = (key: string, fallback: number): number =>
    ov?.kpi_overrides?.[key] ?? fallback;

  // Botão de fonte (analista) reutilizável por card.
  const srcBtn = (key: string, label: string) => (
    <KpiSourceButton
      unitId={unitId}
      kpiKey={key}
      label={label}
      pipelines={pipelines.data ?? []}
      customFields={customFields.data ?? []}
      saved={savedKpiByKey.get(key)}
    />
  );

  const origensLeadsRows = useMemo(
    () => (ov?.origens ?? []).map((o) => ({ origem: o.origem ?? "—", quantidade: o.quantidade ?? 0 })),
    [ov],
  );
  const origensConsultasRows = useMemo(
    () => (ov?.origens_consultas ?? []).map((o) => ({ origem: o.origem ?? "—", quantidade: o.quantidade ?? 0 })),
    [ov],
  );
  const origensTratamentosRows = useMemo(
    () => (ov?.origens_tratamentos ?? []).map((o) => ({ origem: o.origem ?? "—", quantidade: o.quantidade ?? 0 })),
    [ov],
  );
  const agendadosByOrigem = useMemo(() => {
    const m = new Map<string, number>();
    for (const o of ov?.origens_consultas ?? []) m.set(o.origem ?? "—", o.quantidade ?? 0);
    return m;
  }, [ov]);
  const compareceuByOrigem = useMemo(() => {
    const m = new Map<string, number>();
    for (const o of ov?.origens_tratamentos ?? []) m.set(o.origem ?? "—", o.quantidade ?? 0);
    return m;
  }, [ov]);

  // Donuts por semana — convertidos pro shape do ConcentricDonut.
  const palette = ["#a78bfa", "#22d3ee", "#34d399", "#f472b6", "#fbbf24", "#60a5fa", "#f87171", "#94a3b8"];
  const toConcRings = (arr?: Array<{ periodo: string; quantidade: number }>) =>
    (arr ?? []).slice(0, 8).map((d, i) => ({
      name: d.periodo,
      value: d.quantidade,
      color: palette[i % palette.length],
    }));
  const leadsWeekRings = toConcRings(ov?.leads_por_semana);
  const consultasWeekRings = toConcRings(ov?.consultas_por_semana);
  const tratamentosWeekRings = toConcRings(ov?.tratamentos_por_semana);

  // Dia da semana (1=Dom..7=Sab)
  const DOW = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
  const weekdayBars = (ov?.leads_por_dia_semana ?? []).map((d) => ({
    nome: DOW[(d.dia - 1) % 7],
    qtd: d.quantidade,
  }));

  const isLoading = overview.isLoading && !ov;

  // ─── Render ───────────────────────────────────────────────────────────
  return (
    <div
      className="-m-4 lg:-m-6 min-h-[calc(100vh-4rem)] text-white font-normal"
      style={{
        // Gradiente VERTICAL (não radial) — sem escurecer as laterais; "azul do meio" uniforme em toda a largura.
        background:
          "linear-gradient(180deg, #1a3565 0%, #14294c 45%, #102444 100%)",
        fontFamily: "'PT Sans', ui-sans-serif, system-ui, sans-serif",
        fontWeight: 400,
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
        <h1 className="text-center text-2xl font-bold tracking-tight sm:text-4xl lg:text-5xl">
          {agencyName}
        </h1>

        {/* ─── FILTROS ─────────────────────────────────────────────────── */}
        <div className="mt-6 flex flex-col items-stretch gap-3 lg:flex-row lg:flex-wrap lg:items-center lg:justify-between">
          {/* Pílulas — rolam na horizontal no mobile (sem quebrar linha) */}
          <div className="mx-auto flex max-w-full items-center gap-1 overflow-x-auto rounded-full border border-white/15 bg-white/5 p-1 backdrop-blur [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {RANGES.map((r) => (
              <button
                key={r.key}
                type="button"
                onClick={() => {
                  setRangeKey(r.key);
                  setCustomFrom("");
                  setCustomTo("");
                }}
                className={`flex items-center gap-1.5 rounded-full px-4 py-1.5 text-xs font-medium transition ${
                  !isCustom && rangeKey === r.key
                    ? "bg-white text-slate-900"
                    : "text-white/70 hover:text-white"
                }`}
              >
                <Fi name={r.icon} />
                {r.label}
              </button>
            ))}
            <span className="rounded-full bg-white px-4 py-1.5 text-xs font-semibold text-slate-900">
              {isCustom ? `Personalizado: ${rangeLabel}` : rangeLabel}
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
              onClick={() => setShowAdvanced((v) => !v)}
              className={`flex items-center gap-1.5 rounded-full border px-4 py-1.5 text-xs font-medium transition ${
                hasActiveFilters
                  ? "border-violet-400/60 bg-violet-500/20 text-white"
                  : "border-white/15 bg-white/5 text-white/80 hover:bg-white/10"
              }`}
            >
              <Cog className="h-3.5 w-3.5" />
              Filtros{hasActiveFilters ? ` (${
                (sourceFilter ? 1 : 0) +
                (attendantFilter ? 1 : 0) +
                stageFilter.size +
                (isCustom ? 1 : 0)
              })` : ""}
            </button>
          </div>
        </div>

        {/* ─── PAINEL DE FILTROS AVANÇADOS ─────────────────────────────── */}
        {showAdvanced && (
          <DarkCard className="mt-4" accent="#a78bfa">
            <div className="flex items-center justify-between">
              <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-white/60">
                Filtros avançados
              </p>
              {hasActiveFilters && (
                <button
                  type="button"
                  onClick={resetFilters}
                  className="text-[11px] text-violet-300 hover:text-violet-200"
                >
                  Limpar tudo
                </button>
              )}
            </div>

            <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {/* Origem */}
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

              {/* Atendente */}
              <div>
                <label className="text-[11px] font-medium text-white/60">Atendente</label>
                <select
                  value={attendantFilter}
                  onChange={(e) => setAttendantFilter(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs text-white outline-none focus:border-violet-400/50"
                >
                  <option value="" className="bg-slate-900">Todos</option>
                  {(attendants.data ?? []).map((a) => (
                    <option key={a.id} value={a.id} className="bg-slate-900">
                      {a.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Período customizado */}
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

            {/* Etapas (multi-select com chips) */}
            {allStagesForFilter.length > 0 && (
              <div className="mt-4">
                <div className="flex items-center justify-between">
                  <label className="text-[11px] font-medium text-white/60">Etapas do funil</label>
                  {stageFilter.size > 0 && (
                    <button
                      type="button"
                      onClick={() => setStageFilter(new Set())}
                      className="text-[10px] text-white/40 hover:text-white"
                    >
                      Limpar
                    </button>
                  )}
                </div>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {allStagesForFilter.map((e) => {
                    const active = stageFilter.has(e.raw);
                    return (
                      <button
                        key={e.raw}
                        type="button"
                        onClick={() => toggleStage(e.raw)}
                        className={`rounded-full border px-3 py-1 text-[11px] transition ${
                          active
                            ? "border-violet-400 bg-violet-500/30 text-white"
                            : "border-white/15 bg-white/5 text-white/70 hover:bg-white/10"
                        }`}
                      >
                        {e.label} <span className="ml-1 opacity-60">{nf(e.value)}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Custom fields da Kommo (definições) ─ resumo */}
            {(customFields.data?.length ?? 0) > 0 && (
              <div className="mt-4">
                <div className="flex items-center justify-between">
                  <label className="text-[11px] font-medium text-white/60">
                    Campos customizados da Kommo
                  </label>
                  <span className="text-[10px] text-white/40">
                    {customFields.data!.length} campo(s) detectado(s)
                  </span>
                </div>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {customFields.data!.map((f) => (
                    <span
                      key={f.id}
                      title={`type=${f.type}${f.code ? ` · code=${f.code}` : ""}`}
                      className="rounded-full border border-cyan-400/30 bg-cyan-500/10 px-3 py-1 text-[11px] text-cyan-200"
                    >
                      {f.name}
                      {f.enums.length > 0 && (
                        <span className="ml-1 opacity-60">
                          ({f.enums.length} opç.)
                        </span>
                      )}
                    </span>
                  ))}
                </div>
                <p className="mt-2 text-[10px] text-white/40">
                  Sincronizados nos leads via REST sync. Filtros por campo customizado virão na próxima iteração.
                </p>
              </div>
            )}

            {/* Avisos quando endpoints da Kommo não carregam */}
            {unitId != null && pipelines.isError && (
              <p className="mt-3 text-[11px] text-amber-300/80">
                Não consegui carregar os nomes das etapas da Kommo (verifique o subdomain/token da unidade). Usando códigos brutos.
              </p>
            )}
            {unitId != null && customFields.isError && (
              <p className="mt-2 text-[11px] text-amber-300/80">
                Não consegui carregar os custom fields da Kommo (verifique o subdomain/token da unidade).
              </p>
            )}
          </DarkCard>
        )}

        {/* ─── LOADING ─────────────────────────────────────────────────── */}
        {isLoading ? (
          <div className="mt-12 flex items-center justify-center">
            <Loader2 className="h-7 w-7 animate-spin text-white/50" />
          </div>
        ) : (
          <>
            {/* ─── Hero: grid assimétrica amoCRM (1 card por métrica) ─── */}
            <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {/* Col 1 (tall): Total de Leads + canais (INCOMING MESSAGES style) */}
              <DarkCard className="lg:row-span-2" accent="#34d399">
                <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-white/60">
                  Total de Leads
                </p>
                <EditableKpiValue
                  okey={kpiKey(unitId, "total_leads")}
                  live={kpiLive("total_leads", funnelLeads.total)}
                  valueClass="text-6xl text-emerald-400"
                  align="right"
                  format={nf}
                  onDrill={() => setDrill({ kpiKey: "total_leads", label: "Total de Leads" })}
                />
                <p className="mt-3 text-[11px] text-white/40">{rangeLabel}</p>
                {srcBtn("total_leads", "Total de Leads")}
                <div className="mt-5 h-px w-full bg-white/10" />
                <ul className="mt-4 space-y-3">
                  {channels.length === 0 && <li className="text-xs text-white/40">Sem dados</li>}
                  {channels.map((c) => {
                    const ratio = c.value / channelMax;
                    return (
                      <li key={c.name}>
                        <div className="flex items-center justify-between text-[12px] text-white/80">
                          <span className="flex items-center gap-2">
                            <span className="inline-block h-2 w-2 rounded-full" style={{ background: c.color }} />
                            <span className="truncate">{c.name}</span>
                          </span>
                          <span className="font-semibold tabular-nums" style={{ color: c.color }}>{nf(c.value)}</span>
                        </div>
                        <div className="mt-1 h-1 w-full overflow-hidden rounded-full bg-white/5">
                          <div className="h-full rounded-full" style={{ width: `${Math.max(4, ratio * 100)}%`, background: c.color }} />
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </DarkCard>

              {/* Col 2 row 1: Cadastro */}
              <DarkCard accent="#a78bfa">
                <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-white/60">Cadastro</p>
                <EditableKpiValue okey={kpiKey(unitId, "cadastro")} live={kpiLive("cadastro", funnelCadastro.total)} valueClass="text-violet-400" format={nf} onDrill={() => setDrill({ kpiKey: "cadastro", label: "Cadastro" })} />
                <div className="mt-4 h-px w-1/3 bg-white/10" />
                <p className="mt-3 text-[11px] text-white/40">{rangeLabel}</p>
                {srcBtn("cadastro", "Cadastro")}
              </DarkCard>

              {/* Col 3 row 1: Resgate */}
              <DarkCard accent="#fbbf24">
                <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-white/60">Resgate</p>
                <EditableKpiValue okey={kpiKey(unitId, "resgate")} live={kpiLive("resgate", funnelResgate.total)} valueClass="text-amber-400" format={nf} onDrill={() => setDrill({ kpiKey: "resgate", label: "Resgate" })} />
                <div className="mt-4 h-px w-1/3 bg-white/10" />
                <p className="mt-3 text-[11px] text-white/40">{rangeLabel}</p>
                {srcBtn("resgate", "Resgate")}
              </DarkCard>

              {/* Col 4 (tall): Origens de Leads — ConcentricDonut */}
              <DarkCard className="lg:row-span-2" accent="#22d3ee">
                <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-white/60">
                  Origens de Leads
                </p>
                <div className="mt-4 flex items-center justify-between gap-3">
                  <ul className="flex-1 space-y-2 text-[11px]">
                    {channels.length === 0 && <li className="text-white/40">Sem dados</li>}
                    {channels.map((c) => (
                      <li key={c.name} className="flex items-center gap-2 truncate">
                        {c.iconUrl ? (
                          <span
                            className="grid h-6 w-6 shrink-0 place-items-center overflow-hidden rounded-md bg-white p-0.5"
                          >
                            <img src={c.iconUrl} alt="" className="h-full w-full object-contain" />
                          </span>
                        ) : (
                          <span className="inline-block h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: c.color }} />
                        )}
                        <span className="truncate uppercase tracking-wide" style={{ color: c.color }}>{c.name}</span>
                      </li>
                    ))}
                  </ul>
                  <div className="shrink-0">
                    <ConcentricDonut
                      data={channels.length ? channels : [{ name: "—", value: 1, color: "#1e293b" }]}
                      size={200}
                    />
                  </div>
                </div>
              </DarkCard>

              {/* Col 2 row 2: Agendados */}
              <DarkCard accent="#60a5fa">
                <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-white/60">Agendados</p>
                <EditableKpiValue okey={kpiKey(unitId, "agendados")} live={kpiLive("agendados", funnelLeads.agendados)} valueClass="text-sky-400" format={nf} onDrill={() => setDrill({ kpiKey: "agendados", label: "Agendados" })} />
                <div className="mt-4 h-px w-1/3 bg-white/10" />
                <p className="mt-3 text-[11px] text-white/40">{rangeLabel}</p>
                {srcBtn("agendados", "Agendados")}
              </DarkCard>

              {/* Col 3 row 2: No-show */}
              <DarkCard accent="#f87171">
                <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-white/60">No-show</p>
                <EditableKpiValue okey={kpiKey(unitId, "no_show")} live={kpiLive("no_show", funnelLeads.no_show)} valueClass="text-red-400" format={nf} onDrill={() => setDrill({ kpiKey: "no_show", label: "No-show" })} />
                <div className="mt-4 h-px w-1/3 bg-white/10" />
                <p className="mt-3 text-[11px] text-white/40">{rangeLabel}</p>
                {srcBtn("no_show", "No-show")}
              </DarkCard>
            </div>

            {/* ─── 3 cards estilo WON / ACTIVE / TASKS ───────────────── */}
            <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <DarkCard accent="#34d399">
                <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-white/60">Tratamentos</p>
                <EditableKpiValue okey={kpiKey(unitId, "tratamentos")} live={kpiLive("tratamentos", funnelLeads.tratamentos)} valueClass="text-emerald-400" format={nf} onDrill={() => setDrill({ kpiKey: "tratamentos", label: "Tratamentos" })} />
                <div className="mt-4 h-px w-1/3 bg-white/10" />
                <p className="mt-3 text-[11px] text-white/40">{rangeLabel}</p>
                {srcBtn("tratamentos", "Tratamentos")}
              </DarkCard>
              <DarkCard accent="#60a5fa">
                <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-white/60">Consultas</p>
                <EditableKpiValue okey={kpiKey(unitId, "consultas")} live={kpiLive("consultas", funnelLeads.consultas)} valueClass="text-sky-400" format={nf} onDrill={() => setDrill({ kpiKey: "consultas", label: "Consultas" })} />
                <div className="mt-4 h-px w-1/3 bg-white/10" />
                <p className="mt-3 text-[11px] text-white/40">{rangeLabel}</p>
                {srcBtn("consultas", "Consultas")}
              </DarkCard>
              <DarkCard accent="#22d3ee">
                <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-white/60">Interações</p>
                <EditableKpiValue okey={kpiKey(unitId, "interacoes")} live={kpiLive("interacoes", funnelLeads.interacoes)} valueClass="text-cyan-300" format={nf} onDrill={() => setDrill({ kpiKey: "interacoes", label: "Interações" })} />
                <div className="mt-4 h-px w-1/3 bg-white/10" />
                <p className="mt-3 text-[11px] text-white/40">{rangeLabel}</p>
                {srcBtn("interacoes", "Interações")}
              </DarkCard>
            </div>

            {/* ─── Meus KPIs (criados pelo analista) ──────────────────── */}
            {((ov?.custom_kpis?.length ?? 0) > 0 || canEditKpis) && (
              <div className="mt-6">
                <div className="mb-3 flex items-center justify-between">
                  <h2 className="text-[11px] font-semibold uppercase tracking-[0.14em] text-white/60">
                    Meus KPIs
                  </h2>
                  {canEditKpis && (
                    <button
                      type="button"
                      onClick={() => setKpiModal({ existing: null })}
                      className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/15 px-3 py-1 text-[11px] font-semibold text-emerald-200 ring-1 ring-inset ring-emerald-400/25 transition hover:bg-emerald-500/25"
                    >
                      <Plus className="h-3.5 w-3.5" /> Novo KPI
                    </button>
                  )}
                </div>

                {(ov?.custom_kpis?.length ?? 0) === 0 ? (
                  <DarkCard>
                    <p className="text-[12px] text-white/50">
                      Nenhum KPI custom ainda. Clique em <span className="text-emerald-300">Novo KPI</span> para criar um card com a métrica, a cor e a fonte (etapa/campo) que você quiser.
                    </p>
                  </DarkCard>
                ) : (
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                    {ov!.custom_kpis!.map((k) =>
                      k.display_type === "source_chart" ? (
                        <div key={k.key} className="sm:col-span-2">
                          <CustomKpiChartCard
                            label={k.label}
                            accent={k.color}
                            total={k.value}
                            breakdown={k.breakdown ?? []}
                            canEdit={canEditKpis}
                            onEdit={() => setKpiModal({ existing: savedKpiByKey.get(k.key) ?? null })}
                            onDrillValue={(value) => {
                              const cfg = savedKpiByKey.get(k.key)?.config ?? {};
                              setDrill({
                                kpiKey: k.key,
                                label: `${k.label}: ${value}`,
                                source: {
                                  source_type: "custom_field_count",
                                  config: { fieldId: cfg.fieldId, fieldCode: cfg.fieldCode, matchValues: [value] },
                                },
                              });
                            }}
                          />
                        </div>
                      ) : (
                        <DarkCard key={k.key} accent={k.color ?? "#64748b"}>
                          <div className="flex items-start justify-between gap-2">
                            <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-white/60">
                              {k.label}
                            </p>
                            {canEditKpis && (
                              <button
                                type="button"
                                onClick={() => setKpiModal({ existing: savedKpiByKey.get(k.key) ?? null })}
                                className="shrink-0 rounded-full p-1 text-white/30 transition hover:bg-white/10 hover:text-white/70"
                                aria-label={`Editar ${k.label}`}
                              >
                                <Pencil className="h-3.5 w-3.5" />
                              </button>
                            )}
                          </div>
                          <EditableKpiValue
                            okey={kpiKey(unitId, k.key)}
                            live={k.value}
                            format={nf}
                            onDrill={() => setDrill({ kpiKey: k.key, label: k.label })}
                          />
                          <div className="mt-4 h-px w-1/3 bg-white/10" />
                          <p className="mt-3 text-[11px] text-white/40">{rangeLabel}</p>
                        </DarkCard>
                      ),
                    )}
                  </div>
                )}
              </div>
            )}

            {/* ─── Funil de vendas estilo CRM (board Kanban por etapa) ── */}
            <DarkCard className="mt-4" accent="#34d399">
              <div className="mb-3 flex items-center justify-between">
                <h2 className="text-[10px] font-semibold uppercase tracking-[0.12em] text-white/60">
                  Funil de vendas
                </h2>
                <span className="text-[11px] text-white/40">{rangeLabel}</span>
              </div>
              {leadsBoard.isLoading && !leadsBoard.data ? (
                <div className="flex items-center justify-center py-10">
                  <Loader2 className="h-6 w-6 animate-spin text-white/40" />
                </div>
              ) : (
                <CrmKanban columns={kanbanColumns} />
              )}
              {unitId == null && (
                <p className="mt-3 text-[11px] text-white/40">
                  Selecione uma unidade para que as etapas saiam com os nomes do pipeline da Kommo.
                </p>
              )}
            </DarkCard>

            {/* ─── Tendência: barras por dia da semana ────────────────── */}
            <DarkCard className="mt-4" accent="#34d399">
              <div className="flex items-center justify-between">
                <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-white/60">
                  Leads por dia da semana
                </p>
                <span className="text-[11px] text-white/40">{rangeLabel}</span>
              </div>
              <div className="mt-4 h-60">
                <ResponsiveContainer>
                  <BarChart data={weekdayBars} margin={{ top: 12, right: 16, left: 0, bottom: 4 }}>
                    <XAxis dataKey="nome" stroke="rgba(255,255,255,0.4)" tick={{ fontSize: 11, fill: "rgba(255,255,255,0.6)" }} axisLine={false} tickLine={false} />
                    <YAxis stroke="rgba(255,255,255,0.4)" tick={{ fontSize: 11, fill: "rgba(255,255,255,0.5)" }} axisLine={false} tickLine={false} width={32} />
                    <Tooltip cursor={{ fill: "rgba(52,211,153,0.1)" }} contentStyle={{ background: "#0a1a36", border: "1px solid rgba(255,255,255,.1)", borderRadius: 8, color: "#fff", fontSize: 12 }} />
                    <Bar dataKey="qtd" radius={[6, 6, 0, 0]}>
                      {weekdayBars.map((_, i) => (
                        <Cell key={i} fill={i === 0 || i === 6 ? "#a78bfa" : "#34d399"} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </DarkCard>

            {/* ─── Perfil avançado do lead (idade/alertas/doutor) ───── */}
            <LeadProfilePanel unitId={unitId} dateFrom={range.from} dateTo={range.to} />

            {/* ─── Campos da Kommo (perfil do lead) ─────────────────── */}
            <CustomFieldsPanel
              unitId={unitId}
              dateFrom={range.from}
              dateTo={range.to}
              rangeLabel={rangeLabel}
            />
          </>
        )}
      </div>

      {/* Drill-down: clicar no número de um KPI abre a lista dos leads. */}
      <KpiDrillDown
        target={drill}
        unitId={unitId}
        dateFrom={range.from}
        dateTo={range.to}
        onClose={() => setDrill(null)}
      />

      {/* Criar/editar KPI custom (só analista, com unidade selecionada). */}
      {kpiModal && unitId != null && (
        <CustomKpiModal
          unitId={unitId}
          pipelines={pipelines.data ?? []}
          customFields={customFields.data ?? []}
          existing={kpiModal.existing}
          onClose={() => setKpiModal(null)}
        />
      )}
    </div>
  );
}
