import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import {
  Area,
  AreaChart,
  ResponsiveContainer,
  Tooltip,
} from "recharts";
import {
  cn,
  formatNumber,
  formatPercent,
  truncate,
  formatDate,
} from "@/lib/utils";
import { Button } from "@/components/ui/Button";
import { webhooksService } from "@/services/webhooks";
import { contactsService } from "@/services/contacts";
import { metricsService } from "@/services/metrics";
import { useClinic } from "@/hooks/useClinic";
import { useAuth } from "@/hooks/useAuth";
import {
  DashboardFilters,
  DashboardFiltersState,
  defaultFilters,
} from "@/components/filters/DashboardFilters";
import { SnapshotButton } from "@/components/global/SnapshotButton";

/* ============================================================
 * Ícones — cole abaixo as URLs das imagens (copiadas da internet).
 * Cada chave é referenciada via <IconImg src={ICONS.xxx} ... />.
 * ========================================================== */

const ICONS = {
  alertCircle: "",
  alertTriangle: "",
  calendar: "",
  calendarCheck: "",
  checkCircle: "",
  chevronDown: "",
  clipboardList: "",
  clock: "https://cdn-icons-png.flaticon.com/512/5772/5772632.png",
  cloudDownload: "https://cdn-icons-png.flaticon.com/512/4911/4911643.png",
  headset: "https://cdn-icons-png.flaticon.com/512/3576/3576867.png",
  info: "",
  messageCircle: "",
  percent: "https://png.pngtree.com/png-clipart/20230805/original/pngtree-rounded-vector-icon-of-ecofriendly-sales-funnel-in-flat-green-color-vector-picture-image_9728714.png",
  phone: "",
  target: "",
  userPlus: "https://cdn-icons-png.flaticon.com/512/12774/12774902.png",
  webhook: "https://i.sstatic.net/S3SNU.jpg",
} as const;

function IconImg({
  src,
  className,
  alt = "",
}: {
  src: string;
  className?: string;
  alt?: string;
}) {
  return (
    <img src={src} alt={alt} className={cn("object-contain", className)} />
  );
}

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

  const [filters, setFilters] = useState<DashboardFiltersState>(defaultFilters);
  const [period] = useState<string>("Hoje");

  /* ----- Queries ----- */
  const overviewClinicId = tenantId ?? unitId ?? undefined;
  const overview = useQuery({
    queryKey: [
      "dashboard-overview",
      overviewClinicId,
      unitId,
      filters.startDate,
      filters.endDate,
    ],
    queryFn: () =>
      webhooksService.dashboardOverview({
        clinicId: overviewClinicId,
        dateFrom: filters.startDate,
        dateTo: filters.endDate,
        unitId: unitId || undefined,
      }),
    enabled: !!overviewClinicId,
    placeholderData: (prev) => prev,
  });

  const evolucaoClinicId = unitId ?? tenantId ?? undefined;
  const evolucao = useQuery({
    queryKey: [
      "evolution-range",
      evolucaoClinicId,
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
      }),
    enabled: !!evolucaoClinicId,
  });

  const resumoLive = useQuery({
    queryKey: ["live-resumo", unitId],
    queryFn: () => metricsService.resumo(unitId || undefined),
    refetchInterval: 30_000,
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
  if (resumoLive.data?.tempoMedio && resumoLive.data.tempoMedio > 60) {
    alerts.push({
      id: "queue-long",
      severity: "info",
      title: "Leads aguardando há mais de 1 hora",
      detail: "Recomendamos prioridade no atendimento",
      time: "15 min atrás",
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
              <IconImg src={ICONS.calendarCheck} className="h-4 w-4" /> Relatório
            </Button>
          </Link>
          <button
            type="button"
            className="inline-flex items-center gap-2 rounded-md border border-white/[0.06] bg-white/[0.02] px-3 py-1.5 text-[12.5px] text-slate-200 transition hover:bg-white/[0.04]"
          >
            <IconImg src={ICONS.calendar} className="h-3.5 w-3.5" />
            Período: {period}
            <IconImg src={ICONS.chevronDown} className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {/* ---- Filtros (mantidos do código original) ---- */}
      <DashboardFilters
        value={filters}
        onChange={setFilters}
        onSearch={handleSearch}
      />

      {/* ---- Linha de mini KPIs (6 colunas) ---- */}
      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 xl:grid-cols-6">
        <MiniKpi
          icon={<IconImg src={ICONS.userPlus} className="h-20 w-20" />}
          tone="sky"
          value={overviewLoading ? "…" : formatNumber(total)}
          label="leads no total"
        />
        <MiniKpi
          icon={<IconImg src={ICONS.webhook} className="h-20 w-20" />}
          tone="violet"
          value={
            contatosCounts.isLoading ? "…" : formatNumber(webhookCount)
          }
          label="webhook"
        />
        <MiniKpi
          icon={<IconImg src={ICONS.cloudDownload} className="h-20 w-20" />}
          tone="cyan"
          value={
            contatosCounts.isLoading ? "…" : formatNumber(importedCount)
          }
          label="importados"
        />
        <MiniKpi
          icon={<IconImg src={ICONS.clock} className="h-20 w-20" />}
          tone="amber"
          value={overviewLoading ? "…" : formatNumber(inQueue)}
          label="na fila"
        />
        <MiniKpi
          icon={<IconImg src={ICONS.headset} className="h-20 w-20" />}
          tone="emerald"
          value={overviewLoading ? "…" : formatNumber(inService)}
          label="em atendimento"
        />
        <MiniKpi
          icon={<IconImg src={ICONS.percent} className="h-20 w-20" />}
          tone="fuchsia"
          value={overviewLoading ? "…" : formatPercent(conversao)}
          label="de conversão"
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

      {/* ---- KPIs grandes com sparkline ---- */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <ChartKpi
          label="Total de leads"
          value={formatNumber(total)}
          data={evoSeries}
          stroke="#38bdf8"
          chip="bg-sky-500/10 text-sky-300 ring-sky-500/25"
          icon={<IconImg src={ICONS.userPlus} className="h-4 w-4" />}
          delta={change !== null ? `${Math.abs(change).toFixed(1)}%` : "—"}
          deltaUp={changeUp}
          loading={overviewLoading || evolucao.isLoading}
        />
        <ChartKpi
          label="Em atendimento"
          value={formatNumber(inService)}
          data={evoServiceSeries}
          stroke="#34d399"
          chip="bg-emerald-500/10 text-emerald-300 ring-emerald-500/25"
          icon={<IconImg src={ICONS.headset} className="h-4 w-4" />}
          delta="8.3%"
          deltaUp
          loading={overviewLoading}
        />
        <ChartKpi
          label="Na fila"
          value={formatNumber(inQueue)}
          data={evoQueueSeries}
          stroke="#fbbf24"
          chip="bg-amber-500/10 text-amber-300 ring-amber-500/25"
          icon={<IconImg src={ICONS.clock} className="h-4 w-4" />}
          delta="33.3%"
          deltaUp={false}
          loading={overviewLoading}
        />
        <ChartKpi
          label="Taxa de conversão"
          value={formatPercent(conversao)}
          data={evoConvSeries}
          stroke="#e879f9"
          chip="bg-fuchsia-500/10 text-fuchsia-300 ring-fuchsia-500/25"
          icon={<IconImg src={ICONS.percent} className="h-4 w-4" />}
          delta="0.6 p.p."
          deltaUp
          loading={overviewLoading}
        />
      </div>

      {/* ---- Funil: comparecimento / fechamento / recuperação ---- */}
      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 xl:grid-cols-6">
        <FunnelKpi
          tone="amber"
          value={overviewLoading ? "…" : formatNumber(consultasAgendadas)}
          label="consultas agendadas"
        />
        <FunnelKpi
          tone="emerald"
          value={overviewLoading ? "…" : formatNumber(compareceuCount)}
          label="compareceram"
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
}

function FunnelKpi({ tone, value, label }: FunnelKpiProps) {
  return (
    <div
      className={cn(
        "rounded-lg border border-white/[0.06] bg-white/[0.02] px-3 py-2.5 ring-1 ring-inset",
        TONES[tone],
      )}
    >
      <div className="text-[18px] font-semibold tabular-nums">{value}</div>
      <div className="mt-0.5 text-[10.5px] uppercase tracking-wider opacity-80">
        {label}
      </div>
    </div>
  );
}

/* ============================================================
 * Sub-componentes
 * ========================================================== */

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
          <IconImg src={ICONS.target} className="h-5 w-5" />
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
  data: { label: string; v: number }[];
  stroke: string;
  chip: string;
  icon: React.ReactNode;
  delta: string;
  deltaUp: boolean;
  loading?: boolean;
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
}: ChartKpiProps) {
  const gradId = `grad-${label.replace(/\s+/g, "-").toLowerCase()}`;

  return (
    <div className="group relative overflow-hidden rounded-xl border border-white/[0.06] bg-white/[0.015] p-5 transition hover:border-white/[0.1] hover:bg-white/[0.025]">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-1.5">
          <p className="text-[10.5px] font-semibold uppercase tracking-[0.16em] text-slate-400">
            {label}
          </p>
          <IconImg src={ICONS.info} className="h-3 w-3" />
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
                formatter={(val) => [val ?? "—", label]}
              />
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
        icon: <IconImg src={ICONS.phone} className="h-4 w-4" />,
        bg: TONES.sky,
      };
    case "form":
      return {
        icon: <IconImg src={ICONS.clipboardList} className="h-4 w-4" />,
        bg: TONES.indigo,
      };
    case "converted":
      return {
        icon: <IconImg src={ICONS.checkCircle} className="h-4 w-4" />,
        bg: TONES.emerald,
      };
    case "scheduled":
      return {
        icon: <IconImg src={ICONS.calendarCheck} className="h-4 w-4" />,
        bg: TONES.amber,
      };
    default:
      return {
        icon: <IconImg src={ICONS.messageCircle} className="h-4 w-4" />,
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
      return <IconImg src={ICONS.alertTriangle} className="h-4 w-4" />;
    case "warn":
      return <IconImg src={ICONS.alertCircle} className="h-4 w-4" />;
    case "info":
      return <IconImg src={ICONS.info} className="h-4 w-4" />;
    case "violet":
      return <IconImg src={ICONS.target} className="h-4 w-4" />;
  }
}

function AlertsPanel({ items }: { items: AlertItem[] }) {
  return (
    <section className="rounded-xl border border-white/[0.06] bg-white/[0.015]">
      <header className="flex items-center justify-between border-b border-white/[0.05] px-5 py-3.5">
        <div className="flex items-center gap-2">
          <IconImg src={ICONS.alertTriangle} className="h-4 w-4" />
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