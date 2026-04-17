import { useQuery } from "@tanstack/react-query";
import { Link, useParams } from "react-router-dom";
import {
  AlertTriangle, ArrowLeft, Building2, Calendar, CheckCircle2,
  Clock, CreditCard, Hash, History, Mail, MessageSquare, Phone,
  Tag, Target, Timer, User2, UserCog, XCircle, Sparkles, Activity,
  TrendingUp, Zap, FileText, Settings, StickyNote, ChevronRight,
} from "lucide-react";
import { useState } from "react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/Button";
import { StageBadge, StateBadge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import { analyticsService } from "@/services/analytics";
import { assignmentsService, type AssignmentLeadHistoryItem } from "@/services/assignments";
import { webhooksService } from "@/services/webhooks";
import { formatCurrency, formatDate, formatDuration } from "@/lib/utils";
import type { ConversationState } from "@/types";
import { cn } from "@/lib/utils";

/* ═══════════════════════════════════════════════════════════
   PAGE
═══════════════════════════════════════════════════════════ */
export default function LeadDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [activeTab, setActiveTab] = useState<"geral" | "historico" | "pagamentos" | "conversas">("geral");

  const lead    = useQuery({ queryKey: ["lead-detail", id],  queryFn: () => webhooksService.getLeadById(id!),     enabled: !!id, retry: false });
  const metrics = useQuery({ queryKey: ["lead-metrics", id], queryFn: () => analyticsService.leadMetrics(id!),    enabled: !!id, retry: false });
  const history = useQuery({ queryKey: ["lead-history", id], queryFn: () => assignmentsService.leadHistory(id!), enabled: !!id, retry: false });

  const l = lead.data;
  const m = metrics.data;

  /* ── Loading ── */
  if (lead.isLoading) {
    return (
      <>
        <PageHeader title="Carregando lead..." description={`ID: ${id}`} />
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          <div className="skeleton h-[600px] rounded-2xl lg:col-span-1" />
          <div className="skeleton h-[600px] rounded-2xl lg:col-span-2" />
        </div>
      </>
    );
  }

  /* ── Error ── */
  if (lead.isError || !l) {
    return (
      <>
        <PageHeader title="Lead não encontrado" description={`ID: ${id}`} actions={<BackButton />} />
        <div className="rounded-2xl border border-white/8 bg-slate-900/60 p-8">
          <EmptyState title="Não conseguimos carregar este lead" description="Verifique o ID ou se o backend está online." />
        </div>
      </>
    );
  }

  /* ── Helpers ── */
  const initials = (l.name ?? "?").split(" ").slice(0, 2).map((w) => w[0]).join("").toUpperCase();

  const allInteractions = l.conversations
    .flatMap((c) => c.interactions.map((i) => ({ ...i, conversationState: c.conversationState })))
    .sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt));

  const attendantItems =
    l.assignments.length > 0
      ? l.assignments.map((a) => ({ name: a.attendantName ?? `Atendente #${a.attendantId}`, date: a.assignedAt, stage: a.stage }))
      : (history.data ?? []).map((h: AssignmentLeadHistoryItem) => ({
          name: h.attendantName ?? "Atendente",
          date: (h.assignedAt as string | undefined) ?? (h.createdAt as string | undefined),
          stage: undefined,
        }));

  const TABS = [
    { key: "geral",      label: "Geral",      icon: <User2     className="h-3.5 w-3.5" /> },
    { key: "historico",  label: "Histórico",  icon: <TrendingUp className="h-3.5 w-3.5" /> },
    { key: "pagamentos", label: "Pagamentos", icon: <CreditCard className="h-3.5 w-3.5" /> },
    { key: "conversas",  label: "Conversas",  icon: <MessageSquare className="h-3.5 w-3.5" /> },
  ] as const;

  /* ── Render ── */
  return (
    <div className="space-y-5 animate-in fade-in slide-in-from-bottom-3 duration-500">

      {/* ━━━ TOP BAR ━━━ */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <PageHeader
          title={l.name ?? "Lead sem nome"}
          description={`ID ${l.id}${l.externalId ? ` · External ${l.externalId}` : ""}`}
        />
        <BackButton />
      </div>

      {/* ━━━ LAYOUT: sidebar + conteúdo ━━━ */}
      <div className="grid grid-cols-1 lg:grid-cols-[320px_1fr] gap-5 items-start">

        {/* ══════════════════════════════════
            SIDEBAR — estilo "Dados do contato"
        ══════════════════════════════════ */}
        <aside className="rounded-2xl border border-white/8 bg-slate-900/70 backdrop-blur-sm shadow-2xl overflow-hidden">

          {/* Header da sidebar */}
          <div className="flex items-center justify-between px-4 py-3.5 border-b border-white/6">
            <span className="text-sm font-semibold text-slate-100">Dados do contato</span>
            <button className="h-7 w-7 rounded-lg bg-white/5 hover:bg-white/10 border border-white/8 grid place-items-center transition-colors">
              <Settings className="h-3.5 w-3.5 text-slate-400" />
            </button>
          </div>

          {/* Avatar + nome */}
          <div className="flex flex-col items-center py-6 px-4 border-b border-white/6">
            {/* Avatar circular com anel */}
            <div className="relative mb-3">
              <div className="h-20 w-20 rounded-full bg-gradient-to-br from-brand-500 to-violet-700 grid place-items-center text-2xl font-extrabold text-white ring-4 ring-brand-500/20 shadow-xl shadow-violet-900/40">
                {initials}
              </div>
              {/* Dot de estado online */}
              <span className={cn(
                "absolute bottom-1 right-1 h-3.5 w-3.5 rounded-full border-2 border-slate-900",
                l.conversationState === "SERVICE" ? "bg-emerald-400" :
                l.conversationState === "QUEUE"   ? "bg-amber-400"   : "bg-slate-600"
              )} />
            </div>

            <h2 className="text-base font-bold text-slate-50 text-center leading-snug">{l.name ?? "Sem nome"}</h2>
            <p className="text-xs text-slate-500 mt-0.5">{formatDate(l.createdAt)}</p>
            {l.phone && (
              <p className="text-xs font-mono text-brand-400 mt-1">{l.phone}</p>
            )}

            {/* Badges de estado */}
            <div className="flex items-center gap-2 mt-3 flex-wrap justify-center">
              <StateBadge state={(l.conversationState as ConversationState) ?? undefined} />
              <StageBadge stage={l.currentStage} />
            </div>
          </div>

          {/* Campos de contato — estilo "label: valor" */}
          <div className="divide-y divide-white/4">
            <SidebarField icon={<Phone className="h-3.5 w-3.5" />}    label="Telefone"  value={l.phone} />
            <SidebarField icon={<Mail  className="h-3.5 w-3.5" />}    label="E-mail"    value={l.email} />
            <SidebarField icon={<Hash  className="h-3.5 w-3.5" />}    label="CPF"       value={l.cpf} />
            <SidebarField icon={<User2 className="h-3.5 w-3.5" />}    label="Gênero"    value={l.gender} />
            <SidebarField icon={<Building2 className="h-3.5 w-3.5" />} label="Unidade"  value={l.unitName ?? (l.unitId ? `Unit #${l.unitId}` : undefined)} />
            <SidebarField icon={<UserCog className="h-3.5 w-3.5" />}  label="Atendente" value={l.attendantName} />
            <SidebarField icon={<Target className="h-3.5 w-3.5" />}   label="Origem"    value={l.source} />
            <SidebarField icon={<MessageSquare className="h-3.5 w-3.5" />} label="Canal" value={l.channel} />
          </div>

          {/* Bool status pills */}
          <div className="px-4 py-4 border-t border-white/6 space-y-3">
            <SectionLabel>Status</SectionLabel>
            <div className="grid grid-cols-3 gap-2">
              <BoolPill label="Consulta"   value={l.hasAppointment} />
              <BoolPill label="Pagamento"  value={l.hasPayment} />
              <BoolPill label="Plano"      value={l.hasHealthInsurancePlan} />
            </div>
          </div>

          {/* Tags */}
          {l.tags.length > 0 && (
            <div className="px-4 pb-4 border-t border-white/6 pt-4 space-y-2">
              <SectionLabel>Tags do Contato</SectionLabel>
              <div className="flex flex-wrap gap-1.5">
                {l.tags.map((t) => (
                  <span
                    key={t}
                    className="inline-flex items-center gap-1 text-[11px] font-semibold px-2.5 py-1 rounded-full bg-violet-500/15 border border-violet-500/25 text-violet-300 hover:bg-violet-500/20 transition-colors cursor-default"
                  >
                    {t}
                    <XCircle className="h-3 w-3 opacity-50" />
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Observações */}
          {l.observations && (
            <div className="px-4 pb-5 border-t border-white/6 pt-4 space-y-2">
              <SectionLabel>Observações</SectionLabel>
              <p className="text-xs text-slate-400 leading-relaxed whitespace-pre-wrap">
                {l.observations}
              </p>
            </div>
          )}
        </aside>

        {/* ══════════════════════════════════
            CONTEÚDO PRINCIPAL com abas
        ══════════════════════════════════ */}
        <div className="space-y-5 min-w-0">

          {/* Abas */}
          <div className="flex items-center gap-1 p-1 rounded-xl bg-slate-900/60 border border-white/8 backdrop-blur-sm w-fit">
            {TABS.map((tab) => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={cn(
                  "flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold transition-all",
                  activeTab === tab.key
                    ? "bg-brand-600 text-white shadow-lg shadow-brand-900/40"
                    : "text-slate-400 hover:text-slate-200 hover:bg-white/5"
                )}
              >
                {tab.icon}
                {tab.label}
              </button>
            ))}
          </div>

          {/* ── ABA: GERAL ── */}
          {activeTab === "geral" && (
            <div className="space-y-4 animate-in fade-in duration-200">

              {/* Atribuição & rastreamento */}
              <GlassCard title="Atribuição & Rastreamento" subtitle="Origem, canal e confiança do lead" icon={<Target className="h-4 w-4 text-violet-400" />}>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
                  <InfoBlock icon={<Target        className="h-4 w-4" />} label="Origem"   value={l.source}            tone="violet" />
                  <InfoBlock icon={<MessageSquare className="h-4 w-4" />} label="Canal"    value={l.channel}           tone="blue" />
                  <InfoBlock icon={<Tag           className="h-4 w-4" />} label="Campanha" value={l.campaign}          tone="amber" />
                  <InfoBlock
                    icon={<Sparkles className="h-4 w-4" />}
                    label="Confiança"
                    value={l.trackingConfidence}
                    tone={l.trackingConfidence === "ALTA" ? "emerald" : l.trackingConfidence === "MEDIA" ? "amber" : "slate"}
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-y-3 gap-x-10">
                  <Row icon={<Tag      className="h-3.5 w-3.5" />} label="Anúncio"         value={l.ad} />
                  <Row icon={<Calendar className="h-3.5 w-3.5" />} label="Criado em"        value={formatDate(l.createdAt)} />
                  <Row icon={<Clock    className="h-3.5 w-3.5" />} label="Atualizado em"    value={formatDate(l.updatedAt)} />
                  {l.convertedAt && (
                    <Row icon={<CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />} label="Convertido em" value={formatDate(l.convertedAt)} />
                  )}
                  <Row icon={<Mail className="h-3.5 w-3.5" />} label="Email atendente" value={l.attendantEmail} />
                </div>
              </GlassCard>

              {/* Métricas de tempo */}
              {m && (
                <GlassCard title="Tempo no Funil" subtitle="Duração em cada etapa do atendimento" icon={<Activity className="h-4 w-4 text-emerald-400" />}>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    <TimeBlock label="No bot"         value={m.timeInBot}     tone="violet"  icon={<Zap      className="h-4 w-4" />} />
                    <TimeBlock label="Na fila"        value={m.timeInQueue}   tone="amber"   icon={<Timer    className="h-4 w-4" />} />
                    <TimeBlock label="Em atendimento" value={m.timeInService} tone="blue"    icon={<Timer    className="h-4 w-4" />} />
                    <TimeBlock label="Total"          value={m.totalTime}     tone="emerald" icon={<Activity className="h-4 w-4" />} />
                  </div>
                </GlassCard>
              )}

              {/* Alertas */}
              {m?.alerts && m.alerts.length > 0 && (
                <div className="rounded-2xl border border-amber-500/25 bg-gradient-to-br from-amber-500/8 via-amber-900/5 to-transparent p-5">
                  <div className="flex items-center gap-2.5 text-amber-300 font-semibold text-sm mb-3">
                    <div className="h-7 w-7 rounded-lg bg-amber-500/15 grid place-items-center shrink-0">
                      <AlertTriangle className="h-4 w-4" />
                    </div>
                    Alertas ativos
                    <span className="ml-auto text-[11px] font-bold bg-amber-500/20 text-amber-300 px-2.5 py-0.5 rounded-full border border-amber-500/20">
                      {m.alerts.length}
                    </span>
                  </div>
                  <ul className="space-y-2">
                    {m.alerts.map((a, i) => (
                      <li key={i} className="flex items-start gap-2.5 text-xs text-amber-200/80">
                        <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-amber-400/80 shrink-0" />
                        {a}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Log de interações */}
              <GlassCard title="Log de Interações" subtitle={`${allInteractions.length} evento(s)`} icon={<History className="h-4 w-4 text-slate-400" />}>
                {allInteractions.length === 0 ? (
                  <EmptyState title="Nenhuma interação registrada" />
                ) : (
                  <ul className="space-y-2">
                    {allInteractions.map((it) => (
                      <li key={it.id} className="flex items-start gap-3 p-3 rounded-xl bg-white/[0.02] border border-white/5 hover:bg-white/[0.04] hover:border-brand-500/20 transition-all group">
                        <div className="h-8 w-8 rounded-lg bg-white/5 border border-white/6 grid place-items-center shrink-0 mt-0.5 group-hover:bg-brand-500/10 group-hover:border-brand-500/30 transition-all">
                          <History className="h-3.5 w-3.5 text-slate-500 group-hover:text-brand-400 transition-colors" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-[11px] font-semibold px-2 py-0.5 rounded-md bg-slate-800 border border-white/8 text-slate-300">
                              {it.type}
                            </span>
                            <span className="text-[11px] text-slate-600">{formatDate(it.createdAt)}</span>
                          </div>
                          {it.content && (
                            <p className="text-sm text-slate-300 mt-1.5 break-words leading-relaxed">{it.content}</p>
                          )}
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </GlassCard>
            </div>
          )}

          {/* ── ABA: HISTÓRICO ── */}
          {activeTab === "historico" && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 animate-in fade-in duration-200">

              <GlassCard title="Etapas" subtitle={`${l.stageHistory.length} mudança(s)`} icon={<TrendingUp className="h-4 w-4 text-brand-400" />}>
                {l.stageHistory.length > 0 ? (
                  <ol className="relative ml-1 space-y-0">
                    {l.stageHistory.map((h, idx) => (
                      <li key={h.id} className="relative flex gap-4 pb-6 last:pb-0">
                        {idx < l.stageHistory.length - 1 && (
                          <span className="absolute left-[9px] top-5 bottom-0 w-px bg-gradient-to-b from-brand-500/40 to-transparent" />
                        )}
                        <span className={cn(
                          "mt-0.5 h-5 w-5 rounded-full ring-4 ring-slate-900 grid place-items-center shrink-0 z-10",
                          idx === 0 ? "bg-brand-500 shadow-[0_0_12px_3px_rgba(99,102,241,0.45)]" : "bg-slate-700"
                        )}>
                          <span className={cn("h-1.5 w-1.5 rounded-full", idx === 0 ? "bg-white" : "bg-slate-500")} />
                        </span>
                        <div className="pt-0.5">
                          <p className="text-[11px] text-slate-500 mb-1.5">{formatDate(h.changedAt)}</p>
                          <StageBadge stage={h.stageLabel} />
                        </div>
                      </li>
                    ))}
                  </ol>
                ) : (
                  <EmptyState title="Sem histórico de etapas" />
                )}
              </GlassCard>

              <GlassCard title="Atendentes" subtitle={`${attendantItems.length} atribuição(ões)`} icon={<UserCog className="h-4 w-4 text-violet-400" />}>
                {attendantItems.length > 0 ? (
                  <ul className="space-y-2.5">
                    {attendantItems.map((item, i) => (
                      <li key={i} className="flex items-start gap-3 p-3 rounded-xl bg-white/[0.02] border border-white/5 hover:bg-white/[0.04] hover:border-white/10 transition-all">
                        <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-brand-400 to-violet-600 grid place-items-center text-xs font-extrabold shrink-0 shadow-lg">
                          {item.name.charAt(0).toUpperCase()}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-semibold text-slate-100">{item.name}</p>
                          <p className="text-xs text-slate-500 mt-0.5">{formatDate(item.date)}</p>
                          {item.stage && <div className="mt-1.5"><StageBadge stage={item.stage} /></div>}
                        </div>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <EmptyState title="Sem histórico de atendentes" />
                )}
              </GlassCard>
            </div>
          )}

          {/* ── ABA: PAGAMENTOS ── */}
          {activeTab === "pagamentos" && (
            <GlassCard title="Pagamentos" subtitle={`${l.payments.length} pagamento(s) registrado(s)`} icon={<CreditCard className="h-4 w-4 text-emerald-400" />}>
              {l.payments.length > 0 ? (
                <ul className="space-y-2.5">
                  {l.payments.map((p) => (
                    <li key={p.id} className="flex items-center justify-between p-4 rounded-xl bg-emerald-500/[0.04] border border-emerald-500/15 hover:bg-emerald-500/[0.08] hover:border-emerald-500/25 transition-all">
                      <div className="flex items-center gap-3">
                        <div className="h-11 w-11 rounded-xl bg-emerald-500/10 border border-emerald-500/20 grid place-items-center">
                          <CreditCard className="h-5 w-5 text-emerald-400" />
                        </div>
                        <div>
                          <p className="text-base font-bold text-slate-100">{formatCurrency(p.amount)}</p>
                          <p className="text-xs text-slate-500 mt-0.5">{formatDate(p.paidAt)}</p>
                        </div>
                      </div>
                      <span className="text-[11px] font-bold px-3 py-1.5 rounded-full bg-emerald-500/15 text-emerald-300 border border-emerald-500/20">
                        ✓ Pago
                      </span>
                    </li>
                  ))}
                </ul>
              ) : (
                <EmptyState title="Nenhum pagamento registrado" />
              )}
            </GlassCard>
          )}

          {/* ── ABA: CONVERSAS ── */}
          {activeTab === "conversas" && (
            <GlassCard title="Conversas" subtitle={`${l.conversations.length} conversa(s)`} icon={<MessageSquare className="h-4 w-4 text-brand-400" />}>
              {l.conversations.length > 0 ? (
                <ul className="space-y-3">
                  {l.conversations.map((c) => (
                    <li key={c.id} className="p-4 rounded-xl bg-white/[0.02] border border-white/5 hover:bg-white/[0.04] hover:border-white/10 transition-all">
                      <div className="flex items-center justify-between mb-2.5 flex-wrap gap-2">
                        <div className="flex items-center gap-2">
                          <StateBadge state={c.conversationState as ConversationState} />
                          <span className="text-[11px] font-medium text-slate-400 bg-white/5 px-2 py-0.5 rounded-full border border-white/6">
                            {c.channel}
                          </span>
                        </div>
                        <span className="text-[11px] text-slate-500">
                          {formatDate(c.startedAt)}
                          {c.endedAt
                            ? <> → {formatDate(c.endedAt)}</>
                            : <span className="ml-1 text-emerald-400 font-semibold">· ao vivo</span>
                          }
                        </span>
                      </div>
                      {c.attendantName && (
                        <p className="text-xs text-slate-500">
                          Atendente: <span className="text-slate-300 font-semibold">{c.attendantName}</span>
                        </p>
                      )}
                      <p className="text-[11px] text-slate-600 mt-1.5">
                        {c.interactions.length} interação(ões)
                      </p>
                    </li>
                  ))}
                </ul>
              ) : (
                <EmptyState title="Nenhuma conversa registrada" />
              )}
            </GlassCard>
          )}
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   LAYOUT PRIMITIVES
═══════════════════════════════════════════════════════════ */

function BackButton() {
  return (
    <Link to="/leads">
      <Button variant="outline" size="sm" className="gap-1.5 shrink-0">
        <ArrowLeft className="h-4 w-4" /> Voltar
      </Button>
    </Link>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500">{children}</p>
  );
}

/** Sidebar field — label esquerda + valor direita, separado por divisor */
function SidebarField({ icon, label, value }: { icon: React.ReactNode; label: string; value?: string | null }) {
  return (
    <div className="flex items-center justify-between gap-3 px-4 py-3 hover:bg-white/[0.02] transition-colors group">
      <span className="flex items-center gap-2 text-xs text-slate-500 shrink-0">
        <span className="text-slate-600 group-hover:text-brand-400 transition-colors">{icon}</span>
        {label}:
      </span>
      <span className={cn(
        "text-xs font-medium truncate max-w-[55%] text-right",
        value ? "text-slate-200" : "text-slate-700 italic"
      )}>
        {value ?? "Não informado"}
      </span>
    </div>
  );
}

function GlassCard({
  title, subtitle, icon, children,
}: {
  title: string;
  subtitle?: string;
  icon?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-white/8 bg-slate-900/60 backdrop-blur-sm shadow-xl overflow-hidden">
      <div className="flex items-center justify-between gap-3 px-5 py-4 border-b border-white/6">
        <div>
          <p className="text-sm font-semibold text-slate-100">{title}</p>
          {subtitle && <p className="text-xs text-slate-500 mt-0.5">{subtitle}</p>}
        </div>
        {icon && (
          <div className="h-8 w-8 rounded-lg bg-white/5 border border-white/8 grid place-items-center shrink-0">
            {icon}
          </div>
        )}
      </div>
      <div className="p-5">{children}</div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   FIELD COMPONENTS
═══════════════════════════════════════════════════════════ */

function Row({ icon, label, value }: { icon: React.ReactNode; label: string; value?: string | null }) {
  return (
    <div className="flex items-center justify-between gap-3 group py-0.5">
      <span className="text-xs text-slate-500 flex items-center gap-1.5 shrink-0">
        <span className="text-slate-600 group-hover:text-brand-400 transition-colors">{icon}</span>
        {label}
      </span>
      <span className="text-sm text-slate-200 truncate max-w-[58%] text-right font-medium">
        {value ?? <span className="text-slate-700 font-normal">—</span>}
      </span>
    </div>
  );
}

function BoolPill({ label, value }: { label: string; value?: boolean | null }) {
  const isTrue = value === true;
  return (
    <div className={cn(
      "rounded-xl border p-2.5 text-center transition-all",
      isTrue
        ? "border-emerald-500/30 bg-emerald-500/10"
        : "border-white/6 bg-white/[0.02]"
    )}>
      <div className={cn("flex justify-center mb-1", isTrue ? "text-emerald-400" : "text-slate-600")}>
        {isTrue ? <CheckCircle2 className="h-4 w-4" /> : <XCircle className="h-4 w-4" />}
      </div>
      <span className={cn("text-[10px] font-semibold leading-none block", isTrue ? "text-emerald-300" : "text-slate-600")}>
        {label}
      </span>
    </div>
  );
}

function InfoBlock({ icon, label, value, tone }: {
  icon: React.ReactNode;
  label: string;
  value?: string | null;
  tone: "violet" | "amber" | "blue" | "emerald" | "slate";
}) {
  const p = {
    violet:  { from: "from-violet-500/10",  border: "hover:border-violet-500/30", text: "text-violet-200",  iconCls: "text-violet-400"  },
    amber:   { from: "from-amber-500/10",   border: "hover:border-amber-500/30",  text: "text-amber-200",   iconCls: "text-amber-400"   },
    blue:    { from: "from-brand-500/10",   border: "hover:border-brand-500/30",  text: "text-brand-200",   iconCls: "text-brand-400"   },
    emerald: { from: "from-emerald-500/10", border: "hover:border-emerald-500/30",text: "text-emerald-200", iconCls: "text-emerald-400" },
    slate:   { from: "from-slate-500/10",   border: "hover:border-slate-500/30",  text: "text-slate-200",   iconCls: "text-slate-400"   },
  }[tone];

  return (
    <div className={cn("rounded-xl border border-white/8 bg-gradient-to-br to-transparent p-3.5 transition-all", p.from, p.border)}>
      <div className="flex items-center justify-between mb-2.5">
        <span className="text-[10px] font-bold uppercase tracking-widest text-slate-500">{label}</span>
        <span className={p.iconCls}>{icon}</span>
      </div>
      <p className={cn("text-sm font-bold truncate", p.text)} title={value ?? "—"}>
        {value ?? <span className="text-slate-700 font-normal text-xs">Não informado</span>}
      </p>
    </div>
  );
}

function TimeBlock({ label, value, tone, icon }: {
  label: string;
  value?: number;
  tone: "violet" | "amber" | "blue" | "emerald";
  icon: React.ReactNode;
}) {
  const p = {
    violet:  { from: "from-violet-500/10",  border: "hover:border-violet-500/30", value: "text-violet-100",  iconCls: "text-violet-400"  },
    amber:   { from: "from-amber-500/10",   border: "hover:border-amber-500/30",  value: "text-amber-100",   iconCls: "text-amber-400"   },
    blue:    { from: "from-brand-500/10",   border: "hover:border-brand-500/30",  value: "text-brand-100",   iconCls: "text-brand-400"   },
    emerald: { from: "from-emerald-500/10", border: "hover:border-emerald-500/30",value: "text-emerald-100", iconCls: "text-emerald-400" },
  }[tone];

  return (
    <div className={cn("rounded-xl border border-white/8 bg-gradient-to-br to-transparent p-3.5 transition-all", p.from, p.border)}>
      <div className="flex items-center justify-between mb-2">
        <span className="text-[10px] font-bold uppercase tracking-widest text-slate-500">{label}</span>
        <span className={p.iconCls}>{icon}</span>
      </div>
      <p className={cn("text-2xl font-extrabold tracking-tight tabular-nums", p.value)}>
        {formatDuration(value)}
      </p>
    </div>
  );
}