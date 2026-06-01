import { useEffect, useState } from "react";
import { MapPin, X } from "@/components/icons";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import { isAdminLevel } from "@/lib/roles";
import { authService } from "@/services/auth";
import { Button } from "@/components/ui/Button";

/**
 * Banner de consentimento de localização (LGPD). Pede à usuária permissão para
 * compartilhar a localização precisa (GPS) do navegador. Só aparece para papéis
 * operacionais (não admin-level) que ainda não concederam. Ao permitir, envia as
 * coordenadas e não pergunta de novo; ao recusar, só não insiste nesta sessão.
 */
export function LocationConsentPrompt() {
  const { user } = useAuth();
  const email = user?.email ?? "";
  const grantedKey = `geo_consent_granted:${email}`;
  const dismissedKey = `geo_consent_dismissed:${email}`;

  const [visible, setVisible] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!email) return;
    if (isAdminLevel(user?.role)) return;
    if (!("geolocation" in navigator)) return;
    if (localStorage.getItem(grantedKey)) return;
    if (sessionStorage.getItem(dismissedKey)) return;
    setVisible(true);
  }, [email, user?.role, grantedKey, dismissedKey]);

  if (!visible) return null;

  const allow = () => {
    setSubmitting(true);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        try {
          await authService.geoConsent({
            latitude: pos.coords.latitude,
            longitude: pos.coords.longitude,
            accuracy: pos.coords.accuracy,
          });
          localStorage.setItem(grantedKey, "1");
          toast.success("Localização compartilhada. Obrigado!");
          setVisible(false);
        } catch {
          toast.error("Não foi possível registrar a localização.");
        } finally {
          setSubmitting(false);
        }
      },
      () => {
        toast.error("Permissão de localização negada pelo navegador.");
        setSubmitting(false);
      },
      { enableHighAccuracy: true, timeout: 15_000 },
    );
  };

  const dismiss = () => {
    sessionStorage.setItem(dismissedKey, "1");
    setVisible(false);
  };

  return (
    <div className="fixed bottom-4 right-4 z-50 w-[min(360px,calc(100vw-2rem))] rounded-xl border border-emerald-400/20 bg-[#0d0f12] p-4 shadow-xl ring-1 ring-white/[0.06] animate-in fade-in slide-in-from-bottom-4">
      <button
        onClick={dismiss}
        className="absolute right-2 top-2 rounded-md p-1 text-slate-500 hover:text-slate-300"
        aria-label="Fechar"
      >
        <X className="h-4 w-4" />
      </button>
      <div className="flex items-start gap-3">
        <div className="mt-0.5 rounded-lg bg-emerald-500/10 p-2 text-emerald-300">
          <MapPin className="h-4 w-4" />
        </div>
        <div className="text-[13px]">
          <p className="font-medium text-slate-100">Compartilhar localização</p>
          <p className="mt-1 text-slate-400">
            Para fins de segurança e auditoria, pedimos permissão para registrar a
            localização de onde você acessa o sistema. Você pode revogar a qualquer
            momento nas configurações do navegador.
          </p>
        </div>
      </div>
      <div className="mt-3 flex items-center justify-end gap-2">
        <button
          onClick={dismiss}
          className="rounded-md px-3 py-1.5 text-[12.5px] text-slate-400 hover:text-slate-200"
        >
          Agora não
        </button>
        <Button onClick={allow} disabled={submitting} className="h-8 px-3 text-[12.5px]">
          {submitting ? "Enviando…" : "Permitir localização"}
        </Button>
      </div>
    </div>
  );
}
