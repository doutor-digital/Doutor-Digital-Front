import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link, useParams } from "react-router-dom";
import {
  AlertTriangle, ArrowLeft, Building2, Calendar, CheckCircle2,
  Clock, CreditCard, Hash, History, Mail, MessageSquare, Phone,
  Tag, Target, Timer, User2, UserCog, XCircle, Sparkles, Activity,
  TrendingUp, Zap, Pencil, Check, X, Copy, Plus,
  BarChart2, Shield, Globe, Layers,
} from "lucide-react";
import { useState, useRef } from "react";
import { StageBadge, StateBadge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import { Button } from "@/components/ui/Button";
import { analyticsService } from "@/services/analytics";
import { assignmentsService, type AssignmentLeadHistoryItem } from "@/services/assignments";
import { webhooksService } from "@/services/webhooks";
import { formatCurrency, formatDate, formatDuration } from "@/lib/utils";
import type { ConversationState } from "@/types";
import { cn } from "@/lib/utils";

/* ═══════════════════════════════════════════════════════════
   EDITABLE FIELD
═══════════════════════════════════════════════════════════ */
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
  const [draft, setDraft]     = useState(value ?? "");
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
            className="flex-1 text-sm bg-slate-800/80 border border-brand-500/50 rounded-lg px-2.5 py-1.5 text-slate-100 outline-none resize-none focus:ring-1 focus:ring-brand-500/40"
          />
        ) : (
          <input
            ref={ref as React.RefObject<HTMLInputElement>}
            autoFocus
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") commit(); if (e.key === "Escape") cancel(); }}
            className="flex-1 text-sm bg-slate-800/80 border border-brand-500/50 rounded-lg px-2.5 py-1 text-slate-100 outline-none focus:ring-1 focus:ring-brand-500/40"
          />
        )}
        <button onClick={commit} className="mt-0.5 p-1 rounded-md bg-brand-500/20 hover:bg-brand-500/40 text-brand-400 transition-colors shrink-0">
          <Check className="h-3.5 w-3.5" />
        </button>
        <button onClick={cancel} className="mt-0.5 p-1 rounded-md bg-white/5 hover:bg-white/10 text-slate-400 transition-colors shrink-0">
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
        className
      )}
    >
      <span className={cn("truncate", value ? "text-slate-200" : "text-slate-600 italic text-xs")}>
        {value ?? placeholder}
      </span>
      {onSave && (
        <Pencil className="h-3 w-3 text-slate-600 opacity-0 group-hover/edit:opacity-100 group-hover/edit:text-brand-400 transition-all shrink-0" />
      )}
    </span>
  );
}

/* ═══════════════════════════════════════════════════════════
   PAGE
═══════════════════════════════════════════════════════════ */
export default function LeadDetailPage() {
  const { id }   = useParams<{ id: string }>();
  const qc       = useQueryClient();
  const [tab, setTab] = useState<"overview" | "history" | "payments" | "conversations">("overview");
  const [addingTag, setAddingTag] = useState(false);
  const [tagDraft, setTagDraft] = useState("");

  const lead    = useQuery({ queryKey: ["lead-detail",  id], queryFn: () => webhooksService.getLeadById(id!),     enabled: !!id, retry: false });
  const metrics = useQuery({ queryKey: ["lead-metrics", id], queryFn: () => analyticsService.leadMetrics(id!),    enabled: !!id, retry: false });
  const history = useQuery({ queryKey: ["lead-history", id], queryFn: () => assignmentsService.leadHistory(id!), enabled: !!id, retry: false });

  // patch mutation — adapte ao seu service real
  const patch = useMutation({
    mutationFn: (data: Record<string, unknown>) => webhooksService.patchLead(id!, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["lead-detail", id] }),
  });

  const l = lead.data;
  const m = metrics.data;

  /* ── Loading ── */
  if (lead.isLoading) return (
    <div className="space-y-5">
      <div className="skeleton h-14 w-96 rounded-xl" />
      <div className="grid grid-cols-[300px_1fr] gap-5">
        <div className="skeleton h-[700px] rounded-2xl" />
        <div className="space-y-4">
          {[...Array(4)].map((_, i) => <div key={i} className="skeleton h-40 rounded-2xl" />)}
        </div>
      </div>
    </div>
  );

  if (lead.isError || !l) return (
    <div className="space-y-4">
      <Link to="/leads"><Button variant="outline" size="sm"><ArrowLeft className="h-4 w-4" /> Voltar</Button></Link>
      <div className="rounded-2xl bg-slate-900/60 border border-slate-800 p-10">
        <EmptyState title="Lead não encontrado" description="ID inválido ou backend offline." />
      </div>
    </div>
  );

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

  const stateColor =
    l.conversationState === "SERVICE" ? "bg-emerald-400" :
    l.conversationState === "QUEUE"   ? "bg-amber-400"   :
    l.conversationState === "BOT"     ? "bg-violet-400"  : "bg-slate-500";

  const TABS = [
    { key: "overview",      label: "Visão geral",  icon: <BarChart2     className="h-3.5 w-3.5" /> },
    { key: "history",       label: "Histórico",    icon: <TrendingUp    className="h-3.5 w-3.5" /> },
    { key: "payments",      label: "Pagamentos",   icon: <CreditCard    className="h-3.5 w-3.5" /> },
    { key: "conversations", label: "Conversas",    icon: <MessageSquare className="h-3.5 w-3.5" /> },
  ] as const;

  return (
    <div className="space-y-5 animate-in fade-in slide-in-from-bottom-2 duration-400">

      {/* ━━━ TOPBAR ━━━ */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Link to="/leads">
            <Button variant="ghost" size="sm" className="gap-1.5 text-slate-400 hover:text-slate-200">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div className="h-4 w-px bg-slate-800" />
          <div>
            <h1 className="text-lg font-bold text-slate-50 leading-none">{l.name ?? "Lead sem nome"}</h1>
            <p className="text-xs text-slate-500 mt-0.5 font-mono">
              #{l.id}{l.externalId ? ` · ext:${l.externalId}` : ""}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => navigator.clipboard.writeText(String(l.id))}
            className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-300 bg-slate-800/60 hover:bg-slate-800 px-3 py-1.5 rounded-lg transition-colors"
          >
            <Copy className="h-3.5 w-3.5" /> Copiar ID
          </button>
        </div>
      </div>

      {/* ━━━ LAYOUT ━━━ */}
      <div className="grid grid-cols-1 lg:grid-cols-[300px_1fr] gap-5 items-start">

        {/* ══════════════════════════════════════════
            SIDEBAR
        ══════════════════════════════════════════ */}
        <aside className="rounded-2xl bg-slate-900/70 backdrop-blur-md overflow-hidden shadow-2xl shadow-black/30 ring-1 ring-slate-800/80">

          {/* Avatar block */}
          <div className="relative px-5 pt-6 pb-5 bg-gradient-to-b from-slate-800/60 to-transparent">
            <div className="flex items-start gap-4">
              {/* Avatar */}
              <div className="relative shrink-0">
                <div className="h-16 w-16 rounded-2xl bg-gradient-to-br from-brand-400 via-violet-500 to-purple-700 grid place-items-center text-xl font-extrabold text-white shadow-xl shadow-violet-900/50">
                  {initials}
                </div>
                <span className={cn("absolute -bottom-1 -right-1 h-3.5 w-3.5 rounded-full ring-2 ring-slate-900", stateColor)} />
              </div>
              {/* Info */}
              <div className="min-w-0 flex-1 pt-0.5">
                <h2 className="text-sm font-bold text-slate-50 leading-snug truncate">
                  <EditableField value={l.name} placeholder="Sem nome" onSave={(v) => patch.mutate({ name: v })} />
                </h2>
                <p className="text-xs font-mono text-brand-400 mt-0.5 truncate">{l.phone ?? "—"}</p>
                <div className="flex items-center gap-1.5 mt-2 flex-wrap">
                  <StateBadge state={(l.conversationState as ConversationState) ?? undefined} />
                  <StageBadge stage={l.currentStage} />
                </div>
              </div>
            </div>
          </div>

          {/* ── Contato ── */}
          <SidebarSection label="Contato">
            <SidebarRow icon={<Phone className="h-3.5 w-3.5" />} label="Telefone">
              <EditableField value={l.phone} placeholder="Adicionar telefone" onSave={(v) => patch.mutate({ phone: v })} />
            </SidebarRow>
            <SidebarRow icon={<Mail className="h-3.5 w-3.5" />} label="E-mail">
              <EditableField value={l.email} placeholder="Adicionar e-mail" onSave={(v) => patch.mutate({ email: v })} />
            </SidebarRow>
            <SidebarRow icon={<Hash className="h-3.5 w-3.5" />} label="CPF">
              <EditableField value={l.cpf} placeholder="Não informado" onSave={(v) => patch.mutate({ cpf: v })} />
            </SidebarRow>
            <SidebarRow icon={<User2 className="h-3.5 w-3.5" />} label="Gênero">
              <EditableField value={l.gender} placeholder="Não informado" />
            </SidebarRow>
          </SidebarSection>

          {/* ── Atribuição ── */}
          <SidebarSection label="Atribuição">
            <SidebarRow icon={<Building2 className="h-3.5 w-3.5" />} label="Unidade">
              <span className="text-xs text-slate-200">{l.unitName ?? (l.unitId ? `Unit #${l.unitId}` : "—")}</span>
            </SidebarRow>
            <SidebarRow icon={<UserCog className="h-3.5 w-3.5" />} label="Atendente">
              <span className="text-xs text-slate-200">{l.attendantName ?? "—"}</span>
            </SidebarRow>
            <SidebarRow icon={<Mail className="h-3.5 w-3.5" />} label="Email atend.">
              <span className="text-xs text-slate-400 truncate max-w-[130px]">{l.attendantEmail ?? "—"}</span>
            </SidebarRow>
          </SidebarSection>

          {/* ── Rastreamento ── */}
          <SidebarSection label="Rastreamento">
            <SidebarRow icon={<Target className="h-3.5 w-3.5" />} label="Origem">
              <span className="text-xs text-violet-300 font-medium">{l.source ?? "—"}</span>
            </SidebarRow>
            <SidebarRow icon={<Globe className="h-3.5 w-3.5" />} label="Canal">
              <span className="text-xs text-brand-300 font-medium">{l.channel ?? "—"}</span>
            </SidebarRow>
            <SidebarRow icon={<Layers className="h-3.5 w-3.5" />} label="Campanha">
              <span className="text-xs text-amber-300 font-medium">{l.campaign ?? "—"}</span>
            </SidebarRow>
            <SidebarRow icon={<Tag className="h-3.5 w-3.5" />} label="Anúncio">
              <span className="text-xs text-slate-300 truncate max-w-[130px]">{l.ad ?? "—"}</span>
            </SidebarRow>
            <SidebarRow icon={<Shield className="h-3.5 w-3.5" />} label="Confiança">
              <span className={cn(
                "text-xs font-bold",
                l.trackingConfidence === "ALTA"  ? "text-emerald-400" :
                l.trackingConfidence === "MEDIA" ? "text-amber-400"   : "text-slate-500"
              )}>
                {l.trackingConfidence ?? "—"}
              </span>
            </SidebarRow>
          </SidebarSection>

          {/* ── Datas ── */}
          <SidebarSection label="Datas">
            <SidebarRow icon={<Calendar className="h-3.5 w-3.5" />} label="Criado em">
              <span className="text-xs text-slate-300">{formatDate(l.createdAt)}</span>
            </SidebarRow>
            <SidebarRow icon={<Clock className="h-3.5 w-3.5" />} label="Atualizado">
              <span className="text-xs text-slate-300">{formatDate(l.updatedAt)}</span>
            </SidebarRow>
            {l.convertedAt && (
              <SidebarRow icon={<CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />} label="Convertido">
                <span className="text-xs text-emerald-300">{formatDate(l.convertedAt)}</span>
              </SidebarRow>
            )}
          </SidebarSection>

          {/* ── Status booleanos ── */}
          <SidebarSection label="Status">
            <div className="grid grid-cols-3 gap-2 px-4 pb-1">
              <BoolPill label="Consulta"   value={l.hasAppointment} />
              <BoolPill label="Pagamento"  value={l.hasPayment} />
              <BoolPill label="Plano"      value={l.hasHealthInsurancePlan} />
            </div>
          </SidebarSection>

          {/* ── Tags ── */}
          {l.tags.length > 0 && (
            <SidebarSection label="Tags">
              <div className="px-4 pb-1 flex flex-wrap gap-1.5">
                {l.tags.map((t) => (
                  <span key={t} className="inline-flex items-center gap-1 text-[11px] font-semibold px-2.5 py-1 rounded-full bg-violet-500/15 text-violet-300 ring-1 ring-violet-500/20 hover:ring-violet-400/40 cursor-default transition-all">
                    {t}
                  </span>
                ))}
              </div>
            </SidebarSection>
          )}

          {/* ── Observações ── */}
<SidebarSection label="">
  {/* Header "Tags do Contato" + botão + */}
  <div className="flex items-center justify-between px-4 pb-2">
    <span className="text-[11px] font-semibold text-slate-300">Tags do Contato</span>
    <button
      onClick={() => setAddingTag(true)}
      className="flex items-center gap-1 text-[11px] text-brand-400 hover:text-brand-300 bg-brand-500/10 hover:bg-brand-500/20 px-2 py-0.5 rounded-md transition-colors font-semibold"
    >
      <Plus className="h-3 w-3" /> +
    </button>
  </div>

  <div className="px-4 pb-3 flex flex-wrap gap-1.5">
    {l.tags.map((t) => (
      <span
        key={t}
        className="inline-flex items-center gap-1.5 text-[12px] font-semibold px-3 py-1 rounded-full bg-violet-600 text-white hover:bg-violet-500 transition-colors cursor-default group/tag"
      >
        {t}
        <button
          onClick={() => patch.mutate({ tags: l.tags.filter((x) => x !== t) })}
          className="opacity-60 hover:opacity-100 transition-opacity"
        >
          <X className="h-3 w-3" />
        </button>
      </span>
    ))}

    {/* Input inline para nova tag */}
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
          placeholder="nova tag..."
          className="text-[12px] bg-slate-800 text-slate-100 px-2.5 py-1 rounded-full outline-none ring-1 ring-violet-500/50 focus:ring-violet-400 w-24 placeholder:text-slate-600 transition-all"
        />
        <button
          onClick={() => {
            if (tagDraft.trim()) {
              patch.mutate({ tags: [...l.tags, tagDraft.trim()] });
              setTagDraft("");
            }
            setAddingTag(false);
          }}
          className="p-1 rounded-full bg-violet-600 hover:bg-violet-500 text-white transition-colors"
        >
          <Check className="h-3 w-3" />
        </button>
      </span>
    )}

    {l.tags.length === 0 && !addingTag && (
      <span className="text-xs text-slate-600 italic">Nenhuma tag</span>
    )}
  </div>
</SidebarSection>
        </aside>

        {/* ══════════════════════════════════════════
            CONTEÚDO PRINCIPAL
        ══════════════════════════════════════════ */}
        <div className="min-w-0 space-y-4">

          {/* Abas */}
          <div className="flex items-center gap-1 p-1 rounded-xl bg-slate-900/70 ring-1 ring-slate-800/80 w-fit backdrop-blur-md">
            {TABS.map((t) => (
              <button
                key={t.key}
                onClick={() => setTab(t.key)}
                className={cn(
                  "flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold transition-all",
                  tab === t.key
                    ? "bg-brand-600 text-white shadow-lg shadow-brand-900/50"
                    : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/60"
                )}
              >
                {t.icon} {t.label}
              </button>
            ))}
          </div>

          {/* ── TAB: VISÃO GERAL ── */}
          {tab === "overview" && (
            <div className="space-y-4 animate-in fade-in duration-200">

              {/* KPIs de rastreamento */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <InfoBlock icon={<Target        className="h-4 w-4" />} label="Origem"    value={l.source}            tone="violet" />
                <InfoBlock icon={<MessageSquare className="h-4 w-4" />} label="Canal"     value={l.channel}           tone="blue" />
                <InfoBlock icon={<Tag           className="h-4 w-4" />} label="Campanha"  value={l.campaign}          tone="amber" />
                <InfoBlock
                  icon={<Sparkles className="h-4 w-4" />}
                  label="Confiança"
                  value={l.trackingConfidence}
                  tone={l.trackingConfidence === "ALTA" ? "emerald" : l.trackingConfidence === "MEDIA" ? "amber" : "slate"}
                />
              </div>

              {/* Tempo no funil */}
              {m && (
                <Section title="Tempo no funil" subtitle="Duração acumulada em cada fase" icon={<Activity className="h-4 w-4 text-emerald-400" />}>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    <TimeBlock label="No bot"         value={m.timeInBot}     tone="violet"  icon={<Zap      className="h-4 w-4" />} />
                    <TimeBlock label="Na fila"        value={m.timeInQueue}   tone="amber"   icon={<Timer    className="h-4 w-4" />} />
                    <TimeBlock label="Em atendimento" value={m.timeInService} tone="blue"    icon={<Timer    className="h-4 w-4" />} />
                    <TimeBlock label="Total"          value={m.totalTime}     tone="emerald" icon={<Activity className="h-4 w-4" />} />
                  </div>
                </Section>
              )}

              {/* Alertas */}
              {m?.alerts && m.alerts.length > 0 && (
                <div className="rounded-2xl ring-1 ring-amber-500/20 bg-gradient-to-br from-amber-500/8 to-transparent p-5">
                  <div className="flex items-center gap-2.5 mb-3">
                    <div className="h-7 w-7 rounded-lg bg-amber-500/15 grid place-items-center shrink-0">
                      <AlertTriangle className="h-4 w-4 text-amber-400" />
                    </div>
                    <span className="text-sm font-semibold text-amber-300">Alertas ativos</span>
                    <span className="ml-auto text-[11px] font-bold px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300">
                      {m.alerts.length}
                    </span>
                  </div>
                  <ul className="space-y-2">
                    {m.alerts.map((a, i) => (
                      <li key={i} className="flex gap-2.5 text-xs text-amber-200/80">
                        <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-amber-400/70 shrink-0" />
                        {a}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Interações */}
              <Section title="Log de interações" subtitle={`${allInteractions.length} evento(s) registrado(s)`} icon={<History className="h-4 w-4 text-slate-400" />}>
                {allInteractions.length === 0 ? (
                  <EmptyState title="Nenhuma interação" />
                ) : (
                  <ul className="space-y-1.5">
                    {allInteractions.map((it) => (
                      <li key={it.id} className="group flex items-start gap-3 px-3 py-2.5 rounded-xl hover:bg-slate-800/50 transition-colors">
                        <div className="h-7 w-7 rounded-lg bg-slate-800 group-hover:bg-brand-500/15 grid place-items-center shrink-0 mt-0.5 transition-colors">
                          <History className="h-3.5 w-3.5 text-slate-500 group-hover:text-brand-400 transition-colors" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-[11px] font-bold px-2 py-0.5 rounded-md bg-slate-800 text-slate-400">{it.type}</span>
                            <span className="text-[11px] text-slate-600">{formatDate(it.createdAt)}</span>
                          </div>
                          {it.content && <p className="text-sm text-slate-300 mt-1 break-words leading-relaxed">{it.content}</p>}
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </Section>
            </div>
          )}

          {/* ── TAB: HISTÓRICO ── */}
          {tab === "history" && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 animate-in fade-in duration-200">

              <Section title="Etapas" subtitle={`${l.stageHistory.length} mudança(s)`} icon={<TrendingUp className="h-4 w-4 text-brand-400" />}>
                {l.stageHistory.length > 0 ? (
                  <ol className="ml-1 space-y-0">
                    {l.stageHistory.map((h, idx) => (
                      <li key={h.id} className="relative flex gap-4 pb-6 last:pb-0">
                        {idx < l.stageHistory.length - 1 && (
                          <span className="absolute left-[9px] top-5 bottom-0 w-px bg-gradient-to-b from-brand-500/40 to-transparent" />
                        )}
                        <span className={cn(
                          "mt-0.5 h-5 w-5 rounded-full ring-4 ring-slate-900 grid place-items-center shrink-0 z-10",
                          idx === 0 ? "bg-brand-500 shadow-[0_0_10px_rgba(99,102,241,0.5)]" : "bg-slate-700"
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
                ) : <EmptyState title="Sem histórico de etapas" />}
              </Section>

              <Section title="Atendentes" subtitle={`${attendantItems.length} atribuição(ões)`} icon={<UserCog className="h-4 w-4 text-violet-400" />}>
                {attendantItems.length > 0 ? (
                  <ul className="space-y-2">
                    {attendantItems.map((item, i) => (
                      <li key={i} className="flex items-start gap-3 p-3 rounded-xl hover:bg-slate-800/40 transition-colors">
                        <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-brand-400 to-violet-600 grid place-items-center text-xs font-extrabold shrink-0 shadow-md">
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
                ) : <EmptyState title="Sem histórico de atendentes" />}
              </Section>
            </div>
          )}

          {/* ── TAB: PAGAMENTOS ── */}
          {tab === "payments" && (
            <Section title="Pagamentos" subtitle={`${l.payments.length} pagamento(s)`} icon={<CreditCard className="h-4 w-4 text-emerald-400" />}>
              {l.payments.length > 0 ? (
                <ul className="space-y-2">
                  {l.payments.map((p) => (
                    <li key={p.id} className="flex items-center justify-between p-4 rounded-xl bg-emerald-500/[0.04] ring-1 ring-emerald-500/10 hover:ring-emerald-500/20 hover:bg-emerald-500/[0.07] transition-all">
                      <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-xl bg-emerald-500/10 grid place-items-center">
                          <CreditCard className="h-4 w-4 text-emerald-400" />
                        </div>
                        <div>
                          <p className="text-base font-bold text-slate-100">{formatCurrency(p.amount)}</p>
                          <p className="text-xs text-slate-500 mt-0.5">{formatDate(p.paidAt)}</p>
                        </div>
                      </div>
                      <span className="text-[11px] font-bold px-3 py-1.5 rounded-full bg-emerald-500/15 text-emerald-300 ring-1 ring-emerald-500/20">
                        ✓ Confirmado
                      </span>
                    </li>
                  ))}
                </ul>
              ) : <EmptyState title="Nenhum pagamento registrado" />}
            </Section>
          )}

          {/* ── TAB: CONVERSAS ── */}
          {tab === "conversations" && (
            <Section title="Conversas" subtitle={`${l.conversations.length} conversa(s)`} icon={<MessageSquare className="h-4 w-4 text-brand-400" />}>
              {l.conversations.length > 0 ? (
                <ul className="space-y-3">
                  {l.conversations.map((c) => (
                    <li key={c.id} className="p-4 rounded-xl hover:bg-slate-800/40 ring-1 ring-slate-800/60 transition-all">
                      <div className="flex items-center justify-between flex-wrap gap-2 mb-2">
                        <div className="flex items-center gap-2">
                          <StateBadge state={c.conversationState as ConversationState} />
                          <span className="text-[11px] font-medium text-slate-400 bg-slate-800/60 px-2 py-0.5 rounded-full">
                            {c.channel}
                          </span>
                        </div>
                        <span className="text-[11px] text-slate-500">
                          {formatDate(c.startedAt)}
                          {c.endedAt ? <> → {formatDate(c.endedAt)}</> : <span className="ml-1 text-emerald-400 font-semibold">· ao vivo</span>}
                        </span>
                      </div>
                      {c.attendantName && (
                        <p className="text-xs text-slate-500">
                          Atendente: <span className="text-slate-300 font-semibold">{c.attendantName}</span>
                        </p>
                      )}
                      <p className="text-[11px] text-slate-600 mt-1.5">{c.interactions.length} interação(ões)</p>
                    </li>
                  ))}
                </ul>
              ) : <EmptyState title="Nenhuma conversa registrada" />}
            </Section>
          )}
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   LAYOUT COMPONENTS
═══════════════════════════════════════════════════════════ */

function SidebarSection({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="border-t border-slate-800/80">
      <p className="px-4 pt-3 pb-1.5 text-[10px] font-bold uppercase tracking-widest text-slate-600">{label}</p>
      <div className="pb-1">{children}</div>
    </div>
  );
}

function SidebarRow({ icon, label, children }: { icon: React.ReactNode; label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 px-4 py-2 hover:bg-slate-800/40 transition-colors group/row">
      <span className="flex items-center gap-2 text-[11px] text-slate-500 shrink-0 group-hover/row:text-slate-400 transition-colors">
        <span className="text-slate-600 group-hover/row:text-brand-400 transition-colors">{icon}</span>
        {label}
      </span>
      <span className="text-xs text-right min-w-0 flex-1 flex justify-end">{children}</span>
    </div>
  );
}

function Section({ title, subtitle, icon, children }: {
  title: string; subtitle?: string; icon?: React.ReactNode; children: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl bg-slate-900/70 ring-1 ring-slate-800/80 backdrop-blur-sm overflow-hidden">
      <div className="flex items-center justify-between gap-3 px-5 py-4 border-b border-slate-800/80">
        <div>
          <p className="text-sm font-semibold text-slate-100">{title}</p>
          {subtitle && <p className="text-xs text-slate-500 mt-0.5">{subtitle}</p>}
        </div>
        {icon && (
          <div className="h-8 w-8 rounded-lg bg-slate-800/60 grid place-items-center shrink-0">{icon}</div>
        )}
      </div>
      <div className="p-4">{children}</div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   FIELD COMPONENTS
═══════════════════════════════════════════════════════════ */

function BoolPill({ label, value }: { label: string; value?: boolean | null }) {
  return (
    <div className={cn(
      "rounded-xl p-2.5 text-center ring-1 transition-all",
      value === true
        ? "bg-emerald-500/10 ring-emerald-500/25 text-emerald-300"
        : "bg-slate-800/40 ring-slate-700/40 text-slate-600"
    )}>
      <div className="flex justify-center mb-1">
        {value === true
          ? <CheckCircle2 className="h-4 w-4 text-emerald-400" />
          : <XCircle className="h-4 w-4 text-slate-600" />
        }
      </div>
      <span className="text-[10px] font-semibold leading-none block">{label}</span>
    </div>
  );
}

function InfoBlock({ icon, label, value, tone }: {
  icon: React.ReactNode; label: string; value?: string | null;
  tone: "violet" | "amber" | "blue" | "emerald" | "slate";
}) {
  const p = {
    violet:  { bg: "bg-violet-500/8",  ring: "ring-violet-500/15 hover:ring-violet-500/30", text: "text-violet-200",  icon: "text-violet-400"  },
    amber:   { bg: "bg-amber-500/8",   ring: "ring-amber-500/15  hover:ring-amber-500/30",  text: "text-amber-200",   icon: "text-amber-400"   },
    blue:    { bg: "bg-brand-500/8",   ring: "ring-brand-500/15  hover:ring-brand-500/30",  text: "text-brand-200",   icon: "text-brand-400"   },
    emerald: { bg: "bg-emerald-500/8", ring: "ring-emerald-500/15 hover:ring-emerald-500/30",text: "text-emerald-200",icon: "text-emerald-400" },
    slate:   { bg: "bg-slate-700/20",  ring: "ring-slate-700/30  hover:ring-slate-600/40",  text: "text-slate-300",   icon: "text-slate-400"   },
  }[tone];

  return (
    <div className={cn("rounded-xl p-3.5 ring-1 transition-all", p.bg, p.ring)}>
      <div className="flex items-center justify-between mb-2">
        <span className="text-[10px] font-bold uppercase tracking-widest text-slate-500">{label}</span>
        <span className={p.icon}>{icon}</span>
      </div>
      <p className={cn("text-sm font-bold truncate", p.text)} title={value ?? "—"}>
        {value ?? <span className="text-slate-600 font-normal text-xs">—</span>}
      </p>
    </div>
  );
}

function TimeBlock({ label, value, tone, icon }: {
  label: string; value?: number;
  tone: "violet" | "amber" | "blue" | "emerald"; icon: React.ReactNode;
}) {
  const p = {
    violet:  { bg: "bg-violet-500/8",  ring: "ring-violet-500/15 hover:ring-violet-500/30", val: "text-violet-100",  icon: "text-violet-400"  },
    amber:   { bg: "bg-amber-500/8",   ring: "ring-amber-500/15  hover:ring-amber-500/30",  val: "text-amber-100",   icon: "text-amber-400"   },
    blue:    { bg: "bg-brand-500/8",   ring: "ring-brand-500/15  hover:ring-brand-500/30",  val: "text-brand-100",   icon: "text-brand-400"   },
    emerald: { bg: "bg-emerald-500/8", ring: "ring-emerald-500/15 hover:ring-emerald-500/30",val: "text-emerald-100",icon: "text-emerald-400" },
  }[tone];

  return (
    <div className={cn("rounded-xl p-3.5 ring-1 transition-all", p.bg, p.ring)}>
      <div className="flex items-center justify-between mb-2">
        <span className="text-[10px] font-bold uppercase tracking-widest text-slate-500">{label}</span>
        <span className={p.icon}>{icon}</span>
      </div>
      <p className={cn("text-2xl font-extrabold tracking-tight tabular-nums", p.val)}>
        {formatDuration(value)}
      </p>
    </div>
  );
}