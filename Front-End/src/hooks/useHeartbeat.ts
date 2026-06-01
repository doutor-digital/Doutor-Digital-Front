import { useEffect } from "react";
import { authService } from "@/services/auth";
import { useAuth } from "@/hooks/useAuth";

const INTERVAL_MS = 60_000;

/**
 * Enquanto o usuário está logado e a aba está visível, envia um heartbeat ao
 * back a cada ~60s. O back acumula o tempo ativo na sessão (claim `sid`), o que
 * alimenta a métrica "minutos logada" no controle de log avançado.
 */
export function useHeartbeat() {
  const token = useAuth((s) => s.token);

  useEffect(() => {
    if (!token) return;

    let timer: ReturnType<typeof setInterval> | null = null;

    const beat = () => {
      if (document.visibilityState === "visible") {
        void authService.heartbeat().catch(() => {});
      }
    };

    // Pinga ao montar (registra presença) e depois em intervalo.
    beat();
    timer = setInterval(beat, INTERVAL_MS);

    const onVisible = () => {
      if (document.visibilityState === "visible") beat();
    };
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      if (timer) clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [token]);
}
