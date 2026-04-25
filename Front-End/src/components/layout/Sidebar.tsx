import { useEffect, useState } from "react";
import { NavLink, useLocation } from "react-router-dom";
import {
  BarChart3,
  Bell,
  Building2,
  ChevronDown,
  Cog,
  Contact as ContactIcon,
  DollarSign,
  FileBarChart,
  Filter,
  LayoutDashboard,
  LineChart,
  ListChecks,
  type LucideIcon,
  Radio,
  Sunrise,
  Users2,
  Workflow,
} from "lucide-react";
import { cn } from "@/lib/utils";

type NavItem = {
  to: string;
  label: string;
  icon: LucideIcon;
  end?: boolean;
};

type NavEntry =
  | NavItem
  | {
      label: string;
      icon: LucideIcon;
      basePaths: string[];
      children: NavItem[];
    };

type NavGroup = {
  label: string;
  items: NavEntry[];
};

const navGroups: NavGroup[] = [
  {
    label: "Visão geral",
    items: [
      { to: "/", label: "Dashboard", icon: LayoutDashboard, end: true },
      { to: "/live", label: "Ao vivo", icon: Radio },
      { to: "/analytics", label: "Analytics", icon: BarChart3 },
    ],
  },
  {
    label: "Gestão",
    items: [
      { to: "/leads", label: "Leads", icon: ListChecks },
      { to: "/contacts", label: "Contatos", icon: ContactIcon },
      { to: "/funnel", label: "Funil", icon: Workflow },
      { to: "/sources", label: "Origens", icon: Filter },
      { to: "/evolution", label: "Evolução", icon: LineChart },
      { to: "/attendants", label: "Atendentes", icon: Users2 },
      {
        label: "Unidades",
        icon: Building2,
        basePaths: ["/units", "/amanheceu"],
        children: [
          { to: "/units", label: "Lista de unidades", icon: Building2, end: true },
          { to: "/amanheceu", label: "Amanheceu", icon: Sunrise },
          { to: "/live", label: "Ao vivo (por unidade)", icon: Radio },
        ],
      },
    ],
  },
  {
    label: "Financeiro",
    items: [{ to: "/finance", label: "Financeiro", icon: DollarSign }],
  },
  {
    label: "Relatórios",
    items: [
      { to: "/reports", label: "Relatórios", icon: FileBarChart },
      { to: "/alerts", label: "Alertas", icon: Bell },
    ],
  },
  {
    label: "Sistema",
    items: [{ to: "/settings", label: "Configurações", icon: Cog }],
  },
];

function isNestedEntry(
  entry: NavEntry,
): entry is Extract<NavEntry, { children: NavItem[] }> {
  return "children" in entry;
}

function pathMatches(pathname: string, base: string): boolean {
  if (base === "/") return pathname === "/";
  return pathname === base || pathname.startsWith(`${base}/`);
}

function NavItemLink({ to, label, icon: Icon, end }: NavItem) {
  return (
    <NavLink
      to={to}
      end={end}
      className={({ isActive }) =>
        cn(
          "group flex items-center gap-2.5 rounded-md px-2.5 py-2 text-[12.5px] font-medium transition",
          isActive
            ? "bg-white/[0.05] text-slate-50 ring-1 ring-inset ring-white/[0.08]"
            : "text-slate-400 hover:bg-white/[0.03] hover:text-slate-200",
        )
      }
    >
      {({ isActive }) => (
        <>
          <Icon
            className={cn(
              "h-4 w-4 shrink-0 transition-colors",
              isActive
                ? "text-emerald-300"
                : "text-slate-500 group-hover:text-slate-300",
            )}
          />
          <span>{label}</span>
        </>
      )}
    </NavLink>
  );
}

function NavCollapsible({
  entry,
  pathname,
}: {
  entry: Extract<NavEntry, { children: NavItem[] }>;
  pathname: string;
}) {
  const Icon = entry.icon;
  const isWithin = entry.basePaths.some((p) => pathMatches(pathname, p));
  const [open, setOpen] = useState(isWithin);

  // Auto-expand when navigating to a child route from elsewhere.
  useEffect(() => {
    if (isWithin) setOpen(true);
  }, [isWithin]);

  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className={cn(
          "group flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-[12.5px] font-medium transition",
          isWithin
            ? "bg-white/[0.04] text-slate-100 ring-1 ring-inset ring-white/[0.06]"
            : "text-slate-400 hover:bg-white/[0.03] hover:text-slate-200",
        )}
      >
        <Icon
          className={cn(
            "h-4 w-4 shrink-0 transition-colors",
            isWithin
              ? "text-emerald-300"
              : "text-slate-500 group-hover:text-slate-300",
          )}
        />
        <span className="flex-1 text-left">{entry.label}</span>
        <ChevronDown
          className={cn(
            "h-3.5 w-3.5 shrink-0 text-slate-500 transition-transform duration-200",
            open && "rotate-180",
          )}
        />
      </button>

      <div
        className={cn(
          "grid overflow-hidden transition-[grid-template-rows] duration-200 ease-out",
          open ? "grid-rows-[1fr]" : "grid-rows-[0fr]",
        )}
      >
        <div className="min-h-0">
          <div className="ml-4 mt-1 space-y-0.5 border-l border-white/[0.06] pl-2">
            {entry.children.map((child) => (
              <NavLink
                key={child.to + child.label}
                to={child.to}
                end={child.end}
                className={({ isActive }) =>
                  cn(
                    "group flex items-center gap-2 rounded-md px-2 py-1.5 text-[12px] font-medium transition",
                    isActive
                      ? "bg-emerald-400/[0.08] text-emerald-100 ring-1 ring-inset ring-emerald-400/20"
                      : "text-slate-400 hover:bg-white/[0.03] hover:text-slate-200",
                  )
                }
              >
                {({ isActive }) => (
                  <>
                    <child.icon
                      className={cn(
                        "h-3.5 w-3.5 shrink-0 transition-colors",
                        isActive
                          ? "text-emerald-300"
                          : "text-slate-500 group-hover:text-slate-300",
                      )}
                    />
                    <span className="truncate">{child.label}</span>
                  </>
                )}
              </NavLink>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export function Sidebar() {
  const { pathname } = useLocation();

  return (
    <aside
      className={cn(
        "hidden lg:flex lg:flex-col",
        "w-64 shrink-0",
        "border-r border-white/[0.05]",
        "bg-[#0a0a0d]",
      )}
    >
      <div className="flex items-center gap-3 border-b border-white/[0.05] px-5 py-5">
        <div className="h-9 w-9 shrink-0 overflow-hidden rounded-lg ring-1 ring-inset ring-white/[0.08]">
          <img
            src="https://i.postimg.cc/xjx4m8p5/Copia-de-logo-cor-original.png"
            alt="Doutor Digital"
            className="h-full w-full object-cover object-center"
          />
        </div>

        <div className="min-w-0 leading-tight">
          <div className="truncate text-[13px] font-semibold tracking-tight text-slate-50">
            Doutor Digital
          </div>
          <div className="mt-0.5 text-[10px] uppercase tracking-[0.18em] text-slate-500">
            Insights · v1.0
          </div>
        </div>
      </div>

      <nav className="flex-1 space-y-5 overflow-y-auto px-3 py-4">
        {navGroups.map((group) => (
          <div key={group.label}>
            <p className="mb-1.5 px-3 text-[10px] font-medium uppercase tracking-[0.18em] text-slate-500">
              {group.label}
            </p>

            <div className="space-y-0.5">
              {group.items.map((entry) =>
                isNestedEntry(entry) ? (
                  <NavCollapsible
                    key={entry.label}
                    entry={entry}
                    pathname={pathname}
                  />
                ) : (
                  <NavItemLink key={entry.to} {...entry} />
                ),
              )}
            </div>
          </div>
        ))}
      </nav>

      <div className="border-t border-white/[0.05] p-3">
        <div className="rounded-md border border-white/[0.06] bg-white/[0.02] p-3">
          <p className="text-[10px] font-medium uppercase tracking-[0.18em] text-slate-500">
            Dica
          </p>
          <p className="mt-1.5 text-[11px] leading-5 text-slate-400">
            Use a aba <span className="text-slate-200">Unidades · Amanheceu</span>{" "}
            para ver leads de cada unidade durante a madrugada.
          </p>
        </div>
      </div>
    </aside>
  );
}
