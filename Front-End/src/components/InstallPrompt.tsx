import { useEffect, useMemo, useState } from "react";
import { X, Plus, Smartphone, MoreVertical, ChevronRight } from "@/components/icons";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

const DISMISS_KEY = "dd.install.dismissed.at";
// Depois de dispensar, só volta a aparecer após esse período (não fica importunando).
const SNOOZE_MS = 7 * 24 * 60 * 60_000;

type Platform = "ios" | "android-prompt" | "android-manual" | "none";

/** Já está rodando instalado (standalone)? Aí não mostramos nada. */
function isStandalone(): boolean {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia?.("(display-mode: standalone)").matches ||
    // iOS Safari expõe navigator.standalone
    (navigator as unknown as { standalone?: boolean }).standalone === true
  );
}

function isIos(): boolean {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent;
  const iPhoneish = /iPad|iPhone|iPod/.test(ua);
  // iPadOS 13+ se passa por Mac — detecta pelo touch.
  const iPadOs = /Macintosh/.test(ua) && navigator.maxTouchPoints > 1;
  return iPhoneish || iPadOs;
}

/** Safari de verdade no iOS (Chrome/Firefox no iOS não conseguem instalar PWA). */
function isIosSafari(): boolean {
  if (!isIos()) return false;
  const ua = navigator.userAgent;
  return !/CriOS|FxiOS|EdgiOS|OPiOS/.test(ua);
}

function isAndroid(): boolean {
  if (typeof navigator === "undefined") return false;
  return /Android/i.test(navigator.userAgent);
}

function snoozed(): boolean {
  try {
    const raw = localStorage.getItem(DISMISS_KEY);
    if (!raw) return false;
    const at = Number(raw);
    if (!Number.isFinite(at)) return false;
    return Date.now() - at < SNOOZE_MS;
  } catch {
    return false;
  }
}

/**
 * Glifo de "Compartilhar" do iOS (caixa com seta pra cima), desenhado inline
 * porque é o ícone exato que o usuário precisa procurar na barra do Safari.
 */
function IosShareGlyph({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden>
      <path
        d="M12 15V4m0 0L8.5 7.5M12 4l3.5 3.5"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M6 11.5H5.5A1.5 1.5 0 0 0 4 13v6a1.5 1.5 0 0 0 1.5 1.5h13A1.5 1.5 0 0 0 20 19v-6a1.5 1.5 0 0 0-1.5-1.5H18"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/**
 * Banner + tutorial para instalar o PWA como app nativo no celular.
 *
 * Cobre os três caminhos reais:
 *  - Android Chrome dispara `beforeinstallprompt` → botão "Instalar" nativo.
 *  - Android sem o evento (ex.: Mi Browser do Poco) → instruções do menu ⋮.
 *  - iOS Safari (nunca dispara o evento) → passo a passo Compartilhar → Adicionar.
 *
 * Some quando já está instalado (standalone) e fica em "snooze" 7 dias ao dispensar.
 */
export function InstallPrompt() {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);
  const [installed, setInstalled] = useState(() => isStandalone());
  const [dismissed, setDismissed] = useState(() => snoozed());
  const [showHelp, setShowHelp] = useState(false);
  // Espera um tempo pelo beforeinstallprompt antes de cair no fallback manual no Android.
  const [waited, setWaited] = useState(false);

  useEffect(() => {
    const onPrompt = (e: Event) => {
      e.preventDefault();
      setDeferred(e as BeforeInstallPromptEvent);
    };
    const onInstalled = () => {
      setInstalled(true);
      setDeferred(null);
      setShowHelp(false);
    };
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);

    const t = setTimeout(() => setWaited(true), 3500);
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
      clearTimeout(t);
    };
  }, []);

  const platform: Platform = useMemo(() => {
    if (installed) return "none";
    if (deferred) return "android-prompt";
    if (isIos()) return "ios";
    if (isAndroid() && waited) return "android-manual";
    return "none";
  }, [installed, deferred, waited]);

  if (installed || dismissed || platform === "none") return null;

  const dismiss = () => {
    try {
      localStorage.setItem(DISMISS_KEY, String(Date.now()));
    } catch {
      /* storage indisponível — só esconde nesta sessão */
    }
    setDismissed(true);
    setShowHelp(false);
  };

  const onPrimary = async () => {
    if (platform === "android-prompt" && deferred) {
      try {
        await deferred.prompt();
        await deferred.userChoice;
      } catch {
        /* usuário fechou o diálogo do navegador */
      }
      setDeferred(null);
      return;
    }
    // iOS e Android manual → abrir tutorial
    setShowHelp(true);
  };

  const primaryLabel = platform === "android-prompt" ? "Instalar" : "Como instalar";

  return (
    <>
      {/* Banner discreto (só mobile) */}
      <div className="fixed inset-x-3 bottom-[5.5rem] z-40 animate-slide-in-bottom lg:hidden">
        <div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-[#0f1f3a]/95 p-3 shadow-2xl backdrop-blur">
          <img src="/logo-dd.png" alt="" className="h-9 w-auto shrink-0" draggable={false} />
          <div className="min-w-0 flex-1">
            <p className="text-[13px] font-semibold text-white">Instalar o app</p>
            <p className="truncate text-[11px] text-white/50">Acesso rápido na tela inicial</p>
          </div>
          <button
            type="button"
            onClick={onPrimary}
            className="shrink-0 rounded-full bg-emerald-400 px-4 py-1.5 text-[12px] font-bold text-[#05210f] active:scale-95"
          >
            {primaryLabel}
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

      {/* Tutorial (iOS / Android manual) */}
      {showHelp && (
        <div
          className="fixed inset-0 z-[60] flex items-end justify-center bg-black/60 p-3 backdrop-blur-sm lg:hidden"
          onClick={() => setShowHelp(false)}
        >
          <div
            className="w-full max-w-md animate-slide-in-bottom rounded-3xl border border-white/10 bg-[#0b1530] p-5 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-4 flex items-center gap-3">
              <span className="grid h-10 w-10 place-items-center rounded-2xl bg-emerald-400/15 text-emerald-300">
                <Smartphone className="h-5 w-5" />
              </span>
              <div className="min-w-0">
                <p className="text-sm font-bold text-white">Instalar na tela inicial</p>
                <p className="text-[11px] text-white/50">Vira um app, abre em tela cheia e sem a barra do navegador.</p>
              </div>
              <button
                type="button"
                onClick={() => setShowHelp(false)}
                aria-label="Fechar"
                className="ml-auto shrink-0 rounded-full p-1.5 text-white/40 hover:text-white"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {platform === "ios" ? (
              <ol className="space-y-3">
                {!isIosSafari() && (
                  <li className="rounded-xl border border-amber-400/30 bg-amber-400/10 px-3 py-2 text-[12px] text-amber-200">
                    Abra esta página no <b>Safari</b> — só ele instala o app no iPhone/iPad.
                  </li>
                )}
                <Step n={1} icon={<IosShareGlyph className="h-5 w-5" />}>
                  Toque no botão <b>Compartilhar</b> (a caixa com a seta pra cima), na barra do Safari.
                </Step>
                <Step n={2} icon={<Plus className="h-5 w-5" />}>
                  Role e toque em <b>Adicionar à Tela de Início</b>.
                </Step>
                <Step n={3} icon={<ChevronRight className="h-5 w-5" />}>
                  Confirme em <b>Adicionar</b>. Pronto — o ícone aparece na tela inicial.
                </Step>
              </ol>
            ) : (
              <ol className="space-y-3">
                <Step n={1} icon={<MoreVertical className="h-5 w-5" />}>
                  Toque no menu <b>⋮</b> (três pontinhos) no canto do navegador.
                </Step>
                <Step n={2} icon={<Plus className="h-5 w-5" />}>
                  Escolha <b>Instalar app</b> ou <b>Adicionar à tela inicial</b>.
                </Step>
                <Step n={3} icon={<ChevronRight className="h-5 w-5" />}>
                  Confirme. Se não achar a opção, abra o site no <b>Google Chrome</b> e tente de novo.
                </Step>
              </ol>
            )}

            <button
              type="button"
              onClick={() => setShowHelp(false)}
              className="mt-5 w-full rounded-2xl bg-emerald-400 py-2.5 text-sm font-bold text-[#05210f] active:scale-[.98]"
            >
              Entendi
            </button>
          </div>
        </div>
      )}
    </>
  );
}

function Step({ n, icon, children }: { n: number; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <li className="flex items-start gap-3">
      <span className="mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-full bg-white/10 text-[12px] font-bold text-white">
        {n}
      </span>
      <span className="flex items-center gap-2 text-[13px] leading-snug text-white/80">
        <span className="shrink-0 text-emerald-300">{icon}</span>
        <span>{children}</span>
      </span>
    </li>
  );
}
