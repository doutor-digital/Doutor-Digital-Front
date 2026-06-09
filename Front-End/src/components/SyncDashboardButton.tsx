import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { Check, CheckCircle2, Loader2, RefreshCw, X, XCircle } from "@/components/icons";
import { useClinic } from "@/hooks/useClinic";
import { unitsService } from "@/services/units";
import type { Unit } from "@/types";

// Os passos são rótulos da UI — o back-end roda o sync numa chamada só e não
// streama subprogresso. A animação avança por tempo, mas SEGURA no último passo
// até a requisição real terminar; os números finais (leads) são reais.
const STEPS = [
  "Conectando à Kommo",
  "Trazendo atualizações",
  "Sincronizando etapas",
  "Atualizando campos customizados",
] as const;

type Phase = "running" | "done" | "error";

const nf = (n: number) => new Intl.NumberFormat("pt-BR").format(n);

export default function SyncDashboardButton() {
  const { tenantId, unitId } = useClinic();
  const queryClient = useQueryClient();

  const [open, setOpen] = useState(false);
  const [phase, setPhase] = useState<Phase>("running");
  const [active, setActive] = useState(0);
  const [stats, setStats] = useState<{ units: number; leads: number } | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const timerRef = useRef<number | null>(null);

  const clearTimer = () => {
    if (timerRef.current != null) {
      window.clearInterval(timerRef.current);
      timerRef.current = null;
    }
  };
  useEffect(() => () => clearTimer(), []);

  async function run() {
    if (open && phase === "running") return; // já está rodando
    if (tenantId == null) {
      toast.error("Selecione uma unidade antes de sincronizar.");
      return;
    }

    setOpen(true);
    setPhase("running");
    setStats(null);
    setErr(null);
    setActive(0);

    clearTimer();
    timerRef.current = window.setInterval(() => {
      setActive((i) => (i < STEPS.length - 1 ? i + 1 : i));
    }, 900);

    try {
      let unitsToSync: Array<number | string>;
      if (unitId != null) {
        unitsToSync = [unitId];
      } else {
        // "Todas as unidades" → sincroniza cada unidade do tenant com Kommo configurado.
        const all = await unitsService.list();
        unitsToSync = all
          .filter((u: Unit) => Number(u.clinicId) === Number(tenantId))
          .filter((u: Unit) => !!u.kommoSubdomain && u.hasKommoToken !== false)
          .map((u: Unit) => u.id);
      }

      if (unitsToSync.length === 0) {
        throw new Error("Nenhuma unidade com Kommo configurada para sincronizar.");
      }

      let leads = 0;
      for (const id of unitsToSync) {
        const r = await unitsService.syncFromKommo(id);
        if (!r.success && r.error) throw new Error(r.error);
        leads += r.leadsPersisted ?? 0;
      }

      clearTimer();
      setActive(STEPS.length); // todos concluídos
      setStats({ units: unitsToSync.length, leads });
      setPhase("done");
      queryClient.invalidateQueries({ queryKey: ["dash-amo"] });
      queryClient.invalidateQueries({ queryKey: ["kpi-config"] });
      window.setTimeout(() => setOpen(false), 2600);
    } catch (e: unknown) {
      clearTimer();
      const ax = e as { response?: { data?: { error?: string } }; message?: string };
      setErr(ax?.response?.data?.error || ax?.message || "Falha ao sincronizar.");
      setPhase("error");
      toast.error("Falha na sincronização.");
    }
  }

  const canClose = phase !== "running";

  return (
    <>
      <button
        type="button"
        onClick={run}
        className="flex items-center gap-1.5 rounded-full border border-white/15 bg-white/5 px-4 py-1.5 text-xs font-medium text-white/80 transition hover:bg-white/10 hover:text-white"
      >
        <RefreshCw className={`h-3.5 w-3.5 ${open && phase === "running" ? "animate-spin" : ""}`} />
        Sincronizar
      </button>

      {createPortal(
        <AnimatePresence>
          {open && (
            <motion.div
              className="fixed inset-0 z-[1100] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => canClose && setOpen(false)}
            >
              <motion.div
                className="w-full max-w-sm rounded-2xl bg-[#0f1f3a] p-6 text-white shadow-2xl ring-1 ring-white/10"
                initial={{ scale: 0.94, opacity: 0, y: 8 }}
                animate={{ scale: 1, opacity: 1, y: 0 }}
                exit={{ scale: 0.96, opacity: 0 }}
                transition={{ type: "spring", stiffness: 300, damping: 26 }}
                onClick={(e) => e.stopPropagation()}
              >
                <div className="flex items-center justify-between">
                  <p className="text-sm font-semibold">
                    {phase === "done"
                      ? "Sincronizado"
                      : phase === "error"
                        ? "Não foi possível sincronizar"
                        : "Sincronizando"}
                  </p>
                  {canClose && (
                    <button
                      type="button"
                      onClick={() => setOpen(false)}
                      className="text-white/40 transition hover:text-white"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  )}
                </div>

                {phase !== "error" && (
                  <ul className="mt-5 space-y-3">
                    {STEPS.map((label, i) => {
                      const state =
                        i < active
                          ? "done"
                          : i === active && phase === "running"
                            ? "active"
                            : phase === "done"
                              ? "done"
                              : "pending";
                      return (
                        <li key={label} className="flex items-center gap-3">
                          <span className="flex h-6 w-6 shrink-0 items-center justify-center">
                            {state === "done" ? (
                              <motion.span
                                initial={{ scale: 0 }}
                                animate={{ scale: 1 }}
                                transition={{ type: "spring", stiffness: 400, damping: 18 }}
                              >
                                <Check className="h-4 w-4 text-emerald-400" />
                              </motion.span>
                            ) : state === "active" ? (
                              <Loader2 className="h-4 w-4 animate-spin text-violet-300" />
                            ) : (
                              <span className="h-2 w-2 rounded-full bg-white/20" />
                            )}
                          </span>
                          <span
                            className={`text-sm ${
                              state === "pending"
                                ? "text-white/35"
                                : state === "active"
                                  ? "text-white"
                                  : "text-white/70"
                            }`}
                          >
                            {label}
                          </span>
                        </li>
                      );
                    })}
                  </ul>
                )}

                {phase === "done" && (
                  <motion.div
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="mt-5 flex items-center gap-3 rounded-xl bg-emerald-400/10 px-4 py-3 ring-1 ring-emerald-400/20"
                  >
                    <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-400" />
                    <p className="text-sm text-emerald-100">
                      {stats
                        ? `${nf(stats.leads)} lead(s) atualizado(s)${
                            stats.units > 1 ? ` em ${stats.units} unidades` : ""
                          }.`
                        : "Tudo certo."}
                    </p>
                  </motion.div>
                )}

                {phase === "error" && (
                  <div className="mt-4">
                    <div className="flex items-start gap-3 rounded-xl bg-rose-500/10 px-4 py-3 ring-1 ring-rose-500/20">
                      <XCircle className="mt-0.5 h-5 w-5 shrink-0 text-rose-400" />
                      <p className="text-sm text-rose-100">{err}</p>
                    </div>
                    <button
                      type="button"
                      onClick={run}
                      className="mt-4 w-full rounded-full border border-white/15 bg-white/5 py-2 text-xs font-medium text-white/80 transition hover:bg-white/10"
                    >
                      Tentar de novo
                    </button>
                  </div>
                )}
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>,
        document.body,
      )}
    </>
  );
}
