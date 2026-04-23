import { Fragment, ReactNode } from "react";
import { Link } from "react-router-dom";
import { ChevronRight, Home } from "lucide-react";
import { cn } from "@/lib/utils";

export interface Crumb {
  label: ReactNode;
  to?: string;
}

export function Breadcrumbs({
  items, className, showHome = true,
}: {
  items: Crumb[];
  className?: string;
  showHome?: boolean;
}) {
  const all: Crumb[] = showHome
    ? [{ label: <Home className="h-3 w-3" />, to: "/" }, ...items]
    : items;
  return (
    <nav
      aria-label="Breadcrumb"
      className={cn("flex flex-wrap items-center gap-1 text-[11.5px] text-slate-500", className)}
    >
      {all.map((c, i) => {
        const last = i === all.length - 1;
        return (
          <Fragment key={i}>
            {c.to && !last ? (
              <Link
                to={c.to}
                className="rounded px-1 py-0.5 text-slate-400 transition hover:bg-white/[0.04] hover:text-slate-200"
              >
                {c.label}
              </Link>
            ) : (
              <span className={cn("rounded px-1 py-0.5", last ? "text-slate-200" : "text-slate-500")}>
                {c.label}
              </span>
            )}
            {!last && <ChevronRight className="h-3 w-3 text-slate-600" />}
          </Fragment>
        );
      })}
    </nav>
  );
}
