import { ReactNode } from "react";
import { cn } from "@/lib/utils";

type Tone =
  | "neutral"
  | "sky"
  | "emerald"
  | "amber"
  | "rose"
  | "indigo"
  | "slate"
  // Aliases legados — vão saindo conforme páginas são refatoradas
  | "blue"
  | "green"
  | "yellow"
  | "red"
  | "violet";

export function Badge({
  children,
  tone = "neutral",
  className,
}: {
  children: ReactNode;
  tone?: Tone;
  className?: string;
}) {
  const tones: Record<Tone, string> = {
    neutral: "bg-white/[0.04] text-slate-200 ring-white/[0.08]",
    sky: "bg-sky-500/10 text-sky-300 ring-sky-500/20",
    emerald: "bg-emerald-500/10 text-emerald-300 ring-emerald-500/20",
    amber: "bg-amber-500/10 text-amber-300 ring-amber-500/20",
    rose: "bg-rose-500/10 text-rose-300 ring-rose-500/20",
    indigo: "bg-indigo-500/10 text-indigo-300 ring-indigo-500/20",
    slate: "bg-slate-500/10 text-slate-300 ring-slate-500/20",
    // Aliases legados
    blue: "bg-sky-500/10 text-sky-300 ring-sky-500/20",
    green: "bg-emerald-500/10 text-emerald-300 ring-emerald-500/20",
    yellow: "bg-amber-500/10 text-amber-300 ring-amber-500/20",
    red: "bg-rose-500/10 text-rose-300 ring-rose-500/20",
    violet: "bg-indigo-500/10 text-indigo-300 ring-indigo-500/20",
  };
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium ring-1 ring-inset",
        tones[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}

export function StateBadge({ state }: { state?: string | null }) {
  if (!state) return <Badge tone="slate">—</Badge>;
  const map: Record<string, { tone: Tone; label: string }> = {
    bot: { tone: "indigo", label: "Bot" },
    queue: { tone: "amber", label: "Fila" },
    service: { tone: "sky", label: "Atendimento" },
    concluido: { tone: "emerald", label: "Concluído" },
  };
  const c = map[state] ?? { tone: "neutral" as Tone, label: state };
  return <Badge tone={c.tone}>{c.label}</Badge>;
}

export function StageBadge({ stage }: { stage?: string | null }) {
  if (!stage) return <Badge tone="slate">—</Badge>;
  const s = stage.toLowerCase();
  let tone: Tone = "neutral";
  if (s.includes("fechou") || s.includes("tratamento")) tone = "emerald";
  else if (s.includes("pagamento")) tone = "sky";
  else if (s.includes("agendado")) tone = "amber";
  else if (s.includes("perdido") || s.includes("cancelado")) tone = "rose";
  return <Badge tone={tone}>{stage.replace(/_/g, " ")}</Badge>;
}
