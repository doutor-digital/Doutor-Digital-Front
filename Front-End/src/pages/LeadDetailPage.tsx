import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link, useParams } from "react-router-dom";
import { toast } from "sonner";
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
  TrendingUp,
  Zap,
  Pencil,
  Check,
  X,
  Copy,
  Plus,
  BarChart2,
  Shield,
  Globe,
  Layers,
  Route,
  MousePointerClick,
  Gauge,
} from "lucide-react";
import { useState, useRef } from "react";
import { StageBadge, StateBadge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import { Button } from "@/components/ui/Button";
import { Panel } from "@/components/ui/Panel";
import { MarkAttendanceModal } from "@/components/overlay/MarkAttendanceModal";
import type { MarkAttendancePayload } from "@/types";
import { analyticsService } from "@/services/analytics";
import {
  assignmentsService,
  type AssignmentLeadHistoryItem,
} from "@/services/assignments";
import { webhooksService } from "@/services/webhooks";
import { formatCurrency, formatDate, formatDuration } from "@/lib/utils";
import type { ConversationState, TimelineStage } from "@/types";
import { cn } from "@/lib/utils";

function EditableField({
  value,
  placeholder = "—",
  multiline = false,
  onSave,
  className,
}: {
  value?: string | null;
  placeholder?: string;
  multiline?: boolean;
  onSave?: (val: string) => void;
  className?: string;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value ?? "");
  const ref = useRef<HTMLTextAreaElement & HTMLInputElement>(null);

  const commit = () => {
    onSave?.(draft);
    setEditing(false);
  };
  const cancel = () => {
    setDraft(value ?? "");
    setEditing(false);
  };

  if (editing) {
    return (
      <span className="flex items-start gap-1.5 w-full">
        {multiline ? (
          <textarea
            ref={ref as React.RefObject<HTMLTextAreaElement>}
            autoFocus
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            rows={3}
            className="flex-1 text-[13px] bg-white/[0.03] border border-white/[0.18] rounded-md px-2.5 py-1.5 text-slate-100 outline-none resize-none focus:bg-white/[0.04] transition"
          />
        ) : (
          <input
            ref={ref as React.RefObject<HTMLInputElement>}
            autoFocus
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") commit();
              if (e.key === "Escape") cancel();
            }}
            className="flex-1 text-[13px] bg-white/[0.03] border border-white/[0.18] rounded-md px-2.5 py-1 text-slate-100 outline-none focus:bg-white/[0.04] transition"
          />
        )}
        <button
          onClick={commit}
          className="mt-0.5 p-1 rounded-md bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-300 transition shrink-0 ring-1 ring-inset ring-emerald-500/20"
        >
          <Check className="h-3.5 w-3.5" />
        </button>
        <button
          onClick={cancel}
          className="mt-0.5 p-1 rounded-md bg-white/[0.04] hover:bg-white/[0.06] text-slate-400 transition shrink-0"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </span>
    );
  }

  return (
    <span
      onClick={() => onSave && setEditing(true)}
      className={cn(
        "group/edit inline-flex items-center gap-1.5 max-w-full",
        onSave && "cursor-pointer",
        className,
      )}
    >
      <span
        className={cn(
          "truncate",
          value ? "text-slate-200" : "text-slate-600 italic text-[11.5px]",
        )}
      >
        {value ?? placeholder}
      </span>
      {onSave && (
        <Pencil className="h-3 w-3 text-slate-600 opacity-0 group-hover/edit:opacity-100 group-hover/edit:text-slate-300 transition shrink-0" />
      )}
    </span>
  );
}

export default function LeadDetailPage() {
  const { id } = useParams<{ id: string }>();
  const qc = useQueryClient();
  const [tab, setTab] = useState<
    "overview" | "timeline" | "history" | "payments" | "conversations"
  >("overview");
  const [addingTag, setAddingTag] = useState(false);
  const [tagDraft, setTagDraft] = useState("");
  const [attendanceOpen, setAttendanceOpen] = useState(false);

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
  const timeline = useQuery({
    queryKey: ["lead-timeline", id],
    queryFn: () => webhooksService.getLeadTimeline(id!),
    enabled: !!id && tab === "timeline",
    retry: false,
  });

  const patch = useMutation({
    mutationFn: (data: Record<string, unknown>) =>
      webhooksService.patchLead(id!, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["lead-detail", id] }),
  });

  const markAttendance = useMutation({
    mutationFn: (payload: MarkAttendancePayload) =>
      webhooksService.markAttendance(id!, payload),
    onSuccess: (data) => {
      toast.success(data.message ?? "Comparecimento registrado");
      setAttendanceOpen(false);
      qc.invalidateQueries({ queryKey: ["lead-detail", id] });
      qc.invalidateQueries({ queryKey: ["lead-timeline", id] });
    },
    onError: (err: unknown) => {
      const msg =
        (err as { response?: { data?: { title?: string } } })?.response?.data?.title ??
        (err as Error)?.message ??
        "Falha ao registrar comparecimento";
      toast.error(msg);
    },
  });

  const l = lead.data;
  const m = metrics.data;

  if (lead.isLoading)
    return (
      <div className="space-y-5">
        <div className="h-14 w-96 rounded-xl bg-white/[0.02] animate-pulse" />
        <div className="grid grid-cols-[300px_1fr] gap-5">
          <div className="h-[700px] rounded-xl bg-white/[0.02] animate-pulse" />
          <div className="space-y-4">
            {[...Array(4)].map((_, i) => (
              <div
                key={i}
                className="h-40 rounded-xl bg-white/[0.02] animate-pulse"
              />
            ))}
          </div>
        </div>
      </div>
    );

  if (lead.isError || !l)
    return (
      <div className="space-y-4">
        <Link to="/leads">
          <Button variant="outline" size="sm" className="gap-1.5">
            <ArrowLeft className="h-4 w-4" /> Voltar
          </Button>
        </Link>
        <Panel>
          <div className="p-10">
            <EmptyState
              title="Lead não encontrado"
              description="ID inválido ou backend offline."
            />
          </div>
        </Panel>
      </div>
    );

  const initials = (l.name ?? "?")
    .split(" ")
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase();

  const allInteractions = l.conversations
    .flatMap((c) =>
      c.interactions.map((i) => ({
        ...i,
        conversationState: c.conversationState,
      })),
    )
    .sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt));

  const attendantItems =
    l.assignments.length > 0
      ? l.assignments.map((a) => ({
          name: a.attendantName ?? `Atendente #${a.attendantId}`,
          date: a.assignedAt,
          stage: a.stage,
        }))
      : (history.data ?? []).map((h: AssignmentLeadHistoryItem) => ({
          name: h.attendantName ?? "Atendente",
          date:
            (h.assignedAt as string | undefined) ??
            (h.createdAt as string | undefined),
          stage: undefined,
        }));

  const stateColor =
    l.conversationState === "SERVICE"
      ? "bg-emerald-400"
      : l.conversationState === "QUEUE"
        ? "bg-amber-400"
        : l.conversationState === "BOT"
          ? "bg-indigo-400"
          : "bg-slate-500";

  const TABS = [
    { key: "overview", label: "Visão geral", icon: <BarChart2 className="h-3.5 w-3.5" /> },
    { key: "timeline", label: "Timeline", icon: <Route className="h-3.5 w-3.5" /> },
    { key: "history", label: "Histórico", icon: <TrendingUp className="h-3.5 w-3.5" /> },
    { key: "payments", label: "Pagamentos", icon: <CreditCard className="h-3.5 w-3.5" /> },
    { key: "conversations", label: "Conversas", icon: <MessageSquare className="h-3.5 w-3.5" /> },
  ] as const;

  return (
    <div className="space-y-5">
      {/* Topbar */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Link to="/leads">
            <Button variant="ghost" size="sm" className="gap-1.5">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div className="h-4 w-px bg-white/[0.08]" />
          <div>
            <h1 className="text-[18px] font-semibold tracking-tight text-slate-50 leading-none">
              {l.name ?? "Lead sem nome"}
            </h1>
            <p className="text-[11px] text-slate-500 mt-0.5 font-mono tabular-nums">
              #{l.id}
              {l.externalId ? ` · ext:${l.externalId}` : ""}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {(l.currentStage === "04_AGENDADO_SEM_PAGAMENTO" ||
            l.currentStage === "05_AGENDADO_COM_PAGAMENTO") && (
            <Button
              variant="primary"
              size="sm"
              onClick={() => setAttendanceOpen(true)}
              className="gap-1.5"
            >
              <CheckCircle2 className="h-3.5 w-3.5" /> Marcar comparecimento
            </Button>
          )}
          <button
            onClick={() => navigator.clipboard.writeText(String(l.id))}
            className="flex items-center gap-1.5 text-[11px] text-slate-500 hover:text-slate-300 bg-white/[0.02] hover:bg-white/[0.04] border border-white/[0.08] hover:border-white/[0.14] px-3 py-1.5 rounded-md transition"
          >
            <Copy className="h-3.5 w-3.5" /> Copiar ID
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[300px_1fr] gap-5 items-start">
        {/* Sidebar */}
        <Panel>
          <div className="px-5 pt-5 pb-4 border-b border-white/[0.05]">
            <div className="flex items-start gap-4">
              <div className="relative shrink-0">
                <div className="h-14 w-14 rounded-md bg-white/[0.04] ring-1 ring-inset ring-white/[0.08] grid place-items-center text-[16px] font-semibold text-slate-100">
                  {initials}
                </div>
                <span
                  className={cn(
                    "absolute -bottom-1 -right-1 h-3 w-3 rounded-full ring-2 ring-[#0a0a0d]",
                    stateColor,
                  )}
                />
              </div>
              <div className="min-w-0 flex-1 pt-0.5">
                <h2 className="text-[13px] font-semibold text-slate-50 leading-snug truncate">
                  <EditableField
                    value={l.name}
                    placeholder="Sem nome"
                    onSave={(v) => patch.mutate({ name: v })}
                  />
                </h2>
                <p className="text-[11px] font-mono tabular-nums text-slate-400 mt-0.5 truncate">
                  {l.phone ?? "—"}
                </p>
                <div className="flex items-center gap-1.5 mt-2 flex-wrap">
                  <StateBadge
                    state={
                      (l.conversationState as ConversationState) ?? undefined
                    }
                  />
                  <StageBadge stage={l.currentStage} />
                </div>
              </div>
            </div>
          </div>

          <SidebarSection label="Contato">
            <SidebarRow icon={<Phone className="h-3.5 w-3.5" />} label="Telefone">
              <EditableField
                value={l.phone}
                placeholder="Adicionar telefone"
                onSave={(v) => patch.mutate({ phone: v })}
              />
            </SidebarRow>
            <SidebarRow icon={<Mail className="h-3.5 w-3.5" />} label="E-mail">
              <EditableField
                value={l.email}
                placeholder="Adicionar e-mail"
                onSave={(v) => patch.mutate({ email: v })}
              />
            </SidebarRow>
            <SidebarRow icon={<Hash className="h-3.5 w-3.5" />} label="CPF">
              <EditableField
                value={l.cpf}
                placeholder="Não informado"
                onSave={(v) => patch.mutate({ cpf: v })}
              />
            </SidebarRow>
            <SidebarRow icon={<User2 className="h-3.5 w-3.5" />} label="Gênero">
              <EditableField value={l.gender} placeholder="Não informado" />
            </SidebarRow>
          </SidebarSection>

          <SidebarSection label="Atribuição">
            <SidebarRow
              icon={<Building2 className="h-3.5 w-3.5" />}
              label="Unidade"
            >
              <span className="text-[11.5px] text-slate-200">
                {l.unitName ?? (l.unitId ? `Unit #${l.unitId}` : "—")}
              </span>
            </SidebarRow>
            <SidebarRow
              icon={<UserCog className="h-3.5 w-3.5" />}
              label="Atendente"
            >
              <span className="text-[11.5px] text-slate-200">
                {l.attendantName ?? "—"}
              </span>
            </SidebarRow>
            <SidebarRow
              icon={<Mail className="h-3.5 w-3.5" />}
              label="Email atend."
            >
              <span className="text-[11.5px] text-slate-400 truncate max-w-[130px]">
                {l.attendantEmail ?? "—"}
              </span>
            </SidebarRow>
          </SidebarSection>

          <SidebarSection label="Rastreamento">
            <SidebarRow
              icon={<Target className="h-3.5 w-3.5" />}
              label="Origem"
            >
              <span className="text-[11.5px] text-indigo-300 font-medium">
                {l.source ?? "—"}
              </span>
            </SidebarRow>
            <SidebarRow
              icon={<Globe className="h-3.5 w-3.5" />}
              label="Canal"
            >
              <span className="text-[11.5px] text-sky-300 font-medium">
                {l.channel ?? "—"}
              </span>
            </SidebarRow>
            <SidebarRow
              icon={<Layers className="h-3.5 w-3.5" />}
              label="Campanha"
            >
              <span className="text-[11.5px] text-amber-300 font-medium">
                {l.campaign ?? "—"}
              </span>
            </SidebarRow>
            <SidebarRow
              icon={<Tag className="h-3.5 w-3.5" />}
              label="Anúncio"
            >
              <span className="text-[11.5px] text-slate-300 truncate max-w-[130px]">
                {l.ad ?? "—"}
              </span>
            </SidebarRow>
            <SidebarRow
              icon={<Shield className="h-3.5 w-3.5" />}
              label="Confiança"
            >
              <span
                className={cn(
                  "text-[11.5px] font-semibold",
                  l.trackingConfidence === "ALTA"
                    ? "text-emerald-300"
                    : l.trackingConfidence === "MEDIA"
                      ? "text-amber-300"
                      : "text-slate-500",
                )}
              >
                {l.trackingConfidence ?? "—"}
              </span>
            </SidebarRow>
          </SidebarSection>

          <SidebarSection label="Datas">
            <SidebarRow
              icon={<Calendar className="h-3.5 w-3.5" />}
              label="Criado em"
            >
              <span className="text-[11.5px] text-slate-300 tabular-nums">
                {formatDate(l.createdAt)}
              </span>
            </SidebarRow>
            <SidebarRow
              icon={<Clock className="h-3.5 w-3.5" />}
              label="Atualizado"
            >
              <span className="text-[11.5px] text-slate-300 tabular-nums">
                {formatDate(l.updatedAt)}
              </span>
            </SidebarRow>
            {l.convertedAt && (
              <SidebarRow
                icon={
                  <CheckCircle2 className="h-3.5 w-3.5 text-emerald-300" />
                }
                label="Convertido"
              >
                <span className="text-[11.5px] text-emerald-300 tabular-nums">
                  {formatDate(l.convertedAt)}
                </span>
              </SidebarRow>
            )}
          </SidebarSection>

          <SidebarSection label="Status">
            <div className="grid grid-cols-3 gap-2 px-4 pb-2">
              <BoolPill label="Consulta" value={l.hasAppointment} />
              <BoolPill label="Pagamento" value={l.hasPayment} />
              <BoolPill label="Plano" value={l.hasHealthInsurancePlan} />
            </div>
          </SidebarSection>

          <SidebarSection label="Tags do Contato">
            <div className="flex items-center justify-between px-4 pb-2">
              <span className="text-[11px] text-slate-500">
                {l.tags.length} tag(s)
              </span>
              <button
                onClick={() => setAddingTag(true)}
                className="flex items-center gap-1 text-[11px] text-emerald-300 hover:text-emerald-200 bg-emerald-500/10 hover:bg-emerald-500/15 px-2 py-0.5 rounded-md transition font-medium ring-1 ring-inset ring-emerald-500/20"
              >
                <Plus className="h-3 w-3" />
              </button>
            </div>

            <div className="px-4 pb-3 flex flex-wrap gap-1.5">
              {l.tags.map((t) => (
                <span
                  key={t}
                  className="inline-flex items-center gap-1.5 text-[11.5px] font-medium px-2.5 py-0.5 rounded-md bg-indigo-500/10 text-indigo-300 ring-1 ring-inset ring-indigo-500/20 transition cursor-default group/tag"
                >
                  {t}
                  <button
                    onClick={() =>
                      patch.mutate({ tags: l.tags.filter((x) => x !== t) })
                    }
                    className="opacity-60 hover:opacity-100 transition"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </span>
              ))}

              {addingTag && (
                <span className="inline-flex items-center gap-1">
                  <input
                    autoFocus
                    value={tagDraft}
                    onChange={(e) => setTagDraft(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && tagDraft.trim()) {
                        patch.mutate({ tags: [...l.tags, tagDraft.trim()] });
                        setTagDraft("");
                        setAddingTag(false);
                      }
                      if (e.key === "Escape") {
                        setTagDraft("");
                        setAddingTag(false);
                      }
                    }}
                    placeholder="nova tag…"
                    className="text-[11.5px] bg-white/[0.03] text-slate-100 px-2.5 py-1 rounded-md outline-none ring-1 ring-inset ring-white/[0.12] focus:ring-white/[0.2] w-24 placeholder:text-slate-600 transition"
                  />
                  <button
                    onClick={() => {
                      if (tagDraft.trim()) {
                        patch.mutate({
                          tags: [...l.tags, tagDraft.trim()],
                        });
                        setTagDraft("");
                      }
                      setAddingTag(false);
                    }}
                    className="p-1 rounded-md bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-300 transition ring-1 ring-inset ring-emerald-500/20"
                  >
                    <Check className="h-3 w-3" />
                  </button>
                </span>
              )}

              {l.tags.length === 0 && !addingTag && (
                <span className="text-[11px] text-slate-600 italic">
                  Nenhuma tag
                </span>
              )}
            </div>
          </SidebarSection>
        </Panel>

        {/* Conteúdo principal */}
        <div className="min-w-0 space-y-4">
          <div className="inline-flex items-center p-0.5 rounded-lg bg-white/[0.03] border border-white/[0.06]">
            {TABS.map((t) => (
              <button
                key={t.key}
                onClick={() => setTab(t.key)}
                className={cn(
                  "flex items-center gap-1.5 px-3.5 py-1.5 rounded-md text-[12px] font-medium transition",
                  tab === t.key
                    ? "bg-white/[0.08] text-slate-50 shadow-sm"
                    : "text-slate-400 hover:text-slate-200",
                )}
              >
                {t.icon} {t.label}
              </button>
            ))}
          </div>

          {tab === "overview" && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <InfoBlock
                  icon={<Target className="h-4 w-4" />}
                  label="Origem"
                  value={l.source}
                  tone="indigo"
                />
                <InfoBlock
                  icon={<MessageSquare className="h-4 w-4" />}
                  label="Canal"
                  value={l.channel}
                  tone="sky"
                />
                <InfoBlock
                  icon={<Tag className="h-4 w-4" />}
                  label="Campanha"
                  value={l.campaign}
                  tone="amber"
                />
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

              {m && (
                <Section
                  title="Tempo no funil"
                  subtitle="Duração acumulada em cada fase"
                  eyebrow="Timing"
                  eyebrowTone="bg-emerald-400"
                >
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    <TimeBlock
                      label="No bot"
                      value={m.timeInBot}
                      tone="indigo"
                      icon={<Zap className="h-4 w-4" />}
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
                      tone="sky"
                      icon={<Timer className="h-4 w-4" />}
                    />
                    <TimeBlock
                      label="Total"
                      value={m.totalTime}
                      tone="emerald"
                      icon={<Activity className="h-4 w-4" />}
                    />
                  </div>
                </Section>
              )}

              {m?.alerts && m.alerts.length > 0 && (
                <Panel className="ring-1 ring-inset ring-amber-500/20">
                  <div className="p-5">
                    <div className="flex items-center gap-2.5 mb-3">
                      <div className="h-7 w-7 rounded-md bg-amber-500/10 ring-1 ring-inset ring-amber-500/20 grid place-items-center shrink-0">
                        <AlertTriangle className="h-4 w-4 text-amber-300" />
                      </div>
                      <span className="text-[13px] font-semibold text-amber-200">
                        Alertas ativos
                      </span>
                      <span className="ml-auto text-[10px] font-medium tabular-nums px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-300 ring-1 ring-inset ring-amber-500/20">
                        {m.alerts.length}
                      </span>
                    </div>
                    <ul className="space-y-2">
                      {m.alerts.map((a, i) => (
                        <li
                          key={i}
                          className="flex gap-2.5 text-[12px] text-amber-200/80"
                        >
                          <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-amber-400/70 shrink-0" />
                          {a}
                        </li>
                      ))}
                    </ul>
                  </div>
                </Panel>
              )}

              <Section
                title="Log de interações"
                subtitle={`${allInteractions.length} evento(s) registrado(s)`}
                eyebrow="Atividade"
                eyebrowTone="bg-slate-400"
              >
                {allInteractions.length === 0 ? (
                  <EmptyState title="Nenhuma interação" />
                ) : (
                  <ul className="space-y-1">
                    {allInteractions.map((it) => (
                      <li
                        key={it.id}
                        className="group flex items-start gap-3 px-3 py-2.5 rounded-md hover:bg-white/[0.02] transition"
                      >
                        <div className="h-7 w-7 rounded-md bg-white/[0.03] ring-1 ring-inset ring-white/[0.06] grid place-items-center shrink-0 mt-0.5">
                          <History className="h-3.5 w-3.5 text-slate-500" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-[10px] font-medium uppercase tracking-[0.14em] px-2 py-0.5 rounded-md bg-white/[0.04] text-slate-400">
                              {it.type}
                            </span>
                            <span className="text-[10.5px] text-slate-500 tabular-nums">
                              {formatDate(it.createdAt)}
                            </span>
                          </div>
                          {it.content && (
                            <p className="text-[13px] text-slate-300 mt-1 break-words leading-relaxed">
                              {it.content}
                            </p>
                          )}
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </Section>
            </div>
          )}

          {tab === "timeline" && (
            <div className="space-y-4">
              {timeline.isLoading && (
                <div className="h-64 rounded-xl bg-white/[0.02] animate-pulse" />
              )}
              {timeline.isError && (
                <Panel>
                  <div className="p-8">
                    <EmptyState
                      title="Timeline indisponível"
                      description="Falha ao carregar timeline deste lead."
                    />
                  </div>
                </Panel>
              )}
              {timeline.data && (
                <TimelineView data={timeline.data} />
              )}
            </div>
          )}

          {tab === "history" && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Section
                title="Etapas"
                subtitle={`${l.stageHistory.length} mudança(s)`}
                eyebrow="Funil"
                eyebrowTone="bg-sky-400"
              >
                {l.stageHistory.length > 0 ? (
                  <ol className="ml-1 space-y-0">
                    {l.stageHistory.map((h, idx) => (
                      <li
                        key={h.id}
                        className="relative flex gap-4 pb-5 last:pb-0"
                      >
                        {idx < l.stageHistory.length - 1 && (
                          <span className="absolute left-[9px] top-5 bottom-0 w-px bg-white/[0.08]" />
                        )}
                        <span
                          className={cn(
                            "mt-0.5 h-5 w-5 rounded-full ring-4 ring-[#0a0a0d] grid place-items-center shrink-0 z-10",
                            idx === 0
                              ? "bg-emerald-500"
                              : "bg-white/[0.08]",
                          )}
                        >
                          <span
                            className={cn(
                              "h-1.5 w-1.5 rounded-full",
                              idx === 0 ? "bg-emerald-950" : "bg-slate-500",
                            )}
                          />
                        </span>
                        <div className="pt-0.5">
                          <p className="text-[10.5px] text-slate-500 mb-1.5 tabular-nums">
                            {formatDate(h.changedAt)}
                          </p>
                          <StageBadge stage={h.stageLabel} />
                        </div>
                      </li>
                    ))}
                  </ol>
                ) : (
                  <EmptyState title="Sem histórico de etapas" />
                )}
              </Section>

              <Section
                title="Atendentes"
                subtitle={`${attendantItems.length} atribuição(ões)`}
                eyebrow="Equipe"
                eyebrowTone="bg-indigo-400"
              >
                {attendantItems.length > 0 ? (
                  <ul className="space-y-2">
                    {attendantItems.map((item, i) => (
                      <li
                        key={i}
                        className="flex items-start gap-3 p-3 rounded-md hover:bg-white/[0.02] transition"
                      >
                        <div className="h-8 w-8 rounded-md bg-white/[0.04] ring-1 ring-inset ring-white/[0.08] grid place-items-center text-[11px] font-semibold text-slate-100 shrink-0">
                          {item.name.charAt(0).toUpperCase()}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-[13px] font-medium text-slate-100">
                            {item.name}
                          </p>
                          <p className="text-[11px] text-slate-500 mt-0.5 tabular-nums">
                            {formatDate(item.date)}
                          </p>
                          {item.stage && (
                            <div className="mt-1.5">
                              <StageBadge stage={item.stage} />
                            </div>
                          )}
                        </div>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <EmptyState title="Sem histórico de atendentes" />
                )}
              </Section>
            </div>
          )}

          {tab === "payments" && (
            <Section
              title="Pagamentos"
              subtitle={`${l.payments.length} pagamento(s)`}
              eyebrow="Financeiro"
              eyebrowTone="bg-emerald-400"
            >
              {l.payments.length > 0 ? (
                <ul className="space-y-2">
                  {l.payments.map((p) => (
                    <li
                      key={p.id}
                      className="flex items-center justify-between p-4 rounded-md bg-emerald-500/[0.04] ring-1 ring-inset ring-emerald-500/15 hover:ring-emerald-500/25 transition"
                    >
                      <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-md bg-emerald-500/10 ring-1 ring-inset ring-emerald-500/20 grid place-items-center">
                          <CreditCard className="h-4 w-4 text-emerald-300" />
                        </div>
                        <div>
                          <p className="text-[15px] font-semibold text-slate-50 tabular-nums">
                            {formatCurrency(p.amount)}
                          </p>
                          <p className="text-[11px] text-slate-500 mt-0.5 tabular-nums">
                            {formatDate(p.paidAt)}
                          </p>
                        </div>
                      </div>
                      <span className="inline-flex items-center gap-1 text-[10.5px] font-medium px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-300 ring-1 ring-inset ring-emerald-500/20">
                        <CheckCircle2 className="h-3 w-3" /> Confirmado
                      </span>
                    </li>
                  ))}
                </ul>
              ) : (
                <EmptyState title="Nenhum pagamento registrado" />
              )}
            </Section>
          )}

          {tab === "conversations" && (
            <Section
              title="Conversas"
              subtitle={`${l.conversations.length} conversa(s)`}
              eyebrow="Mensagens"
              eyebrowTone="bg-sky-400"
            >
              {l.conversations.length > 0 ? (
                <ul className="space-y-3">
                  {l.conversations.map((c) => (
                    <li
                      key={c.id}
                      className="p-4 rounded-md bg-white/[0.015] ring-1 ring-inset ring-white/[0.05] hover:bg-white/[0.025] transition"
                    >
                      <div className="flex items-center justify-between flex-wrap gap-2 mb-2">
                        <div className="flex items-center gap-2">
                          <StateBadge
                            state={c.conversationState as ConversationState}
                          />
                          <span className="text-[11px] font-medium text-slate-400 bg-white/[0.04] px-2 py-0.5 rounded-full ring-1 ring-inset ring-white/[0.06]">
                            {c.channel}
                          </span>
                        </div>
                        <span className="text-[11px] text-slate-500 tabular-nums">
                          {formatDate(c.startedAt)}
                          {c.endedAt ? (
                            <> → {formatDate(c.endedAt)}</>
                          ) : (
                            <span className="ml-1 text-emerald-300 font-medium">
                              · ao vivo
                            </span>
                          )}
                        </span>
                      </div>
                      {c.attendantName && (
                        <p className="text-[11.5px] text-slate-500">
                          Atendente:{" "}
                          <span className="text-slate-300 font-medium">
                            {c.attendantName}
                          </span>
                        </p>
                      )}
                      <p className="text-[10.5px] text-slate-600 mt-1.5 tabular-nums">
                        {c.interactions.length} interação(ões)
                      </p>
                    </li>
                  ))}
                </ul>
              ) : (
                <EmptyState title="Nenhuma conversa registrada" />
              )}
            </Section>
          )}
        </div>
      </div>

      <MarkAttendanceModal
        open={attendanceOpen}
        leadName={l.name}
        loading={markAttendance.isPending}
        onClose={() => setAttendanceOpen(false)}
        onConfirm={(payload) => markAttendance.mutate(payload)}
      />
    </div>
  );
}

function SidebarSection({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="border-t border-white/[0.05]">
      <p className="px-4 pt-3 pb-1.5 text-[10px] font-medium uppercase tracking-[0.18em] text-slate-500">
        {label}
      </p>
      <div className="pb-1">{children}</div>
    </div>
  );
}

function SidebarRow({
  icon,
  label,
  children,
}: {
  icon: React.ReactNode;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-3 px-4 py-2 hover:bg-white/[0.02] transition group/row">
      <span className="flex items-center gap-2 text-[11px] text-slate-500 shrink-0">
        <span className="text-slate-600 group-hover/row:text-slate-400 transition">
          {icon}
        </span>
        {label}
      </span>
      <span className="text-[11.5px] text-right min-w-0 flex-1 flex justify-end">
        {children}
      </span>
    </div>
  );
}

function Section({
  title,
  subtitle,
  eyebrow,
  eyebrowTone,
  children,
}: {
  title: string;
  subtitle?: string;
  eyebrow?: string;
  eyebrowTone?: string;
  children: React.ReactNode;
}) {
  return (
    <Panel>
      <div className="flex items-start justify-between gap-3 px-5 py-4 border-b border-white/[0.05] bg-white/[0.01]">
        <div>
          {eyebrow && (
            <div className="flex items-center gap-1.5">
              {eyebrowTone && (
                <span className={cn("h-1 w-1 rounded-full", eyebrowTone)} />
              )}
              <p className="text-[10px] font-medium uppercase tracking-[0.22em] text-slate-500">
                {eyebrow}
              </p>
            </div>
          )}
          <p className="mt-1 text-[15px] font-semibold text-slate-50 tracking-tight">
            {title}
          </p>
          {subtitle && (
            <p className="mt-0.5 text-[11.5px] text-slate-500">{subtitle}</p>
          )}
        </div>
      </div>
      <div className="p-4">{children}</div>
    </Panel>
  );
}

function BoolPill({
  label,
  value,
}: {
  label: string;
  value?: boolean | null;
}) {
  return (
    <div
      className={cn(
        "rounded-md p-2.5 text-center ring-1 ring-inset transition",
        value === true
          ? "bg-emerald-500/10 ring-emerald-500/20 text-emerald-300"
          : "bg-white/[0.02] ring-white/[0.06] text-slate-600",
      )}
    >
      <div className="flex justify-center mb-1">
        {value === true ? (
          <CheckCircle2 className="h-4 w-4 text-emerald-300" />
        ) : (
          <XCircle className="h-4 w-4 text-slate-600" />
        )}
      </div>
      <span className="text-[10px] font-medium uppercase tracking-[0.14em] leading-none block">
        {label}
      </span>
    </div>
  );
}

type InfoTone = "indigo" | "amber" | "sky" | "emerald" | "slate";

function InfoBlock({
  icon,
  label,
  value,
  tone,
}: {
  icon: React.ReactNode;
  label: string;
  value?: string | null;
  tone: InfoTone;
}) {
  const p: Record<
    InfoTone,
    { bg: string; ring: string; text: string; iconC: string }
  > = {
    indigo: {
      bg: "bg-indigo-500/8",
      ring: "ring-indigo-500/20",
      text: "text-indigo-200",
      iconC: "text-indigo-300",
    },
    amber: {
      bg: "bg-amber-500/8",
      ring: "ring-amber-500/20",
      text: "text-amber-200",
      iconC: "text-amber-300",
    },
    sky: {
      bg: "bg-sky-500/8",
      ring: "ring-sky-500/20",
      text: "text-sky-200",
      iconC: "text-sky-300",
    },
    emerald: {
      bg: "bg-emerald-500/8",
      ring: "ring-emerald-500/20",
      text: "text-emerald-200",
      iconC: "text-emerald-300",
    },
    slate: {
      bg: "bg-white/[0.02]",
      ring: "ring-white/[0.06]",
      text: "text-slate-300",
      iconC: "text-slate-400",
    },
  };
  const s = p[tone];

  return (
    <div
      className={cn(
        "rounded-md p-3.5 ring-1 ring-inset transition",
        s.bg,
        s.ring,
      )}
    >
      <div className="flex items-center justify-between mb-2">
        <span className="text-[10px] font-medium uppercase tracking-[0.14em] text-slate-500">
          {label}
        </span>
        <span className={s.iconC}>{icon}</span>
      </div>
      <p className={cn("text-[13px] font-semibold truncate", s.text)}>
        {value ?? (
          <span className="text-slate-600 font-normal text-[11.5px]">—</span>
        )}
      </p>
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
  tone: InfoTone;
  icon: React.ReactNode;
}) {
  const p: Record<
    InfoTone,
    { bg: string; ring: string; val: string; iconC: string }
  > = {
    indigo: {
      bg: "bg-indigo-500/8",
      ring: "ring-indigo-500/20",
      val: "text-indigo-100",
      iconC: "text-indigo-300",
    },
    amber: {
      bg: "bg-amber-500/8",
      ring: "ring-amber-500/20",
      val: "text-amber-100",
      iconC: "text-amber-300",
    },
    sky: {
      bg: "bg-sky-500/8",
      ring: "ring-sky-500/20",
      val: "text-sky-100",
      iconC: "text-sky-300",
    },
    emerald: {
      bg: "bg-emerald-500/8",
      ring: "ring-emerald-500/20",
      val: "text-emerald-100",
      iconC: "text-emerald-300",
    },
    slate: {
      bg: "bg-white/[0.02]",
      ring: "ring-white/[0.06]",
      val: "text-slate-100",
      iconC: "text-slate-400",
    },
  };
  const s = p[tone];

  return (
    <div
      className={cn(
        "rounded-md p-3.5 ring-1 ring-inset transition",
        s.bg,
        s.ring,
      )}
    >
      <div className="flex items-center justify-between mb-2">
        <span className="text-[10px] font-medium uppercase tracking-[0.14em] text-slate-500">
          {label}
        </span>
        <span className={s.iconC}>{icon}</span>
      </div>
      <p
        className={cn(
          "text-[22px] font-bold tracking-tight tabular-nums leading-none",
          s.val,
        )}
      >
        {formatDuration(value)}
      </p>
    </div>
  );
}

function TimelineView({
  data,
}: {
  data: import("@/types").LeadTimeline;
}) {
  const { insights, stages, assignments, conversations, interactions, attribution } = data;

  const maxStageMinutes = Math.max(
    1,
    ...stages.map((s) => s.durationMinutes ?? 0),
  );

  const stateColor = (state: string) =>
    state === "service"
      ? "bg-emerald-500/15 text-emerald-300 ring-emerald-500/25"
      : state === "queue"
        ? "bg-amber-500/15 text-amber-300 ring-amber-500/25"
        : state === "bot"
          ? "bg-indigo-500/15 text-indigo-300 ring-indigo-500/25"
          : state === "concluido"
            ? "bg-sky-500/15 text-sky-300 ring-sky-500/25"
            : "bg-white/[0.04] text-slate-300 ring-white/[0.08]";

  return (
    <>
      <Section
        title="Insights"
        subtitle="Tempo agregado do lead"
        eyebrow="Resumo"
        eyebrowTone="bg-emerald-400"
      >
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <TimeBlock
            label="Até converter"
            value={insights.totalMinutesUntilConversion ?? undefined}
            tone="emerald"
            icon={<CheckCircle2 className="h-4 w-4" />}
          />
          <TimeBlock
            label="Até 1ª atribuição"
            value={insights.minutesUntilFirstAssignment ?? undefined}
            tone="indigo"
            icon={<UserCog className="h-4 w-4" />}
          />
          <TimeBlock
            label="Em bot"
            value={insights.minutesInBot}
            tone="indigo"
            icon={<Zap className="h-4 w-4" />}
          />
          <TimeBlock
            label="Em fila"
            value={insights.minutesInQueue}
            tone="amber"
            icon={<Timer className="h-4 w-4" />}
          />
          <TimeBlock
            label="Em atendimento"
            value={insights.minutesInService}
            tone="sky"
            icon={<Activity className="h-4 w-4" />}
          />
          <InfoBlock
            icon={<Gauge className="h-4 w-4" />}
            label="Mudanças de etapa"
            value={String(insights.stageChanges)}
            tone="slate"
          />
          <InfoBlock
            icon={<MousePointerClick className="h-4 w-4" />}
            label="Reatribuições"
            value={String(insights.reassignments)}
            tone="slate"
          />
          <InfoBlock
            icon={<Clock className="h-4 w-4" />}
            label={`Etapa mais longa${insights.longestStageLabel ? `: ${insights.longestStageLabel}` : ""}`}
            value={
              insights.longestStageMinutes != null
                ? formatDuration(insights.longestStageMinutes)
                : "—"
            }
            tone="amber"
          />
        </div>
      </Section>

      <Section
        title="Etapas"
        subtitle={`${stages.length} etapa(s) · duração em cada uma`}
        eyebrow="Funil"
        eyebrowTone="bg-sky-400"
      >
        {stages.length === 0 ? (
          <EmptyState title="Sem histórico de etapas" />
        ) : (
          <ul className="space-y-2">
            {stages.map((s, i) => (
              <StageBar
                key={`${s.stageId}-${s.enteredAt}-${i}`}
                stage={s}
                maxMinutes={maxStageMinutes}
              />
            ))}
          </ul>
        )}
      </Section>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Section
          title="Atribuições"
          subtitle={`${assignments.length} atribuição(ões)`}
          eyebrow="Equipe"
          eyebrowTone="bg-indigo-400"
        >
          {assignments.length === 0 ? (
            <EmptyState title="Sem atribuições" />
          ) : (
            <ul className="space-y-2">
              {assignments.map((a, i) => (
                <li
                  key={`${a.attendantId}-${a.assignedAt}-${i}`}
                  className="flex items-start gap-3 p-3 rounded-md hover:bg-white/[0.02] transition"
                >
                  <div className="h-8 w-8 rounded-md bg-white/[0.04] ring-1 ring-inset ring-white/[0.08] grid place-items-center text-[11px] font-semibold text-slate-100 shrink-0">
                    {a.attendantName.charAt(0).toUpperCase()}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-[13px] font-medium text-slate-100">
                      {a.attendantName}
                    </p>
                    <p className="text-[11px] text-slate-500 mt-0.5 tabular-nums">
                      {formatDate(a.assignedAt)}
                    </p>
                    <div className="flex items-center gap-2 flex-wrap mt-1.5">
                      {a.stageAtAssignment && <StageBadge stage={a.stageAtAssignment} />}
                      {a.minutesUntilFirstReply != null && (
                        <span className="inline-flex items-center gap-1 text-[10.5px] font-medium px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-300 ring-1 ring-inset ring-emerald-500/20">
                          <Timer className="h-3 w-3" /> {formatDuration(a.minutesUntilFirstReply)} até 1ª resposta
                        </span>
                      )}
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Section>

        <Section
          title="Estados da conversa"
          subtitle={`${conversations.length} conversa(s)`}
          eyebrow="Fluxo"
          eyebrowTone="bg-amber-400"
        >
          {conversations.length === 0 ? (
            <EmptyState title="Nenhuma conversa" />
          ) : (
            <ul className="space-y-2">
              {conversations.map((c) => (
                <li
                  key={c.id}
                  className="p-3 rounded-md bg-white/[0.015] ring-1 ring-inset ring-white/[0.05]"
                >
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <span
                      className={cn(
                        "inline-flex items-center text-[10.5px] font-medium px-2 py-0.5 rounded-full ring-1 ring-inset uppercase tracking-wider",
                        stateColor(c.conversationState),
                      )}
                    >
                      {c.conversationState}
                    </span>
                    <span className="text-[10.5px] text-slate-400 tabular-nums">
                      {formatDuration(c.durationMinutes ?? 0)}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-500 mt-1.5 tabular-nums">
                    {formatDate(c.startedAt)}
                    {c.endedAt ? <> → {formatDate(c.endedAt)}</> : <span className="ml-1 text-emerald-300 font-medium">· ao vivo</span>}
                  </p>
                  {c.attendantName && (
                    <p className="text-[11px] text-slate-500 mt-1">
                      Atendente: <span className="text-slate-300 font-medium">{c.attendantName}</span>
                    </p>
                  )}
                  <p className="text-[10.5px] text-slate-600 mt-1 tabular-nums">
                    {c.interactionsCount} interação(ões)
                  </p>
                </li>
              ))}
            </ul>
          )}
        </Section>
      </div>

      {attribution && (
        <Section
          title="Atribuição de origem"
          subtitle="Rastreamento do clique / captação"
          eyebrow="Origem"
          eyebrowTone="bg-indigo-400"
        >
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <InfoBlock
              icon={<Target className="h-4 w-4" />}
              label="MatchType"
              value={attribution.matchType}
              tone="indigo"
            />
            <InfoBlock
              icon={<Shield className="h-4 w-4" />}
              label="Confiança"
              value={attribution.confidence}
              tone={
                attribution.confidence === "HIGH" || attribution.confidence === "ALTA"
                  ? "emerald"
                  : attribution.confidence === "MEDIUM" || attribution.confidence === "MEDIA"
                    ? "amber"
                    : "slate"
              }
            />
            <InfoBlock
              icon={<Globe className="h-4 w-4" />}
              label="Source Type"
              value={attribution.sourceType ?? "—"}
              tone="sky"
            />
            <InfoBlock
              icon={<Calendar className="h-4 w-4" />}
              label="Match em"
              value={formatDate(attribution.matchedAt)}
              tone="slate"
            />
          </div>
          {attribution.ctwaClid && (
            <p className="text-[11px] text-slate-500 mt-3 font-mono break-all">
              CTWA: <span className="text-slate-300">{attribution.ctwaClid}</span>
            </p>
          )}
        </Section>
      )}

      <Section
        title="Linha do tempo"
        subtitle={`${interactions.length} evento(s)`}
        eyebrow="Interações"
        eyebrowTone="bg-slate-400"
      >
        {interactions.length === 0 ? (
          <EmptyState title="Nenhum evento" />
        ) : (
          <ol className="relative ml-1">
            {interactions.map((it, idx) => (
              <li
                key={it.id}
                className="relative flex gap-3 pb-4 last:pb-0"
              >
                {idx < interactions.length - 1 && (
                  <span className="absolute left-[9px] top-5 bottom-0 w-px bg-white/[0.06]" />
                )}
                <span className="mt-0.5 h-5 w-5 rounded-full ring-4 ring-[#0a0a0d] bg-white/[0.08] grid place-items-center shrink-0 z-10">
                  <span className="h-1.5 w-1.5 rounded-full bg-slate-400" />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-[10px] font-medium uppercase tracking-[0.14em] px-2 py-0.5 rounded-md bg-white/[0.04] text-slate-400">
                      {it.type}
                    </span>
                    <span className="text-[10.5px] text-slate-500 tabular-nums">
                      {formatDate(it.createdAt)}
                    </span>
                  </div>
                  {it.content && (
                    <p className="text-[13px] text-slate-300 mt-1 break-words leading-relaxed">
                      {it.content}
                    </p>
                  )}
                </div>
              </li>
            ))}
          </ol>
        )}
      </Section>
    </>
  );
}

function StageBar({
  stage,
  maxMinutes,
}: {
  stage: TimelineStage;
  maxMinutes: number;
}) {
  const duration = stage.durationMinutes ?? 0;
  const pct = Math.min(100, Math.max(2, (duration / maxMinutes) * 100));

  return (
    <li className="p-3 rounded-md hover:bg-white/[0.02] transition">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2 min-w-0">
          <StageBadge stage={stage.label} />
          {stage.isCurrent && (
            <span className="text-[10px] font-medium uppercase tracking-wider px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-300 ring-1 ring-inset ring-emerald-500/20">
              atual
            </span>
          )}
        </div>
        <span className="text-[11.5px] font-semibold text-slate-200 tabular-nums">
          {formatDuration(duration)}
        </span>
      </div>
      <div className="mt-2 h-1.5 w-full rounded-full bg-white/[0.04] overflow-hidden">
        <div
          className={cn(
            "h-full rounded-full transition-all",
            stage.isCurrent ? "bg-emerald-400/70" : "bg-sky-400/50",
          )}
          style={{ width: `${pct}%` }}
        />
      </div>
      <p className="text-[10.5px] text-slate-500 mt-1.5 tabular-nums">
        {formatDate(stage.enteredAt)}
        {stage.exitedAt && <> → {formatDate(stage.exitedAt)}</>}
      </p>
    </li>
  );
}
