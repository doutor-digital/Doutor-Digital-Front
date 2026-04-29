import { useQueries } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import {
  AlertCircle, Award, CalendarRange, Eye, Flame, Layers, Map as MapIcon,
  MessageCircle, Network, Send, Tag, Target, Timer, TrendingUp,
  type LucideIcon,
} from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { useClinic } from "@/hooks/useClinic";
import { insightsService } from "@/services/insights";
import { cn, formatNumber } from "@/lib/utils";

/**
 * Visualização do fluxo de dados:
 *
 *   ┌─ Webhook Meta ──┐
 *   │                 │
 *   │ Cloudia/N8N ────┼──► Origin Events ──► Leads ──┬──► CAPI Events ──► Pixel Health
 *   │                 │                              │
 *   │ Pixel browser ──┘                              ├──► Atribuição (path / UTM)
 *   │                                                ├──► Operacional (SLA / Heatmap / Cohort / Lost / Forecast)
 *   │                                                └──► Distribuição (Mapa / Quality Score)
 *
 * Cada node é clicável e leva pra página correspondente.
 */
export default function SystemOverviewPage() {
  const { unitId } = useClinic();
  const u = unitId || undefined;

  const queries = useQueries({
    queries: [
      { queryKey: ["sys-capi", u],     queryFn: () => insightsService.listCapiEvents({ unitId: u, pageSize: 1 }) },
      { queryKey: ["sys-pixel", u],    queryFn: () => insightsService.pixelHealth({ unitId: u }) },
      { queryKey: ["sys-attr", u],     queryFn: () => insightsService.attributionSummary({ unitId: u }) },
      { queryKey: ["sys-utm", u],      queryFn: () => insightsService.utm({ unitId: u }) },
      { queryKey: ["sys-sla", u],      queryFn: () => insightsService.sla({ unitId: u }) },
      { queryKey: ["sys-heat", u],     queryFn: () => insightsService.heatmap({ unitId: u }) },
      { queryKey: ["sys-cohort", u],   queryFn: () => insightsService.cohort({ unitId: u }) },
      { queryKey: ["sys-lost", u],     queryFn: () => insightsService.lostReasons({ unitId: u }) },
      { queryKey: ["sys-forecast", u], queryFn: () => insightsService.forecast({ unitId: u }) },
      { queryKey: ["sys-geo", u],      queryFn: () => insightsService.geo({ unitId: u }) },
      { queryKey: ["sys-quality", u],  queryFn: () => insightsService.qualityScore({ unitId: u }) },
    ],
  });

  const [capi, pixel, attr, utm, sla, heat, cohort, lost, forecast, geo, quality] = queries;

  const totalLeads = capi.data?.stats?.received ?? 0;

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
      <PageHeader
        title="Mapa do Sistema"
        description="Como os dados fluem da fonte (webhooks) até cada análise — clique nos nós."
        badge="Insights · Arquitetura"
        actions={
          <Link to="/insights"
            className="inline-flex items-center gap-1.5 rounded-md bg-white/[0.03] px-3 py-1.5 text-[11.5px] text-slate-300 ring-1 ring-white/[0.06] hover:bg-white/[0.06]">
            ← Voltar ao hub
          </Link>
        }
      />

      <Legend />

      {/* ─── Layer 1: ingest ───────────────────────────────────────────── */}
      <Layer
        title="1. Ingest"
        subtitle="Eventos chegando ao backend"
      >
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <SourceNode icon={MessageCircle} label="Webhook Meta" sub="WhatsApp + CTWA" tone="emerald" />
          <SourceNode icon={Network} label="Cloudia / n8n" sub="Sync de leads" tone="sky" />
          <SourceNode icon={Eye} label="Pixel browser" sub="Lado cliente" tone="violet" />
        </div>
      </Layer>

      <Connector label="parse + dedup" />

      {/* ─── Layer 2: storage ──────────────────────────────────────────── */}
      <Layer title="2. Storage" subtitle="Tabelas core do banco">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <StorageNode icon={Target} label="Origin Events" sub="origem real do contato" />
          <StorageNode icon={Network} label="Lead Attributions" sub="match origem ↔ lead" highlight />
          <StorageNode icon={TrendingUp} label="Leads" sub={`${formatNumber(totalLeads)} no período`} highlight />
        </div>
      </Layer>

      <Connector label="agregação · /api/insights/*" />

      {/* ─── Layer 3: insights ─────────────────────────────────────────── */}
      <Layer title="3. Insights" subtitle="As 11 visões disponíveis">
        <NodeGroup title="Meta CAPI" tone="emerald">
          <Node icon={Send} label="Eventos CAPI" to="/insights/capi-events"
            metric={capi.data?.stats?.received} metricLabel="eventos" loading={capi.isLoading} tone="emerald" />
          <Node icon={Eye} label="Saúde do Pixel" to="/insights/pixel-health"
            metric={pixel.data?.averageEmqScore} metricLabel="EMQ /10" suffix="" decimals={1}
            loading={pixel.isLoading} tone="sky" />
        </NodeGroup>

        <NodeGroup title="Atribuição" tone="violet">
          <Node icon={Network} label="Caminho" to="/insights/attribution"
            metric={attr.data?.totalConverted} metricLabel="convertidos" loading={attr.isLoading} tone="violet" />
          <Node icon={Tag} label="UTM Explorer" to="/insights/utm"
            metric={utm.data?.sources?.length} metricLabel="sources" loading={utm.isLoading} tone="violet" />
        </NodeGroup>

        <NodeGroup title="Operacional" tone="amber">
          <Node icon={Timer} label="SLA · 1ª resposta" to="/insights/sla"
            metric={sla.data?.medianFirstResponseMinutes} metricLabel="min mediana"
            decimals={1} loading={sla.isLoading} tone="amber" />
          <Node icon={Flame} label="Heatmap" to="/insights/heatmap"
            metric={heat.data?.totalLeads} metricLabel="leads" loading={heat.isLoading} tone="amber" />
          <Node icon={Layers} label="Cohort" to="/insights/cohort"
            metric={cohort.data?.rows?.length} metricLabel="cohorts" loading={cohort.isLoading} tone="violet" />
          <Node icon={AlertCircle} label="Motivos de perda" to="/insights/lost-reasons"
            metric={lost.data?.totalLost} metricLabel="perdidos" loading={lost.isLoading} tone="rose" />
          <Node icon={CalendarRange} label="Forecast" to="/insights/forecast"
            metric={forecast.data?.openLeadsTotal} metricLabel="abertos"
            loading={forecast.isLoading} tone="violet" />
        </NodeGroup>

        <NodeGroup title="Distribuição" tone="sky">
          <Node icon={MapIcon} label="Mapa de leads" to="/insights/map"
            metric={geo.data?.cities?.length} metricLabel="cidades" loading={geo.isLoading} tone="sky" />
          <Node icon={Award} label="Quality Score" to="/insights/quality-score"
            metric={quality.data?.sources?.length} metricLabel="origens"
            loading={quality.isLoading} tone="emerald" />
        </NodeGroup>
      </Layer>
    </div>
  );
}

// ─── Layout primitives ──────────────────────────────────────────────────────

function Layer({ title, subtitle, children }: {
  title: string; subtitle: string; children: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-white/[0.06] bg-slate-900/40 p-4 md:p-5">
      <div className="mb-4 flex items-baseline gap-2">
        <span className="text-[10px] font-bold uppercase tracking-[0.22em] text-slate-500">{title}</span>
        <span className="text-[11px] text-slate-500">{subtitle}</span>
      </div>
      {children}
    </div>
  );
}

function Connector({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-3 px-2">
      <div className="h-6 w-px bg-gradient-to-b from-white/[0.1] via-white/[0.05] to-transparent ml-6" />
      <div className="flex items-center gap-2">
        <span className="h-1 w-1 rounded-full bg-emerald-400" />
        <span className="text-[10px] uppercase tracking-widest text-slate-600">{label}</span>
      </div>
      <div className="flex-1 h-px bg-white/[0.04]" />
    </div>
  );
}

function NodeGroup({ title, tone, children }: {
  title: string; tone: "emerald" | "violet" | "amber" | "sky"; children: React.ReactNode;
}) {
  const accent = {
    emerald: "text-emerald-300 bg-emerald-500/8 ring-emerald-500/20",
    violet:  "text-violet-300 bg-violet-500/8 ring-violet-500/20",
    amber:   "text-amber-300 bg-amber-500/8 ring-amber-500/20",
    sky:     "text-sky-300 bg-sky-500/8 ring-sky-500/20",
  }[tone];
  return (
    <div className="mb-4 last:mb-0">
      <div className="mb-2 flex items-center gap-2">
        <span className={cn("inline-flex items-center rounded-md px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest ring-1 ring-inset", accent)}>
          {title}
        </span>
        <div className="flex-1 h-px bg-white/[0.04]" />
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2.5">
        {children}
      </div>
    </div>
  );
}

// ─── Atoms ──────────────────────────────────────────────────────────────────

function SourceNode({ icon: Icon, label, sub, tone }: {
  icon: LucideIcon; label: string; sub: string; tone: "emerald" | "sky" | "violet";
}) {
  const c = {
    emerald: "ring-emerald-500/30 bg-emerald-500/[0.06] text-emerald-300",
    sky:     "ring-sky-500/30 bg-sky-500/[0.06] text-sky-300",
    violet:  "ring-violet-500/30 bg-violet-500/[0.06] text-violet-300",
  }[tone];
  return (
    <div className={cn("rounded-xl ring-1 ring-inset p-4 flex items-center gap-3", c)}>
      <div className="h-9 w-9 rounded-lg bg-white/5 grid place-items-center shrink-0">
        <Icon className="h-4 w-4" />
      </div>
      <div className="min-w-0">
        <p className="text-[13px] font-semibold text-slate-100">{label}</p>
        <p className="text-[10.5px] text-slate-500">{sub}</p>
      </div>
    </div>
  );
}

function StorageNode({ icon: Icon, label, sub, highlight }: {
  icon: LucideIcon; label: string; sub: string; highlight?: boolean;
}) {
  return (
    <div className={cn(
      "rounded-xl border p-4 flex items-center gap-3 backdrop-blur-sm",
      highlight ? "border-emerald-500/30 bg-emerald-500/[0.04]" : "border-white/[0.06] bg-slate-900/60",
    )}>
      <div className={cn("h-9 w-9 rounded-lg grid place-items-center shrink-0",
        highlight ? "bg-emerald-500/10 text-emerald-300" : "bg-white/[0.04] text-slate-300")}>
        <Icon className="h-4 w-4" />
      </div>
      <div className="min-w-0">
        <p className="text-[13px] font-semibold text-slate-100">{label}</p>
        <p className="text-[10.5px] text-slate-500">{sub}</p>
      </div>
    </div>
  );
}

function Node({
  icon: Icon, label, to, metric, metricLabel, loading, tone, decimals = 0, suffix,
}: {
  icon: LucideIcon;
  label: string;
  to: string;
  metric?: number;
  metricLabel: string;
  loading?: boolean;
  tone: "emerald" | "sky" | "amber" | "violet" | "rose";
  decimals?: number;
  suffix?: string;
}) {
  const c = {
    emerald: { ring: "ring-emerald-500/25 hover:ring-emerald-500/40", icon: "text-emerald-300", bg: "bg-emerald-500/[0.04]" },
    sky:     { ring: "ring-sky-500/25 hover:ring-sky-500/40",         icon: "text-sky-300",     bg: "bg-sky-500/[0.04]"     },
    amber:   { ring: "ring-amber-500/25 hover:ring-amber-500/40",     icon: "text-amber-300",   bg: "bg-amber-500/[0.04]"   },
    violet:  { ring: "ring-violet-500/25 hover:ring-violet-500/40",   icon: "text-violet-300",  bg: "bg-violet-500/[0.04]"  },
    rose:    { ring: "ring-rose-500/25 hover:ring-rose-500/40",       icon: "text-rose-300",    bg: "bg-rose-500/[0.04]"    },
  }[tone];
  const value = typeof metric === "number"
    ? (decimals > 0 ? metric.toFixed(decimals) : formatNumber(metric))
    : "—";

  return (
    <Link
      to={to}
      className={cn(
        "group rounded-lg ring-1 ring-inset p-3 transition-all hover:translate-y-[-1px]",
        c.ring, c.bg,
      )}
    >
      <div className="flex items-start justify-between mb-2">
        <div className={cn("h-7 w-7 rounded-md bg-white/5 grid place-items-center", c.icon)}>
          <Icon className="h-3.5 w-3.5" />
        </div>
        <span className="text-[9px] uppercase tracking-widest text-slate-600 group-hover:text-slate-400">→</span>
      </div>
      <p className="text-[11.5px] font-semibold text-slate-100 leading-tight truncate">{label}</p>
      {loading ? (
        <div className="mt-2 h-5 w-12 rounded bg-white/[0.04] animate-pulse" />
      ) : (
        <div className="mt-1.5">
          <p className="text-[18px] leading-none font-extrabold text-slate-50 tabular-nums">
            {value}{suffix ?? ""}
          </p>
          <p className="text-[9.5px] uppercase tracking-widest text-slate-500 mt-0.5">{metricLabel}</p>
        </div>
      )}
    </Link>
  );
}

function Legend() {
  return (
    <div className="flex flex-wrap items-center gap-3 rounded-xl border border-white/[0.05] bg-white/[0.02] p-3 text-[11px] text-slate-400">
      <span className="text-[10px] uppercase tracking-widest text-slate-500 font-semibold">Legenda</span>
      <Dot color="bg-emerald-400" label="ingest / fonte" />
      <Dot color="bg-slate-300"   label="storage" />
      <Dot color="bg-violet-400"  label="agregação" />
      <span className="ml-auto text-[10.5px] text-slate-500">
        Clique em qualquer nó da camada 3 pra ir ao detalhe.
      </span>
    </div>
  );
}

function Dot({ color, label }: { color: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className={cn("h-1.5 w-1.5 rounded-full", color)} />
      <span>{label}</span>
    </span>
  );
}
