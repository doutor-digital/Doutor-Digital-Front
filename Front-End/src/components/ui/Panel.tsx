import { cn } from "@/lib/utils";

export function Panel({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "rounded-xl border border-white/[0.07] bg-gradient-to-b from-white/[0.02] to-white/[0.005]",
        "shadow-[0_1px_0_rgba(255,255,255,0.03)_inset]",
        "overflow-hidden",
        className,
      )}
    >
      {children}
    </div>
  );
}

export function PanelHeader({
  eyebrow,
  eyebrowTone,
  title,
  subtitle,
  action,
}: {
  eyebrow?: string;
  eyebrowTone?: string;
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-4 px-5 py-4 border-b border-white/[0.05] bg-white/[0.01]">
      <div className="min-w-0">
        {eyebrow && (
          <div className="flex items-center gap-1.5">
            {eyebrowTone && (
              <span className={cn("h-1 w-1 rounded-full", eyebrowTone)} />
            )}
            <p className="text-[10px] font-medium uppercase tracking-[0.22em] text-slate-500">
              {eyebrow}
            </p>
          </div>
        )}
        <h3 className="mt-1 text-[15px] font-semibold text-slate-50 tracking-tight">
          {title}
        </h3>
        {subtitle && (
          <p className="mt-0.5 text-[11.5px] text-slate-500">{subtitle}</p>
        )}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}
