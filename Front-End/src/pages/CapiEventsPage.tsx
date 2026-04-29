import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Activity, AlertTriangle, CheckCircle2, Layers, RefreshCw, Send, Sparkles, Zap,
} from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { EmptyState } from "@/components/ui/EmptyState";
import { useClinic } from "@/hooks/useClinic";
import { insightsService, type CapiEvent } from "@/services/insights";
import { cn, formatNumber, formatPercent } from "@/lib/utils";

const STATUS_TONE: Record<string, { dot: string; chip: string; label: string }> = {
  sent:    { dot: "bg-emerald-400", chip: "bg-emerald-500/12 text-emerald-200 ring-emerald-500/30", label: "Enviado" },
  failed:  { dot: "bg-rose-400",    chip: "bg-rose-500/12 text-rose-200 ring-rose-500/30",          label: "Falhou"  },
  deduped: { dot: "bg-sky-400",     chip: "bg-sky-500/12 text-sky-200 ring-sky-500/30",             label: "Deduped" },
  pending: { dot: "bg-amber-400",   chip: "bg-amber-500/12 text-amber-200 ring-amber-500/30",       label: "Pendente"},
  received:{ dot: "bg-slate-400",   chip: "bg-slate-500/12 text-slate-200 ring-slate-500/30",       label: "Recebido"},
};

export default function CapiEventsPage() {
  const { unitId } = useClinic();
  const qc = useQueryClient();
  const [status, setStatus] = useState<string>("");
  const [eventName, setEventName] = useState<string>("");
  const [page, setPage] = useState(1);

  const events = useQuery({
    queryKey: ["capi-events", unitId, status, eventName, page],
    queryFn: () => insightsService.listCapiEvents({
      unitId: unitId || undefined,
      status: status || undefined,
      eventName: eventName || undefined,
      page,
      pageSize: 50,
    }),
  });

  const retry = useMutation({
    mutationFn: (id: string) => insightsService.retryCapiEvent(id),
    onSuccess: () => {
      toast.success("Evento reenviado (mock)");
      qc.invalidateQueries({ queryKey: ["capi-events"] });
    },
  });

  const stats = events.data?.stats;
  const items = events.data?.items ?? [];
  const total = events.data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / 50));

  const eventNames = useMemo(() => Object.keys(stats?.byEventName ?? {}).sort(), [stats]);

  return (
    <div className="space-y-5 animate-in fade-in slide-in-from-bottom-2 duration-300">
      <PageHeader
        title="Meta Conversions API"
        description="Eventos enviados ao pixel server-side · dados mockados (plug-and-play)"
        badge="Insights"
      />

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <Kpi icon={<Layers />} label="Total" value={formatNumber(stats?.received ?? 0)} tone="slate" />
        <Kpi icon={<CheckCircle2 />} label="Enviados" value={formatNumber(stats?.sent ?? 0)} tone="emerald" />
        <Kpi icon={<AlertTriangle />} label="Falhas" value={formatNumber(stats?.failed ?? 0)} tone="red" />
        <Kpi icon={<Sparkles />} label="Deduped" value={formatNumber(stats?.deduped ?? 0)} tone="sky" />
        <Kpi icon={<Zap />} label="EMQ médio" value={String(stats?.averageEmqScore?.toFixed(1) ?? "—")} tone="violet" />
      </div>

      {/* filtros */}
      <div className="flex flex-wrap items-center gap-2 rounded-xl border border-white/[0.06] bg-white/[0.02] p-3">
        <span className="text-[11px] uppercase tracking-widest text-slate-500">Filtros</span>
        <select
          value={status}
          onChange={(e) => { setStatus(e.target.value); setPage(1); }}
          className="rounded-md bg-slate-900/60 border border-slate-800 text-[12px] px-2 py-1 text-slate-200"
        >
          <option value="">Todos status</option>
          <option value="sent">Enviado</option>
          <option value="failed">Falhou</option>
          <option value="deduped">Deduped</option>
          <option value="pending">Pendente</option>
        </select>
        <select
          value={eventName}
          onChange={(e) => { setEventName(e.target.value); setPage(1); }}
          className="rounded-md bg-slate-900/60 border border-slate-800 text-[12px] px-2 py-1 text-slate-200"
        >
          <option value="">Todos eventos</option>
          {eventNames.map((n) => <option key={n} value={n}>{n}</option>)}
        </select>
        <span className="ml-auto text-[11px] text-slate-500 tabular-nums">
          {formatPercent(stats?.successRate ?? 0)} sucesso · {formatPercent(stats?.dedupRate ?? 0)} dedup
        </span>
      </div>

      {/* tabela */}
      <div className="rounded-2xl bg-slate-900/70 ring-1 ring-slate-800/80 overflow-hidden">
        <div className="px-5 py-3 border-b border-slate-800/80 flex items-center gap-2">
          <Activity className="h-4 w-4 text-emerald-400" />
          <span className="text-sm font-semibold text-slate-100">Eventos CAPI</span>
          <span className="ml-auto text-[11px] text-slate-500">
            Página {page}/{totalPages} · {formatNumber(total)} eventos
          </span>
        </div>

        {events.isLoading ? (
          <div className="p-6 space-y-2">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="h-10 rounded-md bg-white/[0.03] animate-pulse" />
            ))}
          </div>
        ) : items.length ? (
          <div className="overflow-x-auto">
            <table className="w-full text-[12px]">
              <thead className="bg-slate-900/40">
                <tr className="text-slate-500 text-[10px] uppercase tracking-widest">
                  <th className="px-4 py-2.5 text-left">Evento</th>
                  <th className="px-4 py-2.5 text-left">Status</th>
                  <th className="px-4 py-2.5 text-left">Lead</th>
                  <th className="px-4 py-2.5 text-left">Quando</th>
                  <th className="px-4 py-2.5 text-center">Match</th>
                  <th className="px-4 py-2.5 text-right">EMQ</th>
                  <th className="px-4 py-2.5 text-right"></th>
                </tr>
              </thead>
              <tbody>
                {items.map((ev) => <Row key={ev.id} ev={ev} onRetry={() => retry.mutate(ev.id)} retrying={retry.isPending} />)}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="p-8"><EmptyState title="Sem eventos no período" /></div>
        )}

        {totalPages > 1 && (
          <div className="flex items-center justify-end gap-2 border-t border-slate-800/60 px-4 py-2.5">
            <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1}
              className="rounded-md bg-slate-800/70 px-2.5 py-1 text-[11px] text-slate-300 disabled:opacity-40">
              Anterior
            </button>
            <button onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page === totalPages}
              className="rounded-md bg-slate-800/70 px-2.5 py-1 text-[11px] text-slate-300 disabled:opacity-40">
              Próxima
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function Row({ ev, onRetry, retrying }: { ev: CapiEvent; onRetry: () => void; retrying: boolean }) {
  const tone = STATUS_TONE[ev.status] ?? STATUS_TONE.received;
  return (
    <tr className="border-t border-slate-800/40 hover:bg-slate-800/20">
      <td className="px-4 py-2.5">
        <div className="flex items-center gap-2">
          <Send className="h-3.5 w-3.5 text-slate-500" />
          <span className="font-medium text-slate-200">{ev.eventName}</span>
        </div>
      </td>
      <td className="px-4 py-2.5">
        <span className={cn("inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[10px] font-semibold ring-1 ring-inset", tone.chip)}>
          <span className={cn("h-1.5 w-1.5 rounded-full", tone.dot)} />
          {tone.label}
        </span>
      </td>
      <td className="px-4 py-2.5 text-slate-300 truncate max-w-[180px]">{ev.leadName ?? "—"}</td>
      <td className="px-4 py-2.5 text-slate-400 tabular-nums">
        {new Date(ev.eventTime).toLocaleString("pt-BR")}
      </td>
      <td className="px-4 py-2.5 text-center">
        <div className="inline-flex gap-1">
          <Pill on={ev.hasEmailHash} text="em" />
          <Pill on={ev.hasPhoneHash} text="ph" />
          <Pill on={ev.hasIp} text="ip" />
          <Pill on={ev.hasFbp} text="fbp" />
          <Pill on={ev.hasFbc} text="fbc" />
        </div>
      </td>
      <td className="px-4 py-2.5 text-right tabular-nums">
        <span className={cn("font-bold",
          (ev.emqScore ?? 0) >= 8 ? "text-emerald-300" :
          (ev.emqScore ?? 0) >= 6 ? "text-amber-300" : "text-rose-300"
        )}>{ev.emqScore?.toFixed(1) ?? "—"}</span>
      </td>
      <td className="px-4 py-2.5 text-right">
        {ev.status === "failed" && (
          <button onClick={onRetry} disabled={retrying}
            className="inline-flex items-center gap-1.5 rounded-md bg-emerald-500/10 px-2 py-1 text-[10px] text-emerald-300 ring-1 ring-emerald-500/30 hover:bg-emerald-500/20 disabled:opacity-40">
            <RefreshCw className="h-3 w-3" />
            Retry
          </button>
        )}
      </td>
    </tr>
  );
}

function Pill({ on, text }: { on: boolean; text: string }) {
  return (
    <span className={cn(
      "rounded-sm px-1 py-px text-[9px] font-bold uppercase",
      on ? "bg-emerald-500/15 text-emerald-300" : "bg-slate-800/50 text-slate-600",
    )}>{text}</span>
  );
}

function Kpi({ icon, label, value, tone }: {
  icon: React.ReactNode; label: string; value: string;
  tone: "slate" | "emerald" | "red" | "sky" | "violet";
}) {
  const c = {
    slate: "ring-slate-700/40 bg-slate-900/60 text-slate-200",
    emerald: "ring-emerald-500/30 bg-emerald-500/8 text-emerald-200",
    red: "ring-rose-500/30 bg-rose-500/8 text-rose-200",
    sky: "ring-sky-500/30 bg-sky-500/8 text-sky-200",
    violet: "ring-indigo-500/30 bg-indigo-500/8 text-indigo-200",
  }[tone];
  return (
    <div className={cn("rounded-xl p-4 ring-1 ring-inset", c)}>
      <div className="flex items-center justify-between mb-2">
        <span className="text-[10px] uppercase tracking-widest text-slate-500">{label}</span>
        <span className="h-7 w-7 rounded-md bg-white/5 grid place-items-center text-current">{icon}</span>
      </div>
      <p className="text-2xl font-extrabold tabular-nums">{value}</p>
    </div>
  );
}
