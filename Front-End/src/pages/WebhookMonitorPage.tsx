import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  Check,
  CheckCircle2,
  Copy,
  Loader2,
  RefreshCw,
  Search,
  Webhook,
  X,
  XCircle,
} from "@/components/icons";
import {
  webhooksMonitorService,
  type WebhookExecutionDetail,
  type WebhookExecutionStats,
  type WebhookExecutionSummary,
} from "@/services/webhooksMonitor";

type StatusFilter = "all" | "success" | "failed" | "ignored";
const REFRESH_MS = 10_000;

const inputClass =
  "w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder-slate-500 outline-none transition focus:border-brand-400/50";

function formatDuration(ms: number) {
  if (ms < 1000) return `${ms} ms`;
  return `${(ms / 1000).toFixed(2)} s`;
}

function formatRelative(iso: string) {
  const date = new Date(iso);
  const diff = Date.now() - date.getTime();
  const s = Math.floor(diff / 1000);
  if (s < 60) return `há ${s}s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `há ${m}min`;
  const h = Math.floor(m / 60);
  if (h < 24) return `há ${h}h`;
  return date.toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
}

function StatusBadge({ status }: { status: string }) {
  const map = {
    success: { label: "Sucesso", cls: "bg-emerald-500/15 text-emerald-300 border-emerald-400/30", icon: CheckCircle2 },
    failed: { label: "Falha", cls: "bg-rose-500/15 text-rose-300 border-rose-400/30", icon: XCircle },
    ignored: { label: "Ignorado", cls: "bg-amber-500/15 text-amber-300 border-amber-400/30", icon: AlertTriangle },
  } as Record<string, { label: string; cls: string; icon: typeof CheckCircle2 }>;
  const entry = map[status] ?? { label: status, cls: "bg-slate-700/40 text-slate-300 border-white/10", icon: AlertTriangle };
  const Icon = entry.icon;
  return (
    <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-semibold ${entry.cls}`}>
      <Icon className="h-3 w-3" />
      {entry.label}
    </span>
  );
}

function Kpi({ label, value, sub, tone }: { label: string; value: string | number; sub?: string; tone?: "success" | "fail" | "info" }) {
  const toneCls =
    tone === "success" ? "text-emerald-300"
    : tone === "fail" ? "text-rose-300"
    : "text-white";
  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
      <p className="text-xs uppercase tracking-wider text-slate-400">{label}</p>
      <p className={`mt-2 text-2xl font-bold ${toneCls}`}>{value}</p>
      {sub && <p className="mt-0.5 text-[11px] text-slate-500">{sub}</p>}
    </div>
  );
}

export default function WebhookMonitorPage() {
  const [items, setItems] = useState<WebhookExecutionSummary[]>([]);
  const [stats, setStats] = useState<WebhookExecutionStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [search, setSearch] = useState("");
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [selected, setSelected] = useState<WebhookExecutionDetail | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const firstLoadRef = useRef(true);

  const load = useCallback(async () => {
    try {
      const isFirst = firstLoadRef.current;
      if (isFirst) setLoading(true);
      else setRefreshing(true);

      const [list, st] = await Promise.all([
        webhooksMonitorService.list({
          status: statusFilter === "all" ? undefined : statusFilter,
          pageSize: 100,
        }),
        webhooksMonitorService.stats({}),
      ]);
      setItems(list.items);
      setStats(st);
      firstLoadRef.current = false;
    } catch (err) {
      console.error("Falha ao carregar webhooks", err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [statusFilter]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (!autoRefresh) return;
    const t = setInterval(load, REFRESH_MS);
    return () => clearInterval(t);
  }, [autoRefresh, load]);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return items;
    return items.filter((i) =>
      [i.slug, i.unitName, i.kommoSubdomain, i.errorMessage, i.ip, i.formKeys]
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(term)),
    );
  }, [items, search]);

  async function openDetail(id: number) {
    setLoadingDetail(true);
    try {
      const detail = await webhooksMonitorService.getById(id);
      setSelected(detail);
    } catch (err) {
      console.error("Falha ao buscar detalhe", err);
    } finally {
      setLoadingDetail(false);
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-500/15 ring-1 ring-brand-400/20">
            <Webhook className="h-6 w-6 text-brand-400" />
          </div>
          <div>
            <h1 className="text-xl font-semibold text-white sm:text-2xl">Monitor de Webhooks</h1>
            <p className="text-sm text-slate-400">
              Cada chamada recebida em <code className="rounded bg-white/5 px-1 text-[11px]">/webhooks/kommo/{`{slug}`}</code> aparece aqui — sucesso, falha e payload bruto.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <label className="flex cursor-pointer items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs text-slate-300">
            <input
              type="checkbox"
              checked={autoRefresh}
              onChange={(e) => setAutoRefresh(e.target.checked)}
              className="h-3.5 w-3.5 accent-brand-500"
            />
            Auto-refresh 10s
          </label>
          <button
            onClick={load}
            disabled={refreshing}
            className="inline-flex items-center gap-2 rounded-xl bg-brand-500 px-4 py-2 text-sm font-semibold text-white shadow-lg shadow-brand-500/20 transition hover:bg-brand-400 disabled:opacity-50"
          >
            <RefreshCw className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />
            Atualizar
          </button>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-6">
        <Kpi label="Total" value={stats?.total ?? "—"} />
        <Kpi label="Sucessos" value={stats?.success ?? 0} tone="success" />
        <Kpi label="Falhas" value={stats?.failed ?? 0} tone="fail" />
        <Kpi label="Ignorados" value={stats?.ignored ?? 0} />
        <Kpi label="Leads gravados" value={stats?.leadsPersisted ?? 0} tone="success" />
        <Kpi
          label="Duração média"
          value={stats ? `${stats.avgDurationMs} ms` : "—"}
          sub={stats?.lastFailureAt ? `Última falha: ${formatRelative(stats.lastFailureAt)}` : undefined}
          tone="info"
        />
      </div>

      {/* Filtros */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por slug, unidade, erro, IP, chave do form…"
            className={`${inputClass} pl-9`}
          />
        </div>
        <div className="flex gap-1 rounded-xl border border-white/10 bg-white/5 p-1">
          {(["all", "success", "failed", "ignored"] as StatusFilter[]).map((s) => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                statusFilter === s
                  ? "bg-brand-500 text-white"
                  : "text-slate-400 hover:bg-white/5 hover:text-white"
              }`}
            >
              {s === "all" ? "Todos" : s === "success" ? "Sucesso" : s === "failed" ? "Falha" : "Ignorado"}
            </button>
          ))}
        </div>
      </div>

      {/* Tabela */}
      <div className="overflow-hidden rounded-2xl border border-white/10 bg-white/[0.02]">
        {loading ? (
          <div className="flex items-center gap-2 p-8 text-sm text-slate-400">
            <Loader2 className="h-4 w-4 animate-spin" /> Carregando…
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center gap-2 p-12 text-center text-sm text-slate-400">
            <Webhook className="h-8 w-8 text-slate-600" />
            <p>Nenhuma execução de webhook recebida ainda.</p>
            <p className="text-xs text-slate-500">
              Cole a URL do webhook no painel da Kommo e dispare um evento de teste.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px] text-sm">
              <thead className="border-b border-white/[0.05] bg-white/[0.02] text-[11px] uppercase tracking-wider text-slate-400">
                <tr>
                  <th className="px-3 py-2 text-left font-medium">Quando</th>
                  <th className="px-3 py-2 text-left font-medium">Unidade</th>
                  <th className="px-3 py-2 text-left font-medium">Slug</th>
                  <th className="px-3 py-2 text-left font-medium">Status</th>
                  <th className="px-3 py-2 text-right font-medium">Eventos</th>
                  <th className="px-3 py-2 text-right font-medium">Leads</th>
                  <th className="px-3 py-2 text-right font-medium">Duração</th>
                  <th className="px-3 py-2 text-left font-medium">Erro / Form keys</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.04]">
                {filtered.map((it) => (
                  <tr
                    key={it.id}
                    onClick={() => openDetail(it.id)}
                    className="cursor-pointer transition hover:bg-white/[0.03]"
                  >
                    <td className="px-3 py-2 text-slate-300 whitespace-nowrap" title={new Date(it.receivedAt).toLocaleString("pt-BR")}>
                      {formatRelative(it.receivedAt)}
                    </td>
                    <td className="px-3 py-2 text-slate-200">
                      {it.unitName ?? <span className="text-slate-500">—</span>}
                    </td>
                    <td className="px-3 py-2">
                      <code className="rounded bg-white/5 px-1.5 py-0.5 text-[11px] text-slate-300">
                        {it.slug ?? "—"}
                      </code>
                    </td>
                    <td className="px-3 py-2"><StatusBadge status={it.status} /></td>
                    <td className="px-3 py-2 text-right text-slate-300">{it.eventsParsed}</td>
                    <td className="px-3 py-2 text-right">
                      <span className={it.leadsPersisted > 0 ? "font-semibold text-emerald-300" : "text-slate-500"}>
                        {it.leadsPersisted}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-right text-slate-400 whitespace-nowrap">{formatDuration(it.durationMs)}</td>
                    <td className="px-3 py-2 text-xs text-slate-400">
                      {it.errorMessage ? (
                        <span className="text-rose-300">{it.errorMessage}</span>
                      ) : (
                        <span className="font-mono text-[11px] text-slate-500">{it.formKeys ?? "—"}</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Detail drawer */}
      {selected && (
        <DetailDrawer
          detail={selected}
          loading={loadingDetail}
          onClose={() => setSelected(null)}
        />
      )}
    </div>
  );
}

function DetailDrawer({
  detail,
  loading,
  onClose,
}: {
  detail: WebhookExecutionDetail;
  loading: boolean;
  onClose: () => void;
}) {
  const [copied, setCopied] = useState<string | null>(null);

  async function copy(label: string, text: string) {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(label);
      setTimeout(() => setCopied((c) => (c === label ? null : c)), 1500);
    } catch { /* sem clipboard */ }
  }

  const prettyPayload = useMemo(() => {
    const raw = detail.rawPayload;
    if (!raw) return null;
    // Quebra os pares por &, decode, e indenta. Mantém a ordem original.
    return raw
      .split("&")
      .map((pair) => {
        const [k, v = ""] = pair.split("=");
        try {
          return `${decodeURIComponent(k)} = ${decodeURIComponent(v)}`;
        } catch {
          return `${k} = ${v}`;
        }
      })
      .join("\n");
  }, [detail.rawPayload]);

  return (
    <div className="fixed inset-0 z-50 flex">
      <div className="flex-1 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <aside className="flex w-full max-w-2xl flex-col overflow-y-auto bg-[#0f1117] shadow-2xl">
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-white/10 bg-[#0f1117] p-4">
          <div className="flex items-center gap-3">
            <StatusBadge status={detail.status} />
            <div>
              <h2 className="text-base font-semibold text-white">
                Execução #{detail.id}
              </h2>
              <p className="text-xs text-slate-400">
                {new Date(detail.receivedAt).toLocaleString("pt-BR")} · {formatDuration(detail.durationMs)}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-white/10 hover:text-white"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {loading ? (
          <div className="flex items-center gap-2 p-8 text-sm text-slate-400">
            <Loader2 className="h-4 w-4 animate-spin" /> Carregando detalhe…
          </div>
        ) : (
          <div className="space-y-5 p-4">
            <Section title="Resumo">
              <Field label="Provider" value={detail.provider} />
              <Field label="Slug" value={detail.slug ?? "—"} mono />
              <Field label="Unidade" value={detail.unitName ?? `(sem unidade) tenant ${detail.tenantId ?? "—"}`} />
              <Field label="Status HTTP" value={String(detail.statusCode)} />
              <Field label="Eventos parseados" value={String(detail.eventsParsed)} />
              <Field label="Leads gravados" value={String(detail.leadsPersisted)} />
            </Section>

            {detail.errorMessage && (
              <Section title="Erro" tone="fail">
                <pre className="overflow-x-auto rounded-lg bg-rose-500/5 p-3 text-xs text-rose-200">
                  {detail.errorMessage}
                </pre>
                {detail.errorStack && (
                  <details className="mt-2">
                    <summary className="cursor-pointer text-xs text-rose-300/80 hover:text-rose-200">Stack trace</summary>
                    <pre className="mt-2 overflow-x-auto rounded-lg bg-rose-500/5 p-3 text-[11px] text-rose-200/80">
                      {detail.errorStack}
                    </pre>
                  </details>
                )}
              </Section>
            )}

            <Section title="Request">
              <Field label="Método" value={detail.method} mono />
              <Field label="Path" value={detail.path} mono />
              <Field label="Content-Type" value={detail.contentType ?? "—"} mono />
              <Field label="Content-Length" value={detail.contentLength?.toString() ?? "—"} />
              <Field label="IP" value={detail.ip ?? "—"} mono />
              <Field label="User-Agent" value={detail.userAgent ?? "—"} mono small />
            </Section>

            <Section title="Kommo">
              <Field label="Account ID" value={detail.kommoAccountId ?? "—"} mono />
              <Field label="Subdomain" value={detail.kommoSubdomain ?? "—"} mono />
              <Field label="Top-level form keys" value={detail.formKeys ?? "—"} mono />
              <Field label="Total de keys" value={String(detail.formKeyCount)} />
              {detail.eventsSummary && (
                <Field label="Breakdown" value={detail.eventsSummary} mono small />
              )}
            </Section>

            <Section
              title="Payload bruto"
              right={
                prettyPayload && (
                  <button
                    onClick={() => copy("payload", prettyPayload)}
                    className="inline-flex items-center gap-1 rounded-md border border-white/10 bg-white/5 px-2 py-1 text-[11px] text-slate-300 hover:bg-white/10"
                  >
                    {copied === "payload" ? <Check className="h-3 w-3 text-emerald-400" /> : <Copy className="h-3 w-3" />}
                    Copiar
                  </button>
                )
              }
            >
              {detail.payloadTruncated && (
                <p className="mb-2 text-[11px] text-amber-300">⚠️ Truncado em 50KB</p>
              )}
              <pre className="max-h-96 overflow-auto rounded-lg bg-black/30 p-3 text-[11px] leading-relaxed text-slate-300 whitespace-pre-wrap break-all">
                {prettyPayload ?? "(sem payload — corpo não era form-urlencoded)"}
              </pre>
            </Section>

            {detail.responseBody && (
              <Section
                title="Resposta enviada"
                right={
                  <button
                    onClick={() => copy("response", detail.responseBody ?? "")}
                    className="inline-flex items-center gap-1 rounded-md border border-white/10 bg-white/5 px-2 py-1 text-[11px] text-slate-300 hover:bg-white/10"
                  >
                    {copied === "response" ? <Check className="h-3 w-3 text-emerald-400" /> : <Copy className="h-3 w-3" />}
                    Copiar
                  </button>
                }
              >
                <pre className="overflow-auto rounded-lg bg-black/30 p-3 text-[11px] text-slate-300">
                  {(() => {
                    try { return JSON.stringify(JSON.parse(detail.responseBody!), null, 2); }
                    catch { return detail.responseBody; }
                  })()}
                </pre>
              </Section>
            )}
          </div>
        )}
      </aside>
    </div>
  );
}

function Section({
  title,
  right,
  tone,
  children,
}: {
  title: string;
  right?: React.ReactNode;
  tone?: "fail";
  children: React.ReactNode;
}) {
  const border = tone === "fail" ? "border-rose-400/30" : "border-white/10";
  return (
    <section className={`rounded-xl border ${border} bg-white/[0.02] p-3`}>
      <div className="mb-2 flex items-center justify-between">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400">{title}</h3>
        {right}
      </div>
      <div className="space-y-1.5">{children}</div>
    </section>
  );
}

function Field({
  label, value, mono = false, small = false,
}: {
  label: string; value: string; mono?: boolean; small?: boolean;
}) {
  return (
    <div className="flex flex-col gap-0.5 sm:flex-row sm:items-baseline sm:gap-3">
      <span className="min-w-[140px] text-[11px] uppercase tracking-wider text-slate-500">
        {label}
      </span>
      <span className={`break-all text-slate-200 ${mono ? "font-mono" : ""} ${small ? "text-[11px]" : "text-xs"}`}>
        {value}
      </span>
    </div>
  );
}
