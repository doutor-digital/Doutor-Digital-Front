import { type ReactNode, useEffect, useMemo, useState } from "react";
import { NavLink, useLocation } from "react-router-dom";
import {
  Activity,
  AlertCircle,
  Award,
  BarChart3,
  Bell,
  BookOpen,
  Bot,
  Brain,
  Building2,
  CalendarRange,
  CheckCircle2,
  ChefHat,
  ChevronDown,
  ClipboardCheck,
  ClipboardList,
  ClipboardPlus,
  Cog,
  Contact as ContactIcon,
  Copy,
  DollarSign,
  FileBarChart,
  FileSearch,
  FileText,
  Filter,
  Flame,
  Gauge,
  History,
  Layers,
  LayoutDashboard,
  LifeBuoy,
  LineChart,
  ListChecks,
  type LucideIcon,
  Map,
  Network,
  PieChart,
  Plug,
  Plug2,
  Radio,
  Route as RouteIcon,
  ScrollText,
  ShieldAlert,
  SlidersHorizontal,
  Sparkles,
  Stethoscope,
  Sunrise,
  Tag,
  Target,
  Timer,
  TrendingUp,
  UploadCloud,
  UserPlus,
  Users,
  Users2,
  Wallet,
  Webhook,
  Workflow,
} from "@/components/icons";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/useAuth";
import { isAdminLevel, isReadOnly } from "@/lib/roles";
import { SavedViewsSection } from "./SavedViewsSection";

type NavItem = {
  to: string;
  label: string;
  icon: LucideIcon;
  /** PNG custom (sobrepõe o ícone lucide quando presente). */
  iconUrl?: string;
  end?: boolean;
  badge?: string;
};

type NavEntry =
  | NavItem
  | {
      label: string;
      icon: LucideIcon;
      iconUrl?: string;
      basePaths: string[];
      children: NavItem[];
      badge?: string;
    };

/** Renderiza o ícone do item: PNG custom se houver, senão o ícone lucide. */
function NavGlyph({
  icon: Icon,
  iconUrl,
  active,
  size = "h-[18px] w-[18px]",
}: {
  icon: LucideIcon;
  iconUrl?: string;
  active?: boolean;
  size?: string;
}) {
  if (iconUrl) {
    return (
      <img
        src={iconUrl}
        alt=""
        aria-hidden
        className={cn(size, "shrink-0 object-contain")}
        draggable={false}
      />
    );
  }
  return (
    <Icon
      className={cn(
        "h-4 w-4 shrink-0 transition-colors",
        active ? "text-emerald-300" : "text-slate-500 group-hover:text-slate-300",
      )}
    />
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
      { to: "/campos-customizados", label: "Campos Customizados", icon: Layers, badge: "Novo" },
      { to: "/ia", label: "I.A. · agente-Dt", icon: Bot, iconUrl: "/ai-icon.png", badge: "Novo" },
      { to: "/sdr/cadastro-geral", label: "Revisar leads", icon: Users, iconUrl: "/nav-icons/revisar.png" },
      {
        label: "Performance",
        icon: Gauge,
        iconUrl: "/nav-icons/performance.png",
        basePaths: ["/analytics", "/evolution"],
        children: [
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
        iconUrl: "/nav-icons/leads.png",
        basePaths: ["/leads", "/recent-leads", "/recuperacao", "/mudancas-etapas", "/conversao", "/funnel", "/sources"],
        children: [
          { to: "/leads", label: "Todos os leads", icon: ListChecks, end: true },
          { to: "/recent-leads", label: "Recentes", icon: History },
          { to: "/recuperacao", label: "Recuperação", icon: LifeBuoy },
          { to: "/mudancas-etapas", label: "Mudanças de etapa", icon: RouteIcon },
          { to: "/conversao", label: "Conversão", icon: PieChart },
          { to: "/funnel", label: "Funil", icon: Workflow },
          { to: "/sources", label: "Origens", icon: Filter },
        ],
      },
      {
        label: "Contatos",
        icon: ContactIcon,
        iconUrl: "/nav-icons/contatos.png",
        basePaths: ["/contacts"],
        children: [
          { to: "/contacts", label: "Lista de contatos", icon: Users, end: true },
          { to: "/contacts/new", label: "Novo contato", icon: UserPlus },
          { to: "/contacts/duplicates", label: "Duplicados", icon: Copy },
        ],
      },
      { to: "/duplicates", label: "Duplicados (leads + contatos)", icon: Copy, badge: "Novo" },
      { to: "/attendants", label: "Atendentes", icon: Users2, iconUrl: "/nav-icons/atendentes.png" },
      {
        label: "Unidades",
        icon: Building2,
        iconUrl: "/nav-icons/unidades.png",
        basePaths: ["/units", "/amanheceu", "/webhooks-monitor"],
        children: [
          { to: "/units", label: "Lista de unidades", icon: Building2, end: true },
          { to: "/webhooks-monitor", label: "Monitor de webhooks", icon: Webhook },
          { to: "/amanheceu", label: "Amanheceu", icon: Sunrise, badge: "Novo" },
        ],
      },
    ],
  },
  {
    label: "Central de Cadastros",
    items: [
      {
        label: "Cadastros · SDR",
        icon: ClipboardPlus,
        iconUrl: "/nav-icons/cadastro-sdr.png",
        basePaths: ["/sdr"],
        children: [
          { to: "/sdr",                  label: "Painel SDR",            icon: Sparkles,       end: true },
          { to: "/sdr/cadastro-geral",   label: "Revisar leads",         icon: Users,          badge: "Novo" },
          { to: "/sdr/leads-aprovados",  label: "Leads aprovados",        icon: CheckCircle2,   badge: "CRM" },
          { to: "/sdr/consultas",        label: "Consultas Realizadas",  icon: Stethoscope },
          { to: "/sdr/tratamentos",      label: "Tratamentos",            icon: Wallet },
          { to: "/sdr/tarefas",          label: "Tarefas",                icon: ClipboardCheck },
          { to: "/sdr/agenda",           label: "Agenda / Eventos",       icon: CalendarRange },
          { to: "/sdr/metas",            label: "Metas das secretárias",  icon: Target },
          { to: "/sdr/auditoria",        label: "Auditoria",              icon: FileSearch },
          { to: "/sdr/listas",           label: "Listas de domínio",      icon: BookOpen },
          { to: "/sdr/relatorios",       label: "Relatórios",             icon: FileBarChart },
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
        iconUrl: "/nav-icons/financeiro.png",
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
        iconUrl: "/nav-icons/relatorio.png",
        basePaths: ["/reports"],
        children: [
          { to: "/reports", label: "Todos os relatórios", icon: FileText, end: true },
          { to: "/reports?type=performance", label: "Desempenho", icon: Activity },
          { to: "/reports?type=leads", label: "Leads", icon: ListChecks },
        ],
      },
      { to: "/alerts", label: "Alertas", icon: Bell, iconUrl: "/nav-icons/alertas.png" },
    ],
  },
  {
    label: "Sistema",
    items: [
      { to: "/integracoes", label: "Convites", icon: UserPlus },
      {
        label: "Configurações",
        icon: Cog,
        iconUrl: "/nav-icons/configuracoes.png",
        basePaths: ["/settings", "/logs"],
        children: [
          { to: "/settings", label: "Geral", icon: Cog, end: true },
          { to: "/logs", label: "Logs do sistema", icon: ScrollText },
        ],
        // Filho "Técnicas · KPIs" é injetado só para analista_ti/super_admin (ver groups).
      },
    ],
  },
];

const chefGroup: NavGroup = {
  label: "Chef · Super-admin",
  items: [
    { to: "/chef/audit-logs", label: "Auditoria global", icon: ChefHat, iconUrl: "/nav-icons/auditoria.png" },
  ],
};

const advancedLogsGroup: NavGroup = {
  label: "Logs avançados",
  items: [
    { to: "/admin/sessions",  label: "Sessões de login", icon: History,    iconUrl: "/nav-icons/sessoes.png" },
    { to: "/admin/locations", label: "Localizações",      icon: Map,        iconUrl: "/nav-icons/localizacoes.png" },
    { to: "/admin/changes",   label: "Alterações",         icon: ScrollText, iconUrl: "/nav-icons/alteracoes.png" },
  ],
};

function isNestedEntry(
  entry: NavEntry,
): entry is Extract<NavEntry, { children: NavItem[] }> {
  return "children" in entry;
}

/** Link das Configurações Técnicas — injetado só para analista_ti / super_admin. */
const technicalSettingsChild: NavItem = {
  to: "/settings/technical",
  label: "Técnicas · KPIs",
  icon: SlidersHorizontal,
  badge: "Analista",
};

/** Adiciona o filho "Técnicas · KPIs" à seção Configurações (apenas nível admin). */
function withTechnicalSettings(groups: NavGroup[]): NavGroup[] {
  return groups.map((g) => {
    if (g.label !== "Sistema") return g;
    return {
      ...g,
      items: g.items.map((entry) =>
        isNestedEntry(entry) && entry.label === "Configurações"
          ? {
              ...entry,
              basePaths: [...entry.basePaths, "/settings/technical"],
              children: [...entry.children, technicalSettingsChild],
            }
          : entry,
      ),
    };
  });
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

function NavItemLink({ to, label, icon: Icon, iconUrl, end, badge }: NavItem) {
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
          <NavGlyph icon={Icon} iconUrl={iconUrl} active={isActive} />
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
  const iconUrl = entry.iconUrl;
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
        <NavGlyph icon={Icon} iconUrl={iconUrl} active={isWithin} />
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
  const { user } = useAuth();

  const groups = useMemo(() => {
    const role = user?.role;
    // trafego_pago: só os números (Visão geral), somente leitura.
    if (isReadOnly(role)) {
      return navGroups.filter((g) => g.label === "Visão geral");
    }
    // super_admin / analista_ti: tudo + Configurações Técnicas + Logs avançados + Chef.
    if (isAdminLevel(role)) {
      return [...withTechnicalSettings(navGroups), advancedLogsGroup, chefGroup];
    }
    return navGroups;
  }, [user?.role]);

  return (
    <aside
      className={cn(
        "hidden lg:flex lg:flex-col",
        "w-64 shrink-0",
        "border-r border-white/[0.05]",
        "bg-[#0a0a0d]",
      )}
    >
      <div className="relative flex items-center justify-center border-b border-white/[0.05] px-5 py-5">
        <div className="pointer-events-none absolute inset-x-0 -bottom-px h-px bg-gradient-to-r from-transparent via-emerald-400/20 to-transparent" />
        <img
          src="/logo-official.png"
          alt="Doutor Digital"
          className="h-11 w-auto object-contain"
          draggable={false}
        />
      </div>

      <nav className="flex-1 space-y-5 overflow-y-auto px-3 py-4 [&::-webkit-scrollbar]:w-1 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-white/[0.05] [&::-webkit-scrollbar-track]:bg-transparent">
        <SavedViewsSection />

        {groups.map((group) => (
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
