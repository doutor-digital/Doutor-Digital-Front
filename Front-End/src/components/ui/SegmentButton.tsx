import { cn } from "@/lib/utils";

export function SegmentButton({
  active,
  onClick,
  children,
  className,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "relative px-4 py-1.5 text-[12px] font-medium rounded-md transition",
        active
          ? "bg-white/[0.08] text-slate-50 shadow-sm"
          : "text-slate-400 hover:text-slate-200",
        className,
      )}
    >
      {children}
    </button>
  );
}

export function TabButton({
  active,
  onClick,
  children,
  className,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "px-4 py-1 text-[12px] font-medium rounded-md transition",
        active
          ? "bg-white/[0.08] text-slate-50 shadow-sm"
          : "text-slate-400 hover:text-slate-200",
        className,
      )}
    >
      {children}
    </button>
  );
}
