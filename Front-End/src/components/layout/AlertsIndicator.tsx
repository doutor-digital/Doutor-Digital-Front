import { useQuery } from "@tanstack/react-query";
import { AlertTriangle } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { analyticsService } from "@/services/analytics";
import { useClinic } from "@/hooks/useClinic";
import { cn } from "@/lib/utils";

const POLL_INTERVAL_MS = 15_000;

/**
 * Botão na Topbar que acende em âmbar quando há leads com alerta de SLA.
 * Usa a mesma queryKey da AlertsPage — assim o cache é compartilhado.
 */
export function AlertsIndicator() {
  const { unitId } = useClinic();
  const navigate = useNavigate();
  const unitIdStr = unitId ? String(unitId) : "";

  const alerts = useQuery({
    queryKey: ["alerts", unitIdStr],
    queryFn: () => analyticsService.unitAlerts(unitIdStr),
    enabled: !!unitIdStr,
    refetchInterval: POLL_INTERVAL_MS,
    refetchIntervalInBackground: true,
  });

  const count = alerts.data?.alerts.length ?? 0;
  const hasAlerts = count > 0;

  return (
    <button
      type="button"
      onClick={() => navigate("/alerts")}
      title={hasAlerts ? `${count} lead(s) fora do SLA` : "Nenhum alerta ativo"}
      className={cn(
        "relative flex h-8 w-8 items-center justify-center rounded-md transition",
        hasAlerts
          ? "bg-amber-500/10 text-amber-300 ring-1 ring-inset ring-amber-500/20 hover:bg-amber-500/15"
          : "text-slate-500 hover:bg-white/[0.04] hover:text-slate-200",
      )}
    >
      <AlertTriangle className="h-3.5 w-3.5" />
      {hasAlerts && (
        <span
          className="absolute -top-0.5 -right-0.5 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-amber-500 px-1 text-[9px] font-bold tabular-nums text-amber-950 ring-2 ring-[#0a0a0d]"
          aria-label={`${count} alertas ativos`}
        >
          {count > 9 ? "9+" : count}
        </span>
      )}
    </button>
  );
}
