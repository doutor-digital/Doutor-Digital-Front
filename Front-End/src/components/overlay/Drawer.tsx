import { ReactNode, useEffect } from "react";
import { X } from "lucide-react";
import { useShortcut } from "@/hooks/useShortcut";
import { cn } from "@/lib/utils";

/**
 * Painel lateral (slide-over). Acessível, sem deps.
 * Respeita prefers-reduced-motion via CSS simples.
 */
export function Drawer({
  open,
  onClose,
  title,
  subtitle,
  side = "right",
  width = 520,
  children,
  actions,
}: {
  open: boolean;
  onClose: () => void;
  title?: ReactNode;
  subtitle?: ReactNode;
  side?: "right" | "left";
  width?: number;
  children: ReactNode;
  actions?: ReactNode;
}) {
  useShortcut("esc", onClose, { enabled: open });

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  return (
    <div
      aria-hidden={!open}
      className={cn(
        "fixed inset-0 z-[90] transition",
        open ? "pointer-events-auto" : "pointer-events-none",
      )}
    >
      <div
        onClick={onClose}
        className={cn(
          "absolute inset-0 bg-black/50 backdrop-blur-[1px] transition-opacity duration-200",
          open ? "opacity-100" : "opacity-0",
        )}
      />

      <aside
        role="dialog"
        aria-modal="true"
        aria-label={typeof title === "string" ? title : "Drawer"}
        className={cn(
          "absolute top-0 flex h-full flex-col overflow-hidden",
          "border-white/[0.08] bg-[rgba(10,12,20,0.98)] shadow-[0_0_60px_-12px_rgba(0,0,0,0.6)]",
          side === "right"
            ? "right-0 border-l"
            : "left-0 border-r",
          "transition-transform duration-250 ease-out",
          open
            ? "translate-x-0"
            : side === "right"
              ? "translate-x-full"
              : "-translate-x-full",
        )}
        style={{ width: `min(${width}px, 100vw)` }}
      >
        {(title || subtitle) && (
          <header className="flex items-start justify-between gap-4 border-b border-white/[0.05] px-5 py-4">
            <div className="min-w-0">
              {title && (
                <h2 className="truncate text-[15px] font-semibold text-slate-50 tracking-tight">
                  {title}
                </h2>
              )}
              {subtitle && (
                <p className="mt-0.5 text-[11.5px] text-slate-500 leading-relaxed">
                  {subtitle}
                </p>
              )}
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="Fechar"
              className="rounded-md p-1 text-slate-400 transition hover:bg-white/[0.05] hover:text-slate-200"
            >
              <X className="h-4 w-4" />
            </button>
          </header>
        )}

        <div className="min-h-0 flex-1 overflow-y-auto">{children}</div>

        {actions && (
          <footer className="border-t border-white/[0.05] bg-white/[0.015] px-5 py-3">
            <div className="flex flex-wrap items-center justify-end gap-2">{actions}</div>
          </footer>
        )}
      </aside>
    </div>
  );
}
