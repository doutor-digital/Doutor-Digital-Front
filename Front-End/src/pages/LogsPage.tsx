import { FormEvent, useEffect, useMemo, useState } from "react";
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
} from "lucide-react";
import { toast } from "sonner";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
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
            <div className="h-10 w-10 rounded-lg bg-gradient-to-br from-emerald-500 to-emerald-700 grid place-items-center shadow-lg">
              <Terminal className="h-5 w-5 text-white" />
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
          <p className="mt-4 text-[12.5px] text-slate-400 leading-relaxed">
            Esta área é isolada do app principal. Informe o usuário e a senha de
            administrador configurados no backend (seção <code className="text-slate-300">LogsAuth</code> do
            <code className="ml-1 text-slate-300">appsettings.json</code>).
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

        <div className="px-6 pb-6 text-[10.5px] text-slate-500 leading-relaxed border-t border-white/[0.05] pt-4">
          <p>
            <strong className="text-slate-400">Como definir a senha:</strong> edite
            <code className="mx-1 text-slate-300">LeadAnalytics.Api/appsettings.json</code>,
            seção <code className="text-slate-300">LogsAuth</code>:
          </p>
          <pre className="mt-2 rounded bg-black/40 px-2 py-1.5 text-[10.5px] text-slate-400 overflow-x-auto">{`"LogsAuth": {
  "Username": "admin",
  "Password": "sua-senha",
  "SessionTtlMinutes": 120
}`}</pre>
          <p className="mt-2">
            Ou via env vars: <code className="text-slate-300">LogsAuth__Username</code>,
            <code className="ml-1 text-slate-300">LogsAuth__Password</code>.
          </p>
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
            <div className="h-9 w-9 rounded-lg bg-gradient-to-br from-emerald-500 to-emerald-700 grid place-items-center shadow-lg">
              <Terminal className="h-4.5 w-4.5 text-white" />
            </div>
            <div className="min-w-0">
              <p className="text-[10px] font-medium uppercase tracking-[0.22em] text-slate-500">
                Observabilidade · Área restrita
              </p>
              <h1 className="text-[15px] font-semibold tracking-tight truncate">
                Logs da API · console ao vivo
              </h1>
            </div>
          </div>
          <div className="flex items-center gap-2">
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

      <main className="max-w-[1400px] mx-auto px-5 py-5 space-y-4">
        {/* KPIs por nível */}
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-2">
          {levelCounts.map(({ level: lvl, count, meta }) => {
            const Icon = meta.icon;
            const selected = level
              .split(",")
              .map((s) => s.trim())
              .filter(Boolean)
              .includes(lvl);
            return (
              <button
                key={lvl}
                type="button"
                onClick={() => setLevel(selected ? "" : lvl)}
                className={cn(
                  "flex items-center justify-between gap-2 rounded-xl border px-3 py-2.5 text-left transition",
                  "hover:bg-white/[0.04]",
                  selected ? meta.bg : "border-white/[0.06] bg-white/[0.02]"
                )}
              >
                <div className="flex items-center gap-2 min-w-0">
                  <Icon className={cn("h-4 w-4 shrink-0", meta.text)} />
                  <span className={cn("text-[10.5px] font-bold uppercase tracking-widest", meta.text)}>
                    {meta.label}
                  </span>
                </div>
                <span className="text-[15px] font-bold tabular-nums text-slate-100">
                  {count}
                </span>
              </button>
            );
          })}
        </div>

        {/* Filtros */}
        <div className="rounded-xl border border-white/[0.06] bg-[#0c0c10] p-4 space-y-3">
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
          <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-400">
            <div className="flex items-center gap-2">
              <span
                className={cn(
                  "inline-block h-1.5 w-1.5 rounded-full",
                  live ? "bg-emerald-400 animate-pulse" : "bg-slate-500"
                )}
              />
              {live ? `Ao vivo · atualizando a cada ${POLL_MS / 1000}s` : "Pausado"}
              {list.dataUpdatedAt > 0 && live && (
                <span className="text-slate-500">
                  · última resposta {timeAgo(new Date(list.dataUpdatedAt).toISOString())}
                </span>
              )}
            </div>
            <div className="tabular-nums">
              {returned} de {total} no buffer
              {isFiltering && <span className="ml-2 text-emerald-300">filtrado</span>}
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
            <div className="space-y-1.5 font-mono text-[12.5px]">
              {items.map((e) => (
                <LogRow
                  key={e.id}
                  entry={e}
                  expanded={expanded.has(e.id)}
                  onToggle={() => toggle(e.id)}
                  onCopy={() => copyEntry(e)}
                />
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

/* ─── Row ────────────────────────────────────────────────────────────── */

function LogRow({
  entry,
  expanded,
  onToggle,
  onCopy,
}: {
  entry: LogEntry;
  expanded: boolean;
  onToggle: () => void;
  onCopy: () => void;
}) {
  const meta = LEVEL_META[entry.level] ?? LEVEL_META.Information;
  const hasException = !!entry.exception;
  const canExpand = hasException || entry.message.length > 200;

  return (
    <div
      className={cn(
        "rounded-lg border bg-[#0a0a0d] transition",
        meta.bg,
        "hover:bg-white/[0.03]"
      )}
    >
      <div className="flex items-start gap-2 px-3 py-2">
        <button
          type="button"
          onClick={onToggle}
          disabled={!canExpand}
          className={cn(
            "h-5 w-5 shrink-0 grid place-items-center rounded text-slate-500 hover:text-slate-200 transition",
            !canExpand && "opacity-30 cursor-default"
          )}
        >
          {canExpand ? (
            expanded ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />
          ) : (
            <span className={cn("h-1.5 w-1.5 rounded-full", meta.dot)} />
          )}
        </button>

        <span className="text-[10.5px] tabular-nums text-slate-500 shrink-0 pt-[1px]">
          {formatTime(entry.timestamp)}
        </span>

        <span
          className={cn(
            "shrink-0 rounded px-1.5 py-0.5 text-[9.5px] font-bold uppercase tracking-widest",
            meta.text, meta.bg
          )}
        >
          {meta.label}
        </span>

        <span className="truncate text-[11px] text-slate-500 shrink-0 max-w-[200px]">
          {shortenCategory(entry.category)}
        </span>

        <div className="min-w-0 flex-1">
          <p className={cn("text-slate-200 break-words", !expanded && "line-clamp-2")}>
            {entry.message}
          </p>
          {(entry.path || entry.traceId) && (
            <div className="mt-0.5 flex flex-wrap items-center gap-2 text-[10.5px] text-slate-500">
              {entry.method && entry.path && (
                <Badge tone="slate" className="text-[9.5px]">
                  {entry.method} {entry.path}
                </Badge>
              )}
              {entry.traceId && (
                <span className="tabular-nums">trace: {entry.traceId.slice(0, 16)}</span>
              )}
            </div>
          )}
        </div>

        <button
          type="button"
          onClick={onCopy}
          title="Copiar entrada"
          className="h-6 w-6 shrink-0 grid place-items-center rounded text-slate-500 hover:text-slate-200 hover:bg-white/5 transition"
        >
          <Copy className="h-3.5 w-3.5" />
        </button>
      </div>

      {expanded && hasException && (
        <div className="border-t border-white/[0.05] px-3 py-2">
          <p className="mb-1 text-[9.5px] font-bold uppercase tracking-widest text-rose-300">
            Stack trace
          </p>
          <pre className="overflow-auto max-h-80 whitespace-pre-wrap text-[11px] leading-relaxed text-rose-200/90">
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
