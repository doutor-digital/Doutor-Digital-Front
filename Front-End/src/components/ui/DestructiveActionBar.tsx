import { ReactNode, useEffect, useRef, useState } from "react";
import { AlertTriangle, RefreshCw, X } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/utils";

export interface DestructiveActionBarProgress {
  current: number;
  total: number;
  label?: string;
  onStop?: () => void;
  stopping?: boolean;
}

export interface DestructiveActionBarProps {
  open: boolean;
  title: ReactNode;
  description?: ReactNode;
  confirmLabel: string;
  cancelLabel?: string;
  onConfirm: () => void;
  onDismiss: () => void;
  icon?: ReactNode;
  pending?: boolean;
  /**
   * Segundos de "cool-down" em que o botão confirmar fica desabilitado
   * depois que a barra abre. Protege contra double-click impulsivo.
   * 0 = imediato. Default: 3.
   */
  countdownSeconds?: number;
  /**
   * Se presente, renderiza a barra em modo "progresso" — substitui a
   * confirmação pela barra com contador de lotes e botão Parar.
   */
  progress?: DestructiveActionBarProgress;
  className?: string;
}

/**
 * Barra destrutiva sticky no topo da página. Use para bulk actions
 * irreversíveis (apagar em massa, despublicar, etc.).
 *
 * UX:
 * - `sticky top-0` dentro do scroll container do dashboard
 * - Esc cancela (tanto no modo confirmar quanto no modo progresso ele
 *   chama onDismiss — a página decide se equivale a "Parar")
 * - Cool-down de 3s no botão confirmar evita click impulsivo
 * - Foco automático no Cancelar (evita Enter acidental confirmar)
 * - role="alertdialog" + aria-live para acessibilidade
 * - Ícone + cor rose só no botão primário mantêm o resto legível
 */
export function DestructiveActionBar({
  open,
  title,
  description,
  confirmLabel,
  cancelLabel = "Cancelar",
  onConfirm,
  onDismiss,
  icon,
  pending = false,
  countdownSeconds = 3,
  progress,
  className,
}: DestructiveActionBarProps) {
  const cancelRef = useRef<HTMLButtonElement>(null);
  const [remaining, setRemaining] = useState(countdownSeconds);

  useEffect(() => {
    if (!open) return;
    setRemaining(countdownSeconds);
    cancelRef.current?.focus();
  }, [open, countdownSeconds]);

  useEffect(() => {
    if (!open || progress || remaining <= 0) return;
    const t = window.setTimeout(() => setRemaining((r) => Math.max(0, r - 1)), 1000);
    return () => window.clearTimeout(t);
  }, [open, remaining, progress]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onDismiss();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onDismiss]);

  if (!open) return null;

  const isProgressMode = !!progress;
  const pct =
    progress && progress.total > 0
      ? Math.min(100, Math.round((progress.current / progress.total) * 100))
      : 0;

  const confirmDisabled = pending || remaining > 0;
  const confirmText =
    pending
      ? confirmLabel
      : remaining > 0
        ? `${confirmLabel} (${remaining})`
        : confirmLabel;

  return (
    <div
      role="alertdialog"
      aria-live="assertive"
      aria-modal="false"
      aria-labelledby="destructive-bar-title"
      className={cn(
        "sticky top-0 z-40 -mx-4 mb-3 lg:-mx-6",
        "animate-fade-in",
        className,
      )}
    >
      <div
        className={cn(
          "flex items-start gap-3 px-4 lg:px-6 py-3",
          "bg-[rgba(18,10,14,0.92)] backdrop-blur-md",
          "border-b border-rose-500/30",
          "shadow-[0_8px_24px_-12px_rgba(244,63,94,0.35)]",
        )}
      >
        <div className="h-9 w-9 rounded-md bg-rose-500/10 ring-1 ring-inset ring-rose-500/25 grid place-items-center shrink-0">
          {icon ?? <AlertTriangle className="h-4 w-4 text-rose-300" />}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3 flex-wrap">
            <p
              id="destructive-bar-title"
              className="text-[13px] font-semibold text-slate-100"
            >
              {title}
            </p>
            {isProgressMode && (
              <span className="text-[11.5px] text-slate-400 tabular-nums">
                {progress!.current.toLocaleString("pt-BR")} /{" "}
                {progress!.total.toLocaleString("pt-BR")}
                {progress!.label ? ` · ${progress!.label}` : ""}
              </span>
            )}
          </div>

          {description && !isProgressMode && (
            <p className="text-[11.5px] text-slate-400 mt-0.5">{description}</p>
          )}

          {isProgressMode && (
            <div className="mt-2 h-1.5 w-full rounded-full bg-white/[0.06] overflow-hidden">
              <div
                className="h-full bg-rose-500/80 transition-[width] duration-300"
                style={{ width: `${pct}%` }}
              />
            </div>
          )}
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {isProgressMode ? (
            <>
              {progress!.onStop && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={progress!.onStop}
                  disabled={progress!.stopping}
                >
                  {progress!.stopping ? "Parando..." : "Parar"}
                </Button>
              )}
              <Button
                variant="ghost"
                size="sm"
                onClick={onDismiss}
                aria-label="Ocultar barra"
                className="!p-1.5"
              >
                <X className="h-4 w-4" />
              </Button>
            </>
          ) : (
            <>
              <Button
                ref={cancelRef}
                variant="ghost"
                size="sm"
                onClick={onDismiss}
                disabled={pending}
              >
                {cancelLabel}
              </Button>
              <Button
                variant="danger"
                size="sm"
                onClick={onConfirm}
                disabled={confirmDisabled}
                loading={pending}
              >
                {!pending && <AlertTriangle className="h-3.5 w-3.5" />}
                {confirmText}
              </Button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
