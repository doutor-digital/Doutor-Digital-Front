import { ReactNode } from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Toolbar flutuante fixa no bottom que aparece quando há seleção.
 * Use em tabelas / listas. Content-agnostic — você passa as ações.
 */
export function BulkActionsBar({
  count,
  onClear,
  children,
  hidden,
}: {
  count: number;
  onClear: () => void;
  children: ReactNode;
  /** se true, esconde (animação fade-out). Default: auto quando count === 0 */
  hidden?: boolean;
}) {
  const isHidden = hidden ?? count === 0;
  return (
    <div
      role="toolbar"
      aria-label={`${count} itens selecionados`}
      className={cn(
        "pointer-events-none fixed inset-x-0 bottom-6 z-[80] flex justify-center px-4",
        "transition-all duration-200",
        isHidden
          ? "translate-y-4 opacity-0"
          : "translate-y-0 opacity-100",
      )}
    >
      <div
        className={cn(
          "pointer-events-auto flex max-w-[calc(100vw-32px)] items-center gap-3 rounded-full px-2 py-2 pl-4",
          "border border-white/[0.10] bg-[rgba(12,14,22,0.96)] shadow-[0_12px_40px_-8px_rgba(0,0,0,0.6)]",
          "backdrop-blur-md",
        )}
      >
        <span className="text-[12.5px] font-medium text-slate-200">
          <span className="tabular-nums text-emerald-300">{count}</span>{" "}
          {count === 1 ? "item selecionado" : "itens selecionados"}
        </span>
        <div className="h-5 w-px bg-white/[0.08]" />
        <div className="flex flex-wrap items-center gap-1">{children}</div>
        <button
          type="button"
          onClick={onClear}
          aria-label="Limpar seleção"
          className="ml-1 rounded-full p-1.5 text-slate-400 transition hover:bg-white/[0.05] hover:text-slate-200"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}

export function BulkActionBtn({
  icon,
  label,
  onClick,
  tone = "neutral",
}: {
  icon: ReactNode;
  label: string;
  onClick: () => void;
  tone?: "neutral" | "danger";
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[12px] font-medium transition",
        tone === "danger"
          ? "text-rose-300 hover:bg-rose-500/10"
          : "text-slate-200 hover:bg-white/[0.06]",
      )}
    >
      {icon}
      {label}
    </button>
  );
}
