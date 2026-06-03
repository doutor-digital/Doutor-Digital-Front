import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { CalendarCheck, Clock3, ExternalLink } from "@/components/icons";
import { kpiConfigService } from "@/services/kpiConfig";
import { useClinic } from "@/hooks/useClinic";
import { cn } from "@/lib/utils";

function diaLabel(d: number) {
  if (d <= 0) return "hoje";
  if (d === 1) return "amanhã";
  return `em ${d} dias`;
}

/**
 * Sino de AGENDAMENTOS: a cada 60s busca os leads com agendamento nos próximos 7 dias
 * (independente de quando foram criados). Badge âmbar com a contagem; dropdown com a lista.
 */
export function AppointmentsBell() {
  const { tenantId, unitId } = useClinic();
  const clinicId = unitId || tenantId || undefined;
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const query = useQuery({
    queryKey: ["upcoming-appointments", clinicId],
    queryFn: () => kpiConfigService.upcomingAppointments(unitId ?? tenantId ?? null, 7),
    enabled: !!clinicId,
    refetchInterval: 60_000,
    refetchIntervalInBackground: true,
    placeholderData: (prev) => prev,
  });

  const items = query.data?.items ?? [];
  // Conta como "urgente" os que faltam <= 2 dias.
  const soon = items.filter((i) => i.days_until <= 2).length;
  const count = items.length;

  useEffect(() => {
    function handle(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handle);
    return () => document.removeEventListener("mousedown", handle);
  }, []);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        title="Agendamentos próximos"
        className={cn(
          "relative flex h-8 w-8 items-center justify-center rounded-md",
          "text-slate-500 transition hover:bg-white/[0.04] hover:text-slate-200",
          open && "bg-white/[0.04] text-slate-200",
        )}
      >
        <CalendarCheck className="h-3.5 w-3.5" />
        {count > 0 && (
          <span
            className={cn(
              "absolute -top-0.5 -right-0.5 flex h-4 min-w-[16px] items-center justify-center rounded-full px-1 text-[9px] font-bold tabular-nums ring-2 ring-[#0a0a0d]",
              soon > 0 ? "bg-amber-500 text-amber-50" : "bg-slate-600 text-slate-100",
            )}
            aria-label={`${count} agendamentos próximos`}
          >
            {count > 9 ? "9+" : count}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-[calc(100%+8px)] z-50 w-[360px] rounded-xl border border-white/[0.07] bg-[#0a0a0d] shadow-[0_24px_60px_-12px_rgba(0,0,0,0.7)]">
          <div className="border-b border-white/[0.05] px-4 py-3">
            <p className="text-[10px] font-medium uppercase tracking-[0.22em] text-slate-500">Notificações</p>
            <p className="mt-0.5 text-[13px] font-semibold tracking-tight text-slate-50">Agendamentos próximos</p>
            <p className="text-[11px] tabular-nums text-slate-500">próximos 7 dias · atualiza a cada 60s</p>
          </div>

          <div className="max-h-[360px] overflow-y-auto">
            {query.isLoading ? (
              <div className="space-y-2 p-4">
                {[0, 1, 2].map((i) => (
                  <div key={i} className="h-10 w-full animate-pulse rounded-md bg-white/[0.02]" />
                ))}
              </div>
            ) : items.length === 0 ? (
              <div className="px-4 py-8 text-center text-[12px] text-slate-500">
                Nenhum agendamento nos próximos 7 dias
              </div>
            ) : (
              <ul className="divide-y divide-white/[0.04]">
                {items.map((u) => (
                  <li key={u.lead_id}>
                    <Link
                      to={`/leads/${u.lead_id}`}
                      onClick={() => setOpen(false)}
                      className="group block px-4 py-2.5 transition hover:bg-white/[0.02]"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <span className="truncate text-[12.5px] font-medium text-slate-100">
                            {u.name || "Lead"}
                          </span>
                          <div className="mt-0.5 flex items-center gap-1.5 text-[10.5px] tabular-nums text-slate-500">
                            <Clock3 className="h-2.5 w-2.5" />
                            <span className={u.days_until <= 2 ? "text-amber-300" : ""}>{diaLabel(u.days_until)}</span>
                            <span>· {new Date(u.scheduled_at).toLocaleDateString("pt-BR")}</span>
                          </div>
                        </div>
                        <ExternalLink className="h-3 w-3 shrink-0 text-slate-600 transition group-hover:text-slate-400" />
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <button
            type="button"
            onClick={() => {
              setOpen(false);
              navigate("/leads");
            }}
            className="block w-full border-t border-white/[0.05] px-4 py-2.5 text-center text-[12px] font-medium text-slate-300 transition hover:bg-white/[0.02] hover:text-slate-50"
          >
            Ver todos os leads →
          </button>
        </div>
      )}
    </div>
  );
}
