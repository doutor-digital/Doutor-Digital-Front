import { ReactNode } from "react";
import { cn } from "@/lib/utils";

type PageHeaderProps = {
  title: string;
  description?: string;
  actions?: ReactNode;
  badge?: string;
  /** @deprecated mantido apenas por compatibilidade — não é mais usado visualmente */
  backgroundImage?: string;
};

export function PageHeader({
  title,
  description,
  actions,
  badge,
}: PageHeaderProps) {
  return (
    <header
      className={cn(
        "mt-4 mb-6 md:mb-8",
        "relative overflow-hidden rounded-xl",
        "border border-white/[0.07] bg-gradient-to-b from-white/[0.02] to-white/[0.005]",
        "shadow-[0_1px_0_rgba(255,255,255,0.03)_inset]",
        "px-5 py-4 md:px-6 md:py-5",
      )}
    >
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div className="min-w-0">
          {badge && (
            <p className="text-[10px] font-medium uppercase tracking-[0.22em] text-slate-500">
              {badge}
            </p>
          )}

          <h1 className="mt-1 text-[22px] md:text-[24px] font-semibold tracking-tight text-slate-50 leading-tight">
            {title}
          </h1>

          {description && (
            <p className="mt-1.5 max-w-2xl text-[12.5px] leading-relaxed text-slate-400">
              {description}
            </p>
          )}
        </div>

        {actions && (
          <div className="flex flex-wrap items-center gap-2 md:shrink-0 md:justify-end">
            {actions}
          </div>
        )}
      </div>
    </header>
  );
}
