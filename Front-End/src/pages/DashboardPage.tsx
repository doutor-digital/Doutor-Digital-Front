// src/pages/DashboardPage.tsx

import { Suspense, lazy, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  AlertTriangle, Bell, CalendarCheck,
  CheckCircle2, FileUp, Moon, Sparkles, Sunrise,
  TrendingUp, Users, Webhook,
} from "lucide-react";
import { Link } from "react-router-dom";
import { cn, formatNumber, formatPercent, truncate, formatDate } from "@/lib/utils";
import { PageHeader } from "@/components/layout/PageHeader";
import { KpiCard } from "@/components/kpi/KpiCard";
import { Card, CardHeader, CardBody } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { StateBadge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
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

// ─── Lazy charts ──────────────────────────────────────────────────────────────

const FunnelChart = lazy(() =>
  import("@/components/charts/FunnelChart").then((m) => ({ default: m.FunnelChart }))
);
const EvolutionLine = lazy(() =>
  import("@/components/charts/EvolutionLine").then((m) => ({ default: m.EvolutionLine }))
);
const SourceDonut = lazy(() =>
  import("@/components/charts/SourceDonut").then((m) => ({ default: m.SourceDonut }))
);

// ─── Helpers ──────────────────────────────────────────────────────────────────

function greeting() {
  const h = new Date().getHours();
  if (h < 12) return "Bom dia";
  if (h < 18) return "Boa tarde";
  return "Boa noite";
}

const GROUP_LABEL: Record<string, string> = {
  day: "dia",
  week: "semana",
  month: "mês",
  quarter: "trimestre",
};
const COMPARE_LABEL: Record<string, string> = {
  none: "sem comparação",
  previous_period: "vs período anterior",
  previous_year: "vs mesmo período/ano",
};

function evolutionSubtitle(
  filters: DashboardFiltersState,
  total?: number,
  change?: number | null,
  compare?: string
): string {
  const parts: string[] = [];
  parts.push(`${filters.startDate} → ${filters.endDate}`);
  parts.push(`por ${GROUP_LABEL[filters.granularity] ?? filters.granularity}`);
  if (typeof total === "number") parts.push(`${total} leads`);
  if (compare && compare !== "none" && change !== null && change !== undefined) {
    const sign = change >= 0 ? "+" : "";
    parts.push(`${sign}${change.toFixed(1)}% ${COMPARE_LABEL[compare] ?? ""}`);
  }
  return parts.join(" · ");
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function DashboardPage() {
  const { tenantId, unitId } = useClinic();
  const { user } = useAuth();
  const fullName = user?.name?.trim() || user?.email?.split("@")[0] || "Convidado";
  const firstName = fullName.split(" ")[0];

  const [filters, setFilters] = useState<DashboardFiltersState>(defaultFilters);

  // ── Queries ──────────────────────────────────────────────────────────────────

  // Overview consolidado — TODOS os KPIs reagem aos filtros de período + unidade
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

  // Evolução temporal (série do gráfico) — mesmos filtros + granularidade/compare
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
    queryKey:       ["live-resumo", unitId],
    queryFn:        () => metricsService.resumo(unitId || undefined),
    refetchInterval: 30_000,
  });
  const ativos = useQuery({
    queryKey: ["active", unitId],
    queryFn:  () => webhooksService.activeLeads({ limit: 10, unitId: unitId || undefined }),
  });
  const amanheceuQuery = useQuery({
    queryKey: ["amanheceu", 8020],
    queryFn:  () => webhooksService.amanheceu({ clinicId: 8020 }),
    refetchInterval: 60_000,
  });
  const contatosCounts = useQuery({
    queryKey: ["contacts", "counts", tenantId],
    queryFn:  () =>
      contactsService.list({
        clinicId: tenantId ?? undefined,
        pageSize: 1,
        origem: "all",
      }),
    enabled:  tenantId !== null,
  });

  // ── Derivados (todos saem do overview → reagem aos filtros) ───────────────────

  const ov            = overview.data;
  const overviewLoading = overview.isLoading;
  const total         = ov?.total_leads ?? 0;
  const consultasNum  = ov?.consultas ?? 0;
  const comPagNum     = ov?.com_pagamento ?? 0;
  const semPagNum     = ov?.sem_pagamento ?? 0;
  const statesData    = ov?.states;
  const conversao     = ov?.conversao_rate ?? 0;
  const pagamentoRate = ov?.pagamento_rate ?? 0;
  const semPagRate    = ov?.sem_pagamento_rate ?? 0;
  const donutData     = (ov?.origens ?? []).slice(0, 8).map((o) => ({
    name:  o.origem   ?? "—",
    value: o.quantidade ?? 0,
  }));
  // Normaliza pro shape esperado pelo card de distribuição (stage, count)
  const etapaData     = (ov?.etapas ?? []).map((e) => ({
    stage: e.etapa ?? "SEM_ETAPA",
    count: e.quantidade ?? 0,
  }));

  function handleSearch() {
    overview.refetch();
    evolucao.refetch();
  }

  // ── Render ───────────────────────────────────────────────────────────────────

  return (
    <>
      {/* ══ Header ══════════════════════════════════════════════ */}
      <PageHeader
        title="Visão geral"
        badge="Clínica"
        backgroundImage="https://i.postimg.cc/2ynCmp8g/banner.jpg"
        description={
          unitId
            ? `Performance consolidada · unitId: ${unitId}`
            : "Performance consolidada — selecione um Unit ID na topbar para filtrar."
        }
        actions={
          <>
            <Link to="/live">
              <Button
                variant="outline"
                size="sm"
                className="relative border-red-500/60 bg-red-500/10 text-red-400 hover:border-red-400 hover:bg-red-500/20 hover:text-red-300"
              >
                <span className="relative flex h-2.5 w-2.5">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-400 opacity-75" />
                  <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-red-500" />
                </span>
                Ao vivo
              </Button>
            </Link>
            <Link to="/reports">
              <Button size="sm">
                <CalendarCheck className="h-4 w-4" /> Gerar relatório
              </Button>
            </Link>
          </>
        }
      />

      {/* ══ Boas-vindas ══════════════════════════════════════════ */}
      <div
        className={cn(
          "relative mb-4 overflow-hidden rounded-2xl",
          "border border-white/[0.07] bg-[rgba(255,255,255,0.02)]",
          "shadow-[0_1px_3px_rgba(0,0,0,0.2),inset_0_1px_0_rgba(255,255,255,0.04)]",
          "px-6 py-5"
        )}
      >
        {/* Orb decorativo */}
        <div className="pointer-events-none absolute -right-10 -top-10 h-48 w-48 rounded-full bg-brand-500/8 blur-3xl" />

        <div className="relative flex flex-col gap-4 md:flex-row md:items-center md:justify-between">

          {/* Avatar + saudação */}
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-brand-400 to-violet-600 text-[15px] font-black text-white shadow-[0_0_14px_rgba(139,92,246,0.35)]">
              {firstName.charAt(0).toUpperCase()}
            </div>
            <div>
              <p className="text-[12px] text-slate-500">{greeting()},</p>
              <p className="text-[18px] font-bold leading-tight text-slate-100">
                {firstName} 👋
              </p>
              <p className="mt-0.5 text-[11px] text-slate-500">
                {new Date().toLocaleDateString("pt-BR", {
                  weekday: "long",
                  day:     "2-digit",
                  month:   "long",
                })}
              </p>
            </div>
          </div>

          {/* Badges de atualização */}
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-2 rounded-xl border border-emerald-500/20 bg-emerald-500/8 px-3 py-2 text-[11px] font-semibold text-emerald-400">
              <TrendingUp className="h-3.5 w-3.5 shrink-0" />
              {overviewLoading ? "…" : `${total} leads no total`}
            </div>
            <div className="flex items-center gap-2 rounded-xl border border-violet-500/20 bg-violet-500/8 px-3 py-2 text-[11px] font-semibold text-violet-300">
              <Webhook className="h-3.5 w-3.5 shrink-0" />
              {contatosCounts.isLoading
                ? "…"
                : `${formatNumber(contatosCounts.data?.counts.webhook_cloudia ?? 0)} webhook`}
            </div>
            <div className="flex items-center gap-2 rounded-xl border border-amber-500/20 bg-amber-500/8 px-3 py-2 text-[11px] font-semibold text-amber-300">
              <FileUp className="h-3.5 w-3.5 shrink-0" />
              {contatosCounts.isLoading
                ? "…"
                : `${formatNumber(contatosCounts.data?.counts.import_csv ?? 0)} importados`}
            </div>
            <div className="flex items-center gap-2 rounded-xl border border-amber-500/20 bg-amber-500/8 px-3 py-2 text-[11px] font-semibold text-amber-400">
              <Bell className="h-3.5 w-3.5 shrink-0" />
              {overviewLoading ? "…" : `${statesData?.queue ?? 0} na fila`}
            </div>
            <div className="flex items-center gap-2 rounded-xl border border-violet-500/20 bg-violet-500/8 px-3 py-2 text-[11px] font-semibold text-violet-400">
              <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
              {overviewLoading ? "…" : `${statesData?.service ?? 0} em atendimento`}
            </div>
            <div className="flex items-center gap-2 rounded-xl border border-brand-500/20 bg-brand-500/8 px-3 py-2 text-[11px] font-semibold text-brand-400">
              <Sparkles className="h-3.5 w-3.5 shrink-0" />
              {overviewLoading || overviewLoading
                ? "…"
                : `${formatPercent(conversao)} de conversão`}
            </div>
          </div>
        </div>
      </div>

      {/* ══ Amanheceu — banner Araguaína ═════════════════════════ */}
    <Link
  to="/amanheceu"
  className={cn(
    "group mb-4 flex items-center gap-4 rounded-xl border border-white/8",
    "bg-white/[0.03] px-4 py-3.5",
    "transition-colors hover:bg-white/[0.05] hover:border-white/12"
  )}
>
  {/* Ícone simples, sem glow */}
  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-white/6 ring-1 ring-white/10">
    <Moon className="h-4.5 w-4.5 text-slate-300" />
  </div>

  {/* Conteúdo */}
  <div className="min-w-0 flex-1">
    <p className="truncate text-[13px] font-semibold text-slate-100">
      Araguaína ·{" "}
      <span className="text-white">
        {amanheceuQuery.isLoading
          ? "…"
          : `${formatNumber(amanheceuQuery.data?.total ?? 0)} lead${(amanheceuQuery.data?.total ?? 0) === 1 ? "" : "s"} essa madrugada`}
      </span>
    </p>
    <p className="mt-0.5 text-[11px] text-slate-500">
      20h → 07h · {amanheceuQuery.data?.unitName ?? "Araguaína"} · clique para ver o detalhamento
    </p>
  </div>

  {/* Indicador ao vivo + seta */}
  <div className="flex shrink-0 items-center gap-3">
    <span className="flex items-center gap-1.5 text-[11px] text-slate-500">
      <span className="inline-block h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
      ao vivo
    </span>
    <span className="text-slate-600 transition-colors group-hover:text-slate-300">
      →
    </span>
  </div>
</Link>

      {/* ══ Filtros ══════════════════════════════════════════════ */}
      <div className="mb-6">
        <DashboardFilters
          value={filters}
          onChange={setFilters}
          onSearch={handleSearch}
        />
      </div>

      {/* ══ Contatos na base — em destaque ═══════════════════════ */}
      <ContactsBanner
        loading={contatosCounts.isLoading}
        counts={contatosCounts.data?.counts}
        error={contatosCounts.isError}
      />

      {/* ══ KPIs ════════════════════════════════════════════════ */}
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-3">
      <KpiCard
        label="Total de leads"
        value={total}
        icon={<img src="https://cdn-icons-png.flaticon.com/512/7376/7376481.png" alt="leads" className="h-16 w-16 object-contain" />}
        tone="blue"
        loading={overviewLoading}
      />
      <KpiCard
        label="Em atendimento"
        value={statesData?.service ?? 0}
        icon={<img src="https://cdn-icons-png.flaticon.com/512/2706/2706962.png" alt="atendimento" className="h-16 w-16 object-contain" />}
        tone="violet"
        loading={overviewLoading}
      />
      <KpiCard
        label="Na fila"
        value={statesData?.queue ?? 0}
        icon={<img src="https://cdn-icons-png.flaticon.com/512/5772/5772632.png" alt="fila" className="h-16 w-16 object-contain" />}
        tone="amber"
        loading={overviewLoading}
      />
      <KpiCard
        label="Taxa de conversão"
        value={formatPercent(conversao)}
        icon={<img src="https://cdn-icons-png.freepik.com/512/5915/5915116.png" alt="conversão" className="h-16 w-16 object-contain" />}
        tone="blue"
        loading={overviewLoading || overviewLoading}
        subtitle={`${formatPercent(pagamentoRate)} pagam na hora`}
      />
      <KpiCard
        label="CAC"
        value="—"
        icon={<img src="https://cdn-icons-png.flaticon.com/512/3146/3146459.png" alt="cac" className="h-16 w-16 object-contain" />}
        tone="amber"
        subtitle="Custo por aquisição"
      />
      <KpiCard
        label="Agend. c/ pagamento"
        value={comPagNum}
        icon={<img src="https://cdn-icons-png.flaticon.com/512/10251/10251304.png" alt="agendado com pagamento" className="h-16 w-16 object-contain" />}
        tone="green"
        loading={overviewLoading}
        subtitle="Agendados e pagos"
      />
      <KpiCard
        label="Agend. s/ pagamento"
        value={semPagNum}
        icon={<img src="https://cdn-icons-png.flaticon.com/512/9955/9955052.png" alt="agendado sem pagamento" className="h-16 w-16 object-contain" />}
        tone="red"
        loading={overviewLoading}
        subtitle="Agendados sem pagar"
      />
      <KpiCard
        label="Em tratamento"
        value={consultasNum}
        icon={<img src="https://cdn-icons-png.flaticon.com/512/5945/5945068.png" alt="em tratamento" className="h-16 w-16 object-contain" />}
        tone="green"
        loading={overviewLoading}
        subtitle="Fechou / tratando"
      />
      <KpiCard
        label="Fecharam"
        value={consultasNum}
        icon={<img src="https://cdn-icons-png.flaticon.com/512/5015/5015811.png" alt="fecharam" className="h-16 w-16 object-contain" />}
        tone="violet"
        loading={overviewLoading}
        subtitle="Convertidos total"
      />
      <KpiCard
        label="S/ pagamento %"
        value={total > 0 ? formatPercent(semPagRate) : "—"}
        icon={<img src="https://cdn-icons-png.flaticon.com/512/4441/4441817.png" alt="sem pagamento %" className="h-16 w-16 object-contain" />}
        tone="amber"
        loading={overviewLoading || overviewLoading}
        subtitle="Taxa sem pagamento"
      />
     </div>

      {/* ══ Funil + Origens ══════════════════════════════════════ */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mt-6">
        <Card className="lg:col-span-2">
          <CardHeader title="Funil de conversão" subtitle="Da entrada do lead até o tratamento em andamento" />
          <CardBody>
            <Suspense fallback={<div className="skeleton h-60 w-full rounded-lg" />}>
              <FunnelChart
                stages={[
                  { label: "Total de leads",           count: total,               tone: "blue"    },
                  { label: "Agendados sem pagamento",   count: semPagNum,    tone: "amber"   },
                  { label: "Agendados com pagamento",   count: comPagNum,    tone: "violet"  },
                  { label: "Fechou / em tratamento",    count: consultasNum, tone: "emerald" },
                ]}
              />
            </Suspense>
          </CardBody>
        </Card>

        <Card>
          <CardHeader
            title="Origem dos leads"
            subtitle="Top canais de aquisição"
            action={<Link to="/sources"><Button variant="ghost" size="sm">Ver tudo</Button></Link>}
          />
          <CardBody>
            {overviewLoading ? (
              <div className="skeleton h-60 w-full rounded-lg" />
            ) : donutData.length ? (
              <Suspense fallback={<div className="skeleton h-60 w-full rounded-lg" />}>
                <SourceDonut data={donutData} />
              </Suspense>
            ) : (
              <EmptyState title="Sem origens registradas" />
            )}
          </CardBody>
        </Card>
      </div>

      {/* ══ Evolução + Ao vivo ═══════════════════════════════════ */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mt-4">
        <Card className="lg:col-span-2">
          <CardHeader
            title="Evolução temporal"
            subtitle={evolutionSubtitle(filters, evolucao.data?.total_current, evolucao.data?.change_percent, evolucao.data?.compare)}
            action={<Link to="/evolution"><Button variant="ghost" size="sm">Ver detalhes</Button></Link>}
          />
          <CardBody>
            {evolucao.isLoading ? (
              <div className="skeleton h-60 w-full rounded-lg" />
            ) : (evolucao.data?.current?.length ?? 0) > 0 ? (
              <Suspense fallback={<div className="skeleton h-60 w-full rounded-lg" />}>
                <EvolutionLine
                  data={(evolucao.data?.current ?? []).map((p) => ({
                    periodo: p.label,
                    total: p.count,
                  }))}
                />
              </Suspense>
            ) : (
              <EmptyState title="Sem dados no período" />
            )}
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="Ao vivo" subtitle="Sincronizado da Cloudia" />
          <CardBody className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <MiniStat label="Em atendimento" value={resumoLive.data?.totalEmAtendimento ?? 0} />
              <MiniStat label="Na fila"        value={resumoLive.data?.totalNaFila        ?? 0} />
            </div>
            <MiniStat
              label="Tempo médio de fila"
              value={resumoLive.data?.tempoMedio
                ? `${Math.round(resumoLive.data.tempoMedio)} min`
                : "—"}
            />
            <Link to="/live" className="block pt-2">
              <Button variant="outline" className="w-full justify-center" size="sm">
                Abrir painel ao vivo
              </Button>
            </Link>
          </CardBody>
        </Card>
      </div>

      {/* ══ Leads ativos + Etapas ════════════════════════════════ */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mt-4">
        <Card>
          <CardHeader
            title="Leads ativos agora"
            subtitle="Últimos leads em andamento"
            action={<Link to="/leads"><Button variant="ghost" size="sm">Ver todos</Button></Link>}
          />
          <CardBody className="p-0">
            <div className="divide-y divide-white/5">
              {ativos.isLoading
                ? Array.from({ length: 5 }).map((_, i) => (
                    <div key={i} className="p-4 flex items-center gap-3">
                      <div className="skeleton h-9 w-9 rounded-full" />
                      <div className="flex-1 space-y-2">
                        <div className="skeleton h-3 w-40" />
                        <div className="skeleton h-3 w-24" />
                      </div>
                    </div>
                  ))
                : ativos.data?.slice(0, 8).map((l) => (
                    <Link
                      key={l.id}
                      to={`/leads/${l.id}`}
                      className="flex items-center gap-3 p-4 hover:bg-white/[0.04] transition-colors"
                    >
                      <div className="h-9 w-9 rounded-full bg-gradient-to-br from-brand-400 to-violet-600 grid place-items-center text-xs font-semibold">
                        {(l.name ?? "?").charAt(0).toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-slate-100 truncate">
                          {truncate(l.name ?? "Sem nome", 40)}
                        </p>
                        <p className="text-xs text-slate-400 truncate">
                          {l.phone ?? "—"} · {formatDate(l.updatedAt ?? l.createdAt)}
                        </p>
                      </div>
                      <StateBadge state={l.conversationState ?? undefined} />
                    </Link>
                  ))}
            </div>
            {!ativos.isLoading && !ativos.data?.length && (
              <EmptyState title="Nenhum lead ativo" />
            )}
          </CardBody>
        </Card>

        <Card>
          <CardHeader
            title="Distribuição por etapa"
            subtitle="Momento atual dos leads"
            action={<Link to="/funnel"><Button variant="ghost" size="sm">Analisar</Button></Link>}
          />
          <CardBody>
            {overviewLoading ? (
              <div className="skeleton h-60 w-full rounded-lg" />
            ) : etapaData.length > 0 ? (
              <div className="space-y-2">
                {etapaData
                  .slice()
                  .sort((a, b) => b.count - a.count)
                  .slice(0, 8)
                  .map((e) => {
                    const max = Math.max(1, ...etapaData.map((x) => x.count));
                    const pct = (e.count / max) * 100;
                    return (
                      <div key={e.stage}>
                        <div className="flex items-center justify-between text-xs mb-1">
                          <span className="text-slate-300 truncate">
                            {e.stage.replace(/_/g, " ")}
                          </span>
                          <span className="font-semibold text-slate-100">
                            {formatNumber(e.count)}
                          </span>
                        </div>
                        <div className="h-2 rounded-full bg-white/5 overflow-hidden">
                          <div
                            className="h-full bg-gradient-to-r from-brand-500 to-violet-500 rounded-full"
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
              </div>
            ) : (
              <EmptyState
                title="Sem etapas para exibir"
                icon={<AlertTriangle className="h-5 w-5 text-amber-400" />}
              />
            )}
          </CardBody>
        </Card>
      </div>
    </>
  );
}

// ─── MiniStat ─────────────────────────────────────────────────────────────────

function MiniStat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-lg border border-white/10 bg-white/[0.02] p-3">
      <div className="label">{label}</div>
      <div className="text-xl font-semibold text-slate-50 mt-1">
        {typeof value === "number" ? formatNumber(value) : value}
      </div>
    </div>
  );
}

// ─── ContactsBanner ───────────────────────────────────────────────────────────

function ContactsBanner({
  loading,
  counts,
  error,
}: {
  loading: boolean;
  counts?: { all: number; webhook_cloudia: number; import_csv: number };
  error?: boolean;
}) {
  const all = counts?.all ?? 0;
  const webhook = counts?.webhook_cloudia ?? 0;
  const imported = counts?.import_csv ?? 0;
  const pctWebhook = all > 0 ? (webhook / all) * 100 : 0;
  const pctImported = all > 0 ? (imported / all) * 100 : 0;

  return (
    <div className="mb-6 overflow-hidden rounded-2xl border border-white/[0.08] bg-white/[0.03] shadow-[0_1px_3px_rgba(0,0,0,0.2),inset_0_1px_0_rgba(255,255,255,0.04)]">
      {/* Cabeçalho */}
      <div className="flex items-end justify-between gap-3 px-5 pt-5">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-500">
            Contatos na base
          </p>
          <p className="mt-0.5 text-[11px] text-slate-500">
            Total cadastrado — webhook + importados via CSV
          </p>
        </div>
        <Link to="/contacts">
          <Button variant="ghost" size="sm">Ver todos →</Button>
        </Link>
      </div>

      {/* Corpo */}
      <div className="grid grid-cols-1 gap-4 px-5 py-4 md:grid-cols-[auto_1fr]">
        {/* Número total gigante */}
        <div className="flex items-baseline gap-3 md:border-r md:border-white/[0.06] md:pr-6">
          {loading ? (
            <div className="skeleton h-10 w-32 rounded-lg" />
          ) : error ? (
            <span className="text-sm text-rose-300">Erro ao carregar</span>
          ) : (
            <>
              <span className="text-[2.5rem] font-extrabold leading-none tabular-nums text-slate-50">
                {formatNumber(all)}
              </span>
              <span className="text-[12px] text-slate-500">
                contato{all === 1 ? "" : "s"}
              </span>
            </>
          )}
        </div>

        {/* Duas origens */}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <OrigemStat
            icon={<Webhook className="h-4 w-4" />}
            label="Pelo webhook"
            sublabel="Cloudia · em tempo real"
            value={webhook}
            pct={pctWebhook}
            barClass="bg-violet-400"
            loading={loading}
          />
          <OrigemStat
            icon={<FileUp className="h-4 w-4" />}
            label="Importados (CSV)"
            sublabel="Base antiga · upload manual"
            value={imported}
            pct={pctImported}
            barClass="bg-amber-400"
            loading={loading}
          />
        </div>
      </div>

      {/* Barra de proporção (estilo "stacked bar") */}
      {!loading && all > 0 && (
        <div className="flex h-1.5 w-full overflow-hidden">
          <div className="h-full bg-violet-500/80" style={{ width: `${pctWebhook}%` }} />
          <div className="h-full bg-amber-500/80" style={{ width: `${pctImported}%` }} />
        </div>
      )}
    </div>
  );
}

function OrigemStat({
  icon,
  label,
  sublabel,
  value,
  pct,
  barClass,
  loading,
}: {
  icon: React.ReactNode;
  label: string;
  sublabel: string;
  value: number;
  pct: number;
  barClass: string;
  loading: boolean;
}) {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-white/[0.06] bg-white/[0.02] px-4 py-3">
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white/[0.04] text-slate-300">
        {icon}
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-[11px] font-medium uppercase tracking-wide text-slate-500">
          {label}
        </p>
        {loading ? (
          <div className="skeleton mt-1 h-6 w-20 rounded" />
        ) : (
          <div className="mt-0.5 flex items-baseline gap-2">
            <span className="text-[1.25rem] font-bold leading-none tabular-nums text-slate-50">
              {formatNumber(value)}
            </span>
            <span className="text-[11px] tabular-nums text-slate-500">
              {pct.toFixed(0)}%
            </span>
          </div>
        )}
        <p className="mt-1 truncate text-[10.5px] text-slate-500">{sublabel}</p>
        <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-white/[0.05]">
          <div className={cn("h-full rounded-full", barClass)} style={{ width: `${pct}%` }} />
        </div>
      </div>
    </div>
  );
}