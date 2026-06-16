import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, Clock, CheckCircle2, XCircle } from "@/components/icons";
import { kpiConfigService } from "@/services/kpiConfig";

// "Agora" = consulta entre LEAD_MIN antes e TAIL_MIN depois do horário marcado.
const LEAD_MIN = 10;
const TAIL_MIN = 60;

/** Range do dia de HOJE (00:00 → 00:00 do dia seguinte) no fuso local, em ISO. */
function todayRange() {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(end.getDate() + 1);
  return { date_from: start.toISOString(), date_to: end.toISOString() };
}

const hhmm = (iso?: string | null) =>
  iso ? new Date(iso).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }) : "--:--";

interface ConsultasHojeBannerProps {
  tenantId: number | null;
  unitId: number | null;
}

/**
 * Faixa do dia: lista as consultas de HOJE (sempre hoje, independente do filtro
 * de período do dashboard) e destaca em vermelho a que está na hora —
 * "HORÁRIO DE CONSULTA AGORA". Atualiza sozinha (relógio + refetch).
 */
export function ConsultasHojeBanner({ tenantId, unitId }: ConsultasHojeBannerProps) {
  // Relógio: tica a cada 30s pra reavaliar quem está "na hora".
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(id);
  }, []);

  const q = useQuery({
    queryKey: ["consultas-do-dia", tenantId, unitId],
    queryFn: () => kpiConfigService.consultasDoDia(unitId, todayRange()),
    enabled: tenantId != null,
    refetchInterval: 60_000,
    refetchOnWindowFocus: true,
    staleTime: 30_000,
  });

  const items = q.data ?? [];
  if (items.length === 0) return null;

  const enriched = items.map((c) => {
    const t = c.when ? new Date(c.when).getTime() : null;
    const active =
      c.outcome === "aguardando" &&
      t != null &&
      now >= t - LEAD_MIN * 60_000 &&
      now <= t + TAIL_MIN * 60_000;
    const past = t != null && now > t + TAIL_MIN * 60_000;
    return { ...c, active, past };
  });
  const activeOnes = enriched.filter((e) => e.active);
  const hasAlert = activeOnes.length > 0;

  return (
    <div
      className={`relative overflow-hidden rounded-2xl p-4 ring-1 transition ${
        hasAlert
          ? "bg-rose-950/40 ring-rose-500/40 shadow-[0_0_0_1px_rgba(244,63,94,0.25)]"
          : "bg-[#0f1f3a]/80 ring-white/5"
      }`}
    >
      {hasAlert && (
        <div className="mb-3 flex items-center gap-2">
          <span className="relative flex h-2.5 w-2.5">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-rose-400 opacity-75" />
            <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-rose-500" />
          </span>
          <AlertTriangle className="h-4 w-4 text-rose-300" />
          <span className="text-[12px] font-bold uppercase tracking-[0.12em] text-rose-200">
            Horário de consulta agora
          </span>
          <span className="text-[12px] text-rose-100/80">
            — {activeOnes.map((a) => `${a.name || "—"} (${hhmm(a.when)})`).join(", ")}
          </span>
        </div>
      )}

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Clock className="h-3.5 w-3.5 text-white/50" />
          <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-white/60">
            Consultas de hoje · {items.length}
          </span>
        </div>
        <span className="text-[11px] tabular-nums text-white/40">
          {new Date(now).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
        </span>
      </div>

      <ul className="mt-3 flex gap-2 overflow-x-auto pb-1">
        {enriched.map((c, i) => {
          const tone =
            c.outcome === "compareceu"
              ? "text-emerald-200 ring-emerald-400/25 bg-emerald-400/10"
              : c.outcome === "faltou"
                ? "text-rose-200 ring-rose-400/30 bg-rose-400/10"
                : "text-white/75 ring-white/10 bg-white/5";
          return (
            <li
              key={`${c.name}-${i}`}
              className={`flex shrink-0 items-center gap-2 rounded-xl px-3 py-2 ring-1 ring-inset ${
                c.active ? "bg-rose-500/20 ring-rose-400/50" : "bg-white/[0.03] ring-white/5"
              } ${c.past && !c.active ? "opacity-50" : ""}`}
            >
              <span className="tabular-nums text-[13px] font-semibold text-white/90">{hhmm(c.when)}</span>
              <span className="max-w-[160px] truncate text-[12px] text-white/80">{c.name || "—"}</span>
              <span className={`inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[10px] ring-1 ring-inset ${tone}`}>
                {c.outcome === "compareceu" ? (
                  <CheckCircle2 className="h-3 w-3" />
                ) : c.outcome === "faltou" ? (
                  <XCircle className="h-3 w-3" />
                ) : null}
                {c.outcome === "compareceu" ? "Compareceu" : c.outcome === "faltou" ? "Faltou" : "Aguardando"}
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
