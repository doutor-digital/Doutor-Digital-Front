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

  if (lead.isLoading) {
    return (
      <>
        <PageHeader title="Carregando lead..." description={`ID: ${id}`} />
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="skeleton h-80 w-full rounded-xl lg:col-span-1" />
          <div className="skeleton h-80 w-full rounded-xl lg:col-span-2" />
        </div>
      </>
    );
  }

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

  return (
    <>
      <PageHeader
        title={l.name ?? "Lead sem nome"}
        description={`ID ${l.id}${l.externalId ? ` · External ${l.externalId}` : ""}`}
        actions={
          <Link to="/leads">
            <Button variant="outline" size="sm">
              <ArrowLeft className="h-4 w-4" /> Voltar
            </Button>
          </Link>
        }
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card className="lg:col-span-1">
          <CardHeader title="Perfil" subtitle="Dados de contato" />
          <CardBody className="space-y-3">
            <Row icon={<User2 className="h-4 w-4" />} label="Nome" value={l.name} />
            <Row icon={<Phone className="h-4 w-4" />} label="Telefone" value={l.phone} />
            <Row icon={<Mail className="h-4 w-4" />} label="Email" value={l.email} />
            <Row icon={<Hash className="h-4 w-4" />} label="CPF" value={l.cpf} />
            <Row icon={<User2 className="h-4 w-4" />} label="Gênero" value={l.gender} />
            <div className="flex items-center justify-between">
              <span className="text-xs text-slate-400">Estado</span>
              <StateBadge state={(l.conversationState as ConversationState) ?? undefined} />
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs text-slate-400">Etapa</span>
              <StageBadge stage={l.currentStage} />
            </div>
            <BoolRow label="Tem consulta" value={l.hasAppointment} />
            <BoolRow label="Pagou" value={l.hasPayment} />
            <BoolRow label="Plano de saúde" value={l.hasHealthInsurancePlan} />
            {l.observations && (
              <div>
                <span className="text-xs text-slate-400">Observações</span>
                <p className="text-sm text-slate-200 mt-1 whitespace-pre-wrap">
                  {l.observations}
                </p>
              </div>
            )}
            {l.tags.length > 0 && (
              <div>
                <span className="text-xs text-slate-400">Tags</span>
                <div className="flex flex-wrap gap-1 mt-1">
                  {l.tags.map((t) => (
                    <Badge key={t} tone="slate">
                      <Tag className="h-3 w-3" /> {t}
                    </Badge>
                  ))}
                </div>
              </div>
            )}
          </CardBody>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader title="Atribuição & Contexto" subtitle="De onde veio este lead" />
          <CardBody className="space-y-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <InfoBlock
                icon={<Target className="h-4 w-4" />}
                label="Origem"
                value={l.source}
                tone="violet"
              />
              <InfoBlock
                icon={<MessageSquare className="h-4 w-4" />}
                label="Canal"
                value={l.channel}
                tone="blue"
              />
              <InfoBlock
                icon={<Tag className="h-4 w-4" />}
                label="Campanha"
                value={l.campaign}
                tone="amber"
              />
              <InfoBlock
                icon={<CheckCircle2 className="h-4 w-4" />}
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

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <Row icon={<Tag className="h-4 w-4" />} label="Anúncio" value={l.ad} />
              <Row
                icon={<Building2 className="h-4 w-4" />}
                label="Unidade"
                value={l.unitName ?? (l.unitId ? `Unit #${l.unitId}` : undefined)}
              />
              <Row
                icon={<UserCog className="h-4 w-4" />}
                label="Atendente"
                value={l.attendantName}
              />
              <Row
                icon={<Mail className="h-4 w-4" />}
                label="Email atendente"
                value={l.attendantEmail}
              />
              <Row
                icon={<Calendar className="h-4 w-4" />}
                label="Criado em"
                value={formatDate(l.createdAt)}
              />
              <Row
                icon={<Clock className="h-4 w-4" />}
                label="Atualizado em"
                value={formatDate(l.updatedAt)}
              />
              {l.convertedAt && (
                <Row
                  icon={<CheckCircle2 className="h-4 w-4" />}
                  label="Convertido em"
                  value={formatDate(l.convertedAt)}
                />
              )}
            </div>

            {m && (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 pt-2 border-t border-white/5">
                <TimeBlock
                  label="No bot"
                  value={m.timeInBot}
                  tone="violet"
                  icon={<Timer className="h-4 w-4" />}
                />
                <TimeBlock
                  label="Na fila"
                  value={m.timeInQueue}
                  tone="amber"
                  icon={<Timer className="h-4 w-4" />}
                />
                <TimeBlock
                  label="Em atendimento"
                  value={m.timeInService}
                  tone="blue"
                  icon={<Timer className="h-4 w-4" />}
                />
                <TimeBlock
                  label="Total"
                  value={m.totalTime}
                  tone="emerald"
                  icon={<Timer className="h-4 w-4" />}
                />
              </div>
            )}

            {m?.alerts && m.alerts.length > 0 && (
              <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-3">
                <div className="flex items-center gap-2 text-amber-300 font-medium text-sm">
                  <AlertTriangle className="h-4 w-4" /> Alertas ativos
                </div>
                <ul className="mt-2 space-y-1 text-xs text-amber-200">
                  {m.alerts.map((a, i) => (
                    <li key={i}>• {a}</li>
                  ))}
                </ul>
              </div>
            )}
          </CardBody>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mt-4">
        <Card>
          <CardHeader
            title="Histórico de etapas"
            subtitle={`${l.stageHistory.length} mudança(s) de etapa`}
          />
          <CardBody>
            {l.stageHistory.length > 0 ? (
              <ol className="relative border-l border-white/10 ml-2 space-y-4">
                {l.stageHistory.map((h) => (
                  <li key={h.id} className="ml-4">
                    <div className="absolute -left-1.5 h-3 w-3 rounded-full bg-brand-500 ring-4 ring-brand-500/20" />
                    <div className="text-xs text-slate-400">{formatDate(h.changedAt)}</div>
                    <StageBadge stage={h.stageLabel} />
                  </li>
                ))}
              </ol>
            ) : (
              <EmptyState title="Sem histórico de etapas" />
            )}
          </CardBody>
        </Card>

        <Card>
          <CardHeader
            title="Histórico de atendentes"
            subtitle={`${l.assignments.length} atribuição(ões)`}
          />
          <CardBody>
            {l.assignments.length > 0 ? (
              <ul className="space-y-3">
                {l.assignments.map((a) => (
                  <li key={a.id} className="flex items-start gap-3">
                    <div className="h-8 w-8 rounded-full bg-gradient-to-br from-brand-400 to-violet-600 grid place-items-center text-xs font-semibold shrink-0">
                      {(a.attendantName ?? "?").charAt(0).toUpperCase()}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm text-slate-100">
                        {a.attendantName ?? `Atendente #${a.attendantId}`}
                      </p>
                      <p className="text-xs text-slate-400">{formatDate(a.assignedAt)}</p>
                      {a.stage && (
                        <div className="mt-1">
                          <StageBadge stage={a.stage} />
                        </div>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            ) : history.data && history.data.length > 0 ? (
              <ul className="space-y-3">
                {history.data.map((h: AssignmentLeadHistoryItem, i: number) => (
                  <li key={i} className="flex items-start gap-3">
                    <div className="h-8 w-8 rounded-full bg-gradient-to-br from-brand-400 to-violet-600 grid place-items-center text-xs font-semibold shrink-0">
                      {(h.attendantName ?? "?").charAt(0).toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm text-slate-100">{h.attendantName ?? "Atendente"}</p>
                      <p className="text-xs text-slate-400">
                        {formatDate(
                          (h.assignedAt as string | undefined) ??
                            (h.createdAt as string | undefined)
                        )}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <EmptyState title="Sem histórico de atendentes" />
            )}
          </CardBody>
        </Card>

        <Card>
          <CardHeader
            title="Pagamentos"
            subtitle={`${l.payments.length} pagamento(s)`}
          />
          <CardBody>
            {l.payments.length > 0 ? (
              <ul className="space-y-2">
                {l.payments.map((p) => (
                  <li
                    key={p.id}
                    className="flex items-center justify-between p-3 rounded-lg bg-white/[0.02] border border-white/5"
                  >
                    <div className="flex items-center gap-3">
                      <CreditCard className="h-4 w-4 text-emerald-300" />
                      <div>
                        <p className="text-sm text-slate-100">{formatCurrency(p.amount)}</p>
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

        <Card>
          <CardHeader
            title="Conversas"
            subtitle={`${l.conversations.length} conversa(s)`}
          />
          <CardBody>
            {l.conversations.length > 0 ? (
              <ul className="space-y-3">
                {l.conversations.map((c) => (
                  <li
                    key={c.id}
                    className="p-3 rounded-lg bg-white/[0.02] border border-white/5"
                  >
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-2">
                        <StateBadge state={c.conversationState as ConversationState} />
                        <span className="text-xs text-slate-500">{c.channel}</span>
                      </div>
                      <span className="text-xs text-slate-400">
                        {formatDate(c.startedAt)}
                        {c.endedAt ? ` → ${formatDate(c.endedAt)}` : " · em andamento"}
                      </span>
                    </div>
                    {c.attendantName && (
                      <p className="text-xs text-slate-400">
                        Atendente: <span className="text-slate-200">{c.attendantName}</span>
                      </p>
                    )}
                    <p className="text-xs text-slate-500 mt-1">
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

        <Card className="lg:col-span-2">
          <CardHeader
            title="Interações"
            subtitle="Todas as mensagens e eventos registrados"
          />
          <CardBody>
            {(() => {
              const allInteractions = l.conversations
                .flatMap((c) =>
                  c.interactions.map((i) => ({ ...i, conversationState: c.conversationState }))
                )
                .sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt));

              if (allInteractions.length === 0) {
                return <EmptyState title="Nenhuma interação registrada" />;
              }

              return (
                <ul className="space-y-2">
                  {allInteractions.map((it) => (
                    <li
                      key={it.id}
                      className="flex items-start gap-3 p-3 rounded-lg bg-white/[0.02] border border-white/5"
                    >
                      <History className="h-4 w-4 text-slate-400 mt-0.5" />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 text-xs text-slate-400 flex-wrap">
                          <Badge tone="slate">{it.type}</Badge>
                          <span>{formatDate(it.createdAt)}</span>
                        </div>
                        {it.content && (
                          <p className="text-sm text-slate-200 mt-1 break-words">{it.content}</p>
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
    </>
  );
}

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
    <div className="flex items-center justify-between gap-3">
      <span className="text-xs text-slate-400 flex items-center gap-1.5 shrink-0">
        <span className="text-slate-500">{icon}</span>
        {label}
      </span>
      <span className="text-sm text-slate-200 truncate max-w-[60%] text-right">
        {value ?? "—"}
      </span>
    </div>
  );
}

function BoolRow({ label, value }: { label: string; value?: boolean | null }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-xs text-slate-400">{label}</span>
      {value === true ? (
        <span className="text-emerald-300 flex items-center gap-1 text-sm">
          <CheckCircle2 className="h-4 w-4" /> Sim
        </span>
      ) : value === false ? (
        <span className="text-slate-500 flex items-center gap-1 text-sm">
          <XCircle className="h-4 w-4" /> Não
        </span>
      ) : (
        <span className="text-slate-500 text-sm">—</span>
      )}
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
  const tones = {
    violet: "from-violet-500/15 text-violet-300",
    amber: "from-amber-500/15 text-amber-300",
    blue: "from-brand-500/15 text-brand-300",
    emerald: "from-emerald-500/15 text-emerald-300",
    slate: "from-slate-500/15 text-slate-300",
  };
  return (
    <div
      className={`rounded-lg border border-white/10 bg-gradient-to-br ${tones[tone].split(" ")[0]} to-transparent p-3`}
    >
      <div className="flex items-center justify-between">
        <span className="text-xs text-slate-300">{label}</span>
        <span className={tones[tone].split(" ")[1]}>{icon}</span>
      </div>
      <div className="text-sm font-medium mt-1 truncate" title={value ?? "—"}>
        {value ?? "—"}
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
  const tones = {
    violet: "from-violet-500/15 text-violet-300",
    amber: "from-amber-500/15 text-amber-300",
    blue: "from-brand-500/15 text-brand-300",
    emerald: "from-emerald-500/15 text-emerald-300",
  };
  return (
    <div
      className={`rounded-lg border border-white/10 bg-gradient-to-br ${tones[tone].split(" ")[0]} to-transparent p-3`}
    >
      <div className="flex items-center justify-between">
        <span className="text-xs text-slate-300">{label}</span>
        <span className={tones[tone].split(" ")[1]}>{icon}</span>
      </div>
      <div className="text-xl font-semibold mt-1">{formatDuration(value)}</div>
    </div>
  );
}
