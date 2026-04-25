import { Link } from "react-router-dom";
import { Bookmark, X } from "lucide-react";
import { useSavedViews } from "@/hooks/useSavedViews";
import { cn } from "@/lib/utils";

export function SavedViewsSection() {
  const views = useSavedViews((s) => s.views);
  const remove = useSavedViews((s) => s.remove);

  if (views.length === 0) return null;

  return (
    <div>
      <div className="mb-1.5 flex items-center gap-2 px-3">
        <p className="text-[10px] font-medium uppercase tracking-[0.18em] text-slate-500">
          Pinados
        </p>
        <div className="h-px flex-1 bg-white/[0.04]" />
      </div>

      <ul className="space-y-0.5">
        {views.map((v) => (
          <li key={v.id} className="group">
            <div
              className={cn(
                "flex items-center gap-2 rounded-md px-2.5 py-1.5",
                "text-[12px] font-medium text-slate-400 transition",
                "hover:bg-white/[0.03] hover:text-slate-200",
              )}
            >
              <Bookmark className="h-3.5 w-3.5 shrink-0 text-slate-500" />
              <Link to={v.url} className="min-w-0 flex-1 truncate">
                {v.icon && <span className="mr-1">{v.icon}</span>}
                {v.name}
              </Link>
              <button
                type="button"
                onClick={() => remove(v.id)}
                aria-label="Remover pinado"
                className="opacity-0 transition group-hover:opacity-100 hover:text-rose-300"
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
