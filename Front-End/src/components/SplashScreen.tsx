import { useEffect, useState } from "react";

/**
 * Tela de abertura estilo app nativo: fundo branco, logo animada e "Bem-vindo!".
 * Aparece no carregamento do app e some sozinha com um fade suave.
 */
export function SplashScreen() {
  const [phase, setPhase] = useState<"show" | "out" | "done">("show");

  useEffect(() => {
    const toOut = setTimeout(() => setPhase("out"), 2300);
    const toDone = setTimeout(() => setPhase("done"), 2820);
    return () => {
      clearTimeout(toOut);
      clearTimeout(toDone);
    };
  }, []);

  if (phase === "done") return null;

  return (
    <div
      className={`fixed inset-0 z-[100] flex flex-col items-center justify-center bg-white transition-opacity duration-500 ${
        phase === "out" ? "pointer-events-none opacity-0" : "opacity-100"
      }`}
      aria-hidden="true"
    >
      {/* Brilho sutil da marca sobre o branco */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(circle at 50% 38%, rgba(74,125,133,0.12), transparent 62%)",
        }}
      />

      <div className="relative flex flex-col items-center px-8">
        <img
          src="/logo-dd.png"
          alt="Doutor Digital Dash"
          className="w-[280px] max-w-[82vw] select-none animate-splash-logo"
          draggable={false}
        />

        <p className="mt-7 text-sm font-bold uppercase text-[#33525c] animate-splash-word">
          Bem-vindo!
        </p>

        <div className="mt-7 h-[3px] w-40 overflow-hidden rounded-full bg-slate-200/80">
          <div className="h-full w-full origin-left rounded-full bg-gradient-to-r from-[#4a7d85] to-emerald-400 animate-splash-bar" />
        </div>
      </div>
    </div>
  );
}
