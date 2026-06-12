import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { DayPicker, type DateRange } from "react-day-picker";
import { ptBR } from "date-fns/locale";
import "react-day-picker/style.css";
import { Cog, Loader2, Pencil, Plus, RefreshCw } from "@/components/icons";
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

/** Date → "yyyy-MM-dd" no fuso LOCAL. */
function dateToInput(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}
/** "yyyy-MM-dd" → Date no fuso LOCAL (sem shift de UTC). */
function inputToDate(s: string) {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, (m ?? 1) - 1, d ?? 1);
}

/**
 * Combina um Date (dia) com uma string "HH:mm" e devolve ISO no fuso local.
 * "01/06 00:00" no Brasil (BRT) vira "2026-06-01T03:00:00Z" — o que está CORRETO:
 * o filtro `>= esse instante` exclui leads criados antes das 00h BRT do dia 1.
 */
function combineDateAndTime(day: Date, hhmm: string): string {
  const [h, m] = hhmm.split(":").map(Number);
  const d = new Date(day);
  d.setHours(h ?? 0, m ?? 0, 0, 0);
  return d.toISOString();
}

/**
 * Início do dia no fuso local: 00:00:00 LOCAL como ISO UTC.
 * Diferente do `isoBizStart` (que volta 1 dia + 19h pro "dia comercial").
 * Usado no modo custom SEM hora digitada — calendário puro.
 */
function isoLocalDayStart(dayMidnight: Date) {
  const d = new Date(dayMidnight);
  d.setHours(0, 0, 0, 0);
  return d.toISOString();
}

/**
 * Fim EXCLUSIVO do dia no fuso local: meia-noite do dia seguinte.
 * Garante que o dia inteiro entra no filtro `< fim` (até 23:59:59.999 LOCAL).
 */
function isoLocalDayEnd(dayMidnight: Date) {
  const d = new Date(dayMidnight);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + 1);
  return d.toISOString();
}

// ─── Dia comercial: vira às 19h ───────────────────────────────────────────
// O "dia" da clínica vai das 19h de uma noite até as 19h da noite seguinte.
// Ex.: "dia 11" = de 10 às 19h até 11 às 19h. Lead que chega depois das 19h
// conta como o dia seguinte; madrugada (00h–19h) conta como o próprio dia.
const BIZ_CUTOFF_HOUR = 19;

/** Data (meia-noite local) → ISO do INÍCIO do dia comercial (véspera às 19h). */
function isoBizStart(dayMidnight: Date) {
  const d = new Date(dayMidnight);
  d.setDate(d.getDate() - 1);
  d.setHours(BIZ_CUTOFF_HOUR, 0, 0, 0);
  return d.toISOString();
}
/** Data (meia-noite local) → ISO do FIM EXCLUSIVO do dia comercial (próprio dia às 19h). */
function isoBizEnd(dayMidnight: Date) {
  const d = new Date(dayMidnight);
  d.setHours(BIZ_CUTOFF_HOUR, 0, 0, 0);
  return d.toISOString();
}
/** Data comercial (meia-noite local) que contém o instante `ref`. Após 19h já é o dia seguinte. */
function bizDateOf(ref: Date) {
  const d = new Date(ref);
  if (d.getHours() >= BIZ_CUTOFF_HOUR) d.setDate(d.getDate() + 1);
  d.setHours(0, 0, 0, 0);
  return d;
}
/** Date local → "dd/mm/aaaa" (rótulo). */
function fmtDateLocalBr(d: Date) {
  return d.toLocaleDateString("pt-BR");
}

/** Atalhos do seletor de datas. Cada um devolve {from,to} como Date local. */
const DATE_PRESETS: Array<{ key: string; label: string; range: () => { from: Date; to: Date } }> = [
  { key: "hoje", label: "Hoje", range: () => { const d = new Date(); return { from: d, to: d }; } },
  { key: "ontem", label: "Ontem", range: () => { const d = new Date(); d.setDate(d.getDate() - 1); return { from: d, to: d }; } },
  { key: "7d", label: "Últimos 7 dias", range: () => { const to = new Date(); const from = new Date(); from.setDate(from.getDate() - 6); return { from, to }; } },
  { key: "30d", label: "Últimos 30 dias", range: () => { const to = new Date(); const from = new Date(); from.setDate(from.getDate() - 29); return { from, to }; } },
  { key: "mes-passado", label: "Mês passado", range: () => { const now = new Date(); const from = new Date(now.getFullYear(), now.getMonth() - 1, 1); const to = new Date(now.getFullYear(), now.getMonth(), 0); return { from, to }; } },
];

// ─── Filtros (pílulas Ano / Mês / Semana / Dia) ───────────────────────────
type RangeKey = "ano" | "mes" | "semana" | "dia" | "custom";

const RANGES: Array<{ key: RangeKey; label: string; icon: string }> = [
  { key: "ano",    label: "Ano",    icon: "fi-rr-calendar" },
  { key: "mes",    label: "Mês",    icon: "fi-rr-calendar-clock" },
  { key: "semana", label: "Semana", icon: "fi-rr-calendar-day" },
  { key: "dia",    label: "Dia",    icon: "fi-rr-time-quarter-past" },
];

type ComputedRange = { from: string; to: string; fromDate: Date; toDate: Date };
function computeRange(key: RangeKey): ComputedRange {
  // Tudo em "dia comercial" (corte às 19h): a janela vai da véspera 19h até o dia 19h.
  const today = bizDateOf(new Date()); // data comercial de hoje
  const win = (fromDate: Date, toDate: Date): ComputedRange => ({
    from: isoBizStart(fromDate), to: isoBizEnd(toDate), fromDate, toDate,
  });
  const back = (days: number) => { const d = new Date(today); d.setDate(d.getDate() - days); return d; };
  if (key === "dia") return win(today, today);
  if (key === "semana") return win(back(6), today);
  if (key === "mes") return win(back(29), today);
  if (key === "ano") { const d = new Date(today); d.setFullYear(d.getFullYear() - 1); return win(d, today); }
  return win(back(29), today);
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
/**
 * Donut de origens: um único anel com fatias proporcionais por origem e o total no
 * centro. Substitui os anéis concêntricos (que estouravam o card e viravam "espiral").
 */
function DonutChart({
  data,
  size = 168,
  thickness = 22,
}: {
  data: Array<{ name: string; value: number; color: string }>;
  size?: number;
  thickness?: number;
}) {
  const total = data.reduce((s, d) => s + d.value, 0);
  const center = size / 2;
  const radius = (size - thickness) / 2;
  const circ = 2 * Math.PI * radius;
  const positive = data.filter((d) => d.value > 0);
  // gap visual entre fatias (só quando há mais de uma origem).
  const gap = positive.length > 1 ? 3 : 0;

  let acc = 0;
  const segments = total > 0
    ? positive.map((d) => {
        const len = (d.value / total) * circ;
        const seg = { color: d.color, dash: Math.max(0.001, len - gap), rest: circ - Math.max(0.001, len - gap), off: -acc };
        acc += len;
        return seg;
      })
    : [];

  return (
    <div className="relative grid shrink-0 place-items-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ transform: "rotate(-90deg)" }}>
        <circle cx={center} cy={center} r={radius} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth={thickness} />
        {segments.map((s, i) => (
          <circle
            key={i}
            cx={center}
            cy={center}
            r={radius}
            fill="none"
            stroke={s.color}
            strokeWidth={thickness}
            strokeLinecap="butt"
            strokeDasharray={`${s.dash} ${s.rest}`}
            strokeDashoffset={s.off}
          />
        ))}
      </svg>
      <div className="pointer-events-none absolute inset-0 grid place-items-center text-center">
        <div>
          <div className="text-2xl font-bold leading-none text-white">{nf(total)}</div>
          <div className="mt-1 text-[9px] font-medium uppercase tracking-[0.15em] text-white/45">leads</div>
        </div>
      </div>
    </div>
  );
}

// ─── Breakdown inline nos KPI cards ──────────────────────────────────────
function KpiChips({ items, max = 4 }: { items: Array<{ label: string; count: number; tone?: "ok" | "warn" | "neutral" }>; max?: number }) {
  if (!items.length) {
    return <div className="mt-1 text-[10px] italic text-white/30">sem dados</div>;
  }
  return (
    <div className="mt-2 flex flex-wrap gap-1">
      {items.slice(0, max).map((c, i) => {
        const tone =
          c.tone === "ok" ? "bg-emerald-400/[0.12] text-emerald-200 ring-emerald-400/20"
          : c.tone === "warn" ? "bg-amber-400/[0.12] text-amber-100 ring-amber-400/20"
          : "bg-white/[0.04] text-white/75 ring-white/10";
        return (
          <span key={`${c.label}-${i}`} className={`rounded-full px-2 py-0.5 text-[10px] tracking-wide ring-1 ring-inset ${tone}`}>
            <span className="truncate">{c.label}</span> · <span className="tabular-nums text-white">{c.count}</span>
          </span>
        );
      })}
    </div>
  );
}

function KpiBreakdownHeading({ children }: { children: React.ReactNode }) {
  return <p className="mt-3 text-[9px] font-semibold uppercase tracking-[0.14em] text-white/40">{children}</p>;
}

const moneyBR = (v: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 }).format(v);

const dateHourBR = (iso?: string | null) => {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
};

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
  const qc = useQueryClient();
  const [drill, setDrill] = useState<KpiDrillTarget | null>(null);
  // Modal de KPI custom: null = fechado; { existing } = abrindo p/ criar (undefined) ou editar.
  const [kpiModal, setKpiModal] = useState<{ existing: KpiConfigItem | null } | null>(null);
  const { user } = useAuth();
  const canEditKpis = isAdminLevel(user?.role) && unitId != null;
  const [rangeKey, setRangeKey] = useState<RangeKey>("mes");

  // ─── Filtros avançados ─────────────────────────────────────────────
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [sourceFilter, setSourceFilter] = useState<string>("");
  const [attendantFilter, setAttendantFilter] = useState<string>("");
  // SDR responsável = valor do custom field "Usuário responsável" (um login Kommo p/ todas as SDRs).
  const [responsibleFilter, setResponsibleFilter] = useState<string>("");
  const [stageFilter, setStageFilter] = useState<Set<string>>(new Set());
  const [customFrom, setCustomFrom] = useState<string>("");
  const [customTo, setCustomTo] = useState<string>("");
  // Hora opcional ("HH:mm" ou ""). Quando preenchida, o range usa o instante literal
  // (sem o corte comercial das 19h) — pra puxar só leads de um intervalo de horas no dia.
  const [customFromTime, setCustomFromTime] = useState<string>("");
  const [customToTime, setCustomToTime] = useState<string>("");
  const [dateMenuOpen, setDateMenuOpen] = useState(false);
  const isCustom = customFrom !== "" && customTo !== "";
  const hasCustomTime = customFromTime !== "" && customToTime !== "";

  const range = useMemo<ComputedRange>(() => {
    if (isCustom) {
      const fromDate = inputToDate(customFrom);
      const toDate = inputToDate(customTo);
      if (hasCustomTime) {
        // Hora exata: ignora o corte comercial, usa o instante literal do usuário.
        return {
          from: combineDateAndTime(fromDate, customFromTime),
          to: combineDateAndTime(toDate, customToTime),
          fromDate,
          toDate,
        };
      }
      // Sem hora digitada: calendário puro — 00:00 do 1º dia até 00:00 do dia seguinte
      // ao último (fim exclusivo). NÃO usa corte comercial das 19h porque isso arrastava
      // 5 horas do dia anterior (das 19h às 23:59 da véspera) pra dentro do filtro.
      return { from: isoLocalDayStart(fromDate), to: isoLocalDayEnd(toDate), fromDate, toDate };
    }
    return computeRange(rangeKey);
  }, [rangeKey, customFrom, customTo, customFromTime, customToTime, isCustom, hasCustomTime]);
  // Rótulo mostra as DATAS COMERCIAIS escolhidas. Quando há horas, anexa o intervalo HH:mm.
  const rangeLabel = hasCustomTime && isCustom
    ? `${fmtDateLocalBr(range.fromDate)} ${customFromTime} – ${fmtDateLocalBr(range.toDate)} ${customToTime}`
    : `${fmtDateLocalBr(range.fromDate)} - ${fmtDateLocalBr(range.toDate)}`;

  const units = useQuery({
    queryKey: ["dash-amo", "units"],
    queryFn: () => unitsService.list(),
    staleTime: 5 * 60_000,
  });

  const attendants = useQuery({
    queryKey: ["dash-amo", "attendants", unitId],
    queryFn: () => assignmentsService.listAttendants(unitId ?? undefined),
    staleTime: 5 * 60_000,
  });

  // Usuários responsáveis (SDRs) da unidade — alimentam o seletor "Selecionar usuário".
  const responsibleUsers = useQuery({
    queryKey: ["dash-amo", "responsible-users", tenantId, unitId],
    queryFn: () =>
      webhooksService.responsibleUsers({
        clinicId: tenantId ?? undefined,
        unitId: unitId ?? undefined,
      }),
    enabled: tenantId != null,
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

  // Card Agendados "Atualizar": dispara o backfill dos eventos de mudança de etapa
  // (lead_status_changed) da Kommo sob demanda. Sem isso, leads agendados ao longo do
  // dia só aparecem no card após o job de 24h. Idempotente.
  const agendadosBackfill = useMutation({
    mutationFn: () => unitsService.runAgendadosBackfill(unitId!),
    onSuccess: (r) => {
      if (r.error) toast.error(`Falha ao atualizar: ${r.error}`);
      else toast.success(`Agendados atualizados: +${r.inserted} novas transições (de ${r.scanned} eventos).`);
      qc.invalidateQueries({ queryKey: ["dash-amo"] });
    },
    onError: (e) => toast.error(`Falha ao atualizar Agendados: ${(e as Error).message}`),
  });

  // Card Consultas "Atualizar": aplica os campos mapeados (Data de agendamento +
  // Valor da consulta) nos leads existentes a partir do CustomFieldsJson que já
  // está no banco. NÃO chama a Kommo — só processa local. Pra leads ANTIGOS
  // aparecerem no card depois de mapear o campo (leads novos vêm pelo webhook).
  const consultasBackfill = useMutation({
    mutationFn: () => unitsService.runConsultasBackfill(unitId!),
    onSuccess: (r) => {
      if (r.error) toast.error(`Falha: ${r.error}`);
      else
        toast.success(
          `Consultas atualizadas: ${r.appointments_set} datas + ${r.values_set} valores (em ${r.scanned} leads).`,
        );
      qc.invalidateQueries({ queryKey: ["dash-amo"] });
    },
    onError: (e) => toast.error(`Falha ao atualizar Consultas: ${(e as Error).message}`),
  });

  // KPI Resgate "Atualizar agora": dispara o backfill da Kommo sob demanda (sem
  // esperar o job 24h). Invalida queries do dashboard pra ver o número novo.
  const resgateBackfill = useMutation({
    mutationFn: () => unitsService.runResgateBackfill(unitId!),
    onSuccess: (r) => {
      if (r.error) toast.error(`Falha ao atualizar: ${r.error}`);
      else toast.success(`Resgate atualizado: +${r.inserted} novas tentativas (de ${r.scanned} eventos).`);
      qc.invalidateQueries({ queryKey: ["dash-amo"] });
      qc.invalidateQueries({ queryKey: ["kpi-config"] });
    },
    onError: (e) => toast.error(`Falha ao atualizar Resgate: ${(e as Error).message}`),
  });

  // Cross-analysis dos custom fields — usado pra pizza de Qualificação dos leads.
  const crossAnalysis = useQuery({
    queryKey: ["dash-amo", "cross-analysis", unitId, range.from, range.to],
    queryFn: () =>
      kpiConfigService.customFieldsCrossAnalysis(unitId, {
        date_from: range.from,
        date_to: range.to,
      }),
    enabled: unitId != null,
    staleTime: 60_000,
  });

  // Breakdowns por KPI — renderizados inline em cada card do dashboard.
  const kpiBreakdowns = useQuery({
    queryKey: ["dash-amo", "kpi-breakdowns", unitId, range.from, range.to],
    queryFn: () =>
      kpiConfigService.kpiBreakdowns(unitId, {
        date_from: range.from,
        date_to: range.to,
      }),
    enabled: unitId != null,
    staleTime: 60_000,
  });
  const bd = kpiBreakdowns.data;
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
      responsibleFilter,
    ],
    queryFn: () =>
      webhooksService.dashboardOverview({
        clinicId: tenantId ?? undefined,
        unitId: unitId ?? undefined,
        dateFrom: range.from,
        dateTo: range.to,
        source: sourceFilter || undefined,
        attendantId: attendantFilter ? Number(attendantFilter) : undefined,
        responsibleUser: responsibleFilter || undefined,
      }),
    enabled: tenantId != null,
    staleTime: 60_000,
  });

  const ov = overview.data;

  // Ao trocar de unidade, o usuário selecionado pode não pertencer à nova unidade.
  // Limpa os filtros pra não mostrar números de alguém que sumiu da lista.
  useEffect(() => {
    setResponsibleFilter("");
    setAttendantFilter("");
    setUserMenuOpen(false);
  }, [unitId]);

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
    setCustomFromTime("");
    setCustomToTime("");
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

  const channelsTotal = useMemo(
    () => channels.reduce((s, c) => s + c.value, 0),
    [channels],
  );

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

  // Pizza Qualificação dos Leads — Quente/Morno/Frio (custom field).
  const QUALIF_COLORS: Record<string, string> = {
    quente: "#f87171",
    morno: "#fbbf24",
    frio: "#60a5fa",
  };
  const qualificacaoData = useMemo(() => {
    const rows = crossAnalysis.data?.qualificacao ?? [];
    return rows
      .filter((r) => (r.count ?? 0) > 0)
      .map((r, i) => {
        const k = (r.value || "").toLowerCase();
        const matched = Object.keys(QUALIF_COLORS).find((key) => k.includes(key));
        const fallback = ["#a78bfa", "#22d3ee", "#34d399", "#f472b6"][i % 4];
        return {
          name: r.value || "—",
          value: r.count ?? 0,
          color: matched ? QUALIF_COLORS[matched] : fallback,
        };
      });
  }, [crossAnalysis.data]);
  const qualificacaoTotal = qualificacaoData.reduce((s, d) => s + d.value, 0);

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
                  setCustomFromTime("");
                  setCustomToTime("");
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
            <div className="relative">
              <button
                type="button"
                onClick={() => setDateMenuOpen((o) => !o)}
                title="Clique para escolher as datas"
                className="flex items-center gap-1.5 rounded-full bg-white px-4 py-1.5 text-xs font-semibold text-slate-900 hover:bg-white/90"
              >
                <Fi name="fi-rr-calendar" />
                {isCustom ? `Personalizado: ${rangeLabel}` : rangeLabel}
              </button>
              {dateMenuOpen && createPortal(
                <div
                  className="fixed inset-0 z-[1000] flex items-start justify-center overflow-y-auto bg-black/60 p-4 pt-16"
                  onClick={() => setDateMenuOpen(false)}
                >
                  <div
                    className="w-full max-w-[640px] rounded-2xl bg-white p-4 text-slate-900 shadow-2xl sm:p-5"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <div className="mb-3 flex items-center justify-between">
                      <p className="text-[13px] font-semibold text-slate-900">Escolher período</p>
                      <button
                        type="button"
                        onClick={() => setDateMenuOpen(false)}
                        className="rounded-md px-1.5 text-[18px] leading-none text-slate-400 hover:text-slate-700"
                        aria-label="Fechar"
                      >
                        ×
                      </button>
                    </div>

                    <div className="flex flex-col gap-4 sm:flex-row">
                      {/* Atalhos */}
                      <div className="flex shrink-0 flex-row flex-wrap gap-1.5 sm:w-40 sm:flex-col">
                        {DATE_PRESETS.map((p) => (
                          <button
                            key={p.key}
                            type="button"
                            onClick={() => {
                              const r = p.range();
                              setCustomFrom(dateToInput(r.from));
                              setCustomTo(dateToInput(r.to));
                            }}
                            className="rounded-lg border border-slate-200 px-3 py-1.5 text-left text-[12px] font-medium text-slate-700 hover:border-violet-300 hover:bg-violet-50"
                          >
                            {p.label}
                          </button>
                        ))}
                      </div>

                      {/* Calendário real (range) */}
                      <div className="flex-1">
                        <DayPicker
                          mode="range"
                          locale={ptBR}
                          numberOfMonths={1}
                          defaultMonth={customFrom ? inputToDate(customFrom) : range.fromDate}
                          disabled={{ after: new Date() }}
                          selected={{
                            from: customFrom ? inputToDate(customFrom) : range.fromDate,
                            to: customTo ? inputToDate(customTo) : range.toDate,
                          } as DateRange}
                          onSelect={(r) => {
                            if (r?.from) setCustomFrom(dateToInput(r.from));
                            if (r?.from) setCustomTo(dateToInput(r.to ?? r.from));
                          }}
                          styles={{ root: { margin: 0 } }}
                          classNames={{
                            today: "font-bold text-violet-600",
                            selected: "!bg-violet-500 !text-white",
                            range_start: "!bg-violet-600 !text-white rounded-l-full",
                            range_end: "!bg-violet-600 !text-white rounded-r-full",
                            range_middle: "!bg-violet-100 !text-violet-900",
                          }}
                        />
                      </div>
                    </div>

                    <div className="mt-3 flex items-center justify-between border-t border-slate-100 pt-3">
                      <span className="text-[12px] text-slate-500">
                        {isCustom ? rangeLabel : `Atual: ${rangeLabel}`}
                      </span>
                      <div className="flex gap-2">
                        {isCustom && (
                          <button
                            type="button"
                            onClick={() => {
                              setCustomFrom("");
                              setCustomTo("");
                              setCustomFromTime("");
                              setCustomToTime("");
                            }}
                            className="rounded-lg border border-slate-200 px-3 py-1.5 text-[12px] font-medium text-slate-600 hover:bg-slate-50"
                          >
                            Limpar
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => setDateMenuOpen(false)}
                          className="rounded-lg bg-violet-600 px-4 py-1.5 text-[12px] font-semibold text-white hover:bg-violet-500"
                        >
                          Aplicar
                        </button>
                      </div>
                    </div>
                  </div>
                </div>,
                document.body,
              )}
            </div>
          </div>

          {/* All / Select user / Setup */}
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1 rounded-full border border-white/15 bg-white/5 p-1">
              <button
                type="button"
                onClick={() => {
                  setResponsibleFilter("");
                  setUserMenuOpen(false);
                }}
                className={`rounded-full px-4 py-1.5 text-xs font-semibold transition ${
                  responsibleFilter === ""
                    ? "bg-white text-slate-900"
                    : "text-white/70 hover:text-white"
                }`}
              >
                Todos
              </button>
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setUserMenuOpen((v) => !v)}
                  className={`flex items-center gap-1 rounded-full px-3 py-1.5 text-xs transition ${
                    responsibleFilter !== ""
                      ? "bg-white font-semibold text-slate-900"
                      : "text-white/70 hover:text-white"
                  }`}
                >
                  {responsibleFilter || "Selecionar usuário"}
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
                {userMenuOpen && (
                  <>
                    <button
                      type="button"
                      aria-hidden
                      tabIndex={-1}
                      onClick={() => setUserMenuOpen(false)}
                      className="fixed inset-0 z-10 cursor-default"
                    />
                    <div className="absolute right-0 z-20 mt-2 max-h-72 w-64 overflow-auto rounded-xl border border-white/10 bg-slate-900 p-1 shadow-xl">
                      {responsibleUsers.isLoading ? (
                        <p className="px-3 py-2 text-[11px] text-white/50">Carregando…</p>
                      ) : (responsibleUsers.data ?? []).length === 0 ? (
                        <p className="px-3 py-2 text-[11px] text-white/50">
                          Nenhum usuário responsável encontrado{unitId == null ? "" : " nesta unidade"}.
                        </p>
                      ) : (
                        (responsibleUsers.data ?? []).map((name) => (
                          <button
                            key={name}
                            type="button"
                            onClick={() => {
                              setResponsibleFilter(name);
                              setUserMenuOpen(false);
                            }}
                            className={`flex w-full items-center justify-between gap-2 rounded-lg px-3 py-2 text-left text-xs transition hover:bg-white/10 ${
                              name === responsibleFilter
                                ? "bg-white/10 text-white"
                                : "text-white/80"
                            }`}
                          >
                            <span className="truncate">{name}</span>
                            {name === responsibleFilter && (
                              <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                                <path
                                  d="M2.5 6.5L5 9L9.5 3.5"
                                  stroke="currentColor"
                                  strokeWidth="1.5"
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                />
                              </svg>
                            )}
                          </button>
                        ))
                      )}
                    </div>
                  </>
                )}
              </div>
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
                {/* Horas opcionais — sem preencher, usa o corte comercial (19h às 19h). */}
                <div className="mt-1.5 flex items-center gap-1.5">
                  <input
                    type="time"
                    value={customFromTime}
                    onChange={(e) => setCustomFromTime(e.target.value)}
                    title="Hora de início (opcional)"
                    className="w-full rounded-lg border border-white/10 bg-white/5 px-2 py-2 text-xs text-white outline-none focus:border-violet-400/50"
                  />
                  <span className="text-white/40">–</span>
                  <input
                    type="time"
                    value={customToTime}
                    onChange={(e) => setCustomToTime(e.target.value)}
                    title="Hora de fim (opcional)"
                    className="w-full rounded-lg border border-white/10 bg-white/5 px-2 py-2 text-xs text-white outline-none focus:border-violet-400/50"
                  />
                </div>
                <p className="mt-1 text-[10px] text-white/40">
                  Hora opcional. Vazio = corte comercial (19h–19h).
                </p>
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
                  okey={kpiKey(unitId, "total_leads", range.from, range.to)}
                  live={kpiLive("total_leads", funnelLeads.total)}
                  valueClass="text-6xl text-emerald-400"
                  align="right"
                  format={nf}
                  onDrill={() => setDrill({ kpiKey: "total_leads", label: "Total de Leads" })}
                />
                {/* Quebra ativos vs deletados — pra SDR entender quantos sumiram do funil
                    sem precisar bater com a Kommo manualmente. Total do card = só ativos. */}
                <div className="mt-3 flex flex-wrap items-center gap-2 text-[10.5px]">
                  <span className="inline-flex items-center gap-1 rounded-full bg-emerald-400/[0.12] px-2 py-0.5 text-emerald-200 ring-1 ring-inset ring-emerald-400/20">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                    Ativos {nf(funnelLeads.total)}
                  </span>
                  {(ov?.total_leads_deleted ?? 0) > 0 && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-red-400/[0.10] px-2 py-0.5 text-red-200/90 ring-1 ring-inset ring-red-400/20" title="Leads que estavam no funil mas foram deletados na Kommo durante o período">
                      <span className="h-1.5 w-1.5 rounded-full bg-red-400" />
                      Deletados {nf(ov?.total_leads_deleted ?? 0)}
                    </span>
                  )}
                </div>
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
                <EditableKpiValue okey={kpiKey(unitId, "cadastro", range.from, range.to)} live={kpiLive("cadastro", funnelCadastro.total)} valueClass="text-violet-400" format={nf} onDrill={() => setDrill({ kpiKey: "cadastro", label: "Cadastro" })} />
                <div className="mt-3">
                  <KpiBreakdownHeading>Por origem · motivo de não agendamento</KpiBreakdownHeading>
                  {(bd?.cadastro.origens?.length ?? 0) > 0 ? (
                    <ul className="mt-1.5 space-y-1">
                      {bd!.cadastro.origens.slice(0, 4).map((o) => (
                        <li key={o.origem} className="text-[11px]">
                          <div className="flex items-center justify-between gap-2">
                            <span className="truncate font-medium text-white/85">{o.origem}</span>
                            <span className="shrink-0 tabular-nums text-white/70">{nf(o.count)}</span>
                          </div>
                          {o.top_motivo ? (
                            <p className="truncate text-[10px] text-amber-200/80">
                              Sem agendar: {o.top_motivo} ({o.top_motivo_count})
                            </p>
                          ) : (
                            <p className="truncate text-[10px] italic text-white/30">
                              sem motivo registrado
                            </p>
                          )}
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <div className="mt-1 text-[10px] italic text-white/30">sem dados</div>
                  )}
                </div>
                <div className="mt-4 h-px w-1/3 bg-white/10" />
                <p className="mt-3 text-[11px] text-white/40">{rangeLabel}</p>
                {srcBtn("cadastro", "Cadastro")}
              </DarkCard>

              {/* Col 3 row 1: Resgate */}
              <DarkCard accent="#fbbf24">
                <div className="flex items-start justify-between gap-2">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-white/60">Resgate</p>
                  <button
                    type="button"
                    onClick={() => resgateBackfill.mutate()}
                    disabled={resgateBackfill.isPending || unitId == null}
                    title="Buscar tentativas de resgate da Kommo agora (sem esperar o sync de 24h)"
                    className="inline-flex items-center gap-1 rounded-full bg-amber-400/10 px-2 py-0.5 text-[10px] font-medium text-amber-300 ring-1 ring-inset ring-amber-400/20 transition hover:bg-amber-400/20 disabled:opacity-50"
                  >
                    {resgateBackfill.isPending ? (
                      <Loader2 className="h-3 w-3 animate-spin" />
                    ) : (
                      <RefreshCw className="h-3 w-3" />
                    )}
                    Atualizar
                  </button>
                </div>
                <EditableKpiValue okey={kpiKey(unitId, "resgate", range.from, range.to)} live={kpiLive("resgate", funnelResgate.total)} valueClass="text-amber-400" format={nf} onDrill={() => setDrill({ kpiKey: "resgate", label: "Resgate" })} />
                <KpiBreakdownHeading>Tipo</KpiBreakdownHeading>
                <KpiChips items={(bd?.resgate.tipos ?? []).map((t) => ({ label: t.value, count: t.count }))} />
                <KpiBreakdownHeading>Origem</KpiBreakdownHeading>
                <KpiChips items={(bd?.resgate.origens ?? []).map((o) => ({ label: o.value, count: o.count }))} />
                <div className="mt-4 h-px w-1/3 bg-white/10" />
                <p className="mt-3 text-[11px] text-white/40">{rangeLabel}</p>
                {srcBtn("resgate", "Resgate")}
              </DarkCard>

              {/* Col 4 (tall): Origens de Leads — DonutChart */}
              <DarkCard className="lg:row-span-2" accent="#22d3ee">
                <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-white/60">
                  Origens de Leads
                </p>

                {channels.length === 0 ? (
                  <p className="mt-6 text-[12px] text-white/40">Sem dados de origem no período.</p>
                ) : (
                  <div className="mt-5 flex flex-col items-center gap-5">
                    <DonutChart data={channels} size={172} thickness={24} />

                    <ul className="w-full space-y-2 text-[11px]">
                      {channels.map((c) => {
                        const pct = channelsTotal > 0 ? Math.round((c.value / channelsTotal) * 100) : 0;
                        return (
                          <li key={c.name} className="flex items-center gap-2.5">
                            {c.iconUrl ? (
                              <span className="grid h-6 w-6 shrink-0 place-items-center overflow-hidden rounded-md bg-white p-0.5">
                                <img src={c.iconUrl} alt="" className="h-full w-full object-contain" />
                              </span>
                            ) : (
                              <span className="grid h-6 w-6 shrink-0 place-items-center">
                                <span className="h-2.5 w-2.5 rounded-full" style={{ background: c.color }} />
                              </span>
                            )}
                            <span
                              className="flex-1 truncate text-[11px] font-medium uppercase tracking-wide"
                              style={{ color: c.color }}
                            >
                              {c.name}
                            </span>
                            <span className="shrink-0 tabular-nums text-white/75">{nf(c.value)}</span>
                            <span className="w-9 shrink-0 text-right tabular-nums text-white/40">{pct}%</span>
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                )}
              </DarkCard>

              {/* Col 2 row 2: Agendados */}
              <DarkCard accent="#60a5fa">
                <div className="flex items-start justify-between gap-2">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-white/60">Agendados</p>
                  <button
                    type="button"
                    onClick={() => agendadosBackfill.mutate()}
                    disabled={agendadosBackfill.isPending || unitId == null}
                    title="Buscar mudanças de etapa da Kommo agora (sem esperar o sync de 24h)"
                    className="inline-flex items-center gap-1 rounded-full bg-sky-400/10 px-2 py-0.5 text-[10px] font-medium text-sky-300 ring-1 ring-inset ring-sky-400/20 transition hover:bg-sky-400/20 disabled:opacity-50"
                  >
                    {agendadosBackfill.isPending ? (
                      <Loader2 className="h-3 w-3 animate-spin" />
                    ) : (
                      <RefreshCw className="h-3 w-3" />
                    )}
                    Atualizar
                  </button>
                </div>
                <EditableKpiValue okey={kpiKey(unitId, "agendados", range.from, range.to)} live={kpiLive("agendados", funnelLeads.agendados)} valueClass="text-sky-400" format={nf} onDrill={() => setDrill({ kpiKey: "agendados", label: "Agendados" })} />
                <KpiBreakdownHeading>Tipo</KpiBreakdownHeading>
                <KpiChips
                  items={[
                    { label: "Cadastro", count: bd?.agendados.cadastro ?? 0 },
                    { label: "Resgate", count: bd?.agendados.resgate ?? 0 },
                  ].filter((c) => c.count > 0)}
                />
                <KpiBreakdownHeading>Pagamento antecipado</KpiBreakdownHeading>
                <KpiChips
                  items={[
                    { label: "Sim", count: bd?.agendados.com_pagamento ?? 0, tone: "ok" as const },
                    { label: "Não", count: bd?.agendados.sem_pagamento ?? 0, tone: "warn" as const },
                  ].filter((c) => c.count > 0)}
                />
                <KpiBreakdownHeading>Origem</KpiBreakdownHeading>
                <KpiChips items={(bd?.agendados.origens ?? []).map((o) => ({ label: o.value, count: o.count }))} />
                {(bd?.agendados.tipos_agendamento?.length ?? 0) > 0 && (
                  <>
                    <KpiBreakdownHeading>Tipo de agendamento</KpiBreakdownHeading>
                    <KpiChips items={(bd?.agendados.tipos_agendamento ?? []).map((t) => ({ label: t.value, count: t.count }))} />
                  </>
                )}
                <div className="mt-4 h-px w-1/3 bg-white/10" />
                <p className="mt-3 text-[11px] text-white/40">{rangeLabel}</p>
                {srcBtn("agendados", "Agendados")}
              </DarkCard>

              {/* Col 3 row 2: No-show */}
              <DarkCard accent="#f87171">
                <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-white/60">No-show</p>
                <EditableKpiValue okey={kpiKey(unitId, "no_show", range.from, range.to)} live={kpiLive("no_show", funnelLeads.no_show)} valueClass="text-red-400" format={nf} onDrill={() => setDrill({ kpiKey: "no_show", label: "No-show" })} />
                <div className="mt-4 h-px w-1/3 bg-white/10" />
                <p className="mt-3 text-[11px] text-white/40">{rangeLabel}</p>
                {srcBtn("no_show", "No-show")}
              </DarkCard>
            </div>

            {/* ─── 3 cards estilo WON / ACTIVE / TASKS ───────────────── */}
            <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <DarkCard accent="#34d399">
                <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-white/60">Tratamentos</p>
                <EditableKpiValue okey={kpiKey(unitId, "tratamentos", range.from, range.to)} live={kpiLive("tratamentos", funnelLeads.tratamentos)} valueClass="text-emerald-400" format={nf} onDrill={() => setDrill({ kpiKey: "tratamentos", label: "Tratamentos" })} />
                <KpiBreakdownHeading>Origem</KpiBreakdownHeading>
                <KpiChips items={(bd?.tratamentos.origens ?? []).map((o) => ({ label: o.value, count: o.count }))} />
                <KpiBreakdownHeading>Fechou (fisio)</KpiBreakdownHeading>
                <KpiChips items={(bd?.tratamentos.fisios ?? []).map((f) => ({ label: f.value, count: f.count, tone: "ok" as const }))} />
                {(bd?.tratamentos.tipos_tratamento?.length ?? 0) > 0 && (
                  <>
                    <KpiBreakdownHeading>Tipo de tratamento</KpiBreakdownHeading>
                    <KpiChips items={(bd?.tratamentos.tipos_tratamento ?? []).map((t) => ({ label: t.value, count: t.count }))} />
                  </>
                )}
                <KpiBreakdownHeading>Valor</KpiBreakdownHeading>
                <div className="mt-1.5 flex flex-wrap gap-1.5 text-[11px]">
                  <span className="rounded-full bg-emerald-400/[0.12] px-2 py-0.5 text-emerald-200 ring-1 ring-inset ring-emerald-400/20">
                    Consulta: {moneyBR(bd?.tratamentos.valor_consulta_total ?? 0)}
                  </span>
                  <span className="rounded-full bg-emerald-400/[0.12] px-2 py-0.5 text-emerald-200 ring-1 ring-inset ring-emerald-400/20">
                    Tratamento: {moneyBR(bd?.tratamentos.valor_tratamento_total ?? 0)}
                  </span>
                </div>
                <div className="mt-4 h-px w-1/3 bg-white/10" />
                <p className="mt-3 text-[11px] text-white/40">{rangeLabel}</p>
                {srcBtn("tratamentos", "Tratamentos")}
              </DarkCard>
              <DarkCard accent="#60a5fa">
                <div className="flex items-start justify-between gap-2">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-white/60">Consultas</p>
                  <button
                    type="button"
                    onClick={() => consultasBackfill.mutate()}
                    disabled={consultasBackfill.isPending || unitId == null}
                    title="Aplica os campos 'Data de agendamento' e 'Valor da consulta' nos leads existentes (sem chamar a Kommo)"
                    className="inline-flex items-center gap-1 rounded-full bg-sky-400/10 px-2 py-0.5 text-[10px] font-medium text-sky-300 ring-1 ring-inset ring-sky-400/20 transition hover:bg-sky-400/20 disabled:opacity-50"
                  >
                    {consultasBackfill.isPending ? (
                      <Loader2 className="h-3 w-3 animate-spin" />
                    ) : (
                      <RefreshCw className="h-3 w-3" />
                    )}
                    Atualizar
                  </button>
                </div>
                <EditableKpiValue okey={kpiKey(unitId, "consultas", range.from, range.to)} live={kpiLive("consultas", funnelLeads.consultas)} valueClass="text-sky-400" format={nf} onDrill={() => setDrill({ kpiKey: "consultas", label: "Consultas" })} />
                <KpiBreakdownHeading>Tipo</KpiBreakdownHeading>
                <KpiChips
                  items={[
                    { label: "Cadastro", count: bd?.consultas.cadastro ?? 0 },
                    { label: "Resgate", count: bd?.consultas.resgate ?? 0 },
                  ].filter((c) => c.count > 0)}
                />
                <KpiBreakdownHeading>Valor total</KpiBreakdownHeading>
                <div className="mt-1.5">
                  <span className="rounded-full bg-emerald-400/[0.12] px-2 py-0.5 text-[11px] text-emerald-200 ring-1 ring-inset ring-emerald-400/20">
                    {moneyBR(bd?.consultas.valor_total ?? 0)}
                  </span>
                </div>
                <KpiBreakdownHeading>Próximos agendamentos</KpiBreakdownHeading>
                {(bd?.consultas.agendamentos.length ?? 0) > 0 ? (
                  <ul className="mt-1.5 space-y-0.5 text-[10.5px]">
                    {bd!.consultas.agendamentos.slice(0, 5).map((a, i) => (
                      <li key={`${a.name}-${i}`} className="flex items-center justify-between gap-2">
                        <span className="truncate text-white/80">{a.name || "—"}</span>
                        <span className="shrink-0 tabular-nums text-white/55">{dateHourBR(a.when)}</span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <div className="mt-1 text-[10px] italic text-white/30">sem dados</div>
                )}
                <div className="mt-4 h-px w-1/3 bg-white/10" />
                <p className="mt-3 text-[11px] text-white/40">{rangeLabel}</p>
                {srcBtn("consultas", "Consultas")}
              </DarkCard>
              <DarkCard accent="#f472b6">
                <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-white/60">
                  Qualificação dos Leads
                </p>
                {qualificacaoData.length === 0 ? (
                  <p className="mt-6 text-[12px] text-white/40">
                    {crossAnalysis.isLoading ? "carregando…" : "Sem dados de qualificação no período."}
                  </p>
                ) : (
                  <div className="mt-4 flex items-center gap-4">
                    <DonutChart data={qualificacaoData} size={132} thickness={20} />
                    <ul className="flex-1 space-y-1.5 text-[11px]">
                      {qualificacaoData.map((d) => {
                        const pct = qualificacaoTotal > 0 ? Math.round((d.value / qualificacaoTotal) * 100) : 0;
                        return (
                          <li key={d.name} className="flex items-center gap-2">
                            <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: d.color }} />
                            <span className="flex-1 truncate font-medium uppercase tracking-wide text-white/80">{d.name}</span>
                            <span className="shrink-0 tabular-nums text-white/70">{nf(d.value)}</span>
                            <span className="w-9 shrink-0 text-right tabular-nums text-white/40">{pct}%</span>
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                )}
                <p className="mt-3 text-[11px] text-white/40">{rangeLabel}</p>
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
                            okey={kpiKey(unitId, k.key, range.from, range.to)}
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
