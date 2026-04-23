import { useState } from "react";
import { X, Keyboard } from "lucide-react";
import { useShortcut } from "@/hooks/useShortcut";
import { Kbd } from "@/components/command/CommandPalette";
import { cn } from "@/lib/utils";

const SHORTCUTS: Array<{ group: string; items: Array<{ keys: string[]; label: string }> }> = [
  {
    group: "Globais",
    items: [
      { keys: ["⌘", "K"], label: "Abrir paleta de comandos" },
      { keys: ["?"], label: "Mostrar atalhos" },
      { keys: ["Esc"], label: "Fechar modal / voltar" },
      { keys: ["/"], label: "Focar busca" },
    ],
  },
  {
    group: "Navegação",
    items: [
      { keys: ["g", "d"], label: "Dashboard" },
      { keys: ["g", "l"], label: "Leads" },
      { keys: ["g", "c"], label: "Contatos" },
      { keys: ["g", "r"], label: "Relatórios" },
      { keys: ["g", "a"], label: "Analytics" },
      { keys: ["g", "e"], label: "Evolução" },
      { keys: ["g", "u"], label: "Unidades" },
      { keys: ["g", "s"], label: "Configurações" },
      { keys: ["g", "v"], label: "Ao vivo" },
    ],
  },
  {
    group: "Listas e tabelas",
    items: [
      { keys: ["↑", "↓"], label: "Navegar linhas" },
      { keys: ["Enter"], label: "Abrir item selecionado" },
      { keys: ["Shift", "Click"], label: "Selecionar range" },
    ],
  },
];

export function ShortcutsModal() {
  const [open, setOpen] = useState(false);
  useShortcut("?", () => setOpen(true));
  useShortcut("esc", () => setOpen(false), { enabled: open });

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Atalhos do teclado"
      className="fixed inset-0 z-[95] flex items-center justify-center px-4"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) setOpen(false);
      }}
    >
      <div className="absolute inset-0 bg-black/50 backdrop-blur-[2px]" />
      <div
        className={cn(
          "relative w-[min(720px,100%)] overflow-hidden rounded-2xl",
          "border border-white/[0.08] bg-[rgba(12,14,22,0.96)] shadow-[0_24px_60px_-12px_rgba(0,0,0,0.6)]",
        )}
      >
        <div className="flex items-center justify-between border-b border-white/[0.06] px-5 py-4">
          <div className="inline-flex items-center gap-2">
            <Keyboard className="h-4 w-4 text-emerald-400" />
            <h2 className="text-[14px] font-semibold text-slate-100">
              Atalhos de teclado
            </h2>
          </div>
          <button
            onClick={() => setOpen(false)}
            className="text-slate-500 transition hover:text-slate-200"
            aria-label="Fechar"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="grid grid-cols-1 gap-4 p-5 md:grid-cols-2">
          {SHORTCUTS.map((g) => (
            <div key={g.group}>
              <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-500">
                {g.group}
              </p>
              <ul className="space-y-1.5">
                {g.items.map((s, i) => (
                  <li key={i} className="flex items-center justify-between gap-3 rounded-md px-2 py-1.5 hover:bg-white/[0.02]">
                    <span className="text-[12.5px] text-slate-300">{s.label}</span>
                    <span className="flex items-center gap-1">
                      {s.keys.map((k, j) => (
                        <Kbd key={j}>{k}</Kbd>
                      ))}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="border-t border-white/[0.05] bg-white/[0.015] px-5 py-2 text-center text-[10.5px] text-slate-500">
          Pressione <Kbd>?</Kbd> a qualquer momento para ver esta lista.
        </div>
      </div>
    </div>
  );
}
