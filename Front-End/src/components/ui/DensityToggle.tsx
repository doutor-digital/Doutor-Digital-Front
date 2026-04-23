import { Rows3, Rows4 } from "lucide-react";
import { useDensity, type Density } from "@/hooks/useDensity";
import { cn } from "@/lib/utils";

export function DensityToggle({ className }: { className?: string }) {
  const { density, set } = useDensity();
  return (
    <div
      role="radiogroup"
      aria-label="Densidade da tabela"
      className={cn(
        "inline-flex items-center gap-0.5 rounded-md border border-white/[0.06] bg-white/[0.02] p-0.5",
        className,
      )}
    >
      <Opt current={density} value="comfortable" label="Confortável" onClick={set}>
        <Rows3 className="h-3.5 w-3.5" />
      </Opt>
      <Opt current={density} value="compact" label="Compacto" onClick={set}>
        <Rows4 className="h-3.5 w-3.5" />
      </Opt>
    </div>
  );
}

function Opt({
  current, value, label, onClick, children,
}: {
  current: Density;
  value: Density;
  label: string;
  onClick: (v: Density) => void;
  children: React.ReactNode;
}) {
  const active = current === value;
  return (
    <button
      type="button"
      role="radio"
      aria-checked={active}
      aria-label={label}
      title={label}
      onClick={() => onClick(value)}
      className={cn(
        "rounded-[5px] p-1.5 transition",
        active
          ? "bg-white/[0.08] text-slate-50"
          : "text-slate-400 hover:text-slate-200 hover:bg-white/[0.04]",
      )}
    >
      {children}
    </button>
  );
}
