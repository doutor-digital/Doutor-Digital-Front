import { useQuery } from "@tanstack/react-query";
import { Link, useParams } from "react-router-dom";
import {
  AlertTriangle, ArrowLeft, Building2, Calendar, CheckCircle2,
  Clock, CreditCard, Hash, History, Mail, MessageSquare, Phone,
  Tag, Target, Timer, User2, UserCog, XCircle, Sparkles, Activity,
  TrendingUp, Zap,
} from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge, StageBadge, StateBadge } from "@/components/ui/Badge";
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

  const lead    = useQuery({ queryKey: ["lead-detail", id],  queryFn: () => webhooksService.getLeadById(id!),        enabled: !!id, retry: false });
  const metrics = useQuery({ queryKey: ["lead-metrics", id], queryFn: () => analyticsService.leadMetrics(id!),       enabled: !!id, retry: false });
  const history = useQuery({ queryKey: ["lead-history", id], queryFn: () => assignmentsService.leadHistory(id!),    enabled: !!id, retry: false });

  const l = lead.data;
  const m = metrics.data;

  /* ── Loading ── */
  if (lead.isLoading) {
    return (
      <>
        <PageHeader title="Carregando lead..." description={`ID: ${id}`} />
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="skeleton h-[480px] w-full rounded-2xl lg:col-span-1" />
          <div className="skeleton h-[480px] w-full rounded-2xl lg:col-span-2" />
          {[0,1,2,3].map(i => <div key={i} className="skeleton h-48 rounded-2xl" />)}
        </div>
      </>
    );
  }

  /* ── Error ── */
  if (lead.isError || !l) {
    return (
      <>
        <PageHeader
          title="Lead não encontrado"
          description={`ID: ${id}`}
          actions={<BackButton />}
        />
        <Card>
          <CardBody>
            <EmptyState title="Não conseguimos carregar este lead" description="Verifique o ID ou se o backend está online." />
          </CardBody>
        </Card>
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

  /* ── Render ── */
  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-3 duration-500">

      {/* ━━━ HEADER ━━━ */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <PageHeader
            title={l.name ?? "Lead sem nome"}
            description={`ID ${l.id}${l.externalId ? ` · External ${l.externalId}` : ""}`}
          />
        </div>
        <BackButton />
      </div>

      {/* ━━━ ROW 1 · PERFIL + ATRIBUIÇÃO ━━━ */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">

        {/* ── Perfil ── */}
        <div className="lg:col-span-1 flex flex-col rounded-2xl border border-white/8 bg-slate-900/60 backdrop-blur-sm overflow-hidden shadow-xl">

          {/* Hero banner */}
          <div className="relative h-32 bg-gradient-to-br from-brand-700/50 via-violet-700/40 to-slate-900/0 shrink-0">
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_80%_at_-20%_-20%,rgba(99,102,241,0.35),transparent)]" />
            {/* Decorative dots */}
            <div className="absolute inset-0 opacity-20"
              style={{ backgroundImage: "radial-gradient(circle, white 1px, transparent 1px)", backgroundSize: "18px 18px" }}
            />
            {/* Avatar */}
            <div className="absolute -bottom-9 left-5">
              <div className="h-[72px] w-[72px] rounded-2xl ring-[3px] ring-slate-900 bg-gradient-to-br from-brand-400 via-violet-500 to-purple-700 grid place-items-center text-2xl font-extrabold text-white shadow-2xl shadow-violet-900/60">
                {initials}
              </div>
            </div>
          </div>

          {/* Body */}
          <div className="flex-1 px-5 pt-14 pb-5 space-y-4">

            {/* Name + badges */}
            <div>
              <h2 className="text-lg font-bold text-slate-50 leading-snug">{l.name ?? "—"}</h2>
              <div className="flex items-center gap-2 mt-2 flex-wrap">
                <StateBadge state={(l.conversationState as ConversationState) ?? undefined} />
                <StageBadge stage={l.currentStage} />
              </div>
            </div>

            {/* Divider */}
            <hr className="border-white/6" />

            {/* Contact rows */}
            <div className="space-y-2.5">
              <ContactRow icon={<Phone className="h-3.5 w-3.5" />} value={l.phone} placeholder="Sem telefone" />
              <ContactRow icon={<Mail  className="h-3.5 w-3.5" />} value={l.email} placeholder="Sem e-mail" />
              <ContactRow icon={<Hash  className="h-3.5 w-3.5" />} value={l.cpf}   placeholder="Sem CPF" />
              <ContactRow icon={<User2 className="h-3.5 w-3.5" />} value={l.gender} placeholder="Gênero não informado" />
            </div>

            {/* Divider */}
            <hr className="border-white/6" />

            {/* Bool pills */}
            <div>
              <SectionLabel>Status</SectionLabel>
              <div className="grid grid-cols-3 gap-2 mt-2">
                <BoolPill label="Consulta"    value={l.hasAppointment} />
                <BoolPill label="Pagamento"   value={l.hasPayment} />
                <BoolPill label="Plano"       value={l.hasHealthInsurancePlan} />
              </div>
            </div>

            {/* Observations */}
            {l.observations && (
              <div className="rounded-xl bg-white/[0.03] border border-white/6 p-3.5">
                <SectionLabel>Observações</SectionLabel>
                <p className="text-sm text-slate-300 mt-2 whitespace-pre-wrap leading-relaxed">
                  {l.observations}
                </p>
              </div>
            )}

            {/* Tags */}
            {l.tags.length > 0 && (
              <div>
                <SectionLabel>Tags</SectionLabel>
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {l.tags.map((t) => (
                    <span key={t} className="inline-flex items-center gap-1 text-[11px] font-medium px-2 py-1 rounded-full bg-slate-800 border border-white/8 text-slate-300 hover:border-brand-500/40 transition-colors">
                      <Tag className="h-2.5 w-2.5" /> {t}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* ── Atribuição & Contexto ── */}
        <div className="lg:col-span-2 rounded-2xl border border-white/8 bg-slate-900/60 backdrop-blur-sm overflow-hidden shadow-xl flex flex-col">

          {/* Card header strip */}
          <div className="px-5 pt-5 pb-4 border-b border-white/6">
            <p className="text-base font-semibold text-slate-100">Atribuição & Contexto</p>
            <p className="text-xs text-slate-500 mt-0.5">Origem, canal e rastreamento deste lead</p>
          </div>

          <div className="flex-1 px-5 py-5 space-y-6">

            {/* Tracking blocks */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <InfoBlock icon={<Target        className="h-4 w-4" />} label="Origem"    value={l.source}             tone="violet" />
              <InfoBlock icon={<MessageSquare className="h-4 w-4" />} label="Canal"     value={l.channel}            tone="blue" />
              <InfoBlock icon={<Tag           className="h-4 w-4" />} label="Campanha"  value={l.campaign}           tone="amber" />
              <InfoBlock
                icon={<Sparkles className="h-4 w-4" />}
                label="Confiança"
                value={l.trackingConfidence}
                tone={l.trackingConfidence === "ALTA" ? "emerald" : l.trackingConfidence === "MEDIA" ? "amber" : "slate"}
              />
            </div>

            {/* Detail rows */}
            <div>
              <SectionLabel>Detalhes</SectionLabel>
              <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-y-3 gap-x-8">
                <Row icon={<Tag       className="h-3.5 w-3.5" />} label="Anúncio"         value={l.ad} />
                <Row icon={<Building2 className="h-3.5 w-3.5" />} label="Unidade"         value={l.unitName ?? (l.unitId ? `Unit #${l.unitId}` : undefined)} />
                <Row icon={<UserCog   className="h-3.5 w-3.5" />} label="Atendente"       value={l.attendantName} />
                <Row icon={<Mail      className="h-3.5 w-3.5" />} label="Email atendente" value={l.attendantEmail} />
                <Row icon={<Calendar  className="h-3.5 w-3.5" />} label="Criado em"       value={formatDate(l.createdAt)} />
                <Row icon={<Clock     className="h-3.5 w-3.5" />} label="Atualizado em"   value={formatDate(l.updatedAt)} />
                {l.convertedAt && (
                  <Row icon={<CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />} label="Convertido em" value={formatDate(l.convertedAt)} />
                )}
              </div>
            </div>

            {/* Time metrics */}
            {m && (
              <div>
                <SectionLabel>Tempo no funil</SectionLabel>
                <div className="mt-3 grid grid-cols-2 md:grid-cols-4 gap-3">
                  <TimeBlock label="No bot"         value={m.timeInBot}     tone="violet" icon={<Zap      className="h-4 w-4" />} />
                  <TimeBlock label="Na fila"        value={m.timeInQueue}   tone="amber"  icon={<Timer    className="h-4 w-4" />} />
                  <TimeBlock label="Em atendimento" value={m.timeInService} tone="blue"   icon={<Timer    className="h-4 w-4" />} />
                  <TimeBlock label="Total"          value={m.totalTime}     tone="emerald" icon={<Activity className="h-4 w-4" />} />
                </div>
              </div>
            )}

            {/* Alerts */}
            {m?.alerts && m.alerts.length > 0 && (
              <div className="rounded-xl border border-amber-500/25 bg-gradient-to-br from-amber-500/8 to-amber-900/5 p-4">
                <div className="flex items-center gap-2 text-amber-300 font-semibold text-sm mb-3">
                  <div className="h-6 w-6 rounded-lg bg-amber-500/15 grid place-items-center">
                    <AlertTriangle className="h-3.5 w-3.5" />
                  </div>
                  Alertas ativos
                  <span className="ml-auto text-[11px] font-normal bg-amber-500/20 text-amber-300 px-2 py-0.5 rounded-full">
                    {m.alerts.length}
                  </span>
                </div>
                <ul className="space-y-2">
                  {m.alerts.map((a, i) => (
                    <li key={i} className="flex items-start gap-2.5 text-xs text-amber-200/80">
                      <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-amber-400/70 shrink-0" />
                      {a}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ━━━ SECTION DIVIDER ━━━ */}
      <SectionDivider label="Histórico & Atividade" />

      {/* ━━━ ROW 2 · STAGE + ATTENDANT ━━━ */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">

        {/* Histórico de etapas */}
        <GlassCard title="Histórico de etapas" subtitle={`${l.stageHistory.length} mudança(s)`} icon={<TrendingUp className="h-4 w-4 text-brand-400" />}>
          {l.stageHistory.length > 0 ? (
            <ol className="relative ml-1 space-y-0">
              {l.stageHistory.map((h, idx) => (
                <li key={h.id} className="relative flex gap-4 pb-6 last:pb-0">
                  {/* Vertical line */}
                  {idx < l.stageHistory.length - 1 && (
                    <span className="absolute left-[9px] top-5 bottom-0 w-px bg-gradient-to-b from-brand-500/40 to-transparent" />
                  )}
                  {/* Dot */}
                  <span className={cn(
                    "mt-0.5 h-5 w-5 rounded-full ring-4 ring-slate-900 grid place-items-center shrink-0 z-10",
                    idx === 0 ? "bg-brand-500 shadow-[0_0_12px_3px_rgba(99,102,241,0.45)]" : "bg-slate-700"
                  )}>
                    <span className={cn("h-1.5 w-1.5 rounded-full", idx === 0 ? "bg-white" : "bg-slate-500")} />
                  </span>
                  {/* Content */}
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

        {/* Histórico de atendentes */}
        <GlassCard title="Histórico de atendentes" subtitle={`${attendantItems.length} atribuição(ões)`} icon={<UserCog className="h-4 w-4 text-violet-400" />}>
          {attendantItems.length > 0 ? (
            <ul className="space-y-3">
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

      {/* ━━━ ROW 3 · PAGAMENTOS + CONVERSAS ━━━ */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">

        {/* Pagamentos */}
        <GlassCard title="Pagamentos" subtitle={`${l.payments.length} pagamento(s)`} icon={<CreditCard className="h-4 w-4 text-emerald-400" />}>
          {l.payments.length > 0 ? (
            <ul className="space-y-2">
              {l.payments.map((p) => (
                <li key={p.id} className="flex items-center justify-between p-3 rounded-xl bg-emerald-500/[0.04] border border-emerald-500/15 hover:bg-emerald-500/[0.08] hover:border-emerald-500/25 transition-all">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 grid place-items-center">
                      <CreditCard className="h-4 w-4 text-emerald-400" />
                    </div>
                    <div>
                      <p className="text-sm font-bold text-slate-100">{formatCurrency(p.amount)}</p>
                      <p className="text-xs text-slate-500 mt-0.5">{formatDate(p.paidAt)}</p>
                    </div>
                  </div>
                  <span className="text-[11px] font-semibold px-2.5 py-1 rounded-full bg-emerald-500/15 text-emerald-300 border border-emerald-500/20">
                    ✓ Pago
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState title="Nenhum pagamento registrado" />
          )}
        </GlassCard>

        {/* Conversas */}
        <GlassCard title="Conversas" subtitle={`${l.conversations.length} conversa(s)`} icon={<MessageSquare className="h-4 w-4 text-brand-400" />}>
          {l.conversations.length > 0 ? (
            <ul className="space-y-2.5">
              {l.conversations.map((c) => (
                <li key={c.id} className="p-3.5 rounded-xl bg-white/[0.02] border border-white/5 hover:bg-white/[0.04] hover:border-white/10 transition-all">
                  <div className="flex items-center justify-between mb-2 flex-wrap gap-2">
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
                        : <span className="ml-1 text-emerald-400 font-medium">· ao vivo</span>
                      }
                    </span>
                  </div>
                  {c.attendantName && (
                    <p className="text-xs text-slate-500 mt-1">
                      Atendente: <span className="text-slate-300 font-medium">{c.attendantName}</span>
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
      </div>

      {/* ━━━ SECTION DIVIDER ━━━ */}
      <SectionDivider label="Log de Interações" />

      {/* ━━━ ROW 4 · INTERAÇÕES ━━━ */}
      <GlassCard
        title="Interações"
        subtitle={`${allInteractions.length} evento(s) registrado(s)`}
        icon={<History className="h-4 w-4 text-slate-400" />}
      >
        {allInteractions.length === 0 ? (
          <EmptyState title="Nenhuma interação registrada" />
        ) : (
          <ul className="space-y-2">
            {allInteractions.map((it) => (
              <li
                key={it.id}
                className="flex items-start gap-3 p-3 rounded-xl bg-white/[0.02] border border-white/5 hover:bg-white/[0.04] hover:border-brand-500/20 transition-all group"
              >
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
                    <p className="text-sm text-slate-300 mt-1.5 break-words leading-relaxed">
                      {it.content}
                    </p>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </GlassCard>
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
    <p className="text-[11px] font-semibold uppercase tracking-widest text-slate-500">
      {children}
    </p>
  );
}

function SectionDivider({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-3">
      <span className="text-[11px] font-bold uppercase tracking-widest text-slate-500 whitespace-nowrap">
        {label}
      </span>
      <span className="flex-1 h-px bg-gradient-to-r from-white/8 to-transparent" />
    </div>
  );
}

/** Glassmorphism card with header strip */
function GlassCard({
  title,
  subtitle,
  icon,
  children,
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
          <div className="h-8 w-8 rounded-lg bg-white/5 border border-white/8 grid place-items-center">
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

function ContactRow({ icon, value, placeholder }: { icon: React.ReactNode; value?: string | null; placeholder: string }) {
  return (
    <div className="flex items-center gap-2.5">
      <span className="text-slate-600 shrink-0">{icon}</span>
      <span className={cn("text-sm truncate", value ? "text-slate-200 font-medium" : "text-slate-700 italic")}>
        {value ?? placeholder}
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
        ? "border-emerald-500/30 bg-emerald-500/10 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]"
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

function InfoBlock({
  icon, label, value, tone,
}: {
  icon: React.ReactNode;
  label: string;
  value?: string | null;
  tone: "violet" | "amber" | "blue" | "emerald" | "slate";
}) {
  const p = {
    violet:  { from: "from-violet-500/10",  border: "hover:border-violet-500/30", text: "text-violet-200",  iconCls: "text-violet-400" },
    amber:   { from: "from-amber-500/10",   border: "hover:border-amber-500/30",  text: "text-amber-200",   iconCls: "text-amber-400"  },
    blue:    { from: "from-brand-500/10",   border: "hover:border-brand-500/30",  text: "text-brand-200",   iconCls: "text-brand-400"  },
    emerald: { from: "from-emerald-500/10", border: "hover:border-emerald-500/30",text: "text-emerald-200", iconCls: "text-emerald-400"},
    slate:   { from: "from-slate-500/10",   border: "hover:border-slate-500/30",  text: "text-slate-200",   iconCls: "text-slate-400"  },
  }[tone];

  return (
    <div className={cn(
      "rounded-xl border border-white/8 bg-gradient-to-br to-transparent p-3.5 transition-all",
      p.from, p.border
    )}>
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

function TimeBlock({
  label, value, tone, icon,
}: {
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
    <div className={cn(
      "rounded-xl border border-white/8 bg-gradient-to-br to-transparent p-3.5 transition-all",
      p.from, p.border
    )}>
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