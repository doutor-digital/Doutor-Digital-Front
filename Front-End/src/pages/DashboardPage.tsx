import { Suspense, lazy, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  AlertTriangle,
  Bell,
  CalendarCheck,
  CheckCircle2,
  FileUp,
  Moon,
  Sparkles,
  TrendingUp,
  Webhook,
} from "lucide-react";
import { Link } from "react-router-dom";
import { cn, formatNumber, formatPercent, truncate, formatDate } from "@/lib/utils";
import { PageHeader } from "@/components/layout/PageHeader";
import { Panel, PanelHeader } from "@/components/ui/Panel";
import { Kpi, type KpiTone } from "@/components/ui/Kpi";
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

const FunnelChart = lazy(() =>
  import("@/components/charts/FunnelChart").then((m) => ({ default: m.FunnelChart })),
);
const EvolutionLine = lazy(() =>
  import("@/components/charts/EvolutionLine").then((m) => ({ default: m.EvolutionLine })),
);
const SourceDonut = lazy(() =>
  import("@/components/charts/SourceDonut").then((m) => ({ default: m.SourceDonut })),
);

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
  compare?: string,
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

function KpiImg({ src, alt }: { src: string; alt: string }) {
  return <img src={src} alt={alt} className="h-4 w-4 object-contain" />;
}

export default function DashboardPage() {
  const { tenantId, unitId } = useClinic();
  const { user } = useAuth();
  const fullName = user?.name?.trim() || user?.email?.split("@")[0] || "Convidado";
  const firstName = fullName.split(" ")[0];

  const [filters, setFilters] = useState<DashboardFiltersState>(defaultFilters);

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
  const amanheceuQuery = useQuery({
    queryKey: ["amanheceu", 8020],
    queryFn: () => webhooksService.amanheceu({ clinicId: 8020 }),
    refetchInterval: 60_000,
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

  const ov = overview.data;
  const overviewLoading = overview.isLoading;
  const total = ov?.total_leads ?? 0;
  const consultasNum = ov?.consultas ?? 0;
  const comPagNum = ov?.com_pagamento ?? 0;
  const semPagNum = ov?.sem_pagamento ?? 0;
  const statesData = ov?.states;
  const conversao = ov?.conversao_rate ?? 0;
  const pagamentoRate = ov?.pagamento_rate ?? 0;
  const semPagRate = ov?.sem_pagamento_rate ?? 0;
  const donutData = (ov?.origens ?? []).slice(0, 8).map((o) => ({
    name: o.origem ?? "—",
    value: o.quantidade ?? 0,
  }));
  const etapaData = (ov?.etapas ?? []).map((e) => ({
    stage: e.etapa ?? "SEM_ETAPA",
    count: e.quantidade ?? 0,
  }));

  function handleSearch() {
    overview.refetch();
    evolucao.refetch();
  }

  return (
    <div className="space-y-5">
      <PageHeader
        title="Visão geral"
        badge="Dashboard"
        description={
          unitId
            ? `Performance consolidada · unitId: ${unitId}`
            : "Performance consolidada — selecione um Unit ID na topbar para filtrar."
        }
        actions={
          <>
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
                <CalendarCheck className="h-4 w-4" /> Gerar relatório
              </Button>
            </Link>
          </>
        }
      />

      {/* Boas-vindas */}
      <Panel>
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between px-5 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-white/[0.04] ring-1 ring-inset ring-white/[0.08] text-[13px] font-semibold text-slate-100">
              {firstName.charAt(0).toUpperCase()}
            </div>
            <div>
              <p className="text-[10px] font-medium uppercase tracking-[0.22em] text-slate-500">
                {greeting()}
              </p>
              <p className="mt-0.5 text-[16px] font-semibold tracking-tight text-slate-50 leading-tight">
                {firstName}
              </p>
              <p className="mt-0.5 text-[11px] text-slate-500 tabular-nums">
                {new Date().toLocaleDateString("pt-BR", {
                  weekday: "long",
                  day: "2-digit",
                  month: "long",
                })}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-1.5">
            <SummaryChip
              tone="emerald"
              icon={<TrendingUp className="h-3 w-3" />}
              label={overviewLoading ? "…" : `${formatNumber(total)} leads no total`}
            />
            <SummaryChip
              tone="sky"
              icon={<Webhook className="h-3 w-3" />}
              label={
                contatosCounts.isLoading
                  ? "…"
                  : `${formatNumber(
                      contatosCounts.data?.counts.webhook_cloudia ?? 0,
                    )} webhook`
              }
            />
            <SummaryChip
              tone="amber"
              icon={<FileUp className="h-3 w-3" />}
              label={
                contatosCounts.isLoading
                  ? "…"
                  : `${formatNumber(
                      contatosCounts.data?.counts.import_csv ?? 0,
                    )} importados`
              }
            />
            <SummaryChip
              tone="amber"
              icon={<Bell className="h-3 w-3" />}
              label={overviewLoading ? "…" : `${statesData?.queue ?? 0} na fila`}
            />
            <SummaryChip
              tone="indigo"
              icon={<CheckCircle2 className="h-3 w-3" />}
              label={
                overviewLoading ? "…" : `${statesData?.service ?? 0} em atendimento`
              }
            />
            <SummaryChip
              tone="emerald"
              icon={<Sparkles className="h-3 w-3" />}
              label={
                overviewLoading
                  ? "…"
                  : `${formatPercent(conversao)} de conversão`
              }
            />
          </div>
        </div>
      </Panel>

      {/* Amanheceu banner */}
      <Link
        to="/amanheceu"
        className="group flex items-center gap-4 rounded-xl border border-white/[0.07] bg-white/[0.015] px-4 py-3.5 transition hover:bg-white/[0.025] hover:border-white/[0.12]"
      >
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-white/[0.03] ring-1 ring-inset ring-white/[0.06]">
          <Moon className="h-4 w-4 text-slate-400" />
        </div>

        <div className="min-w-0 flex-1">
          <p className="truncate text-[13px] font-semibold text-slate-100">
            Araguaína ·{" "}
            <span className="text-slate-50 tabular-nums">
              {amanheceuQuery.isLoading
                ? "…"
                : `${formatNumber(amanheceuQuery.data?.total ?? 0)} lead${
                    (amanheceuQuery.data?.total ?? 0) === 1 ? "" : "s"
                  } essa madrugada`}
            </span>
          </p>
          <p className="mt-0.5 text-[11px] text-slate-500 tabular-nums">
            20h → 07h · {amanheceuQuery.data?.unitName ?? "Araguaína"} · clique
            para ver o detalhamento
          </p>
        </div>

        <div className="flex shrink-0 items-center gap-3">
          <span className="flex items-center gap-1.5 text-[11px] text-slate-500">
            <span className="inline-block h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
            ao vivo
          </span>
          <span className="text-slate-600 transition group-hover:text-slate-300">
            →
          </span>
        </div>
      </Link>

      {/* Filtros */}
      <DashboardFilters
        value={filters}
        onChange={setFilters}
        onSearch={handleSearch}
      />

      {/* Contatos banner */}
      <ContactsBanner
        loading={contatosCounts.isLoading}
        counts={contatosCounts.data?.counts}
        error={contatosCounts.isError}
      />

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-3">
        <Kpi
          label="Total de leads"
          value={formatNumber(total)}
          tone="sky"
          icon={
            <KpiImg
              src="https://cdn-icons-png.flaticon.com/512/7376/7376481.png"
              alt="leads"
            />
          }
          loading={overviewLoading}
        />
        <Kpi
          label="Em atendimento"
          value={formatNumber(statesData?.service ?? 0)}
          tone="sky"
          icon={
            <KpiImg
              src="https://cdn-icons-png.flaticon.com/512/2706/2706962.png"
              alt="atendimento"
            />
          }
          loading={overviewLoading}
        />
        <Kpi
          label="Na fila"
          value={formatNumber(statesData?.queue ?? 0)}
          tone="amber"
          icon={
            <KpiImg
              src="https://cdn-icons-png.flaticon.com/512/5772/5772632.png"
              alt="fila"
            />
          }
          loading={overviewLoading}
        />
        <Kpi
          label="Taxa de conversão"
          value={formatPercent(conversao)}
          tone="emerald"
          icon={
            <KpiImg
              src="https://cdn-icons-png.freepik.com/512/5915/5915116.png"
              alt="conversão"
            />
          }
          hint={`${formatPercent(pagamentoRate)} pagam na hora`}
          loading={overviewLoading}
        />
        <Kpi
          label="CAC"
          value="—"
          tone="slate"
          icon={
            <KpiImg
              src="https://cdn-icons-png.flaticon.com/512/3146/3146459.png"
              alt="cac"
            />
          }
          hint="Custo por aquisição"
        />
        <Kpi
          label="Agend. c/ pagamento"
          value={formatNumber(comPagNum)}
          tone="emerald"
          icon={
            <KpiImg
              src="https://cdn-icons-png.flaticon.com/512/10251/10251304.png"
              alt="agendado com pagamento"
            />
          }
          hint="Agendados e pagos"
          loading={overviewLoading}
        />
        <Kpi
          label="Agend. s/ pagamento"
          value={formatNumber(semPagNum)}
          tone="rose"
          icon={
            <KpiImg
              src="https://cdn-icons-png.flaticon.com/512/9955/9955052.png"
              alt="agendado sem pagamento"
            />
          }
          hint="Agendados sem pagar"
          loading={overviewLoading}
        />
        <Kpi
          label="Em tratamento"
          value={formatNumber(consultasNum)}
          tone="emerald"
          icon={
            <KpiImg
              src="https://cdn-icons-png.flaticon.com/512/5945/5945068.png"
              alt="em tratamento"
            />
          }
          hint="Fechou / tratando"
          loading={overviewLoading}
        />
        <Kpi
          label="Fecharam"
          value={formatNumber(consultasNum)}
          tone="emerald"
          icon={
            <KpiImg
              src="https://cdn-icons-png.flaticon.com/512/5015/5015811.png"
              alt="fecharam"
            />
          }
          hint="Convertidos total"
          loading={overviewLoading}
        />
        <Kpi
          label="S/ pagamento %"
          value={total > 0 ? formatPercent(semPagRate) : "—"}
          tone="amber"
          icon={
            <KpiImg
              src="https://cdn-icons-png.flaticon.com/512/4441/4441817.png"
              alt="sem pagamento %"
            />
          }
          hint="Taxa sem pagamento"
          loading={overviewLoading}
        />
      </div>

      {/* Funil + Origens */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Panel className="lg:col-span-2">
          <PanelHeader
            eyebrow="Funil"
            eyebrowTone="bg-emerald-400"
            title="Funil de conversão"
            subtitle="Da entrada do lead até o tratamento em andamento"
          />
          <div className="p-5">
            <Suspense
              fallback={
                <div className="h-60 w-full rounded bg-white/[0.02] animate-pulse" />
              }
            >
              <FunnelChart
                stages={[
                  { label: "Total de leads", count: total, tone: "sky" },
                  {
                    label: "Agendados sem pagamento",
                    count: semPagNum,
                    tone: "amber",
                  },
                  {
                    label: "Agendados com pagamento",
                    count: comPagNum,
                    tone: "indigo",
                  },
                  {
                    label: "Fechou / em tratamento",
                    count: consultasNum,
                    tone: "emerald",
                  },
                ]}
              />
            </Suspense>
          </div>
        </Panel>

        <Panel>
          <PanelHeader
            eyebrow="Origens"
            eyebrowTone="bg-sky-400"
            title="Origem dos leads"
            subtitle="Top canais de aquisição"
            action={
              <Link to="/sources">
                <Button variant="ghost" size="sm">
                  Ver tudo
                </Button>
              </Link>
            }
          />
          <div className="p-5">
            {overviewLoading ? (
              <div className="h-60 w-full rounded bg-white/[0.02] animate-pulse" />
            ) : donutData.length ? (
              <Suspense
                fallback={
                  <div className="h-60 w-full rounded bg-white/[0.02] animate-pulse" />
                }
              >
                <SourceDonut data={donutData} />
              </Suspense>
            ) : (
              <EmptyState title="Sem origens registradas" />
            )}
          </div>
        </Panel>
      </div>

      {/* Evolução + Ao vivo */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Panel className="lg:col-span-2">
          <PanelHeader
            eyebrow="Evolução"
            eyebrowTone="bg-sky-400"
            title="Evolução temporal"
            subtitle={evolutionSubtitle(
              filters,
              evolucao.data?.total_current,
              evolucao.data?.change_percent,
              evolucao.data?.compare,
            )}
            action={
              <Link to="/evolution">
                <Button variant="ghost" size="sm">
                  Ver detalhes
                </Button>
              </Link>
            }
          />
          <div className="p-5">
            {evolucao.isLoading ? (
              <div className="h-60 w-full rounded bg-white/[0.02] animate-pulse" />
            ) : (evolucao.data?.current?.length ?? 0) > 0 ? (
              <Suspense
                fallback={
                  <div className="h-60 w-full rounded bg-white/[0.02] animate-pulse" />
                }
              >
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
          </div>
        </Panel>

        <Panel>
          <PanelHeader
            eyebrow="Ao vivo"
            eyebrowTone="bg-emerald-400"
            title="Ao vivo"
            subtitle="Sincronizado da Cloudia"
          />
          <div className="p-5 space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <MiniStat
                label="Em atendimento"
                value={resumoLive.data?.totalEmAtendimento ?? 0}
              />
              <MiniStat
                label="Na fila"
                value={resumoLive.data?.totalNaFila ?? 0}
              />
            </div>
            <MiniStat
              label="Tempo médio de fila"
              value={
                resumoLive.data?.tempoMedio
                  ? `${Math.round(resumoLive.data.tempoMedio)} min`
                  : "—"
              }
            />
            <Link to="/live" className="block pt-2">
              <Button
                variant="outline"
                className="w-full justify-center"
                size="sm"
              >
                Abrir painel ao vivo
              </Button>
            </Link>
          </div>
        </Panel>
      </div>

      {/* Leads ativos + Etapas */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Panel>
          <PanelHeader
            eyebrow="Feed"
            eyebrowTone="bg-sky-400"
            title="Leads ativos agora"
            subtitle="Últimos leads em andamento"
            action={
              <Link to="/leads">
                <Button variant="ghost" size="sm">
                  Ver todos
                </Button>
              </Link>
            }
          />
          <div>
            <div className="divide-y divide-white/[0.04]">
              {ativos.isLoading
                ? Array.from({ length: 5 }).map((_, i) => (
                    <div key={i} className="p-4 flex items-center gap-3">
                      <div className="h-9 w-9 rounded-full bg-white/[0.03] animate-pulse" />
                      <div className="flex-1 space-y-2">
                        <div className="h-3 w-40 rounded bg-white/[0.03] animate-pulse" />
                        <div className="h-3 w-24 rounded bg-white/[0.03] animate-pulse" />
                      </div>
                    </div>
                  ))
                : ativos.data?.slice(0, 8).map((l) => (
                    <Link
                      key={l.id}
                      to={`/leads/${l.id}`}
                      className="flex items-center gap-3 px-5 py-3 hover:bg-white/[0.02] transition"
                    >
                      <div className="h-8 w-8 rounded-md bg-white/[0.04] ring-1 ring-inset ring-white/[0.08] grid place-items-center text-[11px] font-semibold text-slate-200">
                        {(l.name ?? "?").charAt(0).toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-[13px] text-slate-100 truncate font-medium">
                          {truncate(l.name ?? "Sem nome", 40)}
                        </p>
                        <p className="text-[11px] text-slate-500 truncate tabular-nums">
                          {l.phone ?? "—"} ·{" "}
                          {formatDate(l.updatedAt ?? l.createdAt)}
                        </p>
                      </div>
                      <StateBadge state={l.conversationState ?? undefined} />
                    </Link>
                  ))}
            </div>
            {!ativos.isLoading && !ativos.data?.length && (
              <div className="p-5">
                <EmptyState title="Nenhum lead ativo" />
              </div>
            )}
          </div>
        </Panel>

        <Panel>
          <PanelHeader
            eyebrow="Distribuição"
            eyebrowTone="bg-indigo-400"
            title="Distribuição por etapa"
            subtitle="Momento atual dos leads"
            action={
              <Link to="/funnel">
                <Button variant="ghost" size="sm">
                  Analisar
                </Button>
              </Link>
            }
          />
          <div className="p-5">
            {overviewLoading ? (
              <div className="h-60 w-full rounded bg-white/[0.02] animate-pulse" />
            ) : etapaData.length > 0 ? (
              <div className="space-y-2.5">
                {etapaData
                  .slice()
                  .sort((a, b) => b.count - a.count)
                  .slice(0, 8)
                  .map((e) => {
                    const max = Math.max(1, ...etapaData.map((x) => x.count));
                    const pct = (e.count / max) * 100;
                    return (
                      <div key={e.stage}>
                        <div className="flex items-center justify-between text-[12px] mb-1.5">
                          <span className="text-slate-300 truncate">
                            {e.stage.replace(/_/g, " ")}
                          </span>
                          <span className="font-semibold tabular-nums text-slate-100">
                            {formatNumber(e.count)}
                          </span>
                        </div>
                        <div className="h-1.5 rounded-full bg-white/[0.04] overflow-hidden">
                          <div
                            className="h-full bg-gradient-to-r from-sky-500 to-sky-400 rounded-full transition-all"
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
                icon={<AlertTriangle className="h-5 w-5 text-amber-300" />}
              />
            )}
          </div>
        </Panel>
      </div>
    </div>
  );
}

function MiniStat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-md border border-white/[0.06] bg-white/[0.015] p-3">
      <p className="text-[10px] font-medium uppercase tracking-[0.14em] text-slate-500">
        {label}
      </p>
      <p className="mt-1.5 text-[18px] font-semibold text-slate-50 tabular-nums leading-none">
        {typeof value === "number" ? formatNumber(value) : value}
      </p>
    </div>
  );
}

function SummaryChip({
  tone,
  icon,
  label,
}: {
  tone: KpiTone;
  icon: React.ReactNode;
  label: string;
}) {
  const styles: Record<KpiTone, string> = {
    emerald: "bg-emerald-500/10 text-emerald-300 ring-emerald-500/20",
    sky: "bg-sky-500/10 text-sky-300 ring-sky-500/20",
    amber: "bg-amber-500/10 text-amber-300 ring-amber-500/20",
    rose: "bg-rose-500/10 text-rose-300 ring-rose-500/20",
    slate: "bg-white/[0.04] text-slate-300 ring-white/[0.08]",
    indigo: "bg-indigo-500/10 text-indigo-300 ring-indigo-500/20",
  };

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-[11px] font-medium ring-1 ring-inset tabular-nums",
        styles[tone],
      )}
    >
      {icon}
      {label}
    </span>
  );
}

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
    <Panel>
      <div className="flex items-end justify-between gap-3 px-5 pt-4">
        <div>
          <p className="text-[10px] font-medium uppercase tracking-[0.22em] text-slate-500">
            Contatos na base
          </p>
          <p className="mt-0.5 text-[15px] font-semibold text-slate-50 tracking-tight">
            Total cadastrado
          </p>
          <p className="text-[11.5px] text-slate-500">
            Webhook Cloudia + importados via CSV
          </p>
        </div>
        <Link to="/contacts">
          <Button variant="ghost" size="sm">
            Ver todos →
          </Button>
        </Link>
      </div>

      <div className="grid grid-cols-1 gap-4 px-5 py-4 md:grid-cols-[auto_1fr]">
        <div className="flex items-baseline gap-3 md:border-r md:border-white/[0.05] md:pr-6">
          {loading ? (
            <div className="h-10 w-32 rounded bg-white/[0.04] animate-pulse" />
          ) : error ? (
            <span className="text-[13px] text-rose-300">Erro ao carregar</span>
          ) : (
            <>
              <span className="text-[28px] font-bold leading-none tabular-nums tracking-tight text-slate-50">
                {formatNumber(all)}
              </span>
              <span className="text-[11.5px] text-slate-500">
                contato{all === 1 ? "" : "s"}
              </span>
            </>
          )}
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <OrigemStat
            icon={<Webhook className="h-4 w-4" />}
            label="Pelo webhook"
            sublabel="Cloudia · em tempo real"
            value={webhook}
            pct={pctWebhook}
            barClass="bg-gradient-to-r from-indigo-500 to-indigo-400"
            loading={loading}
          />
          <OrigemStat
            icon={<FileUp className="h-4 w-4" />}
            label="Importados (CSV)"
            sublabel="Base antiga · upload manual"
            value={imported}
            pct={pctImported}
            barClass="bg-gradient-to-r from-amber-500 to-amber-400"
            loading={loading}
          />
        </div>
      </div>

      {!loading && all > 0 && (
        <div className="flex h-1 w-full overflow-hidden">
          <div
            className="h-full bg-indigo-500/70"
            style={{ width: `${pctWebhook}%` }}
          />
          <div
            className="h-full bg-amber-500/70"
            style={{ width: `${pctImported}%` }}
          />
        </div>
      )}
    </Panel>
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
    <div className="flex items-center gap-3 rounded-md border border-white/[0.06] bg-white/[0.015] px-4 py-3">
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-white/[0.03] ring-1 ring-inset ring-white/[0.06] text-slate-300">
        {icon}
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-[10px] font-medium uppercase tracking-[0.14em] text-slate-500">
          {label}
        </p>
        {loading ? (
          <div className="mt-1 h-6 w-20 rounded bg-white/[0.04] animate-pulse" />
        ) : (
          <div className="mt-0.5 flex items-baseline gap-2">
            <span className="text-[18px] font-bold leading-none tabular-nums text-slate-50">
              {formatNumber(value)}
            </span>
            <span className="text-[11px] tabular-nums text-slate-500">
              {pct.toFixed(0)}%
            </span>
          </div>
        )}
        <p className="mt-1 truncate text-[10.5px] text-slate-500">{sublabel}</p>
        <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-white/[0.04]">
          <div className={cn("h-full rounded-full", barClass)} style={{ width: `${pct}%` }} />
        </div>
      </div>
    </div>
  );
}
