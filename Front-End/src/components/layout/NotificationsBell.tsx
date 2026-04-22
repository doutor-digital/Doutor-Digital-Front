import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Bell, CheckCheck, Clock3, ExternalLink } from "lucide-react";
import { webhooksService } from "@/services/webhooks";
import { useClinic } from "@/hooks/useClinic";
import { cn } from "@/lib/utils";

/**
 * Sino de notificações: polla /webhooks/recent a cada 30s e mostra badge com
 * contagem de leads novos desde a última vez que o dropdown foi aberto.
 * O "última visualização" é persistido por tenant em localStorage.
 */
export function NotificationsBell() {
  const { tenantId, unitId } = useClinic();
  const clinicId = unitId || tenantId || undefined;
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const storageKey = `notif.lastSeen.${clinicId ?? "na"}`;
  const [lastSeen, setLastSeen] = useState<number>(() => {
    const raw = typeof window !== "undefined" ? window.localStorage.getItem(storageKey) : null;
    return raw ? Number(raw) : 0;
  });

  const query = useQuery({
    queryKey: ["recent-leads", "notifications", clinicId],
    queryFn: () =>
      webhooksService.recentLeads({ clinicId, hours: 24, limit: 10 }),
    enabled: !!clinicId,
    refetchInterval: 30_000,
    refetchIntervalInBackground: true,
    placeholderData: (prev) => prev,
  });

  const items = query.data?.items ?? [];

  const unseenCount = useMemo(
    () => items.filter((i) => new Date(i.created_at).getTime() > lastSeen).length,
    [items, lastSeen]
  );

  // Fecha ao clicar fora
  useEffect(() => {
    function handle(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handle);
    return () => document.removeEventListener("mousedown", handle);
  }, []);

  const markAsSeen = () => {
    const now = Date.now();
    setLastSeen(now);
    if (typeof window !== "undefined") window.localStorage.setItem(storageKey, String(now));
  };

  const toggleOpen = () => {
    const next = !open;
    setOpen(next);
    if (next) markAsSeen();
  };

  const goToAll = () => {
    setOpen(false);
    navigate("/recent-leads");
  };

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={toggleOpen}
        title="Leads recentes"
        className={cn(
          "relative flex h-8 w-8 items-center justify-center rounded-md",
          "text-slate-500 transition hover:bg-white/[0.04] hover:text-slate-200",
          open && "bg-white/[0.04] text-slate-200",
        )}
      >
        <Bell className="h-3.5 w-3.5" />
        {unseenCount > 0 && (
          <span
            className="absolute -top-0.5 -right-0.5 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-rose-500 px-1 text-[9px] font-bold tabular-nums text-rose-50 ring-2 ring-[#0a0a0d]"
            aria-label={`${unseenCount} leads novos`}
          >
            {unseenCount > 9 ? "9+" : unseenCount}
          </span>
        )}
      </button>

      {open && (
        <div
          className={cn(
            "absolute right-0 top-[calc(100%+8px)] z-50 w-[360px]",
            "rounded-xl border border-white/[0.07] bg-[#0a0a0d]",
            "shadow-[0_24px_60px_-12px_rgba(0,0,0,0.7)]",
          )}
        >
          <div className="flex items-center justify-between border-b border-white/[0.05] px-4 py-3">
            <div>
              <p className="text-[10px] font-medium uppercase tracking-[0.22em] text-slate-500">
                Notificações
              </p>
              <p className="mt-0.5 text-[13px] font-semibold text-slate-50 tracking-tight">
                Leads recentes
              </p>
              <p className="text-[11px] text-slate-500 tabular-nums">
                últimas 24h · atualiza a cada 30s
              </p>
            </div>
            <button
              type="button"
              onClick={markAsSeen}
              title="Marcar todas como vistas"
              className="flex items-center gap-1 rounded-md px-2 py-1 text-[10px] text-slate-500 hover:bg-white/[0.04] hover:text-slate-200 transition"
            >
              <CheckCheck className="h-3 w-3" />
              Marcar vistas
            </button>
          </div>

          <div className="max-h-[360px] overflow-y-auto">
            {query.isLoading ? (
              <div className="space-y-2 p-4">
                {[0, 1, 2].map((i) => (
                  <div
                    key={i}
                    className="h-10 w-full rounded-md bg-white/[0.02] animate-pulse"
                  />
                ))}
              </div>
            ) : items.length === 0 ? (
              <div className="px-4 py-8 text-center text-[12px] text-slate-500">
                Nenhum lead nas últimas 24 horas
              </div>
            ) : (
              <ul className="divide-y divide-white/[0.04]">
                {items.map((lead) => {
                  const isNew = new Date(lead.created_at).getTime() > lastSeen;
                  return (
                    <li key={lead.id}>
                      <Link
                        to={`/leads/${lead.id}`}
                        onClick={() => setOpen(false)}
                        className="block px-4 py-2.5 hover:bg-white/[0.02] transition group"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2">
                              {isNew && (
                                <span
                                  className="h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-400"
                                  aria-label="novo"
                                />
                              )}
                              <span className="truncate text-[12.5px] font-medium text-slate-100">
                                {lead.name}
                              </span>
                            </div>
                            <div className="mt-0.5 flex items-center gap-1.5 text-[10.5px] text-slate-500 tabular-nums">
                              <Clock3 className="h-2.5 w-2.5" />
                              <span>{timeAgo(lead.created_at)}</span>
                              {lead.source && (
                                <span className="truncate">· {lead.source}</span>
                              )}
                              {lead.unit_name && (
                                <span className="truncate">· {lead.unit_name}</span>
                              )}
                            </div>
                          </div>
                          <ExternalLink className="h-3 w-3 shrink-0 text-slate-600 group-hover:text-slate-400 transition" />
                        </div>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          <button
            type="button"
            onClick={goToAll}
            className="block w-full border-t border-white/[0.05] px-4 py-2.5 text-center text-[12px] font-medium text-slate-300 hover:bg-white/[0.02] hover:text-slate-50 transition"
          >
            Ver todos os leads recentes →
          </button>
        </div>
      )}
    </div>
  );
}

/* ─── helpers ─── */

function timeAgo(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  if (Number.isNaN(diffMs) || diffMs < 0) return "agora";
  const m = Math.floor(diffMs / 60_000);
  if (m < 1) return "agora";
  if (m < 60) return `há ${m} min`;
  const h = Math.floor(m / 60);
  if (h < 24) return `há ${h}h`;
  const d = Math.floor(h / 24);
  return `há ${d}d`;
}
