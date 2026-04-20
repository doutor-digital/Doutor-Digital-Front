import { ButtonHTMLAttributes, forwardRef } from "react";
import { cn } from "@/lib/utils";

type Variant = "primary" | "ghost" | "outline" | "danger";
type Size = "sm" | "md" | "lg";

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
}

const variants: Record<Variant, string> = {
  primary:
    "bg-emerald-500 hover:bg-emerald-400 text-emerald-950 font-semibold shadow-[0_4px_14px_-4px_rgba(16,185,129,0.35)]",
  ghost: "text-slate-300 hover:bg-white/[0.05] hover:text-slate-100",
  outline:
    "text-slate-200 border border-white/[0.08] bg-white/[0.02] hover:bg-white/[0.04] hover:border-white/[0.14]",
  danger:
    "bg-rose-500/90 hover:bg-rose-500 text-rose-50 shadow-[0_4px_14px_-4px_rgba(244,63,94,0.35)]",
};

const sizes: Record<Size, string> = {
  sm: "px-2.5 py-1.5 text-[12px]",
  md: "px-3.5 py-2 text-[13px]",
  lg: "px-4 py-2.5 text-[14px]",
};

export const Button = forwardRef<HTMLButtonElement, Props>(
  ({ className, variant = "primary", size = "md", loading, children, disabled, ...rest }, ref) => (
    <button
      ref={ref}
      disabled={loading || disabled}
      className={cn(
        "inline-flex items-center gap-2 rounded-md font-medium transition",
        "disabled:opacity-50 disabled:cursor-not-allowed",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/60",
        variants[variant],
        sizes[size],
        className,
      )}
      {...rest}
    >
      {loading && (
        <span className="h-3.5 w-3.5 rounded-full border-2 border-current/40 border-t-current animate-spin" />
      )}
      {children}
    </button>
  ),
);
Button.displayName = "Button";
