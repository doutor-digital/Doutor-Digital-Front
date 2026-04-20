import { InputHTMLAttributes, forwardRef } from "react";
import { cn } from "@/lib/utils";

interface Props extends InputHTMLAttributes<HTMLInputElement> {
  icon?: React.ReactNode;
}

export const Input = forwardRef<HTMLInputElement, Props>(
  ({ className, icon, ...rest }, ref) => (
    <div className="relative">
      {icon && (
        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none">
          {icon}
        </span>
      )}
      <input
        ref={ref}
        className={cn(
          "w-full bg-white/[0.02] border border-white/[0.08] rounded-md px-3 py-2 text-[13px] text-slate-100",
          "placeholder:text-slate-600",
          "focus:outline-none focus:border-white/[0.18] focus:bg-white/[0.03] transition",
          icon && "pl-9",
          className,
        )}
        {...rest}
      />
    </div>
  ),
);
Input.displayName = "Input";
