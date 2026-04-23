import { useEffect, useState } from "react";
import { create } from "zustand";
import { persist } from "zustand/middleware";
import { Sparkles, X } from "lucide-react";
import { useShortcut } from "@/hooks/useShortcut";
import { cn } from "@/lib/utils";

export interface WhatsNewEntry {
  version: string;
  date: string;   // ISO
  title: string;
  items: string[];
  highlight?: boolean;
}

/** Atualize este array quando lançar uma feature. */
export const CHANGELOG: WhatsNewEntry[] = [
  {
    version: "2026.04.22",
    date: "2026-04-22",
    title: "Relatórios SaaS-grade",
    highlight: true,
    items: [
      "Modo Diário/Mensal com atalhos de período.",
      "KPIs com tendência vs. período anterior.",
      "Abas: Visão geral, Por unidade, Por origem, WhatsApp.",
      "Exportar CSV, PDF e copiar link compartilhável.",
      "Anexar imagem e copiar direto pro WhatsApp Web.",
    ],
  },
  {
    version: "2026.04.20",
    date: "2026-04-20",
    title: "Pagamentos e splits",
    items: [
      "Campo de splits em pagamentos com rateio por profissional.",
      "Campos novos no perfil do usuário.",
    ],
  },
];

interface WhatsNewStore {
  lastSeenVersion: string | null;
  markSeen: (version: string) => void;
}

export const useWhatsNew = create<WhatsNewStore>()(
  persist(
    (set) => ({
      lastSeenVersion: null,
      markSeen: (version) => set({ lastSeenVersion: version }),
    }),
    { name: "doutor.digital.whatsnew" },
  ),
);

export function hasUnseenRelease(): boolean {
  const seen = useWhatsNew.getState().lastSeenVersion;
  const latest = CHANGELOG[0]?.version;
  return !!latest && latest !== seen;
}

/** Modal de changelog in-app. Mostra badge no sino até ser visto. */
export function WhatsNewModal({
  open, onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const { markSeen } = useWhatsNew();
  useShortcut("esc", onClose, { enabled: open });

  useEffect(() => {
    if (open && CHANGELOG[0]) markSeen(CHANGELOG[0].version);
  }, [open, markSeen]);

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Novidades"
      className="fixed inset-0 z-[95] flex items-center justify-center px-4"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="absolute inset-0 bg-black/50 backdrop-blur-[2px]" />
      <div
        className={cn(
          "relative w-[min(560px,100%)] overflow-hidden rounded-2xl",
          "border border-white/[0.08] bg-[rgba(12,14,22,0.96)] shadow-[0_24px_60px_-12px_rgba(0,0,0,0.6)]",
        )}
      >
        <div className="flex items-center justify-between border-b border-white/[0.06] px-5 py-4">
          <div className="inline-flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-amber-300" />
            <h2 className="text-[14px] font-semibold text-slate-100">Novidades</h2>
          </div>
          <button
            onClick={onClose}
            aria-label="Fechar"
            className="text-slate-500 transition hover:text-slate-200"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="max-h-[65vh] space-y-5 overflow-y-auto p-5">
          {CHANGELOG.map((e) => (
            <div key={e.version} className="relative">
              {e.highlight && (
                <span className="absolute -left-3 top-2 h-2 w-2 rounded-full bg-amber-400 shadow-[0_0_0_3px_rgba(251,191,36,0.18)]" />
              )}
              <div className="flex items-baseline justify-between gap-2">
                <h3 className="text-[13px] font-semibold text-slate-100">{e.title}</h3>
                <span className="text-[10.5px] text-slate-500">
                  {new Date(e.date).toLocaleDateString("pt-BR")}
                </span>
              </div>
              <p className="text-[10px] font-mono text-slate-600">{e.version}</p>
              <ul className="mt-2 space-y-1 border-l border-white/[0.06] pl-3">
                {e.items.map((i, k) => (
                  <li key={k} className="text-[12px] leading-relaxed text-slate-300">· {i}</li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="border-t border-white/[0.05] bg-white/[0.015] px-5 py-3 text-center text-[10.5px] text-slate-500">
          Inscreva-se para receber novidades por e-mail nas configurações.
        </div>
      </div>
    </div>
  );
}

/** Badge "Novo!" — mostra até o usuário abrir o modal. */
export function WhatsNewDot({ className }: { className?: string }) {
  const seen = useWhatsNew((s) => s.lastSeenVersion);
  const latest = CHANGELOG[0]?.version;
  if (!latest || latest === seen) return null;
  return (
    <span
      className={cn(
        "absolute -top-0.5 -right-0.5 h-2 w-2 rounded-full bg-emerald-400 shadow-[0_0_0_2px_rgba(12,14,22,1)]",
        className,
      )}
      aria-label="Há novidades"
    />
  );
}
