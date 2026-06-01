import { useEffect, useState } from "react";
import { X } from "@/components/icons";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

const DISMISS_KEY = "dd.install.dismissed";

/**
 * Banner discreto para instalar o PWA como app nativo no celular.
 * Aparece só em mobile, quando o navegador oferece a instalação, e some ao instalar/dispensar.
 */
export function InstallPrompt() {
  const [evt, setEvt] = useState<BeforeInstallPromptEvent | null>(null);
  const [hidden, setHidden] = useState(
    () => sessionStorage.getItem(DISMISS_KEY) === "1",
  );

  useEffect(() => {
    const onPrompt = (e: Event) => {
      e.preventDefault();
      setEvt(e as BeforeInstallPromptEvent);
    };
    const onInstalled = () => setEvt(null);
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  if (!evt || hidden) return null;

  const install = async () => {
    try {
      await evt.prompt();
      await evt.userChoice;
    } catch {
      /* usuário fechou o diálogo */
    }
    setEvt(null);
  };

  const dismiss = () => {
    sessionStorage.setItem(DISMISS_KEY, "1");
    setHidden(true);
  };

  return (
    <div className="fixed inset-x-3 bottom-[5.5rem] z-40 animate-slide-in-bottom lg:hidden">
      <div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-[#0f1f3a]/95 p-3 shadow-2xl backdrop-blur">
        <img src="/logo-dd.png" alt="" className="h-9 w-auto shrink-0" draggable={false} />
        <div className="min-w-0 flex-1">
          <p className="text-[13px] font-semibold text-white">Instalar o app</p>
          <p className="truncate text-[11px] text-white/50">Acesso rápido na tela inicial</p>
        </div>
        <button
          type="button"
          onClick={install}
          className="shrink-0 rounded-full bg-emerald-400 px-4 py-1.5 text-[12px] font-bold text-[#05210f] active:scale-95"
        >
          Instalar
        </button>
        <button
          type="button"
          onClick={dismiss}
          aria-label="Dispensar"
          className="shrink-0 rounded-full p-1.5 text-white/40 hover:text-white"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
