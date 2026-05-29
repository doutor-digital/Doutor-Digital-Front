import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
} from "recharts";
import {
  cn,
  formatCurrency,
  formatNumber,
  formatPercent,
  truncate,
  formatDate,
} from "@/lib/utils";
import {
  aggregateReviews,
  listAllReviews,
  type ReviewAggregates,
} from "@/lib/leadReviewStore";
import { Button } from "@/components/ui/Button";
import { webhooksService } from "@/services/webhooks";
import { contactsService } from "@/services/contacts";
import { unitsService } from "@/services/units";
import { assignmentsService } from "@/services/assignments";
import { useClinic } from "@/hooks/useClinic";
import { useAuth } from "@/hooks/useAuth";
import {
  DashboardFilters,
  DashboardFiltersState,
  defaultFilters,
} from "@/components/filters/DashboardFilters";
import { SnapshotButton } from "@/components/global/SnapshotButton";
import {
  AlertCircle,
  AlertTriangle,
  Calendar,
  CalendarCheck,
  CheckCircle2,
  ClipboardList,
  Clock,
  CloudDownload,
  CreditCard,
  Headset,
  Info,
  MessageCircle,
  Percent,
  Phone as PhoneIcon,
  Target,
  TrendingUp,
  UserCog,
  UserPlus,
  Wallet,
  Webhook,
} from "@/components/icons";

/* ============================================================
 * Helpers
 * ========================================================== */

function greeting(): string {
  const h = new Date().getHours();
  if (h < 12) return "Bom dia";
  if (h < 18) return "Boa tarde";
  return "Boa noite";
}

function todayLabel(): string {
  return new Date().toLocaleDateString("pt-BR", {
    weekday: "long",
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
}

/* ============================================================
 * Page
 * ========================================================== */

export default function DashboardPage() {
  const { tenantId, unitId } = useClinic();
  const { user } = useAuth();
  const fullName =
    user?.name?.trim() || user?.email?.split("@")[0] || "Doutor";
  const firstName = fullName.split(" ")[0];

  const [filters, setFilters] = useState<DashboardFiltersState>(() => ({
    ...defaultFilters(),
    unitId: unitId ? Number(unitId) : null,
  }));

  // Se o usuário trocar a unidade pelo seletor global (useClinic), sincroniza.
  useEffect(() => {
    setFilters((prev) =>
      prev.unitId === (unitId ? Number(unitId) : null)
        ? prev
        : { ...prev, unitId: unitId ? Number(unitId) : null },
    );
  }, [unitId]);

  // Agregados das revisões locais (persistidas via localStorage no LeadReviewPage).
  // Reage ao evento "lead-review:saved" pra refletir mudanças sem precisar de F5.
  const [reviewAgg, setReviewAgg] = useState<ReviewAggregates>(() =>
    aggregateReviews(listAllReviews()),
  );
  useEffect(() => {
    const handler = () => setReviewAgg(aggregateReviews(listAllReviews()));
    window.addEventListener("lead-review:saved", handler);
    return () => window.removeEventListener("lead-review:saved", handler);
  }, []);

  /* ----- Listas para os selects de filtro ----- */
  const unitsList = useQuery({
    queryKey: ["units", tenantId],
    queryFn: () => unitsService.list(),
    enabled: !!tenantId,
    staleTime: 60_000,
  });

  const attendantsList = useQuery({
    queryKey: ["attendants"],
    queryFn: () => assignmentsService.listAttendants(),
    staleTime: 60_000,
  });

  const sourcesList = useQuery({
    queryKey: ["sources", tenantId, filters.unitId],
    queryFn: () =>
      webhooksService.distinctSources({
        clinicId: tenantId ?? undefined,
        unitId: filters.unitId ?? undefined,
      }),
    enabled: !!tenantId,
    staleTime: 60_000,
  });

  /* ----- Queries ----- */
  const overviewClinicId = tenantId ?? unitId ?? undefined;
  const filterUnitId = filters.unitId ?? undefined;
  const filterAttendantId = filters.attendantId ?? undefined;
  const filterSource = filters.source ?? undefined;

  const overview = useQuery({
    queryKey: [
      "dashboard-overview",
      overviewClinicId,
      filterUnitId,
      filterAttendantId,
      filterSource,
      filters.startDate,
      filters.endDate,
    ],
    queryFn: () =>
      webhooksService.dashboardOverview({
        clinicId: overviewClinicId,
        dateFrom: filters.startDate,
        dateTo: filters.endDate,
        unitId: filterUnitId,
        attendantId: filterAttendantId,
        source: filterSource,
      }),
    enabled: !!overviewClinicId,
    placeholderData: (prev) => prev,
  });

  const evolucaoClinicId = tenantId ?? unitId ?? undefined;
  const evolucao = useQuery({
    queryKey: [
      "evolution-range",
      evolucaoClinicId,
      filterUnitId,
      filterAttendantId,
      filterSource,
      filters.startDate,
      filters.endDate,
      filters.granularity,
      filters.compare,
    ],
    queryFn: () =>
      webhooksService.evolutionRange({
        clinicId: evolucaoClinicId,
        dateFrom: filters.startDate,
        dateTo: filters.endDate,
        groupBy: filters.granularity,
        compare: filters.compare,
        unitId: filterUnitId,
        attendantId: filterAttendantId,
        source: filterSource,
      }),
    enabled: !!evolucaoClinicId,
  });

  const ativos = useQuery({
    queryKey: ["active", unitId],
    queryFn: () =>
      webhooksService.activeLeads({ limit: 10, unitId: unitId || undefined }),
  });

  const contatosCounts = useQuery({
    queryKey: ["contacts", "counts", tenantId],
    queryFn: () =>
      contactsService.list({
        clinicId: tenantId ?? undefined,
        pageSize: 1,
        origem: "all",
      }),
    enabled: tenantId !== null,
  });

  /* ----- Derived ----- */
  const ov = overview.data;
  const overviewLoading = overview.isLoading;
  const total = ov?.total_leads ?? 0;
  const consultasNum = ov?.consultas ?? 0;
  const inService = ov?.states?.service ?? 0;
  const inQueue = ov?.states?.queue ?? 0;
  const conversao = ov?.conversao_rate ?? 0;

  const consultasAgendadas = ov?.consultas_agendadas ?? 0;
  const compareceuCount = ov?.compareceu ?? 0;
  const faltouCount = ov?.faltou ?? 0;
  const naoFechouCount = ov?.nao_fechou ?? 0;
  const fechouCount = ov?.fechou ?? 0;
  const comparecimentoRate = ov?.comparecimento_rate ?? 0;
  const fechamentoRate = ov?.fechamento_rate ?? 0;
  const webhookCount = contatosCounts.data?.counts.webhook_cloudia ?? 0;
  const importedCount = contatosCounts.data?.counts.import_csv ?? 0;

  // Sparkline data: usa a série de evolução real quando disponível.
  const evoSeries = useMemo(
    () =>
      (evolucao.data?.current ?? []).map((p) => ({
        label: p.label,
        v: p.count,
      })),
    [evolucao.data],
  );

  // Série de comparação (período anterior / mesmo período/ano), quando ativada.
  const evoComparisonSeries = useMemo(() => {
    const cmp = evolucao.data?.comparison;
    if (!cmp || cmp.length === 0) return undefined;
    // Alinha pelos buckets da série atual usando o índice — assim os pontos
    // ficam lado a lado mesmo que as datas sejam diferentes.
    return cmp.map((p, i) => ({
      label: p.label,
      compareV: p.count,
      currentLabel: evolucao.data?.current?.[i]?.label,
    }));
  }, [evolucao.data]);

  // Série combinada para plotar atual + comparação no mesmo gráfico.
  const evoCombinedSeries = useMemo(() => {
    if (!evoComparisonSeries) return evoSeries.map((p) => ({ ...p, compareV: undefined as number | undefined }));
    const len = Math.max(evoSeries.length, evoComparisonSeries.length);
    return Array.from({ length: len }, (_, i) => ({
      label: evoSeries[i]?.label ?? evoComparisonSeries[i]?.label ?? "",
      v: evoSeries[i]?.v ?? 0,
      compareV: evoComparisonSeries[i]?.compareV,
    }));
  }, [evoSeries, evoComparisonSeries]);

  // Para os outros KPIs (em atendimento / fila / conversão), criamos uma
  // série derivada mantendo o "shape" da curva de leads — substitua aqui
  // quando você expor histórico por métrica no backend.
  const evoServiceSeries = useMemo(
    () => evoSeries.map((p) => ({ ...p, v: Math.round(p.v * 0.62) })),
    [evoSeries],
  );
  const evoQueueSeries = useMemo(
    () => evoSeries.map((p) => ({ ...p, v: Math.max(0, Math.round(p.v * 0.02)) })),
    [evoSeries],
  );
  const evoConvSeries = useMemo(
    () =>
      evoSeries.map((p, i) => ({
        ...p,
        v: 3.8 + (i / Math.max(1, evoSeries.length - 1)) * 0.9,
      })),
    [evoSeries],
  );

  const change = evolucao.data?.change_percent ?? null;
  const changeUp = (change ?? 0) >= 0;

  function handleSearch() {
    overview.refetch();
    evolucao.refetch();
  }

  /* ----- Activity feed (real data + ícone por estado) ----- */
  const activityItems: ActivityItem[] = (ativos.data ?? [])
    .slice(0, 5)
    .map((l) => {
      const state = (l.conversationState ?? "").toUpperCase();
      let kind: ActivityKind = "lead";
      if (state.includes("AGEND")) kind = "scheduled";
      else if (state.includes("CONVERT") || state.includes("FECH")) kind = "converted";
      else if (state.includes("LIG")) kind = "call";
      else if (state.includes("FORM")) kind = "form";
      return {
        id: String(l.id),
        kind,
        title: titleFor(kind, l.name ?? "Sem nome"),
        subtitle: l.phone ?? (state.replace(/_/g, " ") || "—"),
        time: formatDate(l.updatedAt ?? l.createdAt),
      };
    });

  /* ----- Alerts (computados a partir dos dados reais) ----- */
  const alerts: AlertItem[] = [];
  if (inQueue > 0) {
    alerts.push({
      id: "queue",
      severity: "danger",
      title: `Fila de espera com ${inQueue} lead${inQueue === 1 ? "" : "s"}`,
      detail: "Atenda em até 15 min para não perder oportunidades",
      time: "agora",
    });
  }
  // Meta mínima (40 consultas) e ideal (50 consultas) — substitua pelos seus valores reais
  const metaMinima = 40;
  const metaIdeal = 50;
  const faltamMin = Math.max(0, metaMinima - consultasNum);
  const faltamIdeal = Math.max(0, metaIdeal - consultasNum);
  if (faltamMin > 0) {
    alerts.push({
      id: "meta-min",
      severity: "warn",
      title: "Meta mínima em risco",
      detail: `Faltam ${faltamMin} consultas para atingir 90% da meta mínima`,
      time: "agora",
    });
  }
  if (faltamIdeal > 0) {
    alerts.push({
      id: "meta-ideal",
      severity: "violet",
      title: "Meta ideal distante",
      detail: `Faltam ${faltamIdeal} consultas para atingir a meta ideal`,
      time: "1 h atrás",
    });
  }

  /* ============================================================
   * Render
   * ========================================================== */

  return (
    <div className="space-y-5">
      {/* ---- Cabeçalho: greeting + período ---- */}
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div>
          <h1 className="text-[26px] font-bold leading-tight tracking-tight text-slate-50">
            {greeting()}, {firstName}{" "}
            <span className="inline-block">👋</span>
          </h1>
          <p className="mt-1 text-[12.5px] capitalize text-slate-400">
            {todayLabel()}
          </p>
          <p className="mt-1 text-[12.5px] text-slate-500">
            {unitId
              ? `Acompanhe o desempenho da unidade em tempo real · unitId: ${unitId}`
              : "Acompanhe o desempenho da unidade em tempo real"}
          </p>
        </div>

        <div className="flex items-center gap-2 self-start">
          <SnapshotButton />
          <Link to="/live">
            <Button variant="outline" size="sm" className="gap-2">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-rose-400 opacity-75" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-rose-500" />
              </span>
              Ao vivo
            </Button>
          </Link>
          <Link to="/reports">
            <Button size="sm" className="gap-2">
              <CalendarCheck className="h-4 w-4" /> Relatório
            </Button>
          </Link>
        </div>
      </div>

      {/* ---- Filtros ---- */}
      <DashboardFilters
        value={filters}
        onChange={setFilters}
        onSearch={handleSearch}
        units={(unitsList.data ?? []).map((u) => ({
          id: u.id,
          label: u.name || `Unidade ${u.id}`,
        }))}
        attendants={(attendantsList.data ?? []).map((a) => ({
          id: a.id,
          label: a.name || a.email || `Atendente ${a.id}`,
        }))}
        sources={sourcesList.data ?? []}
      />

      {/* ════════════ HERO estilo Kommo — donuts + cards de dados ════════════ */}
      <div className="grid grid-cols-1 gap-3 xl:grid-cols-[1fr_minmax(210px,250px)]">
        {/* 3 donuts (rings) com gradiente da marca */}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <DonutKpi
            value={overviewLoading ? "…" : formatNumber(total)}
            label="Leads no período"
            percent={conversao}
            delta={
              change !== null
                ? `${change >= 0 ? "+" : "−"}${Math.abs(change).toFixed(1)}%`
                : "—"
            }
            deltaUp={changeUp}
            gradId="donut-blue"
            from="#0086f7"
            to="#66b9ff"
          />
          <DonutKpi
            value={overviewLoading ? "…" : formatNumber(consultasNum)}
            label="Consultas"
            percent={comparecimentoRate}
            delta={formatPercent(comparecimentoRate)}
            deltaUp
            gradId="donut-amber"
            from="#ffb500"
            to="#ffd666"
          />
          <DonutKpi
            value={overviewLoading ? "…" : formatNumber(fechouCount)}
            label="Fechamentos"
            percent={fechamentoRate}
            delta={formatPercent(fechamentoRate)}
            deltaUp
            gradId="donut-cyan"
            from="#008eff"
            to="#22d3ee"
          />
        </div>

        {/* coluna direita — 2 cards "Data" com mini-barras */}
        <div className="grid grid-cols-2 gap-3 xl:grid-cols-1">
          <DataBarCard
            title="Em atendimento"
            tag="agora"
            value={overviewLoading ? "…" : formatNumber(inService)}
            series={evoServiceSeries}
            from="#0086f7"
            to="#22d3ee"
          />
          <DataBarCard
            title="Na fila"
            tag="agora"
            value={overviewLoading ? "…" : formatNumber(inQueue)}
            series={evoQueueSeries}
            from="#ffb500"
            to="#ffd666"
          />
        </div>
      </div>

      {/* ════════════ Cards A/B (sparkline) + gráfico de barras ════════════ */}
      <div className="grid grid-cols-1 gap-3 xl:grid-cols-[minmax(280px,1fr)_1.6fr]">
        <div className="grid grid-cols-1 gap-3">
          <SparkStatCard
            badge="A"
            value={overviewLoading ? "…" : formatNumber(compareceuCount)}
            label="Compareceram"
            data={evoServiceSeries}
            from="#0086f7"
            to="#66b9ff"
          />
          <SparkStatCard
            badge="B"
            value={overviewLoading ? "…" : formatNumber(consultasAgendadas)}
            label="Consultas agendadas"
            data={evoSeries}
            from="#ffb500"
            to="#ffd666"
          />
        </div>
        <BigBarChart
          title="Evolução de leads"
          highlight={formatPercent(conversao)}
          data={evoSeries}
          loading={evolucao.isLoading}
        />
      </div>

      {/* ---- Metas (mínima / ideal) ---- */}
      <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
        <GoalCard
          tone="amber"
          label="META MÍNIMA"
          current={consultasNum}
          target={metaMinima}
          footer={
            faltamMin > 0
              ? `Faltam ${faltamMin} consultas para atingir a meta mínima`
              : "Meta mínima atingida 🎉"
          }
        />
        <GoalCard
          tone="emerald"
          label="META IDEAL"
          current={consultasNum}
          target={metaIdeal}
          footer={
            faltamIdeal > 0
              ? `Faltam ${faltamIdeal} consultas para atingir a meta ideal`
              : "Meta ideal atingida 🎉"
          }
        />
      </div>

      {/* ---- Funil: comparecimento / fechamento / recuperação ---- */}
      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 xl:grid-cols-6">
        <FunnelKpi
          tone="amber"
          value={overviewLoading ? "…" : formatNumber(consultasAgendadas)}
          label="consultas agendadas"
          to={`/dashboard/agendadas?from=${filters.startDate}&to=${filters.endDate}`}
        />
        <FunnelKpi
          tone="emerald"
          value={overviewLoading ? "…" : formatNumber(compareceuCount)}
          label="compareceram"
          to={`/dashboard/compareceram?from=${filters.startDate}&to=${filters.endDate}`}
        />
        <FunnelKpi
          tone="rose"
          value={overviewLoading ? "…" : formatNumber(faltouCount)}
          label="faltaram"
        />
        <FunnelKpi
          tone="emerald"
          value={overviewLoading ? "…" : formatNumber(fechouCount)}
          label="fecharam"
        />
        <FunnelKpi
          tone="violet"
          value={overviewLoading ? "…" : formatPercent(comparecimentoRate)}
          label="taxa de comparecimento"
        />
        <FunnelKpi
          tone="cyan"
          value={overviewLoading ? "…" : formatPercent(fechamentoRate)}
          label="taxa de fechamento"
        />
      </div>

      {/* ---- RESGATES (destaque hero) ---- */}
      <Link
        to="/recuperacao"
        className={cn(
          "group relative block overflow-hidden rounded-2xl border border-amber-500/30 px-6 py-5 transition",
          "bg-[radial-gradient(ellipse_at_top_left,rgba(251,191,36,0.18),transparent_60%),linear-gradient(135deg,rgba(244,63,94,0.10),rgba(251,191,36,0.06))]",
          "hover:border-amber-400/60 hover:shadow-[0_8px_30px_-12px_rgba(251,191,36,0.45)]",
          naoFechouCount > 0 && "ring-1 ring-amber-500/30 ring-offset-2 ring-offset-[#0a0a0d]",
        )}
      >
        {/* anel pulsante quando há leads */}
        {naoFechouCount > 0 && (
          <span
            aria-hidden
            className="absolute right-5 top-5 inline-flex h-2 w-2"
          >
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-amber-400 opacity-75" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-amber-400" />
          </span>
        )}
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div className="min-w-0">
            <p className="text-[10.5px] font-bold uppercase tracking-[0.2em] text-amber-300">
              Resgates
            </p>
            <h2 className="mt-1 text-[36px] font-bold leading-none tracking-tight text-slate-50 tabular-nums sm:text-[44px]">
              {overviewLoading ? "…" : formatNumber(naoFechouCount)}
            </h2>
            <p className="mt-2 max-w-md text-[12.5px] text-slate-300">
              {naoFechouCount > 0 ? (
                <>
                  <span className="font-semibold text-amber-200">
                    {naoFechouCount === 1 ? "1 oportunidade" : `${formatNumber(naoFechouCount)} oportunidades`}
                  </span>{" "}
                  de recuperação comercial. Compareceram, mas ainda não fecharam tratamento.
                </>
              ) : (
                <>Nenhum lead em fila de recuperação no momento. Bom trabalho! 🎯</>
              )}
            </p>
          </div>
          <span className="inline-flex items-center gap-1.5 rounded-md bg-amber-500/10 px-3 py-2 text-[12.5px] font-semibold text-amber-200 ring-1 ring-inset ring-amber-500/30 transition group-hover:bg-amber-500/15 group-hover:text-amber-100">
            Abrir fila de resgates
            <span aria-hidden>→</span>
          </span>
        </div>
      </Link>

      {/* ═════════════ VISÃO SDR (lê localStorage de leadReviewStore) ═════════════ */}
      <SdrInsights agg={reviewAgg} />

      {/* ---- Atalhos: mudanças de etapa + conversão ---- */}
      <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
        <Link
          to="/mudancas-etapas"
          className="group flex items-center justify-between gap-4 rounded-xl border border-white/[0.06] bg-white/[0.02] px-5 py-3 transition hover:border-emerald-500/30 hover:bg-emerald-500/[0.04]"
        >
          <div className="min-w-0">
            <p className="text-[11.5px] font-medium uppercase tracking-wider text-slate-400">
              Mudanças de etapa
            </p>
            <p className="mt-0.5 text-[12.5px] text-slate-300">
              Feed de transições com gráficos por dia, top destinos e jornada por lead.
            </p>
          </div>
          <span className="text-[12px] font-medium text-slate-400 transition group-hover:text-emerald-300">
            Ver feed →
          </span>
        </Link>

        <Link
          to="/conversao"
          className="group flex items-center justify-between gap-4 rounded-xl border border-white/[0.06] bg-white/[0.02] px-5 py-3 transition hover:border-fuchsia-500/30 hover:bg-fuchsia-500/[0.04]"
        >
          <div className="min-w-0">
            <p className="text-[11.5px] font-medium uppercase tracking-wider text-slate-400">
              Conversão
            </p>
            <p className="mt-0.5 text-[12.5px] text-slate-300">
              Quanto entra, quanto fecha e por que os outros não fecham (motivos extraídos das observações).
            </p>
          </div>
          <span className="text-[12px] font-medium text-slate-400 transition group-hover:text-fuchsia-300">
            Abrir →
          </span>
        </Link>
      </div>

      {/* ---- Atividade ao vivo + Alertas críticos ---- */}
      <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
        <ActivityFeed
          items={activityItems}
          loading={ativos.isLoading}
        />
        <AlertsPanel items={alerts} />
      </div>
    </div>
  );
}

interface FunnelKpiProps {
  tone: ChipTone;
  value: string;
  label: string;
  to?: string;
}

function FunnelKpi({ tone, value, label, to }: FunnelKpiProps) {
  const body = (
    <>
      <div className="text-[18px] font-semibold tabular-nums">{value}</div>
      <div className="mt-0.5 text-[10.5px] uppercase tracking-wider opacity-80">
        {label}
      </div>
    </>
  );
  const cls = cn(
    "rounded-lg border border-white/[0.06] bg-white/[0.02] px-3 py-2.5 ring-1 ring-inset",
    TONES[tone],
  );
  if (to) {
    return (
      <Link
        to={to}
        className={cn(cls, "block transition hover:bg-white/[0.04] hover:scale-[1.01]")}
      >
        {body}
      </Link>
    );
  }
  return <div className={cls}>{body}</div>;
}

/* ============================================================
 * Sub-componentes
 * ========================================================== */

type SparkPoint = { label: string; v: number };

/* ---- Donut (ring) KPI — estilo Kommo, com gradiente da marca ---- */
interface DonutKpiProps {
  value: string;
  label: string;
  percent: number; // 0-100 → preenchimento do anel
  delta: string;
  deltaUp: boolean;
  gradId: string;
  from: string;
  to: string;
}
function DonutKpi({
  value,
  label,
  percent,
  delta,
  deltaUp,
  gradId,
  from,
  to,
}: DonutKpiProps) {
  const pct = Math.max(0, Math.min(100, percent ?? 0));
  const size = 148;
  const stroke = 12;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const offset = c * (1 - pct / 100);

  return (
    <div className="flex flex-col items-center rounded-2xl border border-white/[0.06] bg-white/[0.02] px-4 py-5 transition hover:border-white/[0.1] hover:bg-white/[0.03]">
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size} className="-rotate-90">
          <defs>
            <linearGradient id={gradId} x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor={from} />
              <stop offset="100%" stopColor={to} />
            </linearGradient>
          </defs>
          <circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            fill="none"
            stroke="rgba(255,255,255,0.06)"
            strokeWidth={stroke}
          />
          <circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            fill="none"
            stroke={`url(#${gradId})`}
            strokeWidth={stroke}
            strokeLinecap="round"
            strokeDasharray={c}
            strokeDashoffset={offset}
            style={{ transition: "stroke-dashoffset .6s ease" }}
          />
        </svg>
        <div className="absolute inset-0 grid place-items-center">
          <span className="text-[30px] font-bold tabular-nums text-slate-50">
            {value}
          </span>
        </div>
      </div>
      <div className="mt-3 flex items-center gap-1 text-[12px] font-semibold tabular-nums">
        <span className={cn(deltaUp ? "text-emerald-400" : "text-rose-400")}>
          {deltaUp ? "▲" : "▼"} {delta}
        </span>
      </div>
      <p className="mt-1 text-[11px] uppercase tracking-wider text-slate-400">
        {label}
      </p>
    </div>
  );
}

/* ---- Card "Data" lateral — mini-barras horizontais ---- */
interface DataBarCardProps {
  title: string;
  tag: string;
  value: string;
  series: SparkPoint[];
  from: string;
  to: string;
}
function DataBarCard({ title, tag, value, series, from, to }: DataBarCardProps) {
  const bars = (series ?? []).slice(-3).map((p) => p.v);
  const safeBars = bars.length ? bars : [0.5, 0.3, 0.7];
  const max = Math.max(1, ...safeBars);

  return (
    <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] px-4 py-3.5">
      <div className="flex items-center justify-between">
        <p className="text-[12px] font-semibold text-slate-200">{title}</p>
        <span className="text-[10px] uppercase tracking-wider text-slate-500">
          {tag}
        </span>
      </div>
      <p className="mt-1 text-[22px] font-bold tabular-nums text-slate-50">
        {value}
      </p>
      <div className="mt-2.5 space-y-1.5">
        {safeBars.map((b, i) => (
          <div key={i} className="h-1.5 rounded-full bg-white/[0.05]">
            <div
              className="h-full rounded-full"
              style={{
                width: `${Math.max(8, (b / max) * 100)}%`,
                background: `linear-gradient(90deg, ${from}, ${to})`,
              }}
            />
          </div>
        ))}
      </div>
    </div>
  );
}

/* ---- Card com selo (A/B) + número + sparkline ---- */
interface SparkStatCardProps {
  badge: string;
  value: string;
  label: string;
  data: SparkPoint[];
  from: string;
  to: string;
}
function SparkStatCard({
  badge,
  value,
  label,
  data,
  from,
  to,
}: SparkStatCardProps) {
  const gid = `spark-${badge}`;
  return (
    <div className="flex items-center gap-4 rounded-2xl border border-white/[0.06] bg-white/[0.02] px-5 py-4 transition hover:border-white/[0.1] hover:bg-white/[0.03]">
      <div
        className="grid h-12 w-12 shrink-0 place-items-center rounded-full text-[18px] font-bold text-white shadow-lg"
        style={{ background: `linear-gradient(135deg, ${from}, ${to})` }}
      >
        {badge}
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-[26px] font-bold leading-none tabular-nums text-slate-50">
          {value}
        </p>
        <p className="mt-1 truncate text-[11.5px] text-slate-400">{label}</p>
      </div>
      <div className="h-12 w-24 shrink-0 sm:w-28">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data}>
            <defs>
              <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={to} stopOpacity={0.5} />
                <stop offset="100%" stopColor={to} stopOpacity={0} />
              </linearGradient>
            </defs>
            <Area
              type="monotone"
              dataKey="v"
              stroke={from}
              strokeWidth={2}
              fill={`url(#${gid})`}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

/* ---- Gráfico de barras grande (evolução) ---- */
interface BigBarChartProps {
  title: string;
  highlight: string;
  data: SparkPoint[];
  loading?: boolean;
}
function BigBarChart({ title, highlight, data, loading }: BigBarChartProps) {
  return (
    <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] px-5 py-4">
      <div className="flex items-center justify-between">
        <p className="text-[13px] font-semibold text-slate-200">{title}</p>
        <span className="rounded-md bg-white/[0.04] px-2.5 py-1 text-[12px] font-semibold tabular-nums text-slate-200 ring-1 ring-inset ring-white/[0.08]">
          {highlight}
        </span>
      </div>
      <div className="mt-3 h-[230px]">
        {loading ? (
          <div className="grid h-full place-items-center text-[12px] text-slate-500">
            Carregando…
          </div>
        ) : data.length === 0 ? (
          <div className="grid h-full place-items-center text-[12px] text-slate-500">
            Sem dados no período
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} margin={{ top: 8, right: 4, left: -18, bottom: 0 }}>
              <defs>
                <linearGradient id="bar-blue" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#33a1ff" />
                  <stop offset="100%" stopColor="#0086f7" />
                </linearGradient>
                <linearGradient id="bar-cyan" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#22d3ee" />
                  <stop offset="100%" stopColor="#008eff" />
                </linearGradient>
              </defs>
              <XAxis
                dataKey="label"
                tick={{ fontSize: 10, fill: "rgb(148 163 184)" }}
                axisLine={false}
                tickLine={false}
                interval="preserveStartEnd"
              />
              <Tooltip
                cursor={{ fill: "rgba(255,255,255,0.04)" }}
                contentStyle={{
                  background: "#0f172a",
                  border: "1px solid rgba(255,255,255,0.1)",
                  borderRadius: 10,
                  fontSize: 12,
                }}
                labelStyle={{ color: "#cbd5e1" }}
              />
              <Bar dataKey="v" radius={[4, 4, 0, 0]} maxBarSize={26}>
                {data.map((_, i) => (
                  <Cell key={i} fill={i % 2 === 0 ? "url(#bar-blue)" : "url(#bar-cyan)"} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}

type ChipTone =
  | "sky"
  | "emerald"
  | "amber"
  | "violet"
  | "cyan"
  | "fuchsia"
  | "rose"
  | "slate"
  | "indigo";

const TONES: Record<ChipTone, string> = {
  sky: "bg-sky-500/10 text-sky-300 ring-sky-500/25",
  emerald: "bg-emerald-500/10 text-emerald-300 ring-emerald-500/25",
  amber: "bg-amber-500/10 text-amber-300 ring-amber-500/25",
  violet: "bg-violet-500/10 text-violet-300 ring-violet-500/25",
  cyan: "bg-cyan-500/10 text-cyan-300 ring-cyan-500/25",
  fuchsia: "bg-fuchsia-500/10 text-fuchsia-300 ring-fuchsia-500/25",
  rose: "bg-rose-500/10 text-rose-300 ring-rose-500/25",
  slate: "bg-white/[0.04] text-slate-300 ring-white/[0.08]",
  indigo: "bg-indigo-500/10 text-indigo-300 ring-indigo-500/25",
};

interface MiniKpiProps {
  icon: React.ReactNode;
  tone: ChipTone;
  value: string;
  label: string;
}
function MiniKpi({ icon, tone, value, label }: MiniKpiProps) {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-white/[0.06] bg-white/[0.015] px-4 py-3.5 transition hover:border-white/[0.1] hover:bg-white/[0.025]">
      <div
        className={cn(
          "grid h-20 w-20 shrink-0 place-items-center rounded-lg ring-1 ring-inset",
          TONES[tone],
        )}
      >
        {icon}
      </div>
      <div className="min-w-0">
        <p className="text-[20px] font-bold leading-none tracking-tight text-slate-50 tabular-nums">
          {value}
        </p>
        <p className="mt-1 truncate text-[11px] text-slate-500">{label}</p>
      </div>
    </div>
  );
}

interface GoalCardProps {
  tone: "amber" | "emerald";
  label: string;
  current: number;
  target: number;
  unit?: string;
  footer: string;
}
function GoalCard({
  tone,
  label,
  current,
  target,
  unit = "consultas",
  footer,
}: GoalCardProps) {
  const pct = target > 0 ? Math.round((current / target) * 100) : 0;
  const palette =
    tone === "amber"
      ? {
          ring: "ring-amber-500/20",
          bg: "bg-amber-500/5",
          icon: "bg-amber-500/15 text-amber-300 ring-amber-500/30",
          title: "text-amber-300",
          bar: "bg-gradient-to-r from-amber-500 to-amber-300",
          pct: "text-amber-300",
        }
      : {
          ring: "ring-emerald-500/20",
          bg: "bg-emerald-500/5",
          icon: "bg-emerald-500/15 text-emerald-300 ring-emerald-500/30",
          title: "text-emerald-300",
          bar: "bg-gradient-to-r from-emerald-500 to-emerald-300",
          pct: "text-emerald-300",
        };

  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-xl border border-white/[0.06] px-5 py-4 ring-1 ring-inset",
        palette.bg,
        palette.ring,
      )}
    >
      <div className="flex items-start gap-4">
        <div
          className={cn(
            "grid h-11 w-11 shrink-0 place-items-center rounded-lg ring-1 ring-inset",
            palette.icon,
          )}
        >
          <Target className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-3">
            <p
              className={cn(
                "text-[13px] font-semibold tracking-tight",
                palette.title,
              )}
            >
              {label}: {current}/{target} {unit} ({pct}%)
            </p>
            <span
              className={cn(
                "text-[18px] font-bold leading-none tabular-nums",
                palette.pct,
              )}
            >
              {pct}%
            </span>
          </div>

          <div className="mt-2.5 h-2 overflow-hidden rounded-full bg-white/[0.05]">
            <div
              className={cn("h-full rounded-full transition-all", palette.bar)}
              style={{ width: `${Math.min(pct, 100)}%` }}
            />
          </div>

          <p className="mt-2 text-[11.5px] text-slate-400">{footer}</p>
        </div>
      </div>
    </div>
  );
}

interface ChartKpiProps {
  label: string;
  value: string;
  data: { label: string; v: number; compareV?: number }[];
  stroke: string;
  chip: string;
  icon: React.ReactNode;
  delta: string;
  deltaUp: boolean;
  loading?: boolean;
  showComparison?: boolean;
}
function ChartKpi({
  label,
  value,
  data,
  stroke,
  chip,
  icon,
  delta,
  deltaUp,
  loading,
  showComparison,
}: ChartKpiProps) {
  const gradId = `grad-${label.replace(/\s+/g, "-").toLowerCase()}`;
  const cmpGradId = `grad-cmp-${label.replace(/\s+/g, "-").toLowerCase()}`;
  const hasComparison =
    showComparison && data.some((p) => typeof p.compareV === "number");

  return (
    <div className="group relative overflow-hidden rounded-xl border border-white/[0.06] bg-white/[0.015] p-5 transition hover:border-white/[0.1] hover:bg-white/[0.025]">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-1.5">
          <p className="text-[10.5px] font-semibold uppercase tracking-[0.16em] text-slate-400">
            {label}
          </p>
          <Info className="h-3 w-3" />
        </div>
        <div
          className={cn(
            "grid h-8 w-8 place-items-center rounded-lg ring-1 ring-inset",
            chip,
          )}
        >
          {icon}
        </div>
      </div>

      <p className="mt-3 text-[34px] font-bold leading-none tracking-tight text-slate-50 tabular-nums">
        {loading ? "…" : value}
      </p>

      <div className="mt-2 h-16 -mx-1">
        {data.length > 1 ? (
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart
              data={data}
              margin={{ top: 4, right: 4, bottom: 0, left: 4 }}
            >
              <defs>
                <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={stroke} stopOpacity={0.35} />
                  <stop offset="100%" stopColor={stroke} stopOpacity={0} />
                </linearGradient>
                {hasComparison && (
                  <linearGradient id={cmpGradId} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#94a3b8" stopOpacity={0.18} />
                    <stop offset="100%" stopColor="#94a3b8" stopOpacity={0} />
                  </linearGradient>
                )}
              </defs>
              <Tooltip
                cursor={{ stroke: "rgba(255,255,255,0.1)", strokeWidth: 1 }}
                contentStyle={{
                  background: "#0f1115",
                  border: "1px solid rgba(255,255,255,0.08)",
                  borderRadius: 6,
                  fontSize: 11,
                  color: "#e2e8f0",
                  padding: "4px 8px",
                }}
                labelStyle={{ display: "none" }}
                formatter={(val, name) => [val ?? "—", name === "compareV" ? "Comparação" : label]}
              />
              {hasComparison && (
                <Area
                  type="monotone"
                  dataKey="compareV"
                  stroke="#94a3b8"
                  strokeWidth={1.5}
                  strokeDasharray="3 3"
                  fill={`url(#${cmpGradId})`}
                  dot={false}
                  isAnimationActive={false}
                />
              )}
              <Area
                type="monotone"
                dataKey="v"
                stroke={stroke}
                strokeWidth={2}
                fill={`url(#${gradId})`}
                dot={false}
                activeDot={{
                  r: 3,
                  fill: stroke,
                  stroke: "#0a0b0d",
                  strokeWidth: 2,
                }}
              />
            </AreaChart>
          </ResponsiveContainer>
        ) : (
          <div className="h-full w-full rounded bg-white/[0.02]" />
        )}
      </div>

      <div className="mt-2 flex items-center gap-2">
        <span
          className={cn(
            "inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10.5px] font-semibold tabular-nums ring-1 ring-inset",
            deltaUp
              ? "bg-emerald-500/10 text-emerald-300 ring-emerald-500/20"
              : "bg-rose-500/10 text-rose-300 ring-rose-500/20",
          )}
        >
          {deltaUp ? "↑" : "↓"} {delta}
        </span>
        <span className="text-[11px] text-slate-500">vs ontem</span>
      </div>
    </div>
  );
}

/* ----- Activity feed ----- */

type ActivityKind = "lead" | "call" | "form" | "converted" | "scheduled";

interface ActivityItem {
  id: string;
  kind: ActivityKind;
  title: string;
  subtitle: string;
  time: string;
}

function titleFor(kind: ActivityKind, name: string): string {
  const n = truncate(name, 40);
  switch (kind) {
    case "call":
      return `Ligação atendida — ${n}`;
    case "form":
      return `Formulário do site — ${n}`;
    case "converted":
      return `Lead convertido em consulta — ${n}`;
    case "scheduled":
      return `Consulta agendada — ${n}`;
    default:
      return `Novo lead — ${n}`;
  }
}

function activityIcon(kind: ActivityKind): {
  icon: React.ReactNode;
  bg: string;
} {
  switch (kind) {
    case "call":
      return {
        icon: <PhoneIcon className="h-4 w-4" />,
        bg: TONES.sky,
      };
    case "form":
      return {
        icon: <ClipboardList className="h-4 w-4" />,
        bg: TONES.indigo,
      };
    case "converted":
      return {
        icon: <CheckCircle2 className="h-4 w-4" />,
        bg: TONES.emerald,
      };
    case "scheduled":
      return {
        icon: <CalendarCheck className="h-4 w-4" />,
        bg: TONES.amber,
      };
    default:
      return {
        icon: <MessageCircle className="h-4 w-4" />,
        bg: TONES.emerald,
      };
  }
}

function ActivityFeed({
  items,
  loading,
}: {
  items: ActivityItem[];
  loading: boolean;
}) {
  return (
    <section className="rounded-xl border border-white/[0.06] bg-white/[0.015]">
      <header className="flex items-center justify-between border-b border-white/[0.05] px-5 py-3.5">
        <h3 className="text-[12px] font-semibold uppercase tracking-[0.14em] text-slate-300">
          Atividade ao vivo
        </h3>
        <span className="flex items-center gap-1.5 text-[11px] text-slate-500">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
          Atualizado agora há pouco
        </span>
      </header>

      {loading ? (
        <ul className="divide-y divide-white/[0.04]">
          {Array.from({ length: 4 }).map((_, i) => (
            <li key={i} className="flex items-center gap-3 px-5 py-3">
              <div className="h-8 w-8 rounded-md bg-white/[0.03] animate-pulse" />
              <div className="flex-1 space-y-2">
                <div className="h-3 w-40 rounded bg-white/[0.03] animate-pulse" />
                <div className="h-3 w-24 rounded bg-white/[0.03] animate-pulse" />
              </div>
            </li>
          ))}
        </ul>
      ) : items.length === 0 ? (
        <div className="px-5 py-10 text-center text-[12px] text-slate-500">
          Nenhuma atividade recente
        </div>
      ) : (
        <ul className="divide-y divide-white/[0.04]">
          {items.map((a) => {
            const ai = activityIcon(a.kind);
            return (
              <li
                key={a.id}
                className="flex items-center gap-3 px-5 py-3 transition hover:bg-white/[0.02]"
              >
                <div
                  className={cn(
                    "grid h-8 w-8 shrink-0 place-items-center rounded-md ring-1 ring-inset",
                    ai.bg,
                  )}
                >
                  {ai.icon}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[12.5px] font-medium text-slate-100">
                    {a.title}
                  </p>
                  <p className="truncate text-[11px] text-slate-500">
                    {a.subtitle}
                  </p>
                </div>
                <span className="shrink-0 text-[10.5px] tabular-nums text-slate-500">
                  {a.time}
                </span>
              </li>
            );
          })}
        </ul>
      )}

      <div className="border-t border-white/[0.05] px-5 py-3 text-center">
        <Link
          to="/leads"
          className="text-[11.5px] font-medium text-sky-400 transition hover:text-sky-300"
        >
          Ver todas as atividades
        </Link>
      </div>
    </section>
  );
}

/* ----- Alerts ----- */

type AlertSeverity = "danger" | "warn" | "info" | "violet";

interface AlertItem {
  id: string;
  severity: AlertSeverity;
  title: string;
  detail: string;
  time: string;
}

const ALERT_PALETTE: Record<
  AlertSeverity,
  { bar: string; bg: string; ring: string; icon: string; title: string }
> = {
  danger: {
    bar: "bg-rose-500",
    bg: "bg-rose-500/[0.06]",
    ring: "ring-rose-500/20",
    icon: "bg-rose-500/15 text-rose-300 ring-rose-500/30",
    title: "text-rose-300",
  },
  warn: {
    bar: "bg-amber-500",
    bg: "bg-amber-500/[0.06]",
    ring: "ring-amber-500/20",
    icon: "bg-amber-500/15 text-amber-300 ring-amber-500/30",
    title: "text-amber-300",
  },
  info: {
    bar: "bg-sky-500",
    bg: "bg-sky-500/[0.04]",
    ring: "ring-sky-500/15",
    icon: "bg-sky-500/15 text-sky-300 ring-sky-500/30",
    title: "text-sky-300",
  },
  violet: {
    bar: "bg-violet-500",
    bg: "bg-violet-500/[0.04]",
    ring: "ring-violet-500/15",
    icon: "bg-violet-500/15 text-violet-300 ring-violet-500/30",
    title: "text-violet-300",
  },
};

function alertIcon(severity: AlertSeverity): React.ReactNode {
  switch (severity) {
    case "danger":
      return <AlertTriangle className="h-4 w-4" />;
    case "warn":
      return <AlertCircle className="h-4 w-4" />;
    case "info":
      return <Info className="h-4 w-4" />;
    case "violet":
      return <Target className="h-4 w-4" />;
  }
}

function AlertsPanel({ items }: { items: AlertItem[] }) {
  return (
    <section className="rounded-xl border border-white/[0.06] bg-white/[0.015]">
      <header className="flex items-center justify-between border-b border-white/[0.05] px-5 py-3.5">
        <div className="flex items-center gap-2">
          <AlertTriangle className="h-4 w-4" />
          <h3 className="text-[12px] font-semibold uppercase tracking-[0.14em] text-slate-300">
            Alertas críticos
          </h3>
        </div>
        <button
          type="button"
          className="text-[11.5px] font-medium text-sky-400 transition hover:text-sky-300"
        >
          Ver todos
        </button>
      </header>

      {items.length === 0 ? (
        <div className="px-5 py-10 text-center text-[12px] text-slate-500">
          Tudo certo por aqui ✨
        </div>
      ) : (
        <ul className="space-y-2 p-3">
          {items.map((al) => {
            const p = ALERT_PALETTE[al.severity];
            return (
              <li
                key={al.id}
                className={cn(
                  "relative flex items-start gap-3 overflow-hidden rounded-lg px-3.5 py-3 ring-1 ring-inset",
                  p.bg,
                  p.ring,
                )}
              >
                <span className={cn("absolute inset-y-0 left-0 w-0.5", p.bar)} />
                <div
                  className={cn(
                    "grid h-8 w-8 shrink-0 place-items-center rounded-md ring-1 ring-inset",
                    p.icon,
                  )}
                >
                  {alertIcon(al.severity)}
                </div>
                <div className="min-w-0 flex-1">
                  <p className={cn("text-[12.5px] font-semibold", p.title)}>
                    {al.title}
                  </p>
                  <p className="mt-0.5 text-[11px] text-slate-400">{al.detail}</p>
                </div>
                <span className="shrink-0 text-[10.5px] tabular-nums text-slate-500">
                  {al.time}
                </span>
              </li>
            );
          })}
        </ul>
      )}

      <div className="border-t border-white/[0.05] px-5 py-3 text-center">
        <button
          type="button"
          className="text-[11.5px] font-medium text-sky-400 transition hover:text-sky-300"
        >
          Ver todos os alertas
        </button>
      </div>
    </section>
  );
}

/* ============================================================
 * Visão SDR — widgets ricos a partir das revisões locais
 * ========================================================== */

const NO_APPOINTMENT_LABELS: Record<string, string> = {
  sem_interacao: "Sem interação",
  sem_continuidade: "Sem continuidade",
  plano_saude: "Plano de saúde",
  terceiros: "Para terceiros",
  sem_condicoes: "Sem condições",
  vai_se_organizar: "Vai se organizar",
  busca_laudo: "Busca laudo",
  interesse_pilates: "Só pilates",
  interesse_liberacao: "Só liberação",
  mora_outra_cidade: "Mora +50km",
  sem_interesse: "Sem interesse",
  clicou_engano: "Clicou por engano",
  outro_tratamento: "Outro tratamento",
  outra_patologia: "Outra patologia",
  em_viagem: "Em viagem",
};

const NO_CLOSE_LABELS: Record<string, string> = {
  fechou_total: "Fechou total",
  fechou_parcial: "Fechou parcial",
  assinou_sem_entrada: "Sem entrada",
  decide_familia: "Decide c/ família",
  verifica_pagamento: "Verifica pagto.",
  exame_imagem: "Exame imagem",
  mora_fora: "Mora +50km",
  outra_patologia: "Outra patologia",
  sem_condicoes: "Sem condições",
};

const RESCUE_TYPE_LABELS: Record<string, string> = {
  mensagem: "Mensagem",
  ligacao: "Ligação",
  disparo_massa: "Disparo em massa",
};

const PAYMENT_METHOD_LABELS: Record<string, string> = {
  pix: "PIX",
  dinheiro: "Dinheiro",
  cartao_credito: "Crédito",
  cartao_debito: "Débito",
  boleto: "Boleto",
  transferencia: "Transferência",
  outro: "Outro",
};

function SdrInsights({ agg }: { agg: ReviewAggregates }) {
  const topNoAppointment = Object.entries(agg.noAppointmentReasons)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);
  const topNoClose = Object.entries(agg.noCloseReasons)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);
  const topMethods = Object.entries(agg.byMethod)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 4);

  const totalCadResg = agg.cadastros + agg.resgates;
  const totalReceitas = agg.expectedConsultaTotal + agg.expectedTratamentoTotal;
  const totalAdiantado = agg.advanceConsultaTotal + agg.advanceTratamentoTotal;
  const pctAdiantado =
    totalReceitas > 0 ? (totalAdiantado / totalReceitas) * 100 : 0;

  // Estado "vazio": ainda não há revisões locais — convida o usuário a começar.
  if (agg.total === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-white/[0.08] bg-white/[0.01] px-6 py-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[10.5px] font-bold uppercase tracking-[0.2em] text-slate-500">
              Visão SDR
            </p>
            <p className="mt-1 text-[13px] text-slate-300">
              Comece a revisar leads para ver receita prevista, motivos e respondáveis aqui.
            </p>
          </div>
          <Link
            to="/leads"
            className="rounded-md bg-emerald-500 px-4 py-1.5 text-[12px] font-semibold text-emerald-950 transition hover:bg-emerald-400"
          >
            Revisar leads
          </Link>
        </div>
      </div>
    );
  }

  return (
    <section className="space-y-3">
      <header className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <p className="text-[10.5px] font-bold uppercase tracking-[0.2em] text-emerald-300">
            Visão SDR · financeiro
          </p>
          <h2 className="mt-0.5 text-[16px] font-semibold tracking-tight text-slate-100">
            Recebimentos, fluxo de cadastro e motivos
          </h2>
        </div>
        <span className="rounded-md bg-white/[0.04] px-2 py-0.5 text-[10.5px] font-medium text-slate-400 ring-1 ring-inset ring-white/[0.06]">
          {formatNumber(agg.total)} lead{agg.total === 1 ? "" : "s"} revisado
          {agg.total === 1 ? "" : "s"}
        </span>
      </header>

      {/* Linha 1: 4 KPIs financeiros (link com /finance) */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <FinanceKpi
          tone="emerald"
          icon={<Wallet className="h-4 w-4" />}
          label="Recebimento previsto"
          value={formatCurrency(totalReceitas)}
          sub={`Consulta + tratamento`}
          to="/finance"
        />
        <FinanceKpi
          tone="amber"
          icon={<TrendingUp className="h-4 w-4" />}
          label="Adiantamentos"
          value={formatCurrency(totalAdiantado)}
          sub={`${formatPercent(pctAdiantado)} do previsto`}
          to="/finance"
        />
        <FinanceKpi
          tone="violet"
          icon={<CreditCard className="h-4 w-4" />}
          label="Recebimento de consulta"
          value={formatCurrency(agg.expectedConsultaTotal)}
          sub={`${formatNumber(agg.attendedCount)} comparecimentos`}
          to="/finance"
        />
        <FinanceKpi
          tone="cyan"
          icon={<CheckCircle2 className="h-4 w-4" />}
          label="Recebimento de tratamento"
          value={formatCurrency(agg.expectedTratamentoTotal)}
          sub={`${formatNumber(agg.closedCount)} tratamentos fechados`}
          to="/finance"
        />
      </div>

      {/* Linha 2: 2 cards — Cadastro × Resgate + Top métodos */}
      <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
        <Card className="bg-gradient-to-br from-emerald-500/[0.04] via-transparent to-transparent">
          <header className="mb-3 flex items-center justify-between gap-2">
            <h3 className="text-[12px] font-semibold uppercase tracking-[0.14em] text-slate-300">
              Cadastro × Resgate
            </h3>
            <UserPlus className="h-3.5 w-3.5 text-slate-500" />
          </header>

          {/* Mini-bar comparativa */}
          <div className="mb-3 flex h-2.5 w-full overflow-hidden rounded-full bg-white/[0.04]">
            {totalCadResg > 0 ? (
              <>
                <div
                  className="bg-gradient-to-r from-emerald-500 to-emerald-300 transition-all"
                  style={{ width: `${(agg.cadastros / totalCadResg) * 100}%` }}
                />
                <div
                  className="bg-gradient-to-r from-violet-500 to-violet-300 transition-all"
                  style={{ width: `${(agg.resgates / totalCadResg) * 100}%` }}
                />
              </>
            ) : null}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Legend
              color="emerald"
              label="Cadastros"
              value={formatNumber(agg.cadastros)}
              pct={totalCadResg ? (agg.cadastros / totalCadResg) * 100 : 0}
            />
            <Legend
              color="violet"
              label="Resgates"
              value={formatNumber(agg.resgates)}
              pct={totalCadResg ? (agg.resgates / totalCadResg) * 100 : 0}
            />
          </div>

          {agg.resgates > 0 && (
            <div className="mt-4 space-y-1.5 border-t border-white/[0.05] pt-3">
              <p className="text-[10.5px] font-medium uppercase tracking-wider text-slate-500">
                Resgates por tipo
              </p>
              {Object.entries(agg.rescueTypes)
                .sort((a, b) => b[1] - a[1])
                .map(([k, v]) => (
                  <BarRow
                    key={k}
                    label={RESCUE_TYPE_LABELS[k] ?? k}
                    value={v}
                    total={agg.resgates}
                    tone="violet"
                  />
                ))}
            </div>
          )}
        </Card>

        <Card>
          <header className="mb-3 flex items-center justify-between gap-2">
            <h3 className="text-[12px] font-semibold uppercase tracking-[0.14em] text-slate-300">
              Formas de pagamento (preview)
            </h3>
            <Wallet className="h-3.5 w-3.5 text-slate-500" />
          </header>
          {topMethods.length === 0 ? (
            <p className="py-6 text-center text-[11.5px] italic text-slate-500">
              Ainda sem recebimentos preenchidos
            </p>
          ) : (
            <div className="space-y-2">
              {topMethods.map(([m, v]) => (
                <div key={m} className="flex items-center justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="mb-0.5 flex items-center justify-between gap-2">
                      <span className="text-[12px] font-medium text-slate-200">
                        {PAYMENT_METHOD_LABELS[m] ?? m}
                      </span>
                      <span className="tabular-nums text-[12px] font-semibold text-emerald-300">
                        {formatCurrency(v)}
                      </span>
                    </div>
                    <div className="h-1.5 overflow-hidden rounded-full bg-white/[0.04]">
                      <div
                        className="h-full bg-gradient-to-r from-emerald-500 to-cyan-400"
                        style={{
                          width: `${Math.min(
                            100,
                            (v / (topMethods[0][1] || 1)) * 100,
                          )}%`,
                        }}
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>

      {/* Linha 3: Semáforo de motivos */}
      <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
        <Card>
          <header className="mb-3 flex items-center justify-between gap-2">
            <h3 className="text-[12px] font-semibold uppercase tracking-[0.14em] text-slate-300">
              Top motivos · não agendou
            </h3>
            <UserCog className="h-3.5 w-3.5 text-slate-500" />
          </header>
          {topNoAppointment.length === 0 ? (
            <p className="py-6 text-center text-[11.5px] italic text-slate-500">
              Sem motivos registrados
            </p>
          ) : (
            <div className="space-y-2">
              {topNoAppointment.map(([k, v]) => (
                <BarRow
                  key={k}
                  label={NO_APPOINTMENT_LABELS[k] ?? k}
                  value={v}
                  total={topNoAppointment[0][1]}
                  tone="amber"
                />
              ))}
            </div>
          )}
        </Card>

        <Card>
          <header className="mb-3 flex items-center justify-between gap-2">
            <h3 className="text-[12px] font-semibold uppercase tracking-[0.14em] text-slate-300">
              Top motivos · não fechou
            </h3>
            <AlertCircle className="h-3.5 w-3.5 text-slate-500" />
          </header>
          {topNoClose.length === 0 ? (
            <p className="py-6 text-center text-[11.5px] italic text-slate-500">
              Sem motivos registrados
            </p>
          ) : (
            <div className="space-y-2">
              {topNoClose.map(([k, v]) => (
                <BarRow
                  key={k}
                  label={NO_CLOSE_LABELS[k] ?? k}
                  value={v}
                  total={topNoClose[0][1]}
                  tone="rose"
                />
              ))}
            </div>
          )}
        </Card>
      </div>
    </section>
  );
}

function Card({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "rounded-xl border border-white/[0.06] bg-white/[0.015] p-5",
        className,
      )}
    >
      {children}
    </div>
  );
}

function FinanceKpi({
  tone,
  icon,
  label,
  value,
  sub,
  to,
}: {
  tone: ChipTone;
  icon: React.ReactNode;
  label: string;
  value: string;
  sub: string;
  to?: string;
}) {
  const body = (
    <>
      <div className="flex items-center justify-between gap-2">
        <p className="text-[10px] font-semibold uppercase tracking-[0.16em] opacity-80">
          {label}
        </p>
        <span
          className={cn(
            "grid h-7 w-7 place-items-center rounded-md ring-1 ring-inset",
            TONES[tone],
          )}
        >
          {icon}
        </span>
      </div>
      <p className="mt-2 text-[22px] font-bold tabular-nums leading-none text-slate-50">
        {value}
      </p>
      <p className="mt-1.5 text-[10.5px] text-slate-500">{sub}</p>
    </>
  );
  const cls = cn(
    "rounded-xl border p-4 transition",
    "border-white/[0.06] bg-gradient-to-br from-white/[0.025] via-white/[0.01] to-transparent",
    to && "hover:border-white/[0.14] hover:from-white/[0.04]",
  );
  return to ? (
    <Link to={to} className={cn(cls, "block")}>
      {body}
    </Link>
  ) : (
    <div className={cls}>{body}</div>
  );
}

function Legend({
  color,
  label,
  value,
  pct,
}: {
  color: "emerald" | "violet";
  label: string;
  value: string;
  pct: number;
}) {
  const dot =
    color === "emerald"
      ? "bg-gradient-to-r from-emerald-500 to-emerald-300"
      : "bg-gradient-to-r from-violet-500 to-violet-300";
  return (
    <div>
      <div className="flex items-center gap-1.5">
        <span className={cn("h-2 w-2 rounded-full", dot)} />
        <span className="text-[10.5px] font-medium uppercase tracking-wider text-slate-500">
          {label}
        </span>
      </div>
      <p className="mt-1 text-[18px] font-bold tabular-nums text-slate-100">
        {value}
        <span className="ml-1.5 text-[11px] font-medium text-slate-500">
          {pct.toFixed(0)}%
        </span>
      </p>
    </div>
  );
}

function BarRow({
  label,
  value,
  total,
  tone,
}: {
  label: string;
  value: number;
  total: number;
  tone: "amber" | "rose" | "violet" | "emerald";
}) {
  const fill = {
    amber: "bg-gradient-to-r from-amber-500 to-amber-300",
    rose: "bg-gradient-to-r from-rose-500 to-rose-300",
    violet: "bg-gradient-to-r from-violet-500 to-violet-300",
    emerald: "bg-gradient-to-r from-emerald-500 to-emerald-300",
  }[tone];
  const pct = total > 0 ? (value / total) * 100 : 0;
  return (
    <div>
      <div className="mb-0.5 flex items-center justify-between gap-2 text-[12px]">
        <span className="truncate text-slate-300">{label}</span>
        <span className="shrink-0 tabular-nums text-slate-500">{value}</span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-white/[0.04]">
        <div className={cn("h-full", fill)} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}