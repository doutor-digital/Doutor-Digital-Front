import { useQueries } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import {
  AlertCircle, ArrowUpRight, Award, Brain, CalendarRange, Eye, Flame,
  Layers, Map as MapIcon, Network, Send, Tag, Timer,
  type LucideIcon,
} from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { useClinic } from "@/hooks/useClinic";
import { insightsService } from "@/services/insights";
import { cn, formatCurrency, formatNumber, formatPercent } from "@/lib/utils";

type Tone = "emerald" | "sky" | "amber" | "violet" | "rose" | "slate";

const TONES: Record<Tone, { ring: string; bg: string; icon: string; accent: string }> = {
  emerald: { ring: "ring-emerald-500/30", bg: "bg-emerald-500/8",  icon: "text-emerald-300", accent: "text-emerald-200" },
  sky:     { ring: "ring-sky-500/30",     bg: "bg-sky-500/8",      icon: "text-sky-300",     accent: "text-sky-200"     },
  amber:   { ring: "ring-amber-500/30",   bg: "bg-amber-500/8",    icon: "text-amber-300",   accent: "text-amber-200"   },
  violet:  { ring: "ring-violet-500/30",  bg: "bg-violet-500/8",   icon: "text-violet-300",  accent: "text-violet-200"  },
  rose:    { ring: "ring-rose-500/30",    bg: "bg-rose-500/8",     icon: "text-rose-300",    accent: "text-rose-200"    },
  slate:   { ring: "ring-slate-700/40",   bg: "bg-slate-900/60",   icon: "text-slate-300",   accent: "text-slate-100"   },
};

export default function InsightsHubPage() {
  const { unitId } = useClinic();
  const u = unitId || undefined;

  const queries = useQueries({
    queries: [
      { queryKey: ["hub-capi", u],     queryFn: () => insightsService.listCapiEvents({ unitId: u, pageSize: 1 }) },
      { queryKey: ["hub-pixel", u],    queryFn: () => insightsService.pixelHealth({ unitId: u }) },
      { queryKey: ["hub-attr", u],     queryFn: () => insightsService.attributionSummary({ unitId: u }) },
      { queryKey: ["hub-utm", u],      queryFn: () => insightsService.utm({ unitId: u }) },
      { queryKey: ["hub-sla", u],      queryFn: () => insightsService.sla({ unitId: u }) },
      { queryKey: ["hub-heatmap", u],  queryFn: () => insightsService.heatmap({ unitId: u }) },
      { queryKey: ["hub-cohort", u],   queryFn: () => insightsService.cohort({ unitId: u }) },
      { queryKey: ["hub-lost", u],     queryFn: () => insightsService.lostReasons({ unitId: u }) },
      { queryKey: ["hub-forecast", u], queryFn: () => insightsService.forecast({ unitId: u }) },
      { queryKey: ["hub-geo", u],      queryFn: () => insightsService.geo({ unitId: u }) },
      { queryKey: ["hub-quality", u],  queryFn: () => insightsService.qualityScore({ unitId: u }) },
    ],
  });

  const [capi, pixel, attr, utm, sla, heat, cohort, lost, forecast, geo, quality] = queries;

  const cards: HubCardSpec[] = [
    {
      group: "Meta CAPI",
      to: "/insights/capi-events",
      title: "Eventos CAPI",
      description: "Lead, Schedule, Purchase mockados a partir dos leads reais",
      icon: Send,
      tone: "emerald",
      kpi: capi.data?.stats
        ? {
            primary: formatNumber(capi.data.stats.received),
            primaryLabel: "Eventos no período",
            chips: [
              { label: "Sucesso", value: formatPercent(capi.data.stats.successRate) },
              { label: "Falhas", value: formatNumber(capi.data.stats.failed) },
              { label: "Deduped", value: formatNumber(capi.data.stats.deduped) },
            ],
          }
        : undefined,
      loading: capi.isLoading,
      bars: capi.data?.stats?.timeline
        ?.slice(-14)
        .map((t) => t.sent + t.failed + t.deduped) ?? [],
    },
    {
      group: "Meta CAPI",
      to: "/insights/pixel-health",
      title: "Saúde do Pixel",
      description: "Cobertura email/phone/IP/fbp/fbc + EMQ por unidade",
      icon: Eye,
      tone: "sky",
      kpi: pixel.data
        ? {
            primary: pixel.data.averageEmqScore.toFixed(1),
            primaryLabel: "EMQ médio (0-10)",
            chips: [
              { label: "Email", value: `${pixel.data.emailHashCoverage.toFixed(0)}%` },
              { label: "Phone", value: `${pixel.data.phoneHashCoverage.toFixed(0)}%` },
              { label: "fbp",   value: `${pixel.data.fbpCoverage.toFixed(0)}%` },
            ],
          }
        : undefined,
      loading: pixel.isLoading,
      alert: pixel.data?.alerts?.find((a) => a.severity === "critical")?.title
          ?? pixel.data?.alerts?.find((a) => a.severity === "warning")?.title,
    },
    {
      group: "Atribuição",
      to: "/insights/attribution",
      title: "Caminho de Atribuição",
      description: "First / last / linear touch entre origem e conversão",
      icon: Network,
      tone: "violet",
      kpi: attr.data
        ? {
            primary: formatNumber(attr.data.totalConverted),
            primaryLabel: "Conversões atribuídas",
            chips: [
              { label: "Leads", value: formatNumber(attr.data.totalLeads) },
              { label: "Top fonte", value: attr.data.linearBreakdown[0]?.source ?? "—" },
            ],
          }
        : undefined,
      loading: attr.isLoading,
    },
    {
      group: "Atribuição",
      to: "/insights/utm",
      title: "UTM Explorer",
      description: "Drilldown por source/medium/campaign + CPL/ROAS mock",
      icon: Tag,
      tone: "violet",
      kpi: utm.data
        ? {
            primary: formatCurrency(utm.data.mockedCpl),
            primaryLabel: "CPL médio (mock)",
            chips: [
              { label: "Spend", value: formatCurrency(utm.data.mockedAdSpend) },
              { label: "Sources", value: String(utm.data.sources.length) },
            ],
          }
        : undefined,
      loading: utm.isLoading,
    },
    {
      group: "Operacional",
      to: "/insights/sla",
      title: "SLA · 1ª resposta",
      description: "Tempo até primeira mensagem + ranking por atendente",
      icon: Timer,
      tone: "amber",
      kpi: sla.data
        ? {
            primary: `${sla.data.medianFirstResponseMinutes.toFixed(1)}m`,
            primaryLabel: `Mediana · meta ${sla.data.targetMinutes}min`,
            chips: [
              { label: "P90", value: `${sla.data.p90FirstResponseMinutes.toFixed(0)}m` },
              { label: "No SLA",
                value: formatPercent(sla.data.leadsWithFirstResponse > 0
                  ? (100 * sla.data.withinTargetCount) / sla.data.leadsWithFirstResponse
                  : 0) },
            ],
          }
        : undefined,
      loading: sla.isLoading,
    },
    {
      group: "Operacional",
      to: "/insights/heatmap",
      title: "Heatmap",
      description: "Hora × dia da semana — quando os leads chegam",
      icon: Flame,
      tone: "amber",
      kpi: heat.data
        ? {
            primary: formatNumber(heat.data.totalLeads),
            primaryLabel: "Leads no período",
            chips: heat.data.byWeekday?.length
              ? [
                  {
                    label: "Pico",
                    value: heat.data.byWeekday.reduce((a, b) => a.count > b.count ? a : b).label,
                  },
                ]
              : [],
          }
        : undefined,
      loading: heat.isLoading,
      bars: heat.data?.byHour?.map((h) => h.count) ?? [],
    },
    {
      group: "Operacional",
      to: "/insights/cohort",
      title: "Cohort Retention",
      description: "Leads que chegaram em X e converteram em N dias",
      icon: Layers,
      tone: "violet",
      kpi: cohort.data
        ? {
            primary: String(cohort.data.rows.length),
            primaryLabel: `Cohorts · ${cohort.data.granularity}`,
            chips: [
              { label: "Pontos", value: String(cohort.data.days.length) },
              { label: "Total", value: formatNumber(cohort.data.rows.reduce((s, r) => s + r.size, 0)) },
            ],
          }
        : undefined,
      loading: cohort.isLoading,
    },
    {
      group: "Operacional",
      to: "/insights/lost-reasons",
      title: "Motivos de Perda",
      description: "Classificação heurística do texto livre",
      icon: AlertCircle,
      tone: "rose",
      kpi: lost.data
        ? {
            primary: formatNumber(lost.data.totalLost),
            primaryLabel: "Leads perdidos",
            chips: [
              { label: "Top", value: lost.data.reasons[0]?.category ?? "—" },
              { label: "Categorias", value: String(lost.data.reasons.length) },
            ],
          }
        : undefined,
      loading: lost.isLoading,
    },
    {
      group: "Operacional",
      to: "/insights/forecast",
      title: "Forecast",
      description: "Projeção por etapa baseada na taxa histórica",
      icon: CalendarRange,
      tone: "violet",
      kpi: forecast.data
        ? {
            primary: formatCurrency(forecast.data.projectedRevenue),
            primaryLabel: `Receita projetada · ${forecast.data.horizonDays}d`,
            chips: [
              { label: "Abertos", value: formatNumber(forecast.data.openLeadsTotal) },
              { label: "Conv. proj.", value: formatNumber(Math.round(forecast.data.projectedConversions)) },
            ],
          }
        : undefined,
      loading: forecast.isLoading,
      bars: forecast.data?.timeline?.slice(0, 14).map((t) => t.projected) ?? [],
    },
    {
      group: "Distribuição",
      to: "/insights/map",
      title: "Mapa de Leads",
      description: "Cidades, estados e scatter geográfico (mock)",
      icon: MapIcon,
      tone: "sky",
      kpi: geo.data
        ? {
            primary: String(geo.data.cities.length),
            primaryLabel: "Cidades ativas",
            chips: [
              { label: "Estados", value: String(geo.data.states.length) },
              { label: "Top",     value: geo.data.cities[0]?.city ?? "—" },
            ],
          }
        : undefined,
      loading: geo.isLoading,
    },
    {
      group: "Distribuição",
      to: "/insights/quality-score",
      title: "Quality Score",
      description: "Tier S–D = 60% conv + 30% resposta + 10% velocidade",
      icon: Award,
      tone: "emerald",
      kpi: quality.data
        ? {
            primary: quality.data.sources[0]?.qualityScore?.toFixed(1) ?? "—",
            primaryLabel: `Top: ${quality.data.sources[0]?.source ?? "—"}`,
            chips: [
              { label: "Tier", value: quality.data.sources[0]?.tier ?? "—" },
              { label: "Origens", value: String(quality.data.sources.length) },
            ],
          }
        : undefined,
      loading: quality.isLoading,
    },
  ];

  const groups = ["Meta CAPI", "Atribuição", "Operacional", "Distribuição"] as const;

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
      <PageHeader
        title="Insights"
        description="Visão consolidada de tudo que o sistema sabe sobre seus leads — clique num card pra abrir o detalhe."
        badge="Hub"
        actions={
          <Link
            to="/insights/system"
            className="inline-flex items-center gap-1.5 rounded-md bg-violet-500/10 px-3 py-1.5 text-[11.5px] font-medium text-violet-200 ring-1 ring-violet-500/30 hover:bg-violet-500/20"
          >
            <Brain className="h-3.5 w-3.5" />
            Ver mapa do sistema
          </Link>
        }
      />

      {groups.map((g) => {
        const groupCards = cards.filter((c) => c.group === g);
        return (
          <section key={g}>
            <div className="mb-2 flex items-center gap-2">
              <span className="text-[10px] uppercase tracking-[0.22em] text-slate-500 font-semibold">{g}</span>
              <div className="flex-1 h-px bg-white/[0.04]" />
              <span className="text-[10px] text-slate-600 tabular-nums">{groupCards.length} {groupCards.length === 1 ? "card" : "cards"}</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {groupCards.map((c) => <HubCard key={c.to} card={c} />)}
            </div>
          </section>
        );
      })}
    </div>
  );
}

interface HubCardSpec {
  group: string;
  to: string;
  title: string;
  description: string;
  icon: LucideIcon;
  tone: Tone;
  loading: boolean;
  kpi?: {
    primary: string;
    primaryLabel: string;
    chips: Array<{ label: string; value: string }>;
  };
  bars?: number[];
  alert?: string;
}

function HubCard({ card }: { card: HubCardSpec }) {
  const t = TONES[card.tone];
  const Icon = card.icon;

  return (
    <Link
      to={card.to}
      className={cn(
        "group relative overflow-hidden rounded-2xl border border-white/[0.05] bg-slate-900/70 p-5 transition-all",
        "hover:border-white/[0.1] hover:translate-y-[-1px] hover:shadow-lg hover:shadow-black/30",
      )}
    >
      <div className={cn("absolute -top-12 -right-12 h-32 w-32 rounded-full opacity-50 blur-2xl", t.bg)} />

      <div className="relative">
        <div className="flex items-start justify-between mb-3">
          <div className={cn("h-10 w-10 rounded-lg ring-1 ring-inset grid place-items-center", t.ring, t.bg)}>
            <Icon className={cn("h-4.5 w-4.5", t.icon)} />
          </div>
          <ArrowUpRight className="h-4 w-4 text-slate-600 group-hover:text-slate-300 transition-colors" />
        </div>

        <h3 className="text-[14px] font-semibold text-slate-100 leading-tight">{card.title}</h3>
        <p className="mt-1 text-[11.5px] text-slate-500 leading-relaxed line-clamp-2">{card.description}</p>

        {card.loading ? (
          <div className="mt-4 space-y-2">
            <div className="h-7 w-24 rounded bg-white/[0.04] animate-pulse" />
            <div className="h-3 w-32 rounded bg-white/[0.03] animate-pulse" />
          </div>
        ) : card.kpi ? (
          <>
            <div className="mt-4">
              <p className={cn("text-[26px] leading-none font-extrabold tabular-nums tracking-tight", t.accent)}>
                {card.kpi.primary}
              </p>
              <p className="mt-1 text-[10.5px] uppercase tracking-widest text-slate-500">
                {card.kpi.primaryLabel}
              </p>
            </div>

            {card.bars && card.bars.length > 0 && (
              <Spark bars={card.bars} tone={card.tone} />
            )}

            {card.kpi.chips.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-1.5">
                {card.kpi.chips.map((c) => (
                  <span
                    key={c.label}
                    className="inline-flex items-center gap-1 rounded-md bg-white/[0.03] px-2 py-0.5 text-[10.5px] text-slate-400 ring-1 ring-inset ring-white/[0.04]"
                  >
                    <span className="text-slate-600">{c.label}</span>
                    <span className="text-slate-200 font-medium">{c.value}</span>
                  </span>
                ))}
              </div>
            )}

            {card.alert && (
              <div className="mt-3 inline-flex items-center gap-1.5 rounded-md bg-amber-500/10 px-2 py-1 text-[10.5px] text-amber-200 ring-1 ring-inset ring-amber-500/30">
                <AlertCircle className="h-3 w-3" />
                <span className="truncate">{card.alert}</span>
              </div>
            )}
          </>
        ) : (
          <p className="mt-4 text-[11.5px] text-slate-500">Sem dados no período.</p>
        )}
      </div>
    </Link>
  );
}

function Spark({ bars, tone }: { bars: number[]; tone: Tone }) {
  const max = Math.max(1, ...bars);
  const fill = {
    emerald: "bg-emerald-400/60",
    sky: "bg-sky-400/60",
    amber: "bg-amber-400/60",
    violet: "bg-violet-400/60",
    rose: "bg-rose-400/60",
    slate: "bg-slate-400/60",
  }[tone];
  return (
    <div className="mt-3 flex items-end gap-[2px] h-8">
      {bars.map((v, i) => (
        <div
          key={i}
          className={cn("flex-1 rounded-sm min-w-[2px]", fill)}
          style={{ height: `${Math.max(4, (v / max) * 100)}%` }}
        />
      ))}
    </div>
  );
}
