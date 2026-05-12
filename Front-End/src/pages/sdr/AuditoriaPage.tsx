import { useMemo, useState } from "react";
import {
  Activity,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  ClipboardList,
  Edit3,
  FileSearch,
  Filter,
  Plus,
  Search,
  ShieldCheck,
  Sparkles,
  Trash2,
  XCircle,
} from "@/components/icons";
import { PageHeader } from "@/components/layout/PageHeader";
import { useIsClient, useSdrStore } from "@/lib/sdr/sdr-store";
import type { SdrAuditLog } from "@/types/sdr";
import { cn, formatDate, formatNumber } from "@/lib/utils";

type ActionFilter = "todas" | "review_approved" | "review_rejected" | "created" | "updated" | "deleted";

const ACTION_META: Record<
  string,
  { label: string; tone: "emerald" | "rose" | "sky" | "amber" | "violet" | "slate"; icon: typeof Activity }
> = {
  "sdr_lead.review_approved": { label: "Revisão aprovada", tone: "emerald", icon: CheckCircle2 },
  "sdr_lead.review_rejected": { label: "Revisão rejeitada", tone: "rose", icon: XCircle },
  "sdr_lead.created_manual": { label: "Lead manual criado", tone: "sky", icon: Plus },
  "sdr_lead.created_cloudia": { label: "Lead Cloudia criado", tone: "emerald", icon: Sparkles },
  "sdr_lead.created_importado": { label: "Lead importado", tone: "amber", icon: Plus },
  "sdr_lead.updated": { label: "Lead editado", tone: "sky", icon: Edit3 },
  "sdr_lead.deleted": { label: "Lead removido", tone: "rose", icon: Trash2 },
  "sdr_consulta.created": { label: "Consulta criada", tone: "violet", icon: Plus },
  "sdr_consulta.updated": { label: "Consulta editada", tone: "violet", icon: Edit3 },
  "sdr_consulta.deleted": { label: "Consulta removida", tone: "rose", icon: Trash2 },
  "sdr_tratamento.created": { label: "Tratamento criado", tone: "violet", icon: Plus },
  "sdr_tratamento.deleted": { label: "Tratamento removido", tone: "rose", icon: Trash2 },
  "sdr_tarefa.created": { label: "Tarefa criada", tone: "amber", icon: Plus },
  "sdr_tarefa.updated": { label: "Tarefa editada", tone: "amber", icon: Edit3 },
  "sdr_tarefa.deleted": { label: "Tarefa removida", tone: "rose", icon: Trash2 },
  "sdr_agenda.created": { label: "Evento criado", tone: "sky", icon: Plus },
  "sdr_agenda.updated": { label: "Evento editado", tone: "sky", icon: Edit3 },
  "sdr_agenda.deleted": { label: "Evento removido", tone: "rose", icon: Trash2 },
  "sdr_meta.created": { label: "Meta criada", tone: "emerald", icon: Plus },
  "sdr_meta.updated": { label: "Meta atualizada", tone: "emerald", icon: Edit3 },
};

const TONE_CLASSES: Record<string, string> = {
  emerald: "bg-emerald-400/10 text-emerald-200 ring-emerald-400/20",
  rose: "bg-rose-400/10 text-rose-200 ring-rose-400/20",
  sky: "bg-sky-400/10 text-sky-200 ring-sky-400/20",
  amber: "bg-amber-400/10 text-amber-200 ring-amber-400/20",
  violet: "bg-violet-400/10 text-violet-200 ring-violet-400/20",
  slate: "bg-slate-500/10 text-slate-300 ring-slate-500/20",
};

export default function AuditoriaPage() {
  const ready = useIsClient();
  const { auditLogs } = useSdrStore();
  const [search, setSearch] = useState("");
  const [filterAction, setFilterAction] = useState<ActionFilter>("todas");
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  const filtered = useMemo(() => {
    let r = auditLogs;
    if (filterAction !== "todas") {
      r = r.filter((l) => l.action.includes(filterAction));
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      r = r.filter(
        (l) =>
          l.summary.toLowerCase().includes(q) ||
          (l.userName ?? "").toLowerCase().includes(q) ||
          (l.userEmail ?? "").toLowerCase().includes(q) ||
          l.action.toLowerCase().includes(q) ||
          l.entityId.toLowerCase().includes(q),
      );
    }
    return r;
  }, [auditLogs, search, filterAction]);

  // Agrupa por dia
  const grouped = useMemo(() => {
    const m: Record<string, SdrAuditLog[]> = {};
    for (const l of filtered) {
      const day = l.createdAt.slice(0, 10);
      (m[day] ??= []).push(l);
    }
    return Object.entries(m).sort(([a], [b]) => b.localeCompare(a));
  }, [filtered]);

  const counts = useMemo(() => {
    const m: Record<ActionFilter, number> = {
      todas: auditLogs.length,
      review_approved: 0,
      review_rejected: 0,
      created: 0,
      updated: 0,
      deleted: 0,
    };
    for (const l of auditLogs) {
      if (l.action.includes("review_approved")) m.review_approved++;
      else if (l.action.includes("review_rejected")) m.review_rejected++;
      else if (l.action.includes("created")) m.created++;
      else if (l.action.includes("updated")) m.updated++;
      else if (l.action.includes("deleted")) m.deleted++;
    }
    return m;
  }, [auditLogs]);

  return (
    <div>
      <PageHeader
        badge="Auditoria · Trilha completa"
        title="Auditoria do fluxo SDR"
        description="Toda decisão importante (aprovações, edições, exclusões) fica aqui — pra chefe consultar e o time conferir o histórico."
        actions={
          <div className="flex items-center gap-2 text-[11px] text-slate-400">
            <ShieldCheck className="h-3.5 w-3.5 text-emerald-300" />
            <span>{formatNumber(auditLogs.length)} entradas registradas</span>
          </div>
        }
      />

      {/* Filtros */}
      <div className="mb-4 flex flex-col gap-2 md:flex-row md:items-center">
        <div className="relative flex-1 md:max-w-sm">
          <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-500" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por usuário, lead, ação…"
            className="h-9 w-full rounded-md border border-white/[0.06] bg-white/[0.02] pl-8 pr-3 text-[12px] text-slate-200 placeholder:text-slate-500 focus:border-emerald-400/30 focus:outline-none"
          />
        </div>
        <div className="flex items-center gap-1.5 rounded-md border border-white/[0.06] bg-white/[0.02] px-1 py-1 overflow-x-auto">
          <span className="px-1.5 text-[10px] font-medium uppercase tracking-wider text-slate-500 shrink-0">
            <Filter className="-mt-px mr-1 inline h-3 w-3" />
            Ação
          </span>
          <Chip active={filterAction === "todas"} onClick={() => setFilterAction("todas")} count={counts.todas}>Todas</Chip>
          <Chip active={filterAction === "review_approved"} onClick={() => setFilterAction("review_approved")} count={counts.review_approved} tone="emerald">Aprovações</Chip>
          <Chip active={filterAction === "review_rejected"} onClick={() => setFilterAction("review_rejected")} count={counts.review_rejected} tone="rose">Rejeições</Chip>
          <Chip active={filterAction === "created"} onClick={() => setFilterAction("created")} count={counts.created}>Criados</Chip>
          <Chip active={filterAction === "updated"} onClick={() => setFilterAction("updated")} count={counts.updated}>Edições</Chip>
          <Chip active={filterAction === "deleted"} onClick={() => setFilterAction("deleted")} count={counts.deleted} tone="rose">Exclusões</Chip>
        </div>
      </div>

      {ready && grouped.length === 0 && (
        <div className="rounded-xl border border-dashed border-white/[0.06] bg-white/[0.01] py-16 text-center">
          <FileSearch className="mx-auto h-8 w-8 text-slate-600" />
          <p className="mt-2 text-[12px] text-slate-500">Nenhuma entrada de auditoria com esses filtros.</p>
          <p className="mt-1 text-[10.5px] text-slate-600">
            As entradas aparecem aqui automaticamente quando você aprova/rejeita revisões ou edita registros.
          </p>
        </div>
      )}

      {ready && grouped.length > 0 && (
        <div className="space-y-4">
          {grouped.map(([day, items]) => {
            const dt = new Date(day);
            const today = new Date().toISOString().slice(0, 10);
            const isToday = day === today;
            const label = dt.toLocaleDateString("pt-BR", {
              weekday: "long",
              day: "2-digit",
              month: "long",
              year: "numeric",
            });
            return (
              <div key={day} className="rounded-xl border border-white/[0.06] bg-white/[0.015]">
                <div className="flex items-center justify-between border-b border-white/[0.04] bg-white/[0.02] px-4 py-2.5">
                  <h3 className="text-[12px] font-semibold capitalize text-slate-200">{label}</h3>
                  <span
                    className={cn(
                      "rounded-full px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider ring-1 ring-inset",
                      isToday
                        ? "bg-emerald-400/10 text-emerald-300 ring-emerald-400/20"
                        : "bg-slate-500/10 text-slate-400 ring-slate-500/20",
                    )}
                  >
                    {isToday ? "Hoje" : ""} · {items.length} {items.length === 1 ? "ação" : "ações"}
                  </span>
                </div>
                <ul className="divide-y divide-white/[0.04]">
                  {items.map((log) => {
                    const meta = ACTION_META[log.action] ?? {
                      label: log.action,
                      tone: "slate" as const,
                      icon: ClipboardList,
                    };
                    const Icon = meta.icon;
                    const isOpen = expanded[log.id] ?? false;
                    return (
                      <li key={log.id} className="px-4 py-3">
                        <div className="flex items-start gap-3">
                          <div
                            className={cn(
                              "flex h-7 w-7 shrink-0 items-center justify-center rounded-md ring-1 ring-inset",
                              TONE_CLASSES[meta.tone],
                            )}
                          >
                            <Icon className="h-3.5 w-3.5" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-baseline gap-2">
                              <span
                                className={cn(
                                  "shrink-0 rounded-md px-1.5 py-0.5 text-[10px] font-medium ring-1 ring-inset",
                                  TONE_CLASSES[meta.tone],
                                )}
                              >
                                {meta.label}
                              </span>
                              <span className="text-[10.5px] text-slate-500">
                                {log.entityType} #{log.entityId}
                              </span>
                            </div>
                            <p className="mt-1 text-[12.5px] text-slate-100">{log.summary}</p>
                            <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[10.5px] text-slate-500">
                              <span className="font-mono tabular-nums">
                                {formatDate(log.createdAt)}
                              </span>
                              <span className="text-slate-700">·</span>
                              <span>
                                {log.userName ?? log.userEmail ?? (
                                  <em className="text-slate-600">automático</em>
                                )}
                              </span>
                              {log.ipAddress && (
                                <>
                                  <span className="text-slate-700">·</span>
                                  <span className="font-mono">{log.ipAddress}</span>
                                </>
                              )}
                            </p>
                          </div>
                          {(log.beforeJson || log.afterJson) && (
                            <button
                              type="button"
                              onClick={() => setExpanded((e) => ({ ...e, [log.id]: !isOpen }))}
                              className="shrink-0 rounded-md border border-white/[0.06] bg-white/[0.02] p-1 text-slate-400 transition-colors hover:border-white/[0.15] hover:text-slate-200"
                              aria-label={isOpen ? "Recolher" : "Expandir diff"}
                            >
                              {isOpen ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
                            </button>
                          )}
                        </div>
                        {isOpen && (
                          <div className="mt-3 grid grid-cols-1 gap-2 border-t border-white/[0.04] pt-3 md:grid-cols-2">
                            {log.beforeJson && (
                              <JsonBlock label="Antes" json={log.beforeJson} tone="rose" />
                            )}
                            {log.afterJson && (
                              <JsonBlock label="Depois" json={log.afterJson} tone="emerald" />
                            )}
                          </div>
                        )}
                      </li>
                    );
                  })}
                </ul>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function Chip({
  active,
  onClick,
  count,
  tone = "default",
  children,
}: {
  active: boolean;
  onClick: () => void;
  count: number;
  tone?: "default" | "emerald" | "rose";
  children: React.ReactNode;
}) {
  const activeCls =
    tone === "emerald"
      ? "ring-emerald-400/30 bg-emerald-400/10 text-emerald-200"
      : tone === "rose"
      ? "ring-rose-400/30 bg-rose-400/10 text-rose-200"
      : "ring-emerald-400/30 bg-emerald-400/15 text-emerald-200";
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "inline-flex shrink-0 items-center gap-1 rounded px-2 py-1 text-[11px] font-medium ring-1 ring-inset transition-colors",
        active ? activeCls : "ring-white/[0.06] bg-transparent text-slate-400 hover:bg-white/[0.04]",
      )}
    >
      {children}
      <span
        className={cn(
          "rounded-full px-1.5 py-[1px] text-[9px] tabular-nums",
          active ? "bg-white/[0.08]" : "bg-white/[0.04] text-slate-500",
        )}
      >
        {count}
      </span>
    </button>
  );
}

function JsonBlock({ label, json, tone }: { label: string; json: string; tone: "emerald" | "rose" }) {
  let pretty = json;
  try {
    pretty = JSON.stringify(JSON.parse(json), null, 2);
  } catch {
    /* keep raw */
  }
  const cls =
    tone === "emerald"
      ? "border-emerald-400/20 bg-emerald-400/[0.03]"
      : "border-rose-400/20 bg-rose-400/[0.03]";
  return (
    <div className={cn("rounded-md border p-2", cls)}>
      <p className={cn("text-[10px] font-medium uppercase tracking-wider", tone === "emerald" ? "text-emerald-300" : "text-rose-300")}>
        {label}
      </p>
      <pre className="mt-1 max-h-48 overflow-auto whitespace-pre-wrap break-words text-[10.5px] leading-snug text-slate-300">
        {pretty}
      </pre>
    </div>
  );
}
