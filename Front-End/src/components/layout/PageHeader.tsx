import { ReactNode } from "react";
import { cn } from "@/lib/utils";

type PageHeaderProps = {
  title: string;
  description?: string;
  actions?: ReactNode;
  badge?: string;
  backgroundImage?: string;
};

export function PageHeader({
  title,
  description,
  actions,
  badge = "Clínica",
  backgroundImage,
}: PageHeaderProps) {
  return (
    <header className="relative mb-6 overflow-hidden rounded-2xl">
      {/* Cartão */}
      <div
        className={cn(
          "relative overflow-hidden rounded-2xl",
          "border border-hairline bg-surface shadow-card",
          "px-6 py-5 md:px-8 md:py-6"
        )}
      >
        {/* Imagem de fundo opcional */}
        {backgroundImage && (
          <>
            <img
              src={backgroundImage}
              alt=""
              aria-hidden
              className="absolute inset-0 h-full w-full object-cover object-center"
            />
            <div className="absolute inset-0 bg-gradient-to-r from-[rgb(var(--surface)/0.95)] via-[rgb(var(--surface)/0.85)] to-[rgb(var(--surface)/0.35)]" />
          </>
        )}

        {/* Decoração — gradiente nas cores da logo */}
        {!backgroundImage && (
          <>
            <div className="pointer-events-none absolute -right-20 -top-20 h-56 w-56 rounded-full bg-brand-500/15 blur-3xl" />
            <div className="pointer-events-none absolute -bottom-16 right-32 h-36 w-36 rounded-full bg-accent-500/15 blur-2xl" />
          </>
        )}

        <div className="relative flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="min-w-0">
            {/* Badge em azul da logo */}
            <span
              className={cn(
                "mb-2 inline-flex items-center gap-1 rounded-full px-2.5 py-0.5",
                "text-[10px] font-bold uppercase tracking-widest",
                "bg-brand-500/10 text-brand-700 dark:text-brand-300",
                "ring-1 ring-brand-500/25"
              )}
            >
              {badge}
            </span>

            <h1 className="text-2xl font-extrabold tracking-tight text-slate-50 md:text-3xl">
              {title}
            </h1>

            {description && (
              <p className="mt-1 max-w-xl text-sm leading-6 text-slate-400">
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
      </div>
    </header>
  );
}
