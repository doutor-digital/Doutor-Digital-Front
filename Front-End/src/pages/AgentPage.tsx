import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Area,
  AreaChart,
  ResponsiveContainer,
  Tooltip as RTooltip,
  XAxis,
} from "recharts";
import {
  Bot,
  MessageCircle,
  Users,
  TrendingUp,
  Phone,
  Clock,
  Search,
  RefreshCw,
  X,
  Send,
  Activity,
  Copy,
  Check,
  ChevronRight,
  Headset,
  Sparkles,
} from "@/components/icons";
import { toast } from "sonner";
import { agentService } from "@/services/agent";
import { unitsService } from "@/services/units";
import { useClinic } from "@/hooks/useClinic";
import type {
  AgentConversationListItem,
  AgentOverview,
} from "@/types/agent";

const STATUS_TABS = [
  { key: "", label: "Todas" },
  { key: "active", label: "Ativas" },
  { key: "handoff", label: "Humano" },
  { key: "closed", label: "Encerradas" },
] as const;

const PAGE_SIZE = 30;

const fmtDateTime = (s?: string | null) =>
  s
    ? new Date(s).toLocaleString("pt-BR", {
        day: "2-digit",
        month: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
      })
    : "—";

const fmtTime = (s?: string | null) =>
  s
    ? new Date(s).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })
    : "";

function statusBadge(status: string, handedOff: boolean) {
  if (handedOff || status === "handoff")
    return { label: "Humano", cls: "bg-amber-500/15 text-amber-500" };
  if (status === "active") return { label: "Ativa", cls: "bg-emerald-500/15 text-emerald-500" };
  if (status === "closed") return { label: "Encerrada", cls: "bg-slate-500/15 text-ink-500" };
  return { label: status, cls: "bg-slate-500/15 text-ink-500" };
}

function sentimentBadge(s?: string | null) {
  if (!s) return null;
  const v = s.toLowerCase();
  const cls = v.includes("posit")
    ? "bg-emerald-500/15 text-emerald-500"
    : v.includes("negat")
      ? "bg-rose-500/15 text-rose-500"
      : "bg-sky-500/15 text-sky-500";
  return { label: s, cls };
}

export default function AgentPage() {
  const unitId = useClinic((s) => s.unitId);
  const [status, setStatus] = useState<string>("");
  const [search, setSearch] = useState("");
  const [debounced, setDebounced] = useState("");
  const [page, setPage] = useState(1);
  const [openId, setOpenId] = useState<number | null>(null);

  // debounce simples da busca
  useEffect(() => {
    const t = setTimeout(() => {
      setDebounced(search.trim());
      setPage(1);
    }, 350);
    return () => clearTimeout(t);
  }, [search]);

  const overviewQ = useQuery({
    queryKey: ["agent", "overview", unitId],
    queryFn: () => agentService.overview({ unitId }),
    staleTime: 60_000,
  });

  const listQ = useQuery({
    queryKey: ["agent", "list", unitId, status, debounced, page],
    queryFn: () =>
      agentService.list({
        unitId,
        status: status || undefined,
        search: debounced || undefined,
        page,
        pageSize: PAGE_SIZE,
      }),
    staleTime: 30_000,
  });

  const ov = overviewQ.data;
  const list = listQ.data;
  const totalPages = list ? Math.max(1, Math.ceil(list.total / PAGE_SIZE)) : 1;

  return (
    <div className="mx-auto w-full max-w-7xl px-3 py-4 sm:px-5">
      {/* Cabeçalho */}
      <header className="mb-5 flex flex-wrap items-center gap-3">
        <span className="grid h-11 w-11 place-items-center rounded-2xl bg-brand-500/15 text-brand-500">
          <Bot className="h-6 w-6" />
        </span>
        <div className="min-w-0">
          <h1 className="flex items-center gap-2 text-lg font-bold text-ink-900">
            Inteligência Artificial
            <span className="rounded-full bg-brand-500/15 px-2 py-0.5 text-[11px] font-semibold text-brand-500">
              agente-Dt
            </span>
          </h1>
          <p className="text-[12px] text-ink-500">
            Conversas conduzidas pela I.A., métricas e transferências para humano.
          </p>
        </div>
        <button
          type="button"
          onClick={() => {
            overviewQ.refetch();
            listQ.refetch();
          }}
          className="ml-auto inline-flex items-center gap-2 rounded-xl border border-hairline bg-surface px-3 py-1.5 text-[12px] font-medium text-ink-700 hover:bg-surface-2"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${listQ.isFetching ? "animate-spin" : ""}`} />
          Atualizar
        </button>
      </header>

      {/* KPIs */}
      <KpiRow ov={ov} loading={overviewQ.isLoading} />

      {/* Gráfico de conversas por dia */}
      {ov && ov.seriesByDay.length > 1 && (
        <div className="card mt-4 p-4">
          <p className="mb-2 text-[12px] font-semibold text-ink-700">Conversas por dia</p>
          <div className="h-40">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={ov.seriesByDay} margin={{ top: 4, right: 6, left: 6, bottom: 0 }}>
                <defs>
                  <linearGradient id="agentArea" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#008eff" stopOpacity={0.35} />
                    <stop offset="100%" stopColor="#008eff" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <XAxis
                  dataKey="date"
                  tickFormatter={(d) =>
                    new Date(d).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })
                  }
                  tick={{ fontSize: 10, fill: "rgb(var(--ink-500))" }}
                  axisLine={false}
                  tickLine={false}
                  minTickGap={24}
                />
                <RTooltip
                  contentStyle={{
                    background: "rgb(var(--surface))",
                    border: "1px solid rgb(var(--hairline))",
                    borderRadius: 12,
                    fontSize: 12,
                  }}
                  labelFormatter={(d) => fmtDateTime(d as string)}
                  formatter={(v) => [v as number, "Conversas"]}
                />
                <Area
                  type="monotone"
                  dataKey="count"
                  stroke="#008eff"
                  strokeWidth={2}
                  fill="url(#agentArea)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Filtros */}
      <div className="mt-4 flex flex-wrap items-center gap-2">
        <div className="flex rounded-xl border border-hairline bg-surface p-0.5">
          {STATUS_TABS.map((t) => (
            <button
              key={t.key}
              type="button"
              onClick={() => {
                setStatus(t.key);
                setPage(1);
              }}
              className={`rounded-lg px-3 py-1.5 text-[12px] font-medium transition-colors ${
                status === t.key ? "bg-brand-500 text-white" : "text-ink-500 hover:text-ink-900"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
        <div className="relative ml-auto min-w-[200px] flex-1 sm:max-w-xs">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-500" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por nome, telefone ou assunto…"
            className="w-full rounded-xl border border-hairline bg-surface py-2 pl-9 pr-3 text-[13px] text-ink-900 placeholder:text-ink-500 focus:border-brand-500 focus:outline-none"
          />
        </div>
      </div>

      {/* Lista de conversas */}
      <div className="card mt-3 divide-y divide-hairline overflow-hidden">
        {listQ.isLoading ? (
          <ListSkeleton />
        ) : list && list.items.length > 0 ? (
          list.items.map((c) => (
            <ConversationRow key={c.id} c={c} onOpen={() => setOpenId(c.id)} />
          ))
        ) : (
          <EmptyState webhookConfigured={(ov?.totalConversations ?? 0) > 0} />
        )}
      </div>

      {/* Paginação */}
      {list && list.total > PAGE_SIZE && (
        <div className="mt-3 flex items-center justify-between text-[12px] text-ink-500">
          <span>
            {list.total} conversa{list.total === 1 ? "" : "s"} · página {page}/{totalPages}
          </span>
          <div className="flex gap-2">
            <button
              type="button"
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              className="rounded-lg border border-hairline px-3 py-1 disabled:opacity-40"
            >
              Anterior
            </button>
            <button
              type="button"
              disabled={page >= totalPages}
              onClick={() => setPage((p) => p + 1)}
              className="rounded-lg border border-hairline px-3 py-1 disabled:opacity-40"
            >
              Próxima
            </button>
          </div>
        </div>
      )}

      {/* Card de configuração do webhook */}
      <WebhookCard unitId={unitId} />

      {/* Drawer de detalhe */}
      {openId !== null && (
        <ConversationDrawer id={openId} unitId={unitId} onClose={() => setOpenId(null)} />
      )}
    </div>
  );
}

// ─── KPIs ─────────────────────────────────────────────────────────────────

function KpiRow({ ov, loading }: { ov?: AgentOverview; loading: boolean }) {
  const cards = [
    {
      label: "Conversas",
      value: ov?.totalConversations ?? 0,
      icon: MessageCircle,
      tint: "text-brand-500 bg-brand-500/15",
    },
    {
      label: "Ativas agora",
      value: ov?.activeConversations ?? 0,
      icon: Activity,
      tint: "text-emerald-500 bg-emerald-500/15",
    },
    {
      label: "Mensagens",
      value: ov?.totalMessages ?? 0,
      sub: ov ? `~${ov.avgMessagesPerConversation}/conversa` : undefined,
      icon: Send,
      tint: "text-sky-500 bg-sky-500/15",
    },
    {
      label: "Passou p/ humano",
      value: ov?.handoffConversations ?? 0,
      sub: ov ? `${ov.handoffRate}%` : undefined,
      icon: Headset,
      tint: "text-amber-500 bg-amber-500/15",
    },
    {
      label: "Leads vinculados",
      value: ov?.leadsLinked ?? 0,
      icon: TrendingUp,
      tint: "text-violet-500 bg-violet-500/15",
    },
    {
      label: "Contatos",
      value: ov?.contactsLinked ?? 0,
      icon: Users,
      tint: "text-rose-500 bg-rose-500/15",
    },
  ];

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
      {cards.map((c) => (
        <div key={c.label} className="card p-3.5">
          <div className="mb-2 flex items-center justify-between">
            <span className={`grid h-8 w-8 place-items-center rounded-lg ${c.tint}`}>
              <c.icon className="h-4 w-4" />
            </span>
          </div>
          <p className="text-xl font-bold text-ink-900">
            {loading ? "—" : c.value.toLocaleString("pt-BR")}
          </p>
          <p className="text-[11px] text-ink-500">{c.label}</p>
          {c.sub && <p className="mt-0.5 text-[10px] font-medium text-ink-400">{c.sub}</p>}
        </div>
      ))}
    </div>
  );
}

// ─── Linha de conversa ──────────────────────────────────────────────────────

function ConversationRow({
  c,
  onOpen,
}: {
  c: AgentConversationListItem;
  onOpen: () => void;
}) {
  const st = statusBadge(c.status, c.handedOff);
  const sent = sentimentBadge(c.sentiment);
  return (
    <button
      type="button"
      onClick={onOpen}
      className="flex w-full items-center gap-3 px-3 py-3 text-left transition-colors hover:bg-surface-2"
    >
      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-brand-500/10 text-brand-500">
        <Bot className="h-5 w-5" />
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <p className="truncate text-[13px] font-semibold text-ink-900">
            {c.contactName || c.contactPhone || c.externalId}
          </p>
          <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold ${st.cls}`}>
            {st.label}
          </span>
          {sent && (
            <span
              className={`hidden shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold sm:inline ${sent.cls}`}
            >
              {sent.label}
            </span>
          )}
        </div>
        <p className="truncate text-[11px] text-ink-500">
          {c.summary || c.intent || "Sem resumo"}
        </p>
      </div>
      <div className="hidden shrink-0 flex-col items-end text-right sm:flex">
        <span className="inline-flex items-center gap-1 text-[11px] text-ink-500">
          <MessageCircle className="h-3 w-3" /> {c.messageCount}
        </span>
        <span className="inline-flex items-center gap-1 text-[10px] text-ink-400">
          <Clock className="h-3 w-3" /> {fmtDateTime(c.lastMessageAt || c.startedAt)}
        </span>
      </div>
      <ChevronRight className="h-4 w-4 shrink-0 text-ink-400" />
    </button>
  );
}

// ─── Detalhe (drawer) ───────────────────────────────────────────────────────

function ConversationDrawer({
  id,
  unitId,
  onClose,
}: {
  id: number;
  unitId: number | null;
  onClose: () => void;
}) {
  const detailQ = useQuery({
    queryKey: ["agent", "detail", id, unitId],
    queryFn: () => agentService.detail(id, unitId),
    staleTime: 30_000,
  });
  const d = detailQ.data;
  const st = d ? statusBadge(d.status, d.handedOff) : null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/50 backdrop-blur-sm" onClick={onClose}>
      <div
        className="flex h-full w-full max-w-lg flex-col bg-surface shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Topo */}
        <div className="flex items-center gap-3 border-b border-hairline px-4 py-3">
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-brand-500/10 text-brand-500">
            <Bot className="h-5 w-5" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-[14px] font-bold text-ink-900">
              {d?.contactName || d?.contactPhone || `Conversa #${id}`}
            </p>
            <p className="flex items-center gap-2 text-[11px] text-ink-500">
              {d?.contactPhone && (
                <span className="inline-flex items-center gap-1">
                  <Phone className="h-3 w-3" />
                  {d.contactPhone}
                </span>
              )}
              {st && (
                <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${st.cls}`}>
                  {st.label}
                </span>
              )}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar"
            className="rounded-full p-1.5 text-ink-500 hover:bg-surface-2 hover:text-ink-900"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Metadados */}
        {d && (
          <div className="flex flex-wrap gap-x-4 gap-y-1 border-b border-hairline bg-surface-2 px-4 py-2 text-[11px] text-ink-500">
            {d.intent && (
              <span>
                <b className="text-ink-700">Intenção:</b> {d.intent}
              </span>
            )}
            {d.sentiment && (
              <span>
                <b className="text-ink-700">Sentimento:</b> {d.sentiment}
              </span>
            )}
            <span>
              <b className="text-ink-700">Mensagens:</b> {d.messageCount}
            </span>
            {d.leadId && (
              <a href={`/leads/${d.leadId}`} className="text-brand-500 hover:underline">
                Ver lead #{d.leadId}
              </a>
            )}
            {d.contactId && (
              <a href={`/contacts/${d.contactId}`} className="text-brand-500 hover:underline">
                Ver contato
              </a>
            )}
          </div>
        )}

        {/* Resumo */}
        {d?.summary && (
          <div className="border-b border-hairline px-4 py-2.5">
            <p className="flex items-start gap-2 text-[12px] text-ink-700">
              <Sparkles className="mt-0.5 h-3.5 w-3.5 shrink-0 text-brand-500" />
              {d.summary}
            </p>
          </div>
        )}

        {/* Mensagens */}
        <div className="flex-1 space-y-2.5 overflow-y-auto bg-surface-2 px-3 py-4">
          {detailQ.isLoading ? (
            <p className="py-10 text-center text-[12px] text-ink-500">Carregando conversa…</p>
          ) : d && d.messages.length > 0 ? (
            d.messages.map((m) => {
              const isAi = m.role === "assistant";
              const isMeta = m.role === "system" || m.role === "tool";
              if (isMeta)
                return (
                  <p
                    key={m.id}
                    className="mx-auto max-w-[85%] rounded-lg bg-surface px-3 py-1.5 text-center text-[11px] text-ink-500"
                  >
                    {m.toolName ? `🔧 ${m.toolName}: ` : ""}
                    {m.content}
                  </p>
                );
              return (
                <div key={m.id} className={`flex ${isAi ? "justify-end" : "justify-start"}`}>
                  <div
                    className={`max-w-[80%] rounded-2xl px-3 py-2 text-[13px] ${
                      isAi
                        ? "rounded-br-sm bg-brand-500 text-white"
                        : "rounded-bl-sm bg-surface text-ink-900"
                    }`}
                  >
                    <p className="whitespace-pre-wrap break-words">{m.content}</p>
                    <p
                      className={`mt-1 text-right text-[9px] ${
                        isAi ? "text-white/60" : "text-ink-400"
                      }`}
                    >
                      {isAi ? "agente-Dt" : "cliente"} · {fmtTime(m.sentAt)}
                    </p>
                  </div>
                </div>
              );
            })
          ) : (
            <p className="py-10 text-center text-[12px] text-ink-500">Sem mensagens nesta conversa.</p>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Card do webhook ─────────────────────────────────────────────────────────

function WebhookCard({ unitId }: { unitId: number | null }) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  const unitsQ = useQuery({
    queryKey: ["agent", "units-for-webhook"],
    queryFn: () => unitsService.list(),
    staleTime: 5 * 60_000,
    enabled: open,
  });

  const base =
    (import.meta.env.VITE_API_BASE_URL as string | undefined)?.replace(/\/$/, "") || "";
  const unit = unitsQ.data?.find((u) => String(u.id) === String(unitId));
  const slug = unit?.slug;
  const url = slug ? `${base}/webhooks/agent/${slug}` : null;

  const copy = async () => {
    if (!url) return;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      toast.success("URL copiada");
      setTimeout(() => setCopied(false), 1500);
    } catch {
      toast.error("Não foi possível copiar");
    }
  };

  return (
    <div className="card mt-4 p-4">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center gap-2 text-left"
      >
        <Send className="h-4 w-4 text-brand-500" />
        <span className="text-[13px] font-semibold text-ink-900">
          Como conectar o agente-Dt (webhook)
        </span>
        <ChevronRight
          className={`ml-auto h-4 w-4 text-ink-400 transition-transform ${open ? "rotate-90" : ""}`}
        />
      </button>

      {open && (
        <div className="mt-3 space-y-3 text-[12px] text-ink-700">
          <p>
            Configure seu agente-Dt para enviar <b>POST</b> (JSON) com a conversa completa para a
            URL desta unidade. A cada atualização nós atualizamos a conversa pelo
            <code className="mx-1 rounded bg-surface-2 px-1">conversationId</code>.
          </p>

          {url ? (
            <div className="flex items-center gap-2 rounded-xl border border-hairline bg-surface-2 p-2">
              <code className="flex-1 truncate font-mono text-[12px] text-brand-500">{url}</code>
              <button
                type="button"
                onClick={copy}
                className="inline-flex shrink-0 items-center gap-1 rounded-lg bg-brand-500 px-2.5 py-1 text-[11px] font-semibold text-white"
              >
                {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                {copied ? "Copiado" : "Copiar"}
              </button>
            </div>
          ) : (
            <p className="rounded-xl border border-amber-400/30 bg-amber-400/10 px-3 py-2 text-amber-600">
              {unitsQ.isLoading
                ? "Carregando unidade…"
                : "Selecione uma unidade (com slug) para ver a URL do webhook."}
            </p>
          )}

          <details className="rounded-xl border border-hairline bg-surface-2 p-3">
            <summary className="cursor-pointer text-[12px] font-semibold text-ink-700">
              Ver formato do JSON
            </summary>
            <pre className="mt-2 overflow-x-auto rounded-lg bg-ink-950/90 p-3 text-[11px] leading-relaxed text-emerald-200">
{`{
  "conversationId": "wa-5563999998888",
  "agent": "agente-Dt",
  "channel": "whatsapp",
  "status": "active",
  "contact": { "name": "Maria", "phone": "5563999998888" },
  "summary": "Quer agendar avaliação",
  "intent": "agendamento",
  "sentiment": "positivo",
  "handoff": false,
  "messages": [
    { "role": "user", "content": "Oi", "at": "2026-06-02T12:00:00Z" },
    { "role": "assistant", "content": "Olá! Posso ajudar?", "at": "2026-06-02T12:00:05Z" }
  ]
}`}
            </pre>
          </details>
        </div>
      )}
    </div>
  );
}

// ─── Auxiliares ──────────────────────────────────────────────────────────────

function ListSkeleton() {
  return (
    <div className="divide-y divide-hairline">
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="flex items-center gap-3 px-3 py-3">
          <div className="h-10 w-10 shrink-0 animate-pulse rounded-full bg-surface-2" />
          <div className="flex-1 space-y-2">
            <div className="h-3 w-1/3 animate-pulse rounded bg-surface-2" />
            <div className="h-2.5 w-2/3 animate-pulse rounded bg-surface-2" />
          </div>
        </div>
      ))}
    </div>
  );
}

function EmptyState({ webhookConfigured }: { webhookConfigured: boolean }) {
  return (
    <div className="px-4 py-12 text-center">
      <span className="mx-auto mb-3 grid h-12 w-12 place-items-center rounded-2xl bg-brand-500/10 text-brand-500">
        <Bot className="h-6 w-6" />
      </span>
      <p className="text-[13px] font-semibold text-ink-900">
        {webhookConfigured ? "Nenhuma conversa neste filtro" : "Ainda não há conversas da I.A."}
      </p>
      <p className="mx-auto mt-1 max-w-sm text-[12px] text-ink-500">
        {webhookConfigured
          ? "Ajuste os filtros acima para ver outras conversas."
          : "Conecte o agente-Dt ao webhook abaixo para que as conversas apareçam aqui."}
      </p>
    </div>
  );
}
