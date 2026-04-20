import { SelectHTMLAttributes, forwardRef } from "react";
import { cn } from "@/lib/utils";

export const Select = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement>>(
  ({ className, children, ...rest }, ref) => (
    <select
      ref={ref}
      className={cn(
        "w-full bg-white/[0.02] border border-white/[0.08] rounded-md px-3 py-2 text-[13px] text-slate-100",
        "focus:outline-none focus:border-white/[0.18] focus:bg-white/[0.03] transition",
        "[&>option]:bg-[#0a0a0d] [&>option]:text-slate-100",
        className,
      )}
      {...rest}
    >
      {children}
    </select>
  ),
);
Select.displayName = "Select";
