import { useMemo } from "react";
import { Link } from "react-router-dom";
import {
  Activity,
  AlertTriangle,
  ArrowUpRight,
  CalendarRange,
  CheckCircle2,
  ClipboardCheck,
  FileBarChart,
  FileSearch,
  Sparkles,
  Stethoscope,
  Target,
  TrendingUp,
  Users,
  Wallet,
} from "@/components/icons";
import { PageHeader } from "@/components/layout/PageHeader";
import { CloudiaInlineBadge, CloudiaLegendBanner } from "@/components/sdr/CloudiaField";
import { useIsClient, useSdrCounts, useSdrStore } from "@/lib/sdr/sdr-store";
import { computeAiMetrics } from "@/services/sdr-ai";
import { cn, formatCurrency, formatNumber, formatPercent } from "@/lib/utils";

const TONES = {
  emerald: { ring: "ring-emerald-400/25", bg: "bg-emerald-400/[0.05]", icon: "text-emerald-300" },
  sky: { ring: "ring-sky-400/25", bg: "bg-sky-400/[0.05]", icon: "text-sky-300" },
  violet: { ring: "ring-violet-400/25", bg: "bg-violet-400/[0.05]", icon: "text-violet-300" },
  amber: { ring: "ring-amber-400/25", bg: "bg-amber-400/[0.05]", icon: "text-amber-300" },
  rose: { ring: "ring-rose-400/25", bg: "bg-rose-400/[0.05]", icon: "text-rose-300" },
  slate: { ring: "ring-slate-500/25", bg: "bg-slate-500/[0.05]", icon: "text-slate-300" },
} as const;

export default function PainelSdrPage() {
  const ready = useIsClient();
  const counts = useSdrCounts();
  const store = useSdrStore();
  const m = useMemo(() => computeAiMetrics(store), [store]);

  return (
    <div>
      <PageHeader
        badge="Painel SDR · Visão consolidada"
        title="Visão geral do time de cadastro"
        description="KPIs derivados das 8 seções da planilha (Cadastro, Consultas, Tratamentos, Tarefas, Agenda, Metas, Auditoria). Tudo alimentado em tempo real pelo webhook Cloudia + ações da SDR."
        actions={
          <Link
            to="/sdr/relatorios"
            className="inline-flex items-center gap-1.5 rounded-md border border-emerald-400/30 bg-emerald-400/15 px-3 py-1.5 text-[12px] font-semibold text-emerald-200 transition-colors hover:border-emerald-400/50 hover:bg-emerald-400/25"
          >
            <Sparkles className="h-3.5 w-3.5" />
            Relatório com IA
          </Link>
        }
      />

      <CloudiaLegendBanner className="mb-6" />

      {/* ═══════════════════════════════════════════════════════════════
          SEÇÃO 1 · Cadastro Geral (Leads)
          ═══════════════════════════════════════════════════════════════ */}
      {ready && (
        <SectionShell
          number="1"
          title="Cadastro Geral · Leads"
          description="Quem chegou, de onde, em que estágio."
          link="/sdr/cadastro-geral"
          tone="emerald"
        >
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <KpiCard
              label="Leads totais"
              value={formatNumber(m.totalLeads)}
              sublabel={`${m.leadsCloudia} via Cloudia · ${m.totalLeads - m.leadsCloudia} manuais/importados`}
              icon={Users}
              tone="emerald"
              cloudia
            />
            <KpiCard
              label="Pendentes de revisão"
              value={formatNumber(m.leadsPendentesRevisao)}
              sublabel="Aguardando aprovação SDR"
              icon={AlertTriangle}
              tone={m.leadsPendentesRevisao > 10 ? "rose" : m.leadsPendentesRevisao > 0 ? "amber" : "slate"}
            />
            <KpiCard
              label="Aprovados"
              value={formatNumber(m.leadsAprovados)}
              sublabel={`Taxa de aprovação ${formatPercent(m.taxaAprovacao, 1)}`}
              icon={CheckCircle2}
              tone="emerald"
            />
            <KpiCard
              label="Taxa de agendamento"
              value={formatPercent(m.taxaAgendamento, 1)}
              sublabel={`${Math.round((m.taxaAgendamento * m.totalLeads) / 100)} agendaram consulta`}
              icon={CalendarRange}
              tone={m.taxaAgendamento >= 50 ? "emerald" : m.taxaAgendamento >= 30 ? "amber" : "rose"}
            />
          </div>
        </SectionShell>
      )}

      {/* ═══════════════════════════════════════════════════════════════
          SEÇÃO 2 · Consultas Realizadas
          ═══════════════════════════════════════════════════════════════ */}
      {ready && (
        <SectionShell
          number="2"
          title="Consultas Realizadas"
          description="Quem compareceu, valor cobrado, taxa de fechamento."
          link="/sdr/consultas"
          tone="sky"
        >
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <KpiCard
              label="Consultas no período"
              value={formatNumber(m.consultas)}
              sublabel="Realizadas + agendadas"
              icon={Stethoscope}
              tone="sky"
            />
            <KpiCard
              label="Receita de consultas"
              value={formatCurrency(
                store.consultas.reduce((s, c) => s + (c.recebimento1?.valor ?? 0) + (c.recebimento2?.valor ?? 0), 0),
              )}
              sublabel="Recebimentos pagos"
              icon={Wallet}
              tone="emerald"
            />
            <KpiCard
              label="Ticket médio"
              value={formatCurrency(m.ticketMedio)}
              sublabel="Receita / consultas"
              icon={TrendingUp}
              tone="violet"
            />
            <KpiCard
              label="Taxa de fechamento"
              value={formatPercent(m.taxaFechamento, 1)}
              sublabel="Consulta → tratamento"
              icon={CheckCircle2}
              tone={m.taxaFechamento >= 50 ? "emerald" : m.taxaFechamento >= 25 ? "amber" : "rose"}
            />
          </div>
        </SectionShell>
      )}

      {/* ═══════════════════════════════════════════════════════════════
          SEÇÃO 3 · Tratamentos / Recebimentos
          ═══════════════════════════════════════════════════════════════ */}
      {ready && (
        <SectionShell
          number="3"
          title="Tratamentos · Recebimentos"
          description="Pacotes fechados, splits de pagamento, falta receber."
          link="/sdr/tratamentos"
          tone="violet"
        >
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <KpiCard
              label="Tratamentos ativos"
              value={formatNumber(m.tratamentos)}
              sublabel={`${store.tratamentos.filter((t) => t.status === "em_andamento").length} em andamento · ${store.tratamentos.filter((t) => t.status === "concluido").length} concluído(s)`}
              icon={Wallet}
              tone="violet"
            />
            <KpiCard
              label="Receita tratamentos"
              value={formatCurrency(
                store.tratamentos.reduce((s, t) => s + t.recebimentos.reduce((a, r) => a + r.valor, 0), 0),
              )}
              sublabel="Total recebido"
              icon={Wallet}
              tone="emerald"
            />
            <KpiCard
              label="Falta receber"
              value={formatCurrency(
                store.tratamentos.reduce(
                  (s, t) => s + Math.max(0, t.valor - t.recebimentos.reduce((a, r) => a + r.valor, 0)),
                  0,
                ),
              )}
              sublabel="Saldo aberto"
              icon={AlertTriangle}
              tone={
                store.tratamentos.reduce((s, t) => s + Math.max(0, t.valor - t.recebimentos.reduce((a, r) => a + r.valor, 0)), 0) > 0
                  ? "amber"
                  : "slate"
              }
            />
            <KpiCard
              label="Receita total"
              value={formatCurrency(m.receitaTotal)}
              sublabel="Consultas + tratamentos"
              icon={TrendingUp}
              tone="emerald"
            />
          </div>
        </SectionShell>
      )}

      {/* ═══════════════════════════════════════════════════════════════
          SEÇÃO 4 · Tarefas
          ═══════════════════════════════════════════════════════════════ */}
      {ready && (
        <SectionShell
          number="4"
          title="Tarefas"
          description="Pendências da SDR — confirmações, retornos, envios."
          link="/sdr/tarefas"
          tone="amber"
        >
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <KpiCard
              label="Pendentes"
              value={formatNumber(m.tarefasPendentes)}
              sublabel="Pendente + em andamento"
              icon={ClipboardCheck}
              tone={m.tarefasPendentes > 10 ? "rose" : "amber"}
            />
            <KpiCard
              label="Atrasadas"
              value={formatNumber(m.tarefasAtrasadas)}
              sublabel="Vencimento no passado"
              icon={AlertTriangle}
              tone={m.tarefasAtrasadas > 0 ? "rose" : "slate"}
            />
            <KpiCard
              label="Concluídas"
              value={formatNumber(store.tarefas.filter((t) => t.status === "concluida").length)}
              sublabel="Total finalizado"
              icon={CheckCircle2}
              tone="emerald"
            />
            <KpiCard
              label="Prioridade alta"
              value={formatNumber(
                store.tarefas.filter((t) => t.prioridade === "alta" && t.status !== "concluida" && t.status !== "cancelada").length,
              )}
              sublabel="Urgentes em aberto"
              icon={AlertTriangle}
              tone="rose"
            />
          </div>
        </SectionShell>
      )}

      {/* ═══════════════════════════════════════════════════════════════
          SEÇÃO 5 · Agenda / Eventos
          ═══════════════════════════════════════════════════════════════ */}
      {ready && (
        <SectionShell
          number="5"
          title="Agenda · Eventos"
          description="Compromissos e consultas marcadas."
          link="/sdr/agenda"
          tone="rose"
        >
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <KpiCard label="Eventos hoje" value={formatNumber(counts.eventosHoje)} sublabel="Agenda do dia" icon={CalendarRange} tone="rose" />
            <KpiCard
              label="Próximos 7 dias"
              value={formatNumber(m.eventosProximos7Dias)}
              sublabel="Confirmados + agendados"
              icon={CalendarRange}
              tone="amber"
            />
            <KpiCard
              label="Confirmados"
              value={formatNumber(store.agenda.filter((e) => e.status === "confirmado").length)}
              sublabel="No total"
              icon={CheckCircle2}
              tone="emerald"
            />
            <KpiCard
              label="Cancelados"
              value={formatNumber(store.agenda.filter((e) => e.status === "cancelado").length)}
              sublabel="Histórico"
              icon={AlertTriangle}
              tone="slate"
            />
          </div>
        </SectionShell>
      )}

      {/* ═══════════════════════════════════════════════════════════════
          SEÇÃO 6 · Metas das Secretárias
          ═══════════════════════════════════════════════════════════════ */}
      {ready && (
        <SectionShell
          number="6"
          title="Metas das Secretárias"
          description={`Performance individual no mês ${new Date().toISOString().slice(0, 7)}.`}
          link="/sdr/metas"
          tone="emerald"
        >
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <KpiCard
              label="Meta consolidada"
              value={formatCurrency(m.metaConsolidada)}
              sublabel={`${store.metas.filter((x) => x.mes === new Date().toISOString().slice(0, 7)).length} secretária(s)`}
              icon={Target}
              tone="emerald"
            />
            <KpiCard
              label="Cadastros realizados"
              value={formatNumber(m.realConsolidado)}
              sublabel="Soma de todas as secretárias"
              icon={Users}
              tone="emerald"
            />
            <KpiCard
              label="Top performer"
              value={(() => {
                const mes = new Date().toISOString().slice(0, 7);
                const metas = store.metas.filter((x) => x.mes === mes);
                if (metas.length === 0) return "—";
                const top = metas.reduce((max, cur) => (cur.qtdTotal > max.qtdTotal ? cur : max), metas[0]);
                return top.secretaria.split(" ")[0];
              })()}
              sublabel={(() => {
                const mes = new Date().toISOString().slice(0, 7);
                const metas = store.metas.filter((x) => x.mes === mes);
                if (metas.length === 0) return "Sem metas";
                const top = metas.reduce((max, cur) => (cur.qtdTotal > max.qtdTotal ? cur : max), metas[0]);
                return `${top.qtdTotal} cadastros`;
              })()}
              icon={Sparkles}
              tone="violet"
            />
            <KpiCard
              label="% da meta"
              value={(() => {
                if (m.metaConsolidada === 0) return "—";
                const pct = (m.realConsolidado / Math.max(1, m.metaConsolidada / 1000)) * 100;
                return formatPercent(pct, 0);
              })()}
              sublabel="Real / Meta"
              icon={TrendingUp}
              tone={m.realConsolidado >= m.metaConsolidada / 1000 * 0.8 ? "emerald" : "amber"}
            />
          </div>
        </SectionShell>
      )}

      {/* ═══════════════════════════════════════════════════════════════
          SEÇÃO 7 · Auditoria + 8 · Relatórios
          ═══════════════════════════════════════════════════════════════ */}
      {ready && (
        <div className="mb-6 grid grid-cols-1 gap-3 lg:grid-cols-2">
          <SectionShell number="7" title="Auditoria" description="Trilha de quem fez o quê." link="/sdr/auditoria" tone="slate" compact>
            <div className="grid grid-cols-2 gap-3">
              <KpiCard
                label="Ações registradas"
                value={formatNumber(store.auditLogs.length)}
                sublabel="Histórico completo"
                icon={FileSearch}
                tone="slate"
              />
              <KpiCard
                label="Aprovações 7d"
                value={formatNumber(
                  store.auditLogs.filter((l) => {
                    const d = new Date(l.createdAt);
                    const seteAtras = new Date();
                    seteAtras.setDate(seteAtras.getDate() - 7);
                    return l.action.includes("review_approved") && d >= seteAtras;
                  }).length,
                )}
                sublabel="Últimos 7 dias"
                icon={CheckCircle2}
                tone="emerald"
              />
            </div>
          </SectionShell>
          <SectionShell number="8" title="Relatórios + IA" description="Análise automática + PDF." link="/sdr/relatorios" tone="violet" compact>
            <div className="grid grid-cols-2 gap-3">
              <KpiCard
                label="Origens distintas"
                value={formatNumber(m.topOrigens.length)}
                sublabel={m.topOrigens[0] ? `Top: ${m.topOrigens[0].origem}` : "Sem dados"}
                icon={FileBarChart}
                tone="violet"
              />
              <KpiCard
                label="Análise IA"
                value="Pronta"
                sublabel="Clique pra gerar"
                icon={Sparkles}
                tone="emerald"
              />
            </div>
          </SectionShell>
        </div>
      )}

      {/* Distribuição por origem (preview) */}
      {ready && m.topOrigens.length > 0 && (
        <div className="rounded-xl border border-white/[0.06] bg-white/[0.015] p-4">
          <div className="mb-3 flex items-center justify-between">
            <div>
              <p className="text-[10px] font-medium uppercase tracking-wider text-slate-500">
                Distribuição por origem
              </p>
              <h3 className="mt-1 text-[14px] font-semibold text-slate-100">Top 5 fontes de leads</h3>
            </div>
            <span className="inline-flex items-center gap-1 text-[10.5px] text-slate-500">
              <CloudiaInlineBadge />
              <span>Auto-gerado</span>
            </span>
          </div>
          <div className="space-y-2">
            {m.topOrigens.map((o) => (
              <div key={o.origem}>
                <div className="flex items-baseline justify-between text-[11.5px]">
                  <span className="truncate text-slate-200" title={o.origem}>{o.origem}</span>
                  <span className="tabular-nums text-slate-400">{o.total} · {formatPercent(o.pct, 1)}</span>
                </div>
                <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-white/[0.05]">
                  <div className="h-full rounded-full bg-emerald-400/70" style={{ width: `${o.pct}%` }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ───────────────────────────────────────────────────────────────────────────
// Helpers
// ───────────────────────────────────────────────────────────────────────────

function SectionShell({
  number,
  title,
  description,
  link,
  tone,
  compact,
  children,
}: {
  number: string;
  title: string;
  description: string;
  link: string;
  tone: keyof typeof TONES;
  compact?: boolean;
  children: React.ReactNode;
}) {
  const t = TONES[tone];
  return (
    <section className={cn("mb-6", compact && "mb-0")}>
      <header className="mb-3 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5 min-w-0">
          <span
            className={cn(
              "flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-[10.5px] font-bold ring-1 ring-inset",
              t.ring,
              t.bg,
              t.icon,
            )}
          >
            {number}
          </span>
          <div className="min-w-0">
            <h2 className="truncate text-[13px] font-semibold text-slate-100">{title}</h2>
            <p className="truncate text-[11px] text-slate-500">{description}</p>
          </div>
        </div>
        <Link
          to={link}
          className="inline-flex shrink-0 items-center gap-1 rounded-md border border-white/[0.06] bg-white/[0.02] px-2.5 py-1 text-[11px] font-medium text-slate-300 transition-colors hover:border-white/[0.15] hover:bg-white/[0.05]"
        >
          Abrir <ArrowUpRight className="h-3 w-3" />
        </Link>
      </header>
      {children}
    </section>
  );
}

function KpiCard({
  label,
  value,
  sublabel,
  icon: Icon,
  tone,
  cloudia,
}: {
  label: string;
  value: string;
  sublabel: string;
  icon: typeof Activity;
  tone: keyof typeof TONES;
  cloudia?: boolean;
}) {
  const t = TONES[tone];
  return (
    <div className="relative overflow-hidden rounded-xl border border-white/[0.06] bg-white/[0.02] p-3.5">
      <div className="flex items-center justify-between">
        <div className={cn("flex h-7 w-7 items-center justify-center rounded-md ring-1 ring-inset", t.ring, t.bg)}>
          <Icon className={cn("h-3.5 w-3.5", t.icon)} />
        </div>
        {cloudia && <CloudiaInlineBadge />}
      </div>
      <p className="mt-2.5 text-[10px] font-medium uppercase tracking-wider text-slate-500">{label}</p>
      <p className="mt-1 text-[18px] font-semibold tabular-nums text-slate-100 truncate">{value}</p>
      <p className="mt-1 text-[10.5px] leading-tight text-slate-500 line-clamp-2">{sublabel}</p>
    </div>
  );
}
