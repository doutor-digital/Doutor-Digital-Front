import { NavLink, useLocation } from "react-router-dom";
import { useEffect, useMemo, useState } from "react";
import {
  CalendarDays,
  BarChart3,
  Bell,
  Brain,
  Building2,
  ChevronDown,
  Cog,
  Contact as ContactIcon,
  Copy,
  DollarSign,
  FileBarChart,
  FileSearch,
  Filter,
  Layers,
  LayoutDashboard,
  LineChart,
  ListChecks,
  LogOut,
  type LucideIcon,
  Radio,
  Sunrise,
  Target,
  UserPlus,
  Users2,
  Workflow,
  X,
} from "@/components/icons";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/useAuth";
import { isReadOnly, READONLY_ALLOWED_PATHS } from "@/lib/roles";

type NavItem = {
  to: string;
  label: string;
  icon: LucideIcon;
  iconUrl?: string;
  end?: boolean;
};

type NavEntry =
  | NavItem
  | {
      label: string;
      icon: LucideIcon;
      iconUrl?: string;
      basePaths: string[];
      children: NavItem[];
    };

function DrawerGlyph({
  icon: Icon,
  iconUrl,
  active,
}: {
  icon: LucideIcon;
  iconUrl?: string;
  active?: boolean;
}) {
  if (iconUrl) {
    return (
      <img src={iconUrl} alt="" aria-hidden className="h-[22px] w-[22px] shrink-0 object-contain" draggable={false} />
    );
  }
  return (
    <Icon className={cn("h-[20px] w-[20px] shrink-0", active ? "text-brand-300" : "text-slate-500")} />
  );
}

type NavGroup = {
  label: string;
  items: NavEntry[];
};

const navGroups: NavGroup[] = [
  {
    label: "Visão geral",
    items: [
      { to: "/", label: "Dashboard", icon: LayoutDashboard, end: true, iconUrl: "/nav-icons/dashboard.png" },
      { to: "/calendario", label: "Calendário (franquia)", icon: CalendarDays },
      { to: "/campos-customizados", label: "Campos Customizados", icon: Layers },
      { to: "/ia-analytics", label: "Análise com I.A.", icon: Brain },
      { to: "/buscar-leads", label: "Buscar Leads (I.A.)", icon: FileSearch },
      { to: "/desempenho", label: "Desempenho de Mídia", icon: Target },
      { to: "/analytics", label: "Performance", icon: BarChart3, iconUrl: "/nav-icons/performance.png" },
    ],
  },
  {
    label: "Gestão",
    items: [
      { to: "/leads", label: "Leads", icon: ListChecks, iconUrl: "/nav-icons/leads.png" },
      { to: "/contacts", label: "Contatos", icon: ContactIcon, iconUrl: "/nav-icons/contatos.png" },
      { to: "/duplicates", label: "Duplicados", icon: Copy },
      { to: "/funnel", label: "Funil", icon: Workflow },
      { to: "/sources", label: "Origens", icon: Filter },
      { to: "/evolution", label: "Evolução", icon: LineChart },
      {
        label: "Unidades",
        icon: Building2,
        iconUrl: "/nav-icons/unidades.png",
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
    items: [{ to: "/finance", label: "Financeiro", icon: DollarSign, iconUrl: "/nav-icons/financeiro.png" }],
  },
  {
    label: "Relatórios",
    items: [
      { to: "/reports", label: "Relatórios", icon: FileBarChart, iconUrl: "/nav-icons/relatorio.png" },
      { to: "/alerts", label: "Alertas", icon: Bell, iconUrl: "/nav-icons/alertas.png" },
    ],
  },
  {
    label: "Sistema",
    items: [
      { to: "/integracoes", label: "Convites", icon: UserPlus },
      { to: "/settings", label: "Configurações", icon: Cog, iconUrl: "/nav-icons/configuracoes.png" },
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

function MobileNavLink({
  item,
  onClose,
}: {
  item: NavItem;
  onClose: () => void;
}) {
  return (
    <NavLink
      to={item.to}
      end={item.end}
      onClick={onClose}
      className={({ isActive }) =>
        cn(
          "flex items-center gap-3 rounded-lg px-3 py-2.5 transition active:scale-[0.97]",
          isActive
            ? "bg-brand-500/15 text-brand-200 ring-1 ring-inset ring-brand-500/25"
            : "text-slate-300 hover:bg-white/[0.04]",
        )
      }
    >
      {({ isActive }) => (
        <>
          <DrawerGlyph icon={item.icon} iconUrl={item.iconUrl} active={isActive} />
          <span className="text-[14.5px] font-medium">{item.label}</span>
        </>
      )}
    </NavLink>
  );
}

function MobileNavCollapsible({
  entry,
  pathname,
  onClose,
}: {
  entry: Extract<NavEntry, { children: NavItem[] }>;
  pathname: string;
  onClose: () => void;
}) {
  const Icon = entry.icon;
  const iconUrl = entry.iconUrl;
  const isWithin = entry.basePaths.some((p) => pathMatches(pathname, p));
  const [open, setOpen] = useState(isWithin);

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
          "flex w-full items-center gap-3 rounded-lg px-3 py-2.5 transition active:scale-[0.97]",
          isWithin
            ? "bg-white/[0.04] text-slate-100 ring-1 ring-inset ring-white/[0.06]"
            : "text-slate-300 hover:bg-white/[0.04]",
        )}
      >
        <Icon
          className={cn(
            "h-[20px] w-[20px] shrink-0",
            isWithin ? "text-brand-300" : "text-slate-500",
          )}
        />
        <span className="flex-1 text-left text-[14.5px] font-medium">
          {entry.label}
        </span>
        <ChevronDown
          className={cn(
            "h-4 w-4 shrink-0 text-slate-400 transition-transform duration-200",
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
                onClick={onClose}
                className={({ isActive }) =>
                  cn(
                    "flex items-center gap-2.5 rounded-md px-2.5 py-2 transition active:scale-[0.97]",
                    isActive
                      ? "bg-brand-500/[0.12] text-brand-100 ring-1 ring-inset ring-brand-500/25"
                      : "text-slate-300 hover:bg-white/[0.04]",
                  )
                }
              >
                {({ isActive }) => (
                  <>
                    <child.icon
                      className={cn(
                        "h-4 w-4 shrink-0",
                        isActive ? "text-brand-300" : "text-slate-500",
                      )}
                    />
                    <span className="truncate text-[13.5px] font-medium">
                      {child.label}
                    </span>
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

export function MobileDrawer({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const { user, logout } = useAuth();
  const { pathname } = useLocation();

  // trafego_pago: só os números. Filtra o menu pras rotas permitidas.
  const groups = useMemo(() => {
    if (!isReadOnly(user?.role)) return navGroups;
    const allowed = new Set<string>(READONLY_ALLOWED_PATHS);
    return navGroups
      .map((g) => ({ ...g, items: g.items.filter((it) => "to" in it && allowed.has(it.to)) }))
      .filter((g) => g.items.length > 0);
  }, [user?.role]);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  if (!open) return null;

  const initials = (user?.name ?? "U")
    .split(" ")
    .map((n) => n[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <div className="fixed inset-0 z-50 lg:hidden">
      <div
        onClick={onClose}
        className="absolute inset-0 animate-fade-in bg-black/60 backdrop-blur-sm"
      />

      <aside
        className={cn(
          "absolute bottom-0 left-0 top-0 w-[84%] max-w-[320px]",
          "bg-[#0a0a0d]",
          "border-r border-white/[0.06]",
          "flex flex-col",
          "shadow-2xl",
          "animate-slide-in-left",
        )}
        style={{
          paddingTop: "env(safe-area-inset-top, 0px)",
          paddingBottom: "env(safe-area-inset-bottom, 0px)",
        }}
      >
        <div className="flex items-center gap-3 border-b border-white/[0.05] px-4 py-4">
          <div className="grid h-10 w-10 place-items-center rounded-lg bg-gradient-to-br from-brand-500 to-brand-700 text-[13px] font-semibold text-white ring-1 ring-inset ring-white/[0.08]">
            {initials}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-[14px] font-semibold text-slate-50">
              {user?.name ?? "Usuário"}
            </p>
            <p className="truncate text-[11px] text-slate-500">
              {user?.email ?? ""}
            </p>
          </div>
          <button
            onClick={onClose}
            className="grid h-9 w-9 place-items-center rounded-full transition hover:bg-white/[0.05]"
            aria-label="Fechar"
          >
            <X className="h-5 w-5 text-slate-300" />
          </button>
        </div>

        <nav className="flex-1 space-y-4 overflow-y-auto px-2 py-3">
          {groups.map((group) => (
            <div key={group.label}>
              <p className="px-3 pb-1.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500">
                {group.label}
              </p>
              <div className="space-y-0.5">
                {group.items.map((entry) =>
                  isNestedEntry(entry) ? (
                    <MobileNavCollapsible
                      key={entry.label}
                      entry={entry}
                      pathname={pathname}
                      onClose={onClose}
                    />
                  ) : (
                    <MobileNavLink
                      key={entry.to}
                      item={entry}
                      onClose={onClose}
                    />
                  ),
                )}
              </div>
            </div>
          ))}
        </nav>

        <div className="border-t border-white/[0.05] p-3">
          <button
            onClick={() => {
              onClose();
              logout();
            }}
            className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2.5 text-rose-300 transition hover:bg-rose-500/[0.08] active:scale-[0.97]"
          >
            <LogOut className="h-5 w-5" />
            <span className="text-[14.5px] font-medium">Sair</span>
          </button>
        </div>
      </aside>
    </div>
  );
}
