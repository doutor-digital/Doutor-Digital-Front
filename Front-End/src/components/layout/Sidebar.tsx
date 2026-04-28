import { type ReactNode, useEffect, useState } from "react";
import { NavLink, useLocation } from "react-router-dom";
import {
  Activity,
  BarChart3,
  Bell,
  Building2,
  ChevronDown,
  ClipboardList,
  Cog,
  Contact as ContactIcon,
  Copy,
  DollarSign,
  FileBarChart,
  FileText,
  Filter,
  Gauge,
  History,
  LayoutDashboard,
  LifeBuoy,
  LineChart,
  ListChecks,
  type LucideIcon,
  Radio,
  ScrollText,
  Sparkles,
  Sunrise,
  TrendingUp,
  UserPlus,
  Users,
  Users2,
  Wallet,
  Workflow,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { SavedViewsSection } from "./SavedViewsSection";

type NavItem = {
  to: string;
  label: string;
  icon: LucideIcon;
  end?: boolean;
  badge?: string;
};

type NavEntry =
  | NavItem
  | {
      label: string;
      icon: LucideIcon;
      basePaths: string[];
      children: NavItem[];
      badge?: string;
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
      {
        label: "Performance",
        icon: Gauge,
        basePaths: ["/live", "/analytics", "/evolution"],
        children: [
          { to: "/live", label: "Ao vivo", icon: Radio },
          { to: "/analytics", label: "Analytics", icon: BarChart3 },
          { to: "/evolution", label: "Evolução", icon: LineChart },
        ],
      },
    ],
  },
  {
    label: "Gestão",
    items: [
      {
        label: "Leads",
        icon: ListChecks,
        basePaths: ["/leads", "/recent-leads", "/recuperacao", "/funnel", "/sources"],
        children: [
          { to: "/leads", label: "Todos os leads", icon: ListChecks, end: true },
          { to: "/recent-leads", label: "Recentes", icon: History },
          { to: "/recuperacao", label: "Recuperação", icon: LifeBuoy },
          { to: "/funnel", label: "Funil", icon: Workflow },
          { to: "/sources", label: "Origens", icon: Filter },
        ],
      },
      {
        label: "Contatos",
        icon: ContactIcon,
        basePaths: ["/contacts"],
        children: [
          { to: "/contacts", label: "Lista de contatos", icon: Users, end: true },
          { to: "/contacts/new", label: "Novo contato", icon: UserPlus },
          { to: "/contacts/duplicates", label: "Duplicados", icon: Copy },
        ],
      },
      { to: "/attendants", label: "Atendentes", icon: Users2 },
      {
        label: "Unidades",
        icon: Building2,
        basePaths: ["/units", "/amanheceu"],
        children: [
          { to: "/units", label: "Lista de unidades", icon: Building2, end: true },
          { to: "/amanheceu", label: "Amanheceu", icon: Sunrise, badge: "Novo" },
          { to: "/live", label: "Ao vivo (por unidade)", icon: Radio },
        ],
      },
    ],
  },
  {
    label: "Financeiro",
    items: [
      {
        label: "Financeiro",
        icon: DollarSign,
        basePaths: ["/finance"],
        children: [
          { to: "/finance", label: "Visão geral", icon: Wallet, end: true },
          { to: "/finance?tab=revenue", label: "Receita", icon: TrendingUp },
          { to: "/finance?tab=transactions", label: "Transações", icon: ClipboardList },
        ],
      },
    ],
  },
  {
    label: "Relatórios & Alertas",
    items: [
      {
        label: "Relatórios",
        icon: FileBarChart,
        basePaths: ["/reports"],
        children: [
          { to: "/reports", label: "Todos os relatórios", icon: FileText, end: true },
          { to: "/reports?type=performance", label: "Desempenho", icon: Activity },
          { to: "/reports?type=leads", label: "Leads", icon: ListChecks },
        ],
      },
      { to: "/alerts", label: "Alertas", icon: Bell },
    ],
  },
  {
    label: "Sistema",
    items: [
      {
        label: "Configurações",
        icon: Cog,
        basePaths: ["/settings", "/logs"],
        children: [
          { to: "/settings", label: "Geral", icon: Cog, end: true },
          { to: "/logs", label: "Logs do sistema", icon: ScrollText },
        ],
      },
    ],
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

function NavBadge({ children }: { children: ReactNode }) {
  return (
    <span className="ml-auto inline-flex items-center rounded-full bg-emerald-400/[0.12] px-1.5 py-[1px] text-[9px] font-semibold uppercase tracking-wider text-emerald-300 ring-1 ring-inset ring-emerald-400/20">
      {children}
    </span>
  );
}

function NavItemLink({ to, label, icon: Icon, end, badge }: NavItem) {
  return (
    <NavLink
      to={to}
      end={end}
      className={({ isActive }) =>
        cn(
          "group relative flex items-center gap-2.5 rounded-md px-2.5 py-2 text-[12.5px] font-medium transition-all duration-150",
          isActive
            ? "bg-white/[0.05] text-slate-50 ring-1 ring-inset ring-white/[0.08]"
            : "text-slate-400 hover:bg-white/[0.03] hover:text-slate-200",
        )
      }
    >
      {({ isActive }) => (
        <>
          {isActive && (
            <span className="absolute left-0 top-1/2 h-4 w-[2px] -translate-y-1/2 rounded-r-full bg-emerald-400" />
          )}
          <Icon
            className={cn(
              "h-4 w-4 shrink-0 transition-colors",
              isActive
                ? "text-emerald-300"
                : "text-slate-500 group-hover:text-slate-300",
            )}
          />
          <span className="truncate">{label}</span>
          {badge && <NavBadge>{badge}</NavBadge>}
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

  const activeChildCount = entry.children.filter((c) =>
    pathMatches(pathname, c.to.split("?")[0]),
  ).length;

  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className={cn(
          "group relative flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-[12.5px] font-medium transition-all duration-150",
          isWithin
            ? "bg-white/[0.04] text-slate-100 ring-1 ring-inset ring-white/[0.06]"
            : "text-slate-400 hover:bg-white/[0.03] hover:text-slate-200",
        )}
      >
        {isWithin && (
          <span className="absolute left-0 top-1/2 h-4 w-[2px] -translate-y-1/2 rounded-r-full bg-emerald-400" />
        )}
        <Icon
          className={cn(
            "h-4 w-4 shrink-0 transition-colors",
            isWithin
              ? "text-emerald-300"
              : "text-slate-500 group-hover:text-slate-300",
          )}
        />
        <span className="flex-1 text-left truncate">{entry.label}</span>
        {!open && activeChildCount === 0 && entry.children.length > 0 && (
          <span className="rounded-full bg-white/[0.04] px-1.5 py-[1px] text-[9px] font-medium tabular-nums text-slate-500 ring-1 ring-inset ring-white/[0.05]">
            {entry.children.length}
          </span>
        )}
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
          <div className="relative ml-[18px] mt-1 space-y-0.5 border-l border-white/[0.06] pl-2.5">
            {entry.children.map((child) => (
              <NavLink
                key={child.to + child.label}
                to={child.to}
                end={child.end}
                className={({ isActive }) =>
                  cn(
                    "group relative flex items-center gap-2 rounded-md px-2 py-1.5 text-[12px] font-medium transition-all duration-150",
                    isActive
                      ? "bg-emerald-400/[0.08] text-emerald-100 ring-1 ring-inset ring-emerald-400/20"
                      : "text-slate-400 hover:bg-white/[0.03] hover:text-slate-200",
                  )
                }
              >
                {({ isActive }) => (
                  <>
                    {isActive && (
                      <span className="absolute -left-[11px] top-1/2 h-1.5 w-1.5 -translate-y-1/2 rounded-full bg-emerald-400 ring-2 ring-[#0a0a0d]" />
                    )}
                    <child.icon
                      className={cn(
                        "h-3.5 w-3.5 shrink-0 transition-colors",
                        isActive
                          ? "text-emerald-300"
                          : "text-slate-500 group-hover:text-slate-300",
                      )}
                    />
                    <span className="truncate">{child.label}</span>
                    {child.badge && <NavBadge>{child.badge}</NavBadge>}
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
      <div className="relative flex items-center gap-3 border-b border-white/[0.05] px-5 py-5">
        <div className="pointer-events-none absolute inset-x-0 -bottom-px h-px bg-gradient-to-r from-transparent via-emerald-400/20 to-transparent" />

        <div className="relative h-9 w-9 shrink-0 overflow-hidden rounded-lg ring-1 ring-inset ring-white/[0.08]">
          <img
            src="https://i.postimg.cc/xjx4m8p5/Copia-de-logo-cor-original.png"
            alt="Doutor Digital"
            className="h-full w-full object-cover object-center"
          />
          <span className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full bg-emerald-400 ring-2 ring-[#0a0a0d]" />
        </div>

        <div className="min-w-0 leading-tight">
          <div className="truncate text-[13px] font-semibold tracking-tight text-slate-50">
            Doutor Digital
          </div>
          <div className="mt-0.5 flex items-center gap-1.5 text-[10px] uppercase tracking-[0.18em] text-slate-500">
            <span>Insights</span>
            <span className="text-slate-700">·</span>
            <span className="text-emerald-400/80">v1.0</span>
          </div>
        </div>
      </div>

      <nav className="flex-1 space-y-5 overflow-y-auto px-3 py-4 [&::-webkit-scrollbar]:w-1 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-white/[0.05] [&::-webkit-scrollbar-track]:bg-transparent">
        <SavedViewsSection />

        {navGroups.map((group) => (
          <div key={group.label}>
            <div className="mb-1.5 flex items-center gap-2 px-3">
              <p className="text-[10px] font-medium uppercase tracking-[0.18em] text-slate-500">
                {group.label}
              </p>
              <div className="h-px flex-1 bg-white/[0.04]" />
            </div>

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
        <div className="group relative overflow-hidden rounded-lg border border-white/[0.06] bg-gradient-to-br from-white/[0.03] to-white/[0.01] p-3 transition-colors hover:border-emerald-400/20">
          <div className="pointer-events-none absolute -right-6 -top-6 h-16 w-16 rounded-full bg-emerald-400/[0.06] blur-2xl" />

          <div className="relative">
            <div className="flex items-center gap-1.5">
              <Sparkles className="h-3 w-3 text-emerald-300" />
              <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-emerald-300/90">
                Dica
              </p>
            </div>
            <p className="mt-1.5 text-[11px] leading-5 text-slate-400">
              Use{" "}
              <span className="text-slate-200">Unidades · Amanheceu</span>{" "}
              para ver leads de cada unidade durante a madrugada.
            </p>
          </div>
        </div>
      </div>
    </aside>
  );
}
