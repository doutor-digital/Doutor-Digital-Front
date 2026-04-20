import { HTMLAttributes, ReactNode, TdHTMLAttributes, ThHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

export function Table({ className, children, ...p }: HTMLAttributes<HTMLTableElement>) {
  return (
    <div className="overflow-x-auto rounded-xl border border-white/[0.07] bg-white/[0.01]">
      <table className={cn("w-full text-[12.5px]", className)} {...p}>
        {children}
      </table>
    </div>
  );
}

export function THead({ children }: { children: ReactNode }) {
  return (
    <thead className="border-b border-white/[0.05]">
      {children}
    </thead>
  );
}

export function TBody({ children }: { children: ReactNode }) {
  return <tbody className="divide-y divide-white/[0.04]">{children}</tbody>;
}

export function Tr({
  className,
  clickable,
  ...p
}: HTMLAttributes<HTMLTableRowElement> & { clickable?: boolean }) {
  return (
    <tr
      className={cn(
        "group transition",
        clickable && "cursor-pointer hover:bg-white/[0.02]",
        className,
      )}
      {...p}
    />
  );
}

export function Th({ className, ...p }: ThHTMLAttributes<HTMLTableCellElement>) {
  return (
    <th
      scope="col"
      className={cn(
        "text-left px-5 py-3 text-[10px] font-medium uppercase tracking-widest text-slate-500 whitespace-nowrap",
        className,
      )}
      {...p}
    />
  );
}

export function Td({ className, ...p }: TdHTMLAttributes<HTMLTableCellElement>) {
  return (
    <td
      className={cn("px-5 py-3 text-slate-200 whitespace-nowrap", className)}
      {...p}
    />
  );
}
