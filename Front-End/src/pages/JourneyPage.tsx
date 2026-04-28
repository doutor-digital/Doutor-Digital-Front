import { useMemo } from "react";
import { Link, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  ArrowLeft,
  Bot,
  Calendar,
  CheckCircle2,
  Clock,
  CreditCard,
  Globe,
  Headset,
  History,
  Layers,
  MessageSquare,
  Phone as PhoneIcon,
  Quote,
  Route,
  Tag,
  Target,
  Timer,
  TrendingUp,
  Users,
  XCircle,
  Zap,
} from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card, CardBody } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { StageBadge } from "@/components/ui/Badge";
import { webhooksService } from "@/services/webhooks";
import { cn, formatCurrency, formatDate, formatDuration, formatNumber } from "@/lib/utils";
import { classifyReason, REASON_TONE } from "@/lib/rejectionReasons";
import type { LeadDetail, TimelineInteraction, TimelineInsights, TimelineStage } from "@/types";

type ConversionState = "convertido" | "perdido" | "andamento";

function diffDays(from: string, to: string): number {
  const a = new Date(from).getTime();
  const b = new Date(to).getTime();
  return Math.max(0, Math.round((b - a) / 86400000));
}

export default function JourneyPage() {
  const { id } = useParams<{ id: string }>();

  const lead = useQuery({
    queryKey: ["lead-detail", id],
    queryFn: () => webhooksService.getLeadById(id!),
    enabled: !!id,
    retry: false,
  });

  const timeline = useQuery({
    queryKey: ["lead-timeline", id],
    queryFn: () => webhooksService.getLeadTimeline(id!),
    enabled: !!id,
    retry: false,
  });

  const l = lead.data;
  const t = timeline.data;
  const stages = t?.stages ?? [];
  const insights = t?.insights;
  const interactions = t?.interactions ?? [];
  const attribution = t?.attribution;

  const conversionState: ConversionState = useMemo(() => {
    if (!l) return "andamento";
    if (l.convertedAt || l.currentStage === "09_FECHOU_TRATAMENTO" || l.currentStage === "10_EM_TRATAMENTO")
      return "convertido";
    if (l.currentStage === "08_NAO_FECHOU_TRATAMENTO" || l.currentStage === "07_FALTOU")
      return "perdido";
    return "andamento";
  }, [l]);

  const reason = useMemo(() => classifyReason(l?.observations), [l?.observations]);

  const stageBars = useMemo(
    () =>
      stages.map((s) => ({
        label: s.label.replace(/_/g, " "),
        full: s.label,
        minutes: Math.max(0, s.durationMinutes ?? 0),
        isCurrent: s.isCurrent,
      })),
    [stages],
  );

  const conversationMix = useMemo(() => {
    if (!insights) return [];
    return [
      { label: "Bot", minutes: insights.minutesInBot, color: "#818cf8", icon: Bot },
      { label: "Fila", minutes: insights.minutesInQueue, color: "#fbbf24", icon: Clock },
      { label: "Atendimento", minutes: insights.minutesInService, color: "#34d399", icon: Headset },
    ].filter((x) => x.minutes > 0);
  }, [insights]);

  if (!id) return <EmptyState title="ID inválido" />;

  const totalAmount = (l?.payments ?? []).reduce((acc, p) => acc + (p.amount ?? 0), 0);

  return (
    <>
      <PageHeader
        title={l ? `Perfil · ${l.name ?? "lead"}` : "Perfil do lead"}
        description="Visão completa: status de conversão, observações classificadas, atribuição de origem, jornada visual no funil, atendentes, pagamentos e timeline."
        actions={
          <div className="flex gap-2">
            <Link to={`/leads/${id}`}>
              <Button variant="outline" size="sm">
                <ArrowLeft className="mr-2 h-4 w-4" />
                Detalhe completo
              </Button>
            </Link>
            <Link to="/mudancas-etapas">
              <Button variant="ghost" size="sm">
                <Route className="mr-2 h-4 w-4" />
                Mudanças de etapa
              </Button>
            </Link>
          </div>
        }
      />

      {/* ── Identidade do lead ─────────────────────────────────────── */}
      <Card className="mt-4">
        <CardBody>
          <div className="flex flex-wrap items-start gap-4">
            <Avatar name={l?.name} />
            <div className="min-w-0 flex-1">
              <h2 className="text-[18px] font-semibold leading-tight text-slate-50">
                {l?.name ?? "—"}
              </h2>
              <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11.5px] text-slate-400">
                <span className="font-mono tabular-nums">#{l?.id ?? id}</span>
                {l?.phone && (
                  <span className="inline-flex items-center gap-1 font-mono tabular-nums">
                    <PhoneIcon className="h-3 w-3" /> {l.phone}
                  </span>
                )}
                {l?.unitName && <span>· {l.unitName}</span>}
                {l?.attendantName && <span>· att. {l.attendantName}</span>}
              </div>
              <div className="mt-3 flex flex-wrap items-center gap-1.5">
                <StageBadge stage={l?.currentStage} />
                {l?.attendanceStatus && <AttendanceChip status={l.attendanceStatus} />}
                {(l?.tags ?? []).map((tag) => (
                  <span
                    key={tag}
                    className="inline-flex items-center gap-1 rounded-full bg-white/[0.04] px-2 py-0.5 text-[10.5px] text-slate-300 ring-1 ring-inset ring-white/[0.08]"
                  >
                    <Tag className="h-2.5 w-2.5" /> {tag}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </CardBody>
      </Card>

      {/* ── Hero de conversão ─────────────────────────────────────── */}
      <ConversionHero
        state={conversionState}
        l={l}
        reason={reason}
        insights={insights}
      />

      {/* ── Insights numéricos ────────────────────────────────────── */}
      <div className="mt-3 grid grid-cols-2 gap-2.5 sm:grid-cols-4">
        <InsightCell
          icon={<Layers className="h-3.5 w-3.5" />}
          label="Etapas percorridas"
          value={formatNumber(stages.length)}
        />
        <InsightCell
          icon={<TrendingUp className="h-3.5 w-3.5" />}
          label="Mudanças de etapa"
          value={formatNumber(insights?.stageChanges ?? 0)}
        />
        <InsightCell
          icon={<Users className="h-3.5 w-3.5" />}
          label="Reatribuições"
          value={formatNumber(insights?.reassignments ?? 0)}
        />
        <InsightCell
          icon={<Timer className="h-3.5 w-3.5" />}
          label="Etapa mais demorada"
          value={
            insights?.longestStageLabel
              ? `${insights.longestStageLabel.replace(/_/g, " ").slice(0, 18)} · ${formatDuration(insights.longestStageMinutes ?? 0)}`
              : "—"
          }
        />
      </div>

      {/* ── Observações em destaque ───────────────────────────────── */}
      {l?.observations && (
        <Card className="mt-3">
          <CardBody>
            <div className="flex items-start gap-3">
              <Quote className="mt-0.5 h-5 w-5 shrink-0 text-slate-500" />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="text-[12px] font-semibold uppercase tracking-wider text-slate-400">
                    Observações
                  </h3>
                  {reason && (
                    <span
                      className={cn(
                        "rounded-full px-2 py-0.5 text-[10.5px] font-medium ring-1 ring-inset",
                        "bg-white/[0.03]",
                        REASON_TONE[reason.key].ring,
                        REASON_TONE[reason.key].text,
                      )}
                    >
                      Motivo provável: {reason.label}
                    </span>
                  )}
                </div>
                <p className="mt-2 whitespace-pre-line text-[13px] leading-relaxed text-slate-200">
                  {l.observations}
                </p>
                {reason && reason.matchedKeywords.length > 0 && (
                  <p className="mt-2 text-[10.5px] text-slate-500">
                    Palavras detectadas:{" "}
                    {reason.matchedKeywords.map((k, i) => (
                      <span key={k} className="font-mono">
                        {i > 0 ? ", " : ""}“{k}”
                      </span>
                    ))}
                  </p>
                )}
              </div>
            </div>
          </CardBody>
        </Card>
      )}

      {/* ── Tempo por etapa + Distribuição de atendimento ─────────── */}
      <div className="mt-3 grid grid-cols-1 gap-3 lg:grid-cols-2">
        <Card>
          <CardBody>
            <h3 className="text-[12px] font-semibold uppercase tracking-wider text-slate-400">
              Tempo em cada etapa
            </h3>
            <div className="mt-3 h-64">
              {stageBars.length === 0 ? (
                <div className="grid h-full place-items-center text-[11.5px] text-slate-500">
                  Lead ainda sem etapas registradas
                </div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={stageBars} layout="vertical">
                    <CartesianGrid stroke="rgba(255,255,255,0.04)" horizontal={false} />
                    <XAxis
                      type="number"
                      tick={{ fill: "#64748b", fontSize: 10 }}
                      stroke="transparent"
                      tickFormatter={(v: number) => formatDuration(v)}
                    />
                    <YAxis
                      type="category"
                      dataKey="label"
                      width={150}
                      tick={{ fill: "#94a3b8", fontSize: 10 }}
                      stroke="transparent"
                    />
                    <Tooltip
                      contentStyle={{
                        background: "#0d0d12",
                        border: "1px solid rgba(255,255,255,0.08)",
                        borderRadius: 6,
                        fontSize: 11,
                      }}
                      formatter={(v: number) => formatDuration(v)}
                    />
                    <Bar dataKey="minutes" radius={[0, 4, 4, 0]}>
                      {stageBars.map((entry, idx) => (
                        <Cell key={idx} fill={entry.isCurrent ? "#34d399" : "#38bdf8"} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          </CardBody>
        </Card>

        <Card>
          <CardBody>
            <h3 className="text-[12px] font-semibold uppercase tracking-wider text-slate-400">
              Distribuição do atendimento
            </h3>
            <p className="mt-1 text-[10.5px] text-slate-500">
              Tempo total acumulado em bot / fila / humano.
            </p>
            <div className="mt-3 space-y-2">
              {conversationMix.length === 0 && (
                <div className="grid h-40 place-items-center text-[11.5px] text-slate-500">
                  Sem dados de conversa
                </div>
              )}
              {conversationMix.map((m) => {
                const total = conversationMix.reduce((acc, x) => acc + x.minutes, 0) || 1;
                const pct = (m.minutes / total) * 100;
                const Icon = m.icon;
                return (
                  <div key={m.label}>
                    <div className="flex items-center justify-between text-[11.5px]">
                      <span className="flex items-center gap-1.5 text-slate-300">
                        <Icon className="h-3 w-3" />
                        {m.label}
                      </span>
                      <span className="font-mono tabular-nums text-slate-400">
                        {formatDuration(m.minutes)} ({pct.toFixed(0)}%)
                      </span>
                    </div>
                    <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-white/[0.04]">
                      <div
                        className="h-full rounded-full transition-all"
                        style={{ width: `${pct}%`, backgroundColor: m.color }}
                      />
                    </div>
                  </div>
                );
              })}

              {insights?.totalMinutesUntilConversion != null && (
                <div className="mt-4 rounded-md border border-emerald-500/20 bg-emerald-500/[0.05] px-3 py-2">
                  <div className="flex items-center gap-2 text-[11.5px] text-emerald-300">
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    Convertido em {formatDuration(insights.totalMinutesUntilConversion)} desde a entrada
                  </div>
                </div>
              )}
            </div>
          </CardBody>
        </Card>
      </div>

      {/* ── Linha do tempo ─────────────────────────────────────────── */}
      <Card className="mt-3">
        <CardBody>
          <div className="mb-3 flex items-center gap-2 text-[12px] font-semibold uppercase tracking-wider text-slate-400">
            <Calendar className="h-3.5 w-3.5" />
            Linha do tempo das etapas
          </div>

          {timeline.isLoading ? (
            <div className="space-y-2">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="h-14 animate-pulse rounded-md bg-white/[0.02]" />
              ))}
            </div>
          ) : stages.length === 0 ? (
            <EmptyState title="Sem etapas registradas" />
          ) : (
            <ol className="space-y-3">
              {stages.map((s, i) => (
                <StageStep key={i} stage={s} />
              ))}
            </ol>
          )}
        </CardBody>
      </Card>

      {/* ── Atribuição de origem (CTWA) ────────────────────────────── */}
      {(attribution || l?.source) && (
        <Card className="mt-3">
          <CardBody>
            <div className="mb-3 flex items-center gap-2 text-[12px] font-semibold uppercase tracking-wider text-slate-400">
              <Globe className="h-3.5 w-3.5" />
              Atribuição de origem
            </div>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              <AttributionCell
                icon={<Target className="h-3 w-3" />}
                label="Origem"
                value={l?.source ?? "—"}
              />
              <AttributionCell label="Canal" value={l?.channel ?? "—"} />
              <AttributionCell label="Campanha" value={l?.campaign ?? "—"} />
              <AttributionCell label="Anúncio" value={l?.ad ?? "—"} />
              {attribution && (
                <>
                  <AttributionCell
                    label="Confiança"
                    value={attribution.confidence}
                    tone={
                      attribution.confidence === "ALTA"
                        ? "emerald"
                        : attribution.confidence === "MEDIA"
                          ? "amber"
                          : "slate"
                    }
                  />
                  <AttributionCell label="Match" value={attribution.matchType} />
                  <AttributionCell label="CTWA Clid" value={attribution.ctwaClid} mono />
                  <AttributionCell label="Match em" value={formatDate(attribution.matchedAt)} />
                </>
              )}
            </div>
          </CardBody>
        </Card>
      )}

      {/* ── Pagamentos ─────────────────────────────────────────────── */}
      {(l?.payments ?? []).length > 0 && (
        <Card className="mt-3">
          <CardBody>
            <div className="mb-3 flex items-center justify-between">
              <div className="flex items-center gap-2 text-[12px] font-semibold uppercase tracking-wider text-slate-400">
                <CreditCard className="h-3.5 w-3.5" />
                Pagamentos ({l!.payments.length})
              </div>
              <span className="text-[12.5px] font-semibold text-emerald-300 tabular-nums">
                {formatCurrency(totalAmount)}
              </span>
            </div>
            <ul className="divide-y divide-white/[0.05]">
              {l!.payments.map((p) => (
                <li key={p.id} className="flex items-center justify-between px-1 py-2 text-[12px]">
                  <span className="font-mono text-slate-400 tabular-nums">{formatDate(p.paidAt)}</span>
                  <span className="font-semibold tabular-nums text-slate-100">
                    {formatCurrency(p.amount ?? 0)}
                  </span>
                </li>
              ))}
            </ul>
          </CardBody>
        </Card>
      )}

      {/* ── Atendentes que passaram ────────────────────────────────── */}
      {(l?.assignments ?? []).length > 0 && (
        <Card className="mt-3">
          <CardBody>
            <div className="mb-3 flex items-center gap-2 text-[12px] font-semibold uppercase tracking-wider text-slate-400">
              <Users className="h-3.5 w-3.5" />
              Atendentes que passaram pelo lead
            </div>
            <ul className="divide-y divide-white/[0.05]">
              {l!.assignments.map((a) => (
                <li key={a.id} className="flex flex-wrap items-center justify-between gap-2 px-1 py-2 text-[12px]">
                  <div className="flex items-center gap-2">
                    <Avatar name={a.attendantName} small />
                    <span className="text-slate-200">{a.attendantName ?? `#${a.attendantId}`}</span>
                    {a.stage && <StageBadge stage={a.stage} />}
                  </div>
                  <span className="font-mono text-[10.5px] text-slate-500">{formatDate(a.assignedAt)}</span>
                </li>
              ))}
            </ul>
          </CardBody>
        </Card>
      )}

      {/* ── Eventos da conversa ────────────────────────────────────── */}
      <Card className="mt-3">
        <CardBody>
          <div className="mb-3 flex items-center gap-2 text-[12px] font-semibold uppercase tracking-wider text-slate-400">
            <MessageSquare className="h-3.5 w-3.5" />
            Eventos da conversa ({interactions.length})
          </div>

          {timeline.isLoading ? (
            <div className="space-y-2">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="h-10 animate-pulse rounded-md bg-white/[0.02]" />
              ))}
            </div>
          ) : interactions.length === 0 ? (
            <EmptyState title="Sem eventos" />
          ) : (
            <ul className="divide-y divide-white/[0.05]">
              {interactions.slice(0, 100).map((it) => (
                <InteractionRow key={it.id} item={it} />
              ))}
            </ul>
          )}
        </CardBody>
      </Card>

      {!t && timeline.isError && (
        <Card className="mt-3">
          <CardBody>
            <EmptyState
              title="Não foi possível carregar a timeline"
              description="Verifique se o lead existe e tente novamente."
            />
          </CardBody>
        </Card>
      )}
    </>
  );
}

function ConversionHero({
  state,
  l,
  reason,
  insights,
}: {
  state: ConversionState;
  l: LeadDetail | undefined;
  reason: ReturnType<typeof classifyReason>;
  insights?: TimelineInsights | null;
}) {
  if (state === "convertido") {
    const days =
      l?.convertedAt && l?.createdAt ? diffDays(l.createdAt, l.convertedAt) : null;
    const minutes = insights?.totalMinutesUntilConversion;
    return (
      <div
        className={cn(
          "mt-3 overflow-hidden rounded-2xl border border-emerald-500/30 px-6 py-5",
          "bg-[radial-gradient(ellipse_at_top_left,rgba(52,211,153,0.18),transparent_60%),linear-gradient(135deg,rgba(52,211,153,0.10),rgba(56,189,248,0.06))]",
          "ring-1 ring-emerald-500/20",
        )}
      >
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="flex items-center gap-1.5 text-[10.5px] font-bold uppercase tracking-[0.2em] text-emerald-300">
              <CheckCircle2 className="h-3 w-3" /> Convertido
            </p>
            <h3 className="mt-1 text-[28px] font-bold leading-none text-slate-50 sm:text-[32px]">
              {days != null ? `${days} dia${days === 1 ? "" : "s"}` : "Fechou tratamento"}
            </h3>
            <p className="mt-1.5 text-[12.5px] text-slate-300">
              {minutes != null
                ? `Em ${formatDuration(minutes)} desde a entrada do lead.`
                : "Tempo total não calculado, mas a conversão foi registrada."}
            </p>
          </div>
          {l?.convertedAt && (
            <div className="text-right text-[11px] tabular-nums text-emerald-200/80">
              <div>Convertido em</div>
              <div className="font-mono">{formatDate(l.convertedAt)}</div>
            </div>
          )}
        </div>
      </div>
    );
  }

  if (state === "perdido") {
    return (
      <div
        className={cn(
          "mt-3 overflow-hidden rounded-2xl border border-rose-500/30 px-6 py-5",
          "bg-[radial-gradient(ellipse_at_top_left,rgba(244,63,94,0.18),transparent_60%),linear-gradient(135deg,rgba(244,63,94,0.10),rgba(251,191,36,0.06))]",
          "ring-1 ring-rose-500/20",
        )}
      >
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div className="min-w-0">
            <p className="flex items-center gap-1.5 text-[10.5px] font-bold uppercase tracking-[0.2em] text-rose-300">
              <XCircle className="h-3 w-3" /> Não convertido
            </p>
            <h3 className="mt-1 text-[26px] font-bold leading-tight text-slate-50">
              {reason ? reason.label : "Sem motivo registrado"}
            </h3>
            <p className="mt-1.5 max-w-md text-[12.5px] text-slate-300">
              {reason
                ? `Motivo provável extraído das observações. Considere o resgate comercial.`
                : `Preencha as observações deste lead pra extrair o motivo automaticamente.`}
            </p>
          </div>
          <Link
            to="/recuperacao"
            className="inline-flex items-center gap-1.5 rounded-md bg-rose-500/10 px-3 py-2 text-[12px] font-semibold text-rose-200 ring-1 ring-inset ring-rose-500/30 hover:bg-rose-500/15 hover:text-rose-100"
          >
            Fila de resgates →
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div
      className={cn(
        "mt-3 overflow-hidden rounded-2xl border border-sky-500/20 px-6 py-5",
        "bg-[radial-gradient(ellipse_at_top_left,rgba(56,189,248,0.10),transparent_60%)]",
      )}
    >
      <p className="flex items-center gap-1.5 text-[10.5px] font-bold uppercase tracking-[0.2em] text-sky-300">
        <Clock className="h-3 w-3" /> Em andamento
      </p>
      <h3 className="mt-1 text-[22px] font-bold leading-tight text-slate-50">
        Lead ainda no funil
      </h3>
      <p className="mt-1.5 text-[12.5px] text-slate-300">
        Não chegou em estágio de fechamento nem de descarte. Acompanhe a evolução abaixo.
      </p>
    </div>
  );
}

function InsightCell({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-md border border-white/[0.06] bg-white/[0.02] px-3 py-2">
      <div className="flex items-center gap-1.5 text-[10.5px] uppercase tracking-wider text-slate-500">
        {icon}
        {label}
      </div>
      <div className="mt-1 truncate text-[14px] font-semibold text-slate-100">{value}</div>
    </div>
  );
}

function StageStep({ stage }: { stage: TimelineStage }) {
  return (
    <li className="rounded-md border border-white/[0.05] bg-white/[0.015] p-3 transition hover:bg-white/[0.03]">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <StageBadge stage={stage.label} />
          {stage.isCurrent && (
            <span className="rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider text-emerald-300 ring-1 ring-inset ring-emerald-500/20">
              atual
            </span>
          )}
        </div>
        <span className="font-mono text-[11px] tabular-nums text-slate-300">
          {formatDuration(stage.durationMinutes ?? 0)}
        </span>
      </div>
      <p className="mt-1.5 text-[10.5px] text-slate-500">
        {formatDate(stage.enteredAt)}
        {stage.exitedAt && <> → {formatDate(stage.exitedAt)}</>}
      </p>
    </li>
  );
}

function InteractionRow({ item }: { item: TimelineInteraction }) {
  const icon =
    item.type === "STAGE_CHANGED" ? (
      <Route className="h-3 w-3 text-sky-400" />
    ) : item.type.startsWith("ATTENDANCE_") ? (
      <CheckCircle2 className="h-3 w-3 text-emerald-400" />
    ) : item.type === "PAYMENT" ? (
      <Zap className="h-3 w-3 text-amber-400" />
    ) : (
      <History className="h-3 w-3 text-slate-400" />
    );
  return (
    <li className="flex items-start gap-2 px-1 py-2.5">
      <span className="mt-0.5">{icon}</span>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
          <span className="text-[11px] font-medium uppercase tracking-wider text-slate-400">
            {item.type}
          </span>
          <span className="text-[10.5px] text-slate-600">{formatDate(item.createdAt)}</span>
        </div>
        {item.content && <p className="mt-0.5 text-[12px] text-slate-200">{item.content}</p>}
      </div>
    </li>
  );
}

function AttendanceChip({ status }: { status: string }) {
  const tone =
    status === "compareceu"
      ? "bg-emerald-500/10 text-emerald-300 ring-emerald-500/20"
      : status === "faltou"
        ? "bg-rose-500/10 text-rose-300 ring-rose-500/20"
        : "bg-amber-500/10 text-amber-300 ring-amber-500/20";
  return (
    <span className={cn("rounded-full px-2 py-0.5 text-[10.5px] font-medium ring-1 ring-inset", tone)}>
      {status}
    </span>
  );
}

function AttributionCell({
  icon,
  label,
  value,
  tone = "neutral",
  mono = false,
}: {
  icon?: React.ReactNode;
  label: string;
  value: string;
  tone?: "neutral" | "emerald" | "amber" | "slate";
  mono?: boolean;
}) {
  const tones: Record<string, string> = {
    neutral: "text-slate-200",
    emerald: "text-emerald-300",
    amber: "text-amber-300",
    slate: "text-slate-400",
  };
  return (
    <div className="rounded-md border border-white/[0.05] bg-white/[0.02] px-3 py-2">
      <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-slate-500">
        {icon}
        {label}
      </div>
      <div className={cn("mt-0.5 truncate text-[12px]", tones[tone], mono && "font-mono tabular-nums")}>
        {value || "—"}
      </div>
    </div>
  );
}

function Avatar({ name, small = false }: { name?: string | null; small?: boolean }) {
  const initials = (name ?? "?")
    .split(" ")
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase();
  return (
    <div
      className={cn(
        "grid shrink-0 place-items-center rounded-md bg-white/[0.04] font-semibold text-slate-100 ring-1 ring-inset ring-white/[0.08]",
        small ? "h-7 w-7 text-[11px]" : "h-14 w-14 text-[16px]",
      )}
    >
      {initials}
    </div>
  );
}
