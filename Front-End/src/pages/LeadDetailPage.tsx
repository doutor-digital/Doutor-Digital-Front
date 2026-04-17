import { useQuery } from "@tanstack/react-query";
import { Link, useParams } from "react-router-dom";
import {
  AlertTriangle,
  ArrowLeft,
  Building2,
  Calendar,
  CheckCircle2,
  Clock,
  CreditCard,
  Hash,
  History,
  Mail,
  MessageSquare,
  Phone,
  Tag,
  Target,
  Timer,
  User2,
  UserCog,
  XCircle,
  Sparkles,
  Activity,
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

export default function LeadDetailPage() {
  const { id } = useParams<{ id: string }>();

  const lead = useQuery({
    queryKey: ["lead-detail", id],
    queryFn: () => webhooksService.getLeadById(id!),
    enabled: !!id,
    retry: false,
  });

  const metrics = useQuery({
    queryKey: ["lead-metrics", id],
    queryFn: () => analyticsService.leadMetrics(id!),
    enabled: !!id,
    retry: false,
  });

  const history = useQuery({
    queryKey: ["lead-history", id],
    queryFn: () => assignmentsService.leadHistory(id!),
    enabled: !!id,
    retry: false,
  });

  const l = lead.data;
  const m = metrics.data;

  /* ── Loading ─────────────────────────────────────────── */
  if (lead.isLoading) {
    return (
      <>
        <PageHeader title="Carregando lead..." description={`ID: ${id}`} />
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {[...Array(3)].map((_, i) => (
            <div
              key={i}
              className={`skeleton h-80 w-full rounded-2xl ${i === 0 ? "lg:col-span-1" : "lg:col-span-2"}`}
            />
          ))}
        </div>
      </>
    );
  }

  /* ── Error ───────────────────────────────────────────── */
  if (lead.isError || !l) {
    return (
      <>
        <PageHeader
          title="Lead não encontrado"
          description={`ID: ${id}`}
          actions={
            <Link to="/leads">
              <Button variant="outline" size="sm">
                <ArrowLeft className="h-4 w-4" /> Voltar
              </Button>
            </Link>
          }
        />
        <Card>
          <CardBody>
            <EmptyState
              title="Não conseguimos carregar este lead"
              description="Verifique se o ID está correto ou se o backend está no ar."
            />
          </CardBody>
        </Card>
      </>
    );
  }

  /* ── Helpers ─────────────────────────────────────────── */
  const allInteractions = l.conversations
    .flatMap((c) =>
      c.interactions.map((i) => ({ ...i, conversationState: c.conversationState }))
    )
    .sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt));

  const initials = (l.name ?? "?")
    .split(" ")
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase();

  /* ── Render ──────────────────────────────────────────── */
  return (
    <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-300">
      {/* Header */}
      <PageHeader
        title={l.name ?? "Lead sem nome"}
        description={`ID ${l.id}${l.externalId ? ` · External ${l.externalId}` : ""}`}
        actions={
          <Link to="/leads">
            <Button variant="outline" size="sm" className="gap-1.5">
              <ArrowLeft className="h-4 w-4" /> Voltar
            </Button>
          </Link>
        }
      />

      {/* ── Row 1: Perfil + Atribuição ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

        {/* Perfil */}
        <Card className="lg:col-span-1 overflow-hidden">
          {/* Avatar hero */}
          <div className="relative h-28 bg-gradient-to-br from-brand-600/40 via-violet-600/30 to-transparent">
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_left,rgba(99,102,241,0.25),transparent_60%)]" />
            <div className="absolute -bottom-8 left-4">
              <div className="h-16 w-16 rounded-2xl ring-4 ring-slate-900 bg-gradient-to-br from-brand-400 to-violet-600 grid place-items-center text-xl font-bold text-white shadow-xl">
                {initials}
              </div>
            </div>
          </div>

          <CardBody className="pt-12 space-y-3">
            <div className="flex items-center gap-2 flex-wrap">
              <StateBadge state={(l.conversationState as ConversationState) ?? undefined} />
              <StageBadge stage={l.currentStage} />
            </div>

            <div className="space-y-2.5 pt-1">
              <Row icon={<User2 className="h-3.5 w-3.5" />} label="Nome"    value={l.name} />
              <Row icon={<Phone className="h-3.5 w-3.5" />} label="Telefone" value={l.phone} />
              <Row icon={<Mail  className="h-3.5 w-3.5" />} label="E-mail"  value={l.email} />
              <Row icon={<Hash  className="h-3.5 w-3.5" />} label="CPF"     value={l.cpf} />
              <Row icon={<User2 className="h-3.5 w-3.5" />} label="Gênero"  value={l.gender} />
            </div>

            <div className="grid grid-cols-3 gap-2 pt-1">
              <BoolPill label="Consulta"    value={l.hasAppointment} />
              <BoolPill label="Pagamento"   value={l.hasPayment} />
              <BoolPill label="Plano saúde" value={l.hasHealthInsurancePlan} />
            </div>

            {l.observations && (
              <div className="rounded-lg bg-white/[0.03] border border-white/5 p-3">
                <span className="text-[11px] font-medium text-slate-400 uppercase tracking-wider">
                  Observações
                </span>
                <p className="text-sm text-slate-200 mt-1 whitespace-pre-wrap leading-relaxed">
                  {l.observations}
                </p>
              </div>
            )}

            {l.tags.length > 0 && (
              <div>
                <span className="text-[11px] font-medium text-slate-400 uppercase tracking-wider">
                  Tags
                </span>
                <div className="flex flex-wrap gap-1 mt-1.5">
                  {l.tags.map((t) => (
                    <Badge key={t} tone="slate" className="gap-1">
                      <Tag className="h-2.5 w-2.5" /> {t}
                    </Badge>
                  ))}
                </div>
              </div>
            )}
          </CardBody>
        </Card>

        {/* Atribuição & Contexto */}
        <Card className="lg:col-span-2">
          <CardHeader
            title="Atribuição & Contexto"
            subtitle="Origem, canal e rastreamento deste lead"
          />
          <CardBody className="space-y-5">

            {/* Origem / Canal / Campanha / Confiança */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <InfoBlock icon={<Target        className="h-4 w-4" />} label="Origem"    value={l.source}             tone="violet" />
              <InfoBlock icon={<MessageSquare className="h-4 w-4" />} label="Canal"     value={l.channel}            tone="blue" />
              <InfoBlock icon={<Tag           className="h-4 w-4" />} label="Campanha"  value={l.campaign}           tone="amber" />
              <InfoBlock
                icon={<Sparkles className="h-4 w-4" />}
                label="Confiança"
                value={l.trackingConfidence}
                tone={
                  l.trackingConfidence === "ALTA"
                    ? "emerald"
                    : l.trackingConfidence === "MEDIA"
                      ? "amber"
                      : "slate"
                }
              />
            </div>

            {/* Detalhes */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
              <Row icon={<Tag       className="h-3.5 w-3.5" />} label="Anúncio"          value={l.ad} />
              <Row icon={<Building2 className="h-3.5 w-3.5" />} label="Unidade"          value={l.unitName ?? (l.unitId ? `Unit #${l.unitId}` : undefined)} />
              <Row icon={<UserCog   className="h-3.5 w-3.5" />} label="Atendente"        value={l.attendantName} />
              <Row icon={<Mail      className="h-3.5 w-3.5" />} label="Email atendente"  value={l.attendantEmail} />
              <Row icon={<Calendar  className="h-3.5 w-3.5" />} label="Criado em"        value={formatDate(l.createdAt)} />
              <Row icon={<Clock     className="h-3.5 w-3.5" />} label="Atualizado em"    value={formatDate(l.updatedAt)} />
              {l.convertedAt && (
                <Row icon={<CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />} label="Convertido em" value={formatDate(l.convertedAt)} />
              )}
            </div>

            {/* Métricas de tempo */}
            {m && (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 pt-3 border-t border-white/5">
                <TimeBlock label="No bot"         value={m.timeInBot}     tone="violet" icon={<Timer className="h-4 w-4" />} />
                <TimeBlock label="Na fila"        value={m.timeInQueue}   tone="amber"  icon={<Timer className="h-4 w-4" />} />
                <TimeBlock label="Em atendimento" value={m.timeInService} tone="blue"   icon={<Timer className="h-4 w-4" />} />
                <TimeBlock label="Total"          value={m.totalTime}     tone="emerald" icon={<Activity className="h-4 w-4" />} />
              </div>
            )}

            {/* Alertas */}
            {m?.alerts && m.alerts.length > 0 && (
              <div className="rounded-xl border border-amber-500/30 bg-gradient-to-br from-amber-500/10 to-transparent p-4">
                <div className="flex items-center gap-2 text-amber-300 font-semibold text-sm">
                  <AlertTriangle className="h-4 w-4 shrink-0" />
                  Alertas ativos ({m.alerts.length})
                </div>
                <ul className="mt-2.5 space-y-1.5">
                  {m.alerts.map((a, i) => (
                    <li key={i} className="text-xs text-amber-200 flex items-start gap-2">
                      <span className="mt-0.5 h-1.5 w-1.5 rounded-full bg-amber-400 shrink-0" />
                      {a}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </CardBody>
        </Card>
      </div>

      {/* ── Row 2: Stage history + Attendant history ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

        {/* Histórico de etapas */}
        <Card>
          <CardHeader
            title="Histórico de etapas"
            subtitle={`${l.stageHistory.length} mudança(s) registrada(s)`}
          />
          <CardBody>
            {l.stageHistory.length > 0 ? (
              <ol className="relative border-l-2 border-brand-500/20 ml-3 space-y-5">
                {l.stageHistory.map((h, idx) => (
                  <li key={h.id} className="ml-5 relative">
                    <span
                      className={`absolute -left-[1.65rem] flex h-5 w-5 items-center justify-center rounded-full ring-4 ring-slate-900 ${
                        idx === 0
                          ? "bg-brand-500 shadow-[0_0_10px_2px_rgba(99,102,241,0.5)]"
                          : "bg-slate-700"
                      }`}
                    >
                      <span className={`h-2 w-2 rounded-full ${idx === 0 ? "bg-white" : "bg-slate-500"}`} />
                    </span>
                    <div className="text-[11px] text-slate-500 mb-1">{formatDate(h.changedAt)}</div>
                    <StageBadge stage={h.stageLabel} />
                  </li>
                ))}
              </ol>
            ) : (
              <EmptyState title="Sem histórico de etapas" />
            )}
          </CardBody>
        </Card>

        {/* Histórico de atendentes */}
        <Card>
          <CardHeader
            title="Histórico de atendentes"
            subtitle={`${l.assignments.length} atribuição(ões)`}
          />
          <CardBody>
            {(() => {
              const items =
                l.assignments.length > 0
                  ? l.assignments.map((a) => ({
                      name: a.attendantName ?? `Atendente #${a.attendantId}`,
                      date: a.assignedAt,
                      stage: a.stage,
                    }))
                  : (history.data ?? []).map((h: AssignmentLeadHistoryItem) => ({
                      name: h.attendantName ?? "Atendente",
                      date: (h.assignedAt as string | undefined) ?? (h.createdAt as string | undefined),
                      stage: undefined,
                    }));

              if (items.length === 0) return <EmptyState title="Sem histórico de atendentes" />;

              return (
                <ul className="space-y-3">
                  {items.map((item, i) => (
                    <li key={i} className="flex items-start gap-3 group">
                      <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-brand-400 to-violet-600 grid place-items-center text-xs font-bold shrink-0 shadow-md">
                        {item.name.charAt(0).toUpperCase()}
                      </div>
                      <div className="min-w-0 flex-1 pt-0.5">
                        <p className="text-sm font-medium text-slate-100 leading-none">{item.name}</p>
                        <p className="text-xs text-slate-500 mt-1">{formatDate(item.date)}</p>
                        {item.stage && (
                          <div className="mt-1.5">
                            <StageBadge stage={item.stage} />
                          </div>
                        )}
                      </div>
                    </li>
                  ))}
                </ul>
              );
            })()}
          </CardBody>
        </Card>
      </div>

      {/* ── Row 3: Pagamentos + Conversas ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

        {/* Pagamentos */}
        <Card>
          <CardHeader title="Pagamentos" subtitle={`${l.payments.length} pagamento(s)`} />
          <CardBody>
            {l.payments.length > 0 ? (
              <ul className="space-y-2">
                {l.payments.map((p) => (
                  <li
                    key={p.id}
                    className="flex items-center justify-between p-3 rounded-xl bg-emerald-500/5 border border-emerald-500/15 hover:bg-emerald-500/10 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <div className="h-9 w-9 rounded-lg bg-emerald-500/10 border border-emerald-500/20 grid place-items-center">
                        <CreditCard className="h-4 w-4 text-emerald-400" />
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-slate-100">{formatCurrency(p.amount)}</p>
                        <p className="text-xs text-slate-400">{formatDate(p.paidAt)}</p>
                      </div>
                    </div>
                    <Badge tone="green">Pago</Badge>
                  </li>
                ))}
              </ul>
            ) : (
              <EmptyState title="Nenhum pagamento registrado" />
            )}
          </CardBody>
        </Card>

        {/* Conversas */}
        <Card>
          <CardHeader title="Conversas" subtitle={`${l.conversations.length} conversa(s)`} />
          <CardBody>
            {l.conversations.length > 0 ? (
              <ul className="space-y-3">
                {l.conversations.map((c) => (
                  <li
                    key={c.id}
                    className="p-3 rounded-xl bg-white/[0.02] border border-white/5 hover:bg-white/[0.04] transition-colors"
                  >
                    <div className="flex items-center justify-between mb-2 flex-wrap gap-2">
                      <div className="flex items-center gap-2">
                        <StateBadge state={c.conversationState as ConversationState} />
                        <span className="text-xs text-slate-500 bg-white/5 px-2 py-0.5 rounded-full">
                          {c.channel}
                        </span>
                      </div>
                      <span className="text-xs text-slate-500">
                        {formatDate(c.startedAt)}
                        {c.endedAt ? (
                          <> → {formatDate(c.endedAt)}</>
                        ) : (
                          <span className="ml-1 text-emerald-400">· ao vivo</span>
                        )}
                      </span>
                    </div>
                    {c.attendantName && (
                      <p className="text-xs text-slate-400">
                        Atendente:{" "}
                        <span className="text-slate-200 font-medium">{c.attendantName}</span>
                      </p>
                    )}
                    <p className="text-xs text-slate-600 mt-1">
                      {c.interactions.length} interação(ões)
                    </p>
                  </li>
                ))}
              </ul>
            ) : (
              <EmptyState title="Nenhuma conversa registrada" />
            )}
          </CardBody>
        </Card>
      </div>

      {/* ── Row 4: Interações (full width) ── */}
      <Card>
        <CardHeader
          title="Interações"
          subtitle={`${allInteractions.length} evento(s) registrado(s)`}
        />
        <CardBody>
          {allInteractions.length === 0 ? (
            <EmptyState title="Nenhuma interação registrada" />
          ) : (
            <ul className="space-y-2">
              {allInteractions.map((it) => (
                <li
                  key={it.id}
                  className="flex items-start gap-3 p-3 rounded-xl bg-white/[0.02] border border-white/5 hover:bg-white/[0.04] transition-colors group"
                >
                  <div className="h-8 w-8 rounded-lg bg-white/5 border border-white/5 grid place-items-center shrink-0 mt-0.5 group-hover:border-brand-500/30 transition-colors">
                    <History className="h-3.5 w-3.5 text-slate-400" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge tone="slate">{it.type}</Badge>
                      <span className="text-xs text-slate-500">{formatDate(it.createdAt)}</span>
                    </div>
                    {it.content && (
                      <p className="text-sm text-slate-200 mt-1.5 break-words leading-relaxed">
                        {it.content}
                      </p>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardBody>
      </Card>
    </div>
  );
}

/* ───────────────────────────────────────────────
   Sub-components
─────────────────────────────────────────────── */

function Row({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value?: string | null;
}) {
  return (
    <div className="flex items-center justify-between gap-3 group">
      <span className="text-xs text-slate-500 flex items-center gap-1.5 shrink-0">
        <span className="text-slate-600 group-hover:text-brand-400 transition-colors">{icon}</span>
        {label}
      </span>
      <span className="text-sm text-slate-200 truncate max-w-[60%] text-right">
        {value ?? <span className="text-slate-600">—</span>}
      </span>
    </div>
  );
}

function BoolPill({ label, value }: { label: string; value?: boolean | null }) {
  return (
    <div
      className={`rounded-lg border p-2 text-center transition-colors ${
        value === true
          ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-300"
          : value === false
            ? "border-white/5 bg-white/[0.02] text-slate-500"
            : "border-white/5 bg-white/[0.02] text-slate-600"
      }`}
    >
      <div className="flex items-center justify-center gap-1 mb-0.5">
        {value === true ? (
          <CheckCircle2 className="h-3.5 w-3.5" />
        ) : (
          <XCircle className="h-3.5 w-3.5" />
        )}
      </div>
      <span className="text-[10px] font-medium leading-none">{label}</span>
    </div>
  );
}

function InfoBlock({
  icon,
  label,
  value,
  tone,
}: {
  icon: React.ReactNode;
  label: string;
  value?: string | null;
  tone: "violet" | "amber" | "blue" | "emerald" | "slate";
}) {
  const palette = {
    violet:  { bg: "from-violet-500/15",  text: "text-violet-300",  icon: "text-violet-400"  },
    amber:   { bg: "from-amber-500/15",   text: "text-amber-300",   icon: "text-amber-400"   },
    blue:    { bg: "from-brand-500/15",   text: "text-brand-300",   icon: "text-brand-400"   },
    emerald: { bg: "from-emerald-500/15", text: "text-emerald-300", icon: "text-emerald-400" },
    slate:   { bg: "from-slate-500/15",   text: "text-slate-300",   icon: "text-slate-400"   },
  }[tone];

  return (
    <div
      className={`rounded-xl border border-white/8 bg-gradient-to-br ${palette.bg} to-transparent p-3 hover:border-white/15 transition-colors`}
    >
      <div className="flex items-center justify-between mb-2">
        <span className="text-[11px] font-medium text-slate-400 uppercase tracking-wider">{label}</span>
        <span className={palette.icon}>{icon}</span>
      </div>
      <div className={`text-sm font-semibold truncate ${palette.text}`} title={value ?? "—"}>
        {value ?? <span className="text-slate-600 font-normal">—</span>}
      </div>
    </div>
  );
}

function TimeBlock({
  label,
  value,
  tone,
  icon,
}: {
  label: string;
  value?: number;
  tone: "violet" | "amber" | "blue" | "emerald";
  icon: React.ReactNode;
}) {
  const palette = {
    violet:  { bg: "from-violet-500/15",  text: "text-violet-200",  icon: "text-violet-400",  glow: "shadow-violet-500/20"  },
    amber:   { bg: "from-amber-500/15",   text: "text-amber-200",   icon: "text-amber-400",   glow: "shadow-amber-500/20"   },
    blue:    { bg: "from-brand-500/15",   text: "text-brand-200",   icon: "text-brand-400",   glow: "shadow-brand-500/20"   },
    emerald: { bg: "from-emerald-500/15", text: "text-emerald-200", icon: "text-emerald-400", glow: "shadow-emerald-500/20" },
  }[tone];

  return (
    <div
      className={`rounded-xl border border-white/8 bg-gradient-to-br ${palette.bg} to-transparent p-3 hover:border-white/15 transition-colors shadow-lg ${palette.glow}`}
    >
      <div className="flex items-center justify-between mb-2">
        <span className="text-[11px] font-medium text-slate-400 uppercase tracking-wider">{label}</span>
        <span className={palette.icon}>{icon}</span>
      </div>
      <div className={`text-2xl font-bold tracking-tight ${palette.text}`}>
        {formatDuration(value)}
      </div>
    </div>
  );
}