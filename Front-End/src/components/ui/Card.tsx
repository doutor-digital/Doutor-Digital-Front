import { HTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/utils";

// ─── Card (legado) — agora renderiza o visual Panel canônico ──────────────────
// Mantido como alias para não forçar reescrita de todas as páginas.
// Internamente aplica: rounded-xl + border neutra + gradient sutil + inset shadow

export function Card({
  className,
  children,
  ...props
}: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "relative flex flex-col overflow-hidden rounded-xl",
        "border border-white/[0.07]",
        "bg-gradient-to-b from-white/[0.02] to-white/[0.005]",
        "shadow-[0_1px_0_rgba(255,255,255,0.03)_inset]",
        "transition-[border-color,background] duration-200",
        "hover:border-white/[0.12]",
        className,
      )}
      {...props}
    >
      {children}
    </div>
  );
}

// ─── CardHeader — API (title, subtitle, action) com visual de PanelHeader ─────

export function CardHeader({
  title,
  subtitle,
  action,
  className,
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex items-start justify-between gap-4 px-5 py-4",
        "border-b border-white/[0.05] bg-white/[0.01]",
        className,
      )}
    >
      <div className="min-w-0 flex-1">
        <h3 className="truncate text-[15px] font-semibold text-slate-50 tracking-tight">
          {title}
        </h3>
        {subtitle && (
          <p className="mt-0.5 text-[11.5px] text-slate-500 leading-relaxed">
            {subtitle}
          </p>
        )}
      </div>

      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}

// ─── CardBody — container interno com padding padrão ─────────────────────────

export function CardBody({
  className,
  children,
  ...props
}: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("relative flex-1 p-5", className)}
      {...props}
    >
      {children}
    </div>
  );
}
