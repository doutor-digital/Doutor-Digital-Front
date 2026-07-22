import { FormEvent, ReactNode, useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  AlertOctagon,
  AlertTriangle,
  Bug,
  ChevronDown,
  ChevronRight,
  Copy,
  Eye,
  EyeOff,
  Info,
  KeyRound,
  Loader2,
  Lock,
  LogOut,
  Pause,
  Play,
  RefreshCw,
  Search,
  ShieldCheck,
  Terminal,
  Trash2,
  TriangleAlert,
  User as UserIcon,
  Zap,
} from "@/components/icons";
import { toast } from "sonner";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import {
  logsService,
  LogsSessionExpiredError,
  type LogEntry,
  type LogLevel,
} from "@/services/logs";
import { cn } from "@/lib/utils";

const POLL_MS = 4000;

const LEVEL_META: Record<
  LogLevel | string,
  {
    label: string;
    dot: string;
    text: string;
    bg: string;
    icon: React.ElementType;
  }
> = {
  Trace: { label: "TRACE", dot: "bg-slate-500", text: "text-slate-400", bg: "bg-slate-500/10 border-slate-500/20", icon: Bug },
  Debug: { label: "DEBUG", dot: "bg-sky-500", text: "text-sky-300", bg: "bg-sky-500/10 border-sky-500/20", icon: Bug },
  Information: { label: "INFO", dot: "bg-emerald-500", text: "text-emerald-300", bg: "bg-emerald-500/10 border-emerald-500/20", icon: Info },
  Warning: { label: "WARN", dot: "bg-amber-500", text: "text-amber-300", bg: "bg-amber-500/10 border-amber-500/20", icon: TriangleAlert },
  Error: { label: "ERROR", dot: "bg-rose-500", text: "text-rose-300", bg: "bg-rose-500/10 border-rose-500/20", icon: AlertTriangle },
  Critical: { label: "CRIT", dot: "bg-fuchsia-500", text: "text-fuchsia-300", bg: "bg-fuchsia-500/10 border-fuchsia-500/20", icon: AlertOctagon },
};

const LEVEL_ORDER: LogLevel[] = [
  "Trace", "Debug", "Information", "Warning", "Error", "Critical",
];

export default function LogsPage() {
  const [authed, setAuthed] = useState<boolean>(() => logsService.hasSession());

  if (!authed) {
    return <LogsLoginGate onAuthed={() => setAuthed(true)} />;
  }
  return <LogsConsole onLogout={() => setAuthed(false)} />;
}

/* ═══════════════════════════════════════════════════════════════════
 *  Gate de login — admin + senha (config no backend)
 * ═══════════════════════════════════════════════════════════════════ */

function LogsLoginGate({ onAuthed }: { onAuthed: () => void }) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPwd, setShowPwd] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!username || !password) return;
    setLoading(true);
    setError(null);
    try {
      await logsService.login(username, password);
      toast.success("Acesso liberado");
      onAuthed();
    } catch (err) {
      const msg =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message
          ?? (err as { message?: string })?.message
          ?? "Falha ao autenticar.";
      setError(msg);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-[#070709] text-slate-100 flex items-center justify-center px-4">
      <div
        className={cn(
          "w-full max-w-md rounded-2xl border border-white/[0.06] bg-[#0c0c10]",
          "shadow-[0_24px_80px_-20px_rgba(0,0,0,0.6)] overflow-hidden"
        )}
      >
        <div className="px-6 pt-7 pb-5 border-b border-white/[0.05]">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg border border-white/[0.09] bg-white/[0.04] grid place-items-center">
              <Terminal className="h-5 w-5 text-slate-300" />
            </div>
            <div>
              <p className="text-[10px] font-medium uppercase tracking-[0.22em] text-slate-500">
                Área restrita
              </p>
              <h1 className="mt-0.5 text-[17px] font-semibold tracking-tight">
                Painel de logs da API
              </h1>
            </div>
          </div>
          <p className="mt-4 text-[12.5px] leading-relaxed text-slate-400">
            Console de erros e eventos da API, isolado do dashboard — quem entra
            aqui não acessa os dados das unidades. Use as credenciais de
            administrador do backend.
          </p>
        </div>

        <form onSubmit={onSubmit} className="px-6 py-5 space-y-4">
          <div>
            <label className="label">Usuário</label>
            <Input
              className="mt-1.5"
              icon={<UserIcon className="h-4 w-4" />}
              name="logs-username"
              autoComplete="off"
              autoFocus
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="admin"
            />
          </div>

          <div>
            <label className="label">Senha</label>
            <div className="relative mt-1.5">
              <Input
                type={showPwd ? "text" : "password"}
                icon={<KeyRound className="h-4 w-4" />}
                name="logs-password"
                autoComplete="off"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="pr-10"
              />
              <button
                type="button"
                onClick={() => setShowPwd((v) => !v)}
                className="absolute right-2 top-1/2 -translate-y-1/2 h-7 w-7 grid place-items-center rounded text-slate-500 hover:text-slate-200 hover:bg-white/5 transition"
                tabIndex={-1}
              >
                {showPwd ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
              </button>
            </div>
          </div>

          {error && (
            <div className="rounded-lg border border-rose-500/30 bg-rose-500/[0.08] px-3 py-2 text-[12px] text-rose-200">
              {error}
            </div>
          )}

          <Button
            type="submit"
            disabled={!username || !password || loading}
            className="w-full justify-center bg-emerald-500 hover:bg-emerald-400 text-emerald-950 font-semibold"
          >
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Autenticando…
              </>
            ) : (
              <>
                <ShieldCheck className="mr-2 h-4 w-4" />
                Entrar no painel
              </>
            )}
          </Button>
        </form>

        {/* Rodapé enxuto: instrução de configuração é assunto de servidor, não
            de tela de acesso — poluía e expunha detalhe interno para quem loga. */}
        <div className="flex items-center justify-between gap-3 border-t border-white/[0.05] px-6 py-4">
          <span className="text-[10.5px] text-slate-600">
            Doutor Digital · Observabilidade
          </span>
          <span className="inline-flex items-center gap-1.5 text-[10.5px] text-slate-600">
            <Lock className="h-3 w-3" />
            Sessão expira em 2 h
          </span>
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════
 *  Console — só roda quando autenticado
 * ═══════════════════════════════════════════════════════════════════ */

function LogsConsole({ onLogout }: { onLogout: () => void }) {
  const [level, setLevel] = useState<string>("");
  const [search, setSearch] = useState<string>("");
  const [sinceMinutes, setSinceMinutes] = useState<number>(0);
  const [limit, setLimit] = useState<number>(500);
  const [live, setLive] = useState<boolean>(true);
  const [expanded, setExpanded] = useState<Set<number>>(new Set());
  /** Entrada aberta no painel lateral — é onde se investiga um erro de fato. */
  const [detail, setDetail] = useState<LogEntry | null>(null);

  const list = useQuery({
    queryKey: ["logs", "list", level, search, sinceMinutes, limit],
    queryFn: () => logsService.list({ level, search, sinceMinutes, limit }),
    refetchInterval: live ? POLL_MS : false,
    refetchIntervalInBackground: true,
    retry: false,
  });

  const stats = useQuery({
    queryKey: ["logs", "stats", sinceMinutes],
    queryFn: () => logsService.stats(sinceMinutes || undefined),
    refetchInterval: live ? POLL_MS : false,
    retry: false,
  });

  // Se a sessão expirar enquanto estiver usando, cai de volta pro gate.
  useEffect(() => {
    const err = (list.error ?? stats.error) as unknown;
    if (err instanceof LogsSessionExpiredError) {
      toast.error("Sessão expirada — faça login de novo");
      onLogout();
    }
  }, [list.error, stats.error, onLogout]);

  const items: LogEntry[] = list.data?.items ?? [];
  const total = list.data?.total ?? 0;
  const returned = list.data?.returned ?? 0;
  const byLevel = stats.data?.byLevel ?? {};

  const levelCounts = useMemo(() => {
    return LEVEL_ORDER.map((l) => ({
      level: l as LogLevel,
      count: byLevel[l] ?? 0,
      meta: LEVEL_META[l],
    }));
  }, [byLevel]);

  function toggle(id: number) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function copyEntry(e: LogEntry) {
    const text = [
      `[${new Date(e.timestamp).toISOString()}] ${e.level} ${e.category}`,
      e.path && `${e.method ?? ""} ${e.path}`,
      e.traceId && `trace: ${e.traceId}`,
      "",
      e.message,
      e.exception && `\n${e.exception}`,
    ]
      .filter(Boolean)
      .join("\n");
    try {
      await navigator.clipboard.writeText(text);
      toast.success("Log copiado");
    } catch {
      toast.error("Falha ao copiar");
    }
  }

  async function handleClear() {
    if (!window.confirm("Apagar todos os logs do buffer em memória?")) return;
    try {
      await logsService.clear();
      toast.success("Buffer de logs esvaziado");
      list.refetch();
      stats.refetch();
    } catch {
      /* handler já trata 401 */
    }
  }

  async function handleLogout() {
    await logsService.logout();
    toast.success("Sessão encerrada");
    onLogout();
  }

  const isFiltering = !!(level || search || sinceMinutes);

  return (
    <div className="min-h-screen bg-[#070709] text-slate-100">
      {/* Topbar próprio (não compartilha com o app principal) */}
      <header className="sticky top-0 z-20 border-b border-white/[0.05] bg-[#0a0a0d]/95 backdrop-blur">
        <div className="max-w-[1400px] mx-auto flex items-center justify-between px-5 py-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="h-9 w-9 rounded-lg border border-white/[0.09] bg-white/[0.04] grid place-items-center">
              <Terminal className="h-4 w-4 text-slate-300" />
            </div>
            <div className="min-w-0">
              <p className="text-[10px] font-medium uppercase tracking-[0.22em] text-slate-500">
                Observabilidade · Área restrita
              </p>
              <div className="flex items-center gap-2.5">
                <h1 className="text-[15px] font-semibold tracking-tight truncate">
                  Logs da API
                </h1>
                <span
                  className={cn(
                    "inline-flex items-center gap-1.5 rounded-full border px-2 py-[2px] text-[10px] font-medium",
                    live
                      ? "border-emerald-400/25 bg-emerald-400/10 text-emerald-300"
                      : "border-white/[0.08] bg-white/[0.03] text-slate-400",
                  )}
                >
                  <span
                    className={cn(
                      "h-1.5 w-1.5 rounded-full",
                      live ? "bg-emerald-400 animate-pulse" : "bg-slate-500",
                    )}
                  />
                  {live ? "ao vivo" : "pausado"}
                </span>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {/* Atalho mais usado ao investigar: isolar só o que quebrou. */}
            <Button
              variant="outline"
              size="sm"
              onClick={() =>
                setLevel((v) => (v === "Error,Critical" ? "" : "Error,Critical"))
              }
              className={cn(
                level === "Error,Critical" &&
                  "border-rose-500/40 bg-rose-500/10 text-rose-200",
              )}
              title="Mostrar apenas erros e falhas críticas"
            >
              <AlertTriangle className="mr-2 h-4 w-4" />
              Só erros
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setLive((v) => !v)}
              title={live ? "Pausar atualização automática" : "Retomar atualização automática"}
            >
              {live ? (
                <><Pause className="mr-2 h-4 w-4" /> Pausar</>
              ) : (
                <><Play className="mr-2 h-4 w-4" /> Ao vivo</>
              )}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => { list.refetch(); stats.refetch(); }}
              disabled={list.isFetching}
            >
              <RefreshCw className={cn("mr-2 h-4 w-4", list.isFetching && "animate-spin")} />
              Atualizar
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleClear}
              className="text-rose-200 border-rose-500/25 hover:bg-rose-500/10"
            >
              <Trash2 className="mr-2 h-4 w-4" />
              Limpar
            </Button>
            <Button variant="ghost" size="sm" onClick={handleLogout}>
              <LogOut className="mr-2 h-4 w-4" />
              Sair
            </Button>
          </div>
        </div>
      </header>

      <main className="max-w-[1400px] mx-auto px-5 py-6 space-y-5">
        {/* Contagem por nível — clicar filtra. O número é o protagonista:
            bate o olho e vê onde está o problema. */}
        <section>
          <div className="mb-2.5 flex items-baseline justify-between">
            <h2 className="text-[12px] font-medium uppercase tracking-[0.16em] text-slate-500">
              Ocorrências por nível
            </h2>
            <span className="text-[11.5px] text-slate-600">clique para filtrar</span>
          </div>
          <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 md:grid-cols-6">
            {levelCounts.map(({ level: lvl, count, meta }) => {
              const Icon = meta.icon;
              const selected = level
                .split(",")
                .map((s) => s.trim())
                .filter(Boolean)
                .includes(lvl);
              const empty = count === 0;
              return (
                <button
                  key={lvl}
                  type="button"
                  onClick={() => setLevel(selected ? "" : lvl)}
                  aria-pressed={selected}
                  className={cn(
                    "group relative overflow-hidden rounded-xl border px-3.5 py-3 text-left transition",
                    "focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-400/40",
                    selected
                      ? "border-white/20 bg-white/[0.07]"
                      : "border-white/[0.06] bg-white/[0.02] hover:border-white/[0.12] hover:bg-white/[0.04]",
                  )}
                >
                  {/* Faixa de cor do nível — some quando não há ocorrência. */}
                  <span
                    className={cn(
                      "absolute inset-x-0 top-0 h-[2px] transition-opacity",
                      meta.dot,
                      empty && !selected ? "opacity-25" : "opacity-100",
                    )}
                  />
                  <div className="flex items-center gap-1.5">
                    <Icon className={cn("h-3.5 w-3.5 shrink-0", empty ? "text-slate-600" : meta.text)} />
                    <span
                      className={cn(
                        "text-[10px] font-semibold uppercase tracking-[0.12em]",
                        empty ? "text-slate-600" : meta.text,
                      )}
                    >
                      {meta.label}
                    </span>
                  </div>
                  <p
                    className={cn(
                      "mt-1.5 text-[26px] font-semibold leading-none tabular-nums tracking-tight",
                      empty ? "text-slate-700" : "text-slate-50",
                    )}
                  >
                    {count}
                  </p>
                </button>
              );
            })}
          </div>
        </section>

        {/* Filtros */}
        <div className="rounded-xl border border-white/[0.06] bg-[#0b0b0f] p-4 space-y-3.5">
          <div className="flex items-center justify-between">
            <h2 className="text-[12px] font-medium uppercase tracking-[0.16em] text-slate-500">
              Filtros
            </h2>
            {isFiltering && (
              <button
                type="button"
                onClick={() => {
                  setLevel("");
                  setSearch("");
                  setSinceMinutes(0);
                }}
                className="text-[11.5px] text-slate-400 underline-offset-4 transition hover:text-slate-200 hover:underline"
              >
                Limpar filtros
              </button>
            )}
          </div>
          <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
            <div className="md:col-span-6">
              <label className="label">Buscar no texto</label>
              <Input
                className="mt-1"
                icon={<Search className="h-4 w-4" />}
                placeholder="ex.: exception, userId, path, stack trace…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <div className="md:col-span-2">
              <label className="label">Nível</label>
              <Select
                className="mt-1"
                value={level}
                onChange={(e) => setLevel(e.target.value)}
              >
                <option value="">Todos</option>
                {LEVEL_ORDER.map((l) => (
                  <option key={l} value={l}>
                    {LEVEL_META[l].label}
                  </option>
                ))}
                <option value="Error,Critical">Apenas falhas</option>
                <option value="Warning,Error,Critical">Warnings+</option>
              </Select>
            </div>
            <div className="md:col-span-2">
              <label className="label">Janela</label>
              <Select
                className="mt-1"
                value={sinceMinutes}
                onChange={(e) => setSinceMinutes(+e.target.value)}
              >
                <option value={0}>Tudo no buffer</option>
                <option value={5}>Últimos 5 min</option>
                <option value={15}>Últimos 15 min</option>
                <option value={60}>Última 1 h</option>
                <option value={360}>Últimas 6 h</option>
                <option value={1440}>Últimas 24 h</option>
              </Select>
            </div>
            <div className="md:col-span-2">
              <label className="label">Máx. linhas</label>
              <Select
                className="mt-1"
                value={limit}
                onChange={(e) => setLimit(+e.target.value)}
              >
                <option value={100}>100</option>
                <option value={250}>250</option>
                <option value={500}>500</option>
                <option value={1000}>1000</option>
                <option value={2000}>2000</option>
              </Select>
            </div>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-white/[0.05] pt-3 text-[11.5px]">
            <div className="flex items-center gap-2 text-slate-400">
              <span
                className={cn(
                  "inline-block h-2 w-2 rounded-full",
                  live ? "bg-emerald-400 animate-pulse" : "bg-slate-600",
                )}
              />
              <span className={live ? "text-emerald-300/90" : "text-slate-500"}>
                {live ? "Ao vivo" : "Pausado"}
              </span>
              <span className="text-slate-600">
                {live
                  ? `atualiza a cada ${POLL_MS / 1000}s`
                  : "clique em “Ao vivo” para retomar"}
              </span>
              {list.dataUpdatedAt > 0 && live && (
                <span className="text-slate-600">
                  · {timeAgo(new Date(list.dataUpdatedAt).toISOString())}
                </span>
              )}
            </div>
            <div className="flex items-center gap-2 tabular-nums text-slate-400">
              <span>
                <span className="font-medium text-slate-200">{returned}</span> de {total} no buffer
              </span>
              {isFiltering && (
                <span className="rounded border border-sky-400/30 bg-sky-400/10 px-1.5 py-[1px] text-[10.5px] text-sky-200">
                  filtrado
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Lista */}
        <div>
          {list.isLoading ? (
            <div className="space-y-2">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="skeleton h-14 w-full rounded-lg" />
              ))}
            </div>
          ) : list.isError ? (
            <div className="rounded-xl border border-white/[0.06] bg-[#0c0c10] p-8">
              <EmptyState
                icon={<Zap className="h-5 w-5 text-rose-400" />}
                title="Falha ao carregar os logs"
                description="Verifique se a API está acessível."
              />
            </div>
          ) : items.length === 0 ? (
            <div className="rounded-xl border border-white/[0.06] bg-[#0c0c10] p-8">
              <EmptyState
                icon={<Info className="h-5 w-5 text-slate-400" />}
                title="Nada por aqui"
                description={
                  isFiltering
                    ? "Nenhum log bate com os filtros atuais — ajuste ou limpe o filtro."
                    : "O buffer está vazio. Faça uma requisição pra API e os logs vão aparecer."
                }
              />
            </div>
          ) : (
            /* Painel único com linhas contínuas — um console de verdade lê
               melhor do que dezenas de cards coloridos soltos. */
            <div className="overflow-hidden rounded-xl border border-white/[0.06] bg-[#0a0a0d]">
              <div className="hidden md:flex items-center gap-3 border-b border-white/[0.06] bg-white/[0.015] px-3 py-2 text-[10px] font-medium uppercase tracking-[0.14em] text-slate-500">
                <span className="w-5" />
                <span className="w-[68px]">Hora</span>
                <span className="w-[52px]">Nível</span>
                <span className="w-[150px]">Origem</span>
                <span className="flex-1">Mensagem</span>
                <span className="w-6" />
              </div>
              <div className="divide-y divide-white/[0.045]">
                {items.map((e) => (
                  <LogRow
                    key={e.id}
                    entry={e}
                    expanded={expanded.has(e.id)}
                    onToggle={() => toggle(e.id)}
                    onCopy={() => copyEntry(e)}
                    onOpen={() => setDetail(e)}
                    selected={detail?.id === e.id}
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      </main>

      <LogDetailPanel
        entry={detail}
        onClose={() => setDetail(null)}
        onCopy={copyEntry}
        onFilterTrace={(traceId) => {
          setSearch(traceId);
          setLevel("");
          setDetail(null);
          toast.success("Filtrando por este request");
        }}
      />
    </div>
  );
}

/* ─── Painel de detalhe ──────────────────────────────────────────────────
 * Investigar um erro exige ver a entrada inteira: mensagem sem corte, stack
 * trace legível, rota, request. Numa linha de lista isso não cabe — por isso
 * um painel lateral, que abre ao clicar e não perde a lista de vista.
 * ───────────────────────────────────────────────────────────────────────── */

function LogDetailPanel({
  entry,
  onClose,
  onCopy,
  onFilterTrace,
}: {
  entry: LogEntry | null;
  onClose: () => void;
  onCopy: (e: LogEntry) => void;
  onFilterTrace: (traceId: string) => void;
}) {
  // Fecha no Esc — quem debuga vive no teclado.
  useEffect(() => {
    if (!entry) return;
    const onKey = (ev: KeyboardEvent) => {
      if (ev.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [entry, onClose]);

  if (!entry) return null;

  const meta = LEVEL_META[entry.level] ?? LEVEL_META.Information;

  return (
    <>
      <div
        className="fixed inset-0 z-30 bg-black/50 backdrop-blur-[2px]"
        onClick={onClose}
        aria-hidden
      />
      <aside className="fixed inset-y-0 right-0 z-40 flex w-full max-w-[560px] flex-col border-l border-white/[0.08] bg-[#0b0b0f] shadow-[0_0_60px_rgba(0,0,0,0.6)]">
        <header className="flex items-start justify-between gap-3 border-b border-white/[0.06] px-5 py-4">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className={cn("h-2 w-2 rounded-full", meta.dot)} />
              <span className={cn("text-[11px] font-semibold uppercase tracking-[0.14em]", meta.text)}>
                {meta.label}
              </span>
            </div>
            <h2 className="mt-1.5 text-[15px] font-semibold tracking-tight text-slate-100">
              Detalhe da ocorrência
            </h2>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => onCopy(entry)}>
              <Copy className="mr-2 h-4 w-4" />
              Copiar
            </Button>
            <Button variant="ghost" size="sm" onClick={onClose} title="Fechar (Esc)">
              Fechar
            </Button>
          </div>
        </header>

        <div className="flex-1 space-y-5 overflow-y-auto px-5 py-5">
          <Field label="Mensagem">
            <p className="whitespace-pre-wrap break-words text-[13px] leading-relaxed text-slate-100">
              {entry.message}
            </p>
          </Field>

          <div className="grid grid-cols-2 gap-4">
            <Field label="Quando">
              <p className="text-[12.5px] tabular-nums text-slate-300">
                {new Date(entry.timestamp).toLocaleString("pt-BR")}
              </p>
            </Field>
            <Field label="Origem">
              <p className="break-all text-[12.5px] text-slate-300">{entry.category}</p>
            </Field>
          </div>

          {(entry.method || entry.path) && (
            <Field label="Requisição">
              <p className="break-all text-[12.5px] text-slate-300">
                <span className="font-semibold text-slate-100">{entry.method}</span>{" "}
                {entry.path}
              </p>
            </Field>
          )}

          {entry.traceId && (
            <Field label="Trace">
              <div className="flex flex-wrap items-center gap-2">
                <code className="break-all rounded bg-black/40 px-2 py-1 text-[11.5px] text-slate-300">
                  {entry.traceId}
                </code>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => onFilterTrace(entry.traceId!)}
                  title="Ver todos os logs desta mesma requisição"
                >
                  <Search className="mr-2 h-3.5 w-3.5" />
                  Ver o request inteiro
                </Button>
              </div>
            </Field>
          )}

          {entry.exception && (
            <Field label="Stack trace">
              <pre className="max-h-[45vh] overflow-auto whitespace-pre-wrap rounded-md border border-white/[0.06] bg-black/40 p-3 text-[11.5px] leading-[1.7] text-rose-200/85">
                {entry.exception}
              </pre>
            </Field>
          )}
        </div>
      </aside>
    </>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500">
        {label}
      </p>
      {children}
    </div>
  );
}

/* ─── Row ────────────────────────────────────────────────────────────── */

function LogRow({
  entry,
  expanded,
  onToggle,
  onCopy,
  onOpen,
  selected,
}: {
  entry: LogEntry;
  expanded: boolean;
  onToggle: () => void;
  onCopy: () => void;
  onOpen: () => void;
  selected: boolean;
}) {
  const meta = LEVEL_META[entry.level] ?? LEVEL_META.Information;
  const hasException = !!entry.exception;
  const canExpand = hasException || entry.message.length > 160;
  const severe = entry.level === "Error" || entry.level === "Critical";

  return (
    <div
      className={cn(
        "group relative transition-colors",
        // Barra de nível na lateral em vez de pintar a linha inteira: dá pra
        // varrer a coluna e achar os erros sem o ruído de dezenas de caixas.
        "before:absolute before:inset-y-0 before:left-0 before:w-[3px] before:content-['']",
        meta.dot.replace("bg-", "before:bg-"),
        severe ? "bg-rose-500/[0.045]" : "bg-transparent",
        "hover:bg-white/[0.035]",
        expanded && "bg-white/[0.03]",
        selected && "bg-sky-500/[0.08] ring-1 ring-inset ring-sky-400/30",
      )}
    >
      {/* Clicar em qualquer lugar da linha abre o detalhe — é o gesto natural
          de quem está investigando. Os botões param a propagação. */}
      <div
        role="button"
        tabIndex={0}
        onClick={onOpen}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            onOpen();
          }
        }}
        className="flex cursor-pointer items-start gap-3 py-2 pl-3 pr-2 outline-none focus-visible:bg-white/[0.05]"
      >
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); onToggle(); }}
          disabled={!canExpand}
          aria-label={canExpand ? (expanded ? "Recolher" : "Expandir") : undefined}
          className={cn(
            "mt-[3px] h-5 w-5 shrink-0 grid place-items-center rounded text-slate-500 transition",
            canExpand ? "hover:bg-white/[0.06] hover:text-slate-200" : "cursor-default opacity-0",
          )}
        >
          {expanded ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
        </button>

        <span className="w-[68px] shrink-0 pt-[3px] text-[11.5px] tabular-nums text-slate-500">
          {formatTime(entry.timestamp)}
        </span>

        <span
          className={cn(
            "mt-[2px] w-[52px] shrink-0 text-[10px] font-semibold uppercase tracking-[0.1em]",
            meta.text,
          )}
        >
          {meta.label}
        </span>

        <span
          className="hidden md:block w-[150px] shrink-0 truncate pt-[3px] text-[11.5px] text-slate-500"
          title={entry.category}
        >
          {shortenCategory(entry.category)}
        </span>

        <div className="min-w-0 flex-1">
          {/* A mensagem é o conteúdo — ganha o maior tamanho da linha. */}
          <p
            className={cn(
              "text-[13px] leading-relaxed break-words",
              severe ? "text-rose-100" : "text-slate-200",
              !expanded && "line-clamp-2",
            )}
          >
            {entry.message}
          </p>

          {(entry.path || entry.traceId) && (
            <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-slate-500">
              {entry.method && entry.path && (
                <span className="rounded border border-white/[0.08] px-1.5 py-[1px] text-[10.5px] text-slate-400">
                  <span className="font-semibold text-slate-300">{entry.method}</span> {entry.path}
                </span>
              )}
              {entry.traceId && (
                <span className="tabular-nums">trace {entry.traceId.slice(0, 12)}</span>
              )}
              <span className="md:hidden">{shortenCategory(entry.category)}</span>
            </div>
          )}
        </div>

        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); onCopy(); }}
          title="Copiar entrada"
          className="mt-[2px] h-6 w-6 shrink-0 grid place-items-center rounded text-slate-600 opacity-0 transition group-hover:opacity-100 hover:bg-white/[0.06] hover:text-slate-200 focus:opacity-100"
        >
          <Copy className="h-3.5 w-3.5" />
        </button>
      </div>

      {expanded && hasException && (
        <div className="border-t border-white/[0.06] bg-black/30 px-3 py-3 pl-11">
          <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-rose-300/80">
            Stack trace
          </p>
          <pre className="max-h-80 overflow-auto whitespace-pre-wrap rounded-md border border-white/[0.05] bg-black/40 p-3 text-[11.5px] leading-[1.65] text-rose-200/80">
            {entry.exception}
          </pre>
        </div>
      )}
    </div>
  );
}

/* ─── helpers ───────────────────────────────────────────────────────── */

function formatTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
}

function shortenCategory(cat: string): string {
  const parts = cat.split(".");
  return parts[parts.length - 1] ?? cat;
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  if (diff < 1000) return "agora";
  const s = Math.floor(diff / 1000);
  if (s < 60) return `há ${s}s`;
  const m = Math.floor(s / 60);
  return `há ${m}min`;
}
