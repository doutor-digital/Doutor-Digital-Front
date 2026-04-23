import { useState } from "react";
import { create } from "zustand";
import { persist } from "zustand/middleware";
import { Check, ChevronDown, Rocket, X } from "lucide-react";
import { cn } from "@/lib/utils";

type StepId = "unit" | "attendant" | "lead" | "report" | "integration";

interface OnboardingStore {
  done: Record<StepId, boolean>;
  dismissed: boolean;
  markDone: (id: StepId) => void;
  dismiss: () => void;
  reset: () => void;
}

export const useOnboarding = create<OnboardingStore>()(
  persist(
    (set) => ({
      done: { unit: false, attendant: false, lead: false, report: false, integration: false },
      dismissed: false,
      markDone: (id) =>
        set((s) => ({ done: { ...s.done, [id]: true } })),
      dismiss: () => set({ dismissed: true }),
      reset: () =>
        set({
          done: { unit: false, attendant: false, lead: false, report: false, integration: false },
          dismissed: false,
        }),
    }),
    { name: "doutor.digital.onboarding" },
  ),
);

const STEPS: Array<{ id: StepId; title: string; description: string; to: string }> = [
  { id: "unit",        title: "Configure sua primeira unidade",  description: "Em Unidades, cadastre a clínica e equipe inicial.", to: "/units" },
  { id: "attendant",   title: "Adicione atendentes",            description: "Atribua leads pra quem realmente conversa com eles.", to: "/attendants" },
  { id: "lead",        title: "Revise seus leads",              description: "Veja como sua base está organizada hoje.", to: "/leads" },
  { id: "report",      title: "Gere o primeiro relatório",      description: "Diário ou mensal — em PDF ou WhatsApp.", to: "/reports" },
  { id: "integration", title: "Configure integrações",          description: "Meta webhook, tokens Cloudia e mais.", to: "/settings" },
];

export function OnboardingChecklist() {
  const { done, dismissed, dismiss } = useOnboarding();
  const [open, setOpen] = useState(true);

  const completed = STEPS.filter((s) => done[s.id]).length;
  const total = STEPS.length;
  const pct = Math.round((completed / total) * 100);

  if (dismissed || completed === total) return null;

  return (
    <div
      className={cn(
        "fixed bottom-4 right-4 z-[70] w-[min(360px,calc(100vw-32px))] overflow-hidden rounded-2xl",
        "border border-white/[0.08] bg-[rgba(12,14,22,0.96)] shadow-[0_12px_40px_-12px_rgba(0,0,0,0.6)]",
      )}
    >
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left hover:bg-white/[0.02]"
      >
        <div className="inline-flex items-center gap-2">
          <div className="relative">
            <svg width="28" height="28" viewBox="0 0 36 36" className="-rotate-90">
              <circle cx="18" cy="18" r="14" stroke="rgba(255,255,255,0.08)" strokeWidth="3" fill="none" />
              <circle
                cx="18" cy="18" r="14"
                stroke="rgb(52 211 153)"
                strokeWidth="3" fill="none"
                strokeDasharray={2 * Math.PI * 14}
                strokeDashoffset={2 * Math.PI * 14 * (1 - completed / total)}
                strokeLinecap="round"
                className="transition-[stroke-dashoffset]"
              />
            </svg>
            <Rocket className="absolute inset-0 m-auto h-3.5 w-3.5 text-emerald-300" />
          </div>
          <div>
            <p className="text-[13px] font-semibold text-slate-100">Primeiros passos</p>
            <p className="text-[11px] text-slate-500">{completed} de {total} · {pct}%</p>
          </div>
        </div>
        <ChevronDown
          className={cn("h-4 w-4 text-slate-400 transition", open ? "rotate-180" : "")}
        />
      </button>

      {open && (
        <>
          <ul className="border-t border-white/[0.05]">
            {STEPS.map((s) => {
              const isDone = done[s.id];
              return (
                <li key={s.id}>
                  <a
                    href={s.to}
                    className={cn(
                      "flex items-start gap-3 px-4 py-3 transition hover:bg-white/[0.02]",
                      isDone && "opacity-70",
                    )}
                  >
                    <span
                      className={cn(
                        "mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full ring-1 ring-inset",
                        isDone
                          ? "bg-emerald-500/20 text-emerald-300 ring-emerald-500/30"
                          : "bg-white/[0.03] text-slate-500 ring-white/[0.08]",
                      )}
                    >
                      {isDone ? <Check className="h-3 w-3" /> : null}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p
                        className={cn(
                          "text-[12.5px] font-medium",
                          isDone ? "text-slate-400 line-through" : "text-slate-200",
                        )}
                      >
                        {s.title}
                      </p>
                      <p className="text-[11px] text-slate-500">{s.description}</p>
                    </div>
                  </a>
                </li>
              );
            })}
          </ul>
          <div className="flex items-center justify-end border-t border-white/[0.05] bg-white/[0.015] px-4 py-2">
            <button
              type="button"
              onClick={dismiss}
              className="inline-flex items-center gap-1 text-[11px] text-slate-500 hover:text-slate-300"
            >
              <X className="h-3 w-3" /> Ocultar
            </button>
          </div>
        </>
      )}
    </div>
  );
}
