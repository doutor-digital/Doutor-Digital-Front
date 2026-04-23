import { Check } from "lucide-react";
import { ACCENTS, useAccent, type Accent } from "@/hooks/useAccent";
import { cn } from "@/lib/utils";

export function AccentPicker({ className }: { className?: string }) {
  const { accent, setAccent } = useAccent();
  return (
    <div
      role="radiogroup"
      aria-label="Cor de destaque"
      className={cn("flex items-center gap-1.5", className)}
    >
      {(Object.keys(ACCENTS) as Accent[]).map((a) => {
        const active = a === accent;
        return (
          <button
            key={a}
            type="button"
            role="radio"
            aria-checked={active}
            aria-label={ACCENTS[a].label}
            title={ACCENTS[a].label}
            onClick={() => setAccent(a)}
            className={cn(
              "relative flex h-6 w-6 items-center justify-center rounded-full ring-2 ring-transparent transition",
              active && ACCENTS[a].ring,
            )}
            style={{ background: `rgb(${ACCENTS[a].rgb})` }}
          >
            {active && <Check className="h-3 w-3 text-white" />}
          </button>
        );
      })}
    </div>
  );
}
