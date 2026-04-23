import { ReactNode, useState } from "react";
import { cn } from "@/lib/utils";

/**
 * Tooltip rico sem deps — aparece no hover/focus, conteúdo React.
 * Posicionamento simples (top por default) com seta.
 */
export function RichTooltip({
  children, content, side = "top", className, contentClassName,
}: {
  children: ReactNode;
  content: ReactNode;
  side?: "top" | "bottom" | "left" | "right";
  className?: string;
  contentClassName?: string;
}) {
  const [open, setOpen] = useState(false);

  return (
    <span
      className={cn("relative inline-flex", className)}
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
      onFocus={() => setOpen(true)}
      onBlur={() => setOpen(false)}
    >
      {children}
      {open && (
        <span
          role="tooltip"
          className={cn(
            "pointer-events-none absolute z-[60] w-max max-w-[260px] rounded-md px-2.5 py-1.5",
            "border border-white/[0.08] bg-[rgba(12,14,22,0.98)] text-[11px] leading-relaxed text-slate-200",
            "shadow-[0_8px_24px_-8px_rgba(0,0,0,0.6)]",
            side === "top" && "bottom-full left-1/2 mb-1.5 -translate-x-1/2",
            side === "bottom" && "top-full left-1/2 mt-1.5 -translate-x-1/2",
            side === "left" && "right-full top-1/2 mr-1.5 -translate-y-1/2",
            side === "right" && "left-full top-1/2 ml-1.5 -translate-y-1/2",
            contentClassName,
          )}
        >
          {content}
        </span>
      )}
    </span>
  );
}
