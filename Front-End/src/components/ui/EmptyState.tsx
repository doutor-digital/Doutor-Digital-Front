import { Inbox } from "lucide-react";
import { ReactNode } from "react";

export function EmptyState({
  title = "Sem dados para exibir",
  description,
  action,
  icon,
}: {
  title?: string;
  description?: string;
  action?: ReactNode;
  icon?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center p-6 text-center">
      <div className="h-10 w-10 rounded-md bg-white/[0.03] ring-1 ring-inset ring-white/[0.06] grid place-items-center mb-3">
        {icon ?? <Inbox className="h-5 w-5 text-slate-500" />}
      </div>
      <p className="text-[13px] font-medium text-slate-200">{title}</p>
      {description && (
        <p className="text-[11.5px] text-slate-500 mt-1 max-w-sm leading-snug">
          {description}
        </p>
      )}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
