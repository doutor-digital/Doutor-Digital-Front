import { X as XIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export function FilterChip({
  label,
  dot,
  onRemove,
}: {
  label: string;
  dot?: string;
  onRemove: () => void;
}) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-white/[0.08] bg-white/[0.03] pl-2 pr-1 py-0.5 text-[11px] text-slate-200">
      {dot && <span className={cn("h-1.5 w-1.5 rounded-full", dot)} />}
      {label}
      <button
        onClick={onRemove}
        className="ml-0.5 h-4 w-4 grid place-items-center rounded-full text-slate-500 hover:text-slate-200 hover:bg-white/[0.06] transition"
        aria-label={`Remover filtro ${label}`}
      >
        <XIcon className="h-2.5 w-2.5" />
      </button>
    </span>
  );
}
