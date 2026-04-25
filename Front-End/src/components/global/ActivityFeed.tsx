import { useEffect, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Activity,
  CheckCircle2,
  ChevronRight,
  Clock,
  PhoneCall,
  RefreshCw,
  UserPlus,
  X,
  Zap,
} from "lucide-react";
import { Link } from "react-router-dom";
import { useGlobalUI } from "@/hooks/useGlobalUI";
import { useClinic } from "@/hooks/useClinic";
import { webhooksService } from "@/services/webhooks";
import { cn } from "@/lib/utils";
import type { ActiveLeadDto } from "@/types";

type FeedItem = {
  id: string;
  kind: "lead-new" | "lead-attended" | "lead-queue" | "lead-update";
  title: string;
  subtitle: string;
  ts: number;
  to?: string;
};

const KIND_META: Record<FeedItem["kind"], { icon: typeof Activity; color: string; ring: string }> = {
  "lead-new":      { icon: UserPlus,    color: "text-emerald-300", ring: "ring-emerald-400/20 bg-emerald-400/10" },
  "lead-attended": { icon: CheckCircle2, color: "text-sky-300",     ring: "ring-sky-400/20 bg-sky-400/10" },
  "lead-queue":    { icon: PhoneCall,   color: "text-amber-300",   ring: "ring-amber-400/20 bg-amber-400/10" },
  "lead-update":   { icon: Zap,         color: "text-violet-300",  ring: "ring-violet-400/20 bg-violet-400/10" },
};

function relativeTime(ts: number): string {
  const diff = Date.now() - ts;
  const sec = Math.floor(diff / 1000);
  if (sec < 60) return "agora";
  const min = Math.floor(sec / 60);
  if (min < 60) return `há ${min} min`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `há ${hr}h`;
  const d = Math.floor(hr / 24);
  return `há ${d}d`;
}

function leadToItems(leads: ActiveLeadDto[]): FeedItem[] {
  return leads
    .map<FeedItem>((l) => {
      const updated = new Date(l.updatedAt).getTime();
      const created = new Date(l.createdAt).getTime();
      const isNew = updated - created < 60_000;
      const state = (l.conversationState ?? "").toLowerCase();

      const kind: FeedItem["kind"] = isNew
        ? "lead-new"
        : state.includes("queue")
          ? "lead-queue"
          : state.includes("service") || state.includes("attend")
            ? "lead-attended"
            : "lead-update";

      const name = l.name?.trim() || (l.phone ? `Contato ${l.phone}` : `Lead #${l.id}`);

      const titleByKind: Record<FeedItem["kind"], string> = {
        "lead-new":      `Novo lead: ${name}`,
        "lead-attended": `${name} em atendimento`,
        "lead-queue":    `${name} entrou na fila`,
        "lead-update":   `${name} atualizado`,
      };

      return {
        id: `lead-${l.id}-${updated}`,
        kind,
        title: titleByKind[kind],
        subtitle: l.conversationState ? `estado: ${l.conversationState}` : "atualização",
        ts: updated,
        to: `/leads/${l.id}`,
      };
    })
    .sort((a, b) => b.ts - a.ts);
}

export function ActivityFeed() {
  const { activityOpen, setActivityOpen } = useGlobalUI();
  const { unitId } = useClinic();

  const query = useQuery({
    queryKey: ["activity-feed", unitId],
    queryFn: () => webhooksService.activeLeads({ limit: 30, unitId: unitId || undefined }),
    enabled: activityOpen,
    refetchInterval: activityOpen ? 15_000 : false,
  });

  const items = useMemo(
    () => (query.data ? leadToItems(query.data) : []),
    [query.data],
  );

  // ESC to close
  useEffect(() => {
    if (!activityOpen) return;
    const h = (e: KeyboardEvent) => {
      if (e.key === "Escape") setActivityOpen(false);
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [activityOpen, setActivityOpen]);

  return (
    <>
      {/* Backdrop */}
      <div
        className={cn(
          "fixed inset-0 z-[70] bg-black/40 backdrop-blur-[1px] transition-opacity duration-200",
          activityOpen ? "opacity-100" : "pointer-events-none opacity-0",
        )}
        onClick={() => setActivityOpen(false)}
      />

      {/* Drawer */}
      <aside
        className={cn(
          "fixed right-0 top-0 z-[71] flex h-full w-[380px] max-w-[90vw] flex-col",
          "border-l border-white/[0.08] bg-[rgba(10,10,14,0.98)] backdrop-blur",
          "shadow-[-20px_0_60px_-15px_rgba(0,0,0,0.6)]",
          "transition-transform duration-300 ease-out",
          activityOpen ? "translate-x-0" : "translate-x-full",
        )}
        aria-label="Atividades recentes"
      >
        {/* Header */}
        <div className="flex items-center gap-3 border-b border-white/[0.06] px-4 py-3.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-md bg-emerald-400/10 ring-1 ring-inset ring-emerald-400/20">
            <Activity className="h-4 w-4 text-emerald-300" />
          </div>

          <div className="min-w-0 flex-1 leading-tight">
            <p className="truncate text-[13px] font-semibold text-slate-100">
              Atividades recentes
            </p>
            <p className="text-[10.5px] text-slate-500">
              {query.isFetching
                ? "atualizando…"
                : `auto-atualiza a cada 15s · ${items.length} eventos`}
            </p>
          </div>

          <button
            type="button"
            onClick={() => query.refetch()}
            className="rounded-md p-1.5 text-slate-500 transition hover:bg-white/[0.05] hover:text-slate-200"
            aria-label="Atualizar"
            disabled={query.isFetching}
          >
            <RefreshCw className={cn("h-3.5 w-3.5", query.isFetching && "animate-spin")} />
          </button>

          <button
            type="button"
            onClick={() => setActivityOpen(false)}
            className="rounded-md p-1.5 text-slate-500 transition hover:bg-white/[0.05] hover:text-slate-200"
            aria-label="Fechar"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Lista */}
        <div className="flex-1 overflow-y-auto px-3 py-3 [&::-webkit-scrollbar]:w-1 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-white/[0.05]">
          {query.isLoading ? (
            <div className="space-y-2">
              {Array.from({ length: 6 }).map((_, i) => (
                <div
                  key={i}
                  className="h-14 animate-pulse rounded-lg border border-white/[0.04] bg-white/[0.015]"
                />
              ))}
            </div>
          ) : items.length === 0 ? (
            <div className="flex h-full flex-col items-center justify-center gap-3 text-center">
              <Clock className="h-8 w-8 text-slate-600" />
              <p className="text-[12px] text-slate-500">
                Sem atividades recentes para exibir.
              </p>
            </div>
          ) : (
            <ul className="relative space-y-1">
              {/* Linha vertical */}
              <span
                aria-hidden
                className="absolute left-[19px] top-2 bottom-2 w-px bg-white/[0.05]"
              />

              {items.map((it) => {
                const meta = KIND_META[it.kind];
                const Icon = meta.icon;
                const Wrapper = it.to ? Link : "div";
                const wrapperProps = it.to ? { to: it.to } : ({} as Record<string, never>);
                return (
                  <li key={it.id}>
                    <Wrapper
                      {...wrapperProps}
                      onClick={() => it.to && setActivityOpen(false)}
                      className={cn(
                        "group relative flex items-start gap-3 rounded-lg px-2 py-2.5",
                        "transition hover:bg-white/[0.025]",
                      )}
                    >
                      <div
                        className={cn(
                          "relative z-10 flex h-7 w-7 shrink-0 items-center justify-center rounded-full ring-2",
                          meta.ring,
                          "ring-[#0a0a0e]",
                        )}
                      >
                        <Icon className={cn("h-3.5 w-3.5", meta.color)} />
                      </div>

                      <div className="min-w-0 flex-1 leading-tight">
                        <p className="truncate text-[12.5px] font-medium text-slate-100">
                          {it.title}
                        </p>
                        <p className="truncate text-[11px] text-slate-500">
                          {it.subtitle}
                        </p>
                      </div>

                      <div className="flex shrink-0 flex-col items-end gap-0.5">
                        <span className="text-[10px] tabular-nums text-slate-500">
                          {relativeTime(it.ts)}
                        </span>
                        {it.to && (
                          <ChevronRight className="h-3 w-3 text-slate-600 transition group-hover:translate-x-0.5 group-hover:text-slate-300" />
                        )}
                      </div>
                    </Wrapper>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-white/[0.05] px-4 py-2.5 text-[10.5px] text-slate-500">
          <Link
            to="/live"
            onClick={() => setActivityOpen(false)}
            className="inline-flex items-center gap-1 transition hover:text-emerald-300"
          >
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
            </span>
            Ver tudo ao vivo →
          </Link>
        </div>
      </aside>
    </>
  );
}
