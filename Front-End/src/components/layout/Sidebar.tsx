import { NavLink } from "react-router-dom";
import {
  BarChart3,
  Bell,
  Building2,
  Cog,
  Contact as ContactIcon,
  DollarSign,
  FileBarChart,
  Filter,
  LayoutDashboard,
  LineChart,
  ListChecks,
  Moon,
  Radio,
  Users2,
  Workflow,
} from "lucide-react";
import { cn } from "@/lib/utils";

const navGroups = [
  {
    label: "Visão geral",
    items: [
      { to: "/", label: "Dashboard", icon: LayoutDashboard, end: true },
      { to: "/live", label: "Ao vivo", icon: Radio },
      { to: "/amanheceu", label: "Amanheceu", icon: Moon },
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
      { to: "/units", label: "Unidades", icon: Building2 },
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

export function Sidebar() {
  return (
    <aside
      className={cn(
        "hidden lg:flex lg:flex-col",
        "w-64 shrink-0",
        "border-r border-white/[0.05]",
        "bg-[#0a0a0d]",
      )}
    >
      <div className="flex items-center gap-3 px-5 py-5 border-b border-white/[0.05]">
        <div className="h-9 w-9 shrink-0 overflow-hidden rounded-lg ring-1 ring-inset ring-white/[0.08]">
          <img
            src="https://i.postimg.cc/xjx4m8p5/Copia-de-logo-cor-original.png"
            alt="Doutor Digital"
            className="h-full w-full object-cover object-center"
          />
        </div>

        <div className="leading-tight min-w-0">
          <div className="text-[13px] font-semibold text-slate-50 tracking-tight truncate">
            Doutor Digital
          </div>
          <div className="text-[10px] uppercase tracking-[0.18em] text-slate-500 mt-0.5">
            Insights · v1.0
          </div>
        </div>
      </div>

      <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-5">
        {navGroups.map((group) => (
          <div key={group.label}>
            <p className="mb-1.5 px-3 text-[10px] font-medium uppercase tracking-[0.18em] text-slate-500">
              {group.label}
            </p>

            <div className="space-y-0.5">
              {group.items.map(({ to, label, icon: Icon, end }) => (
                <NavLink
                  key={to}
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
              ))}
            </div>
          </div>
        ))}
      </nav>

      <div className="p-3 border-t border-white/[0.05]">
        <div className="rounded-md border border-white/[0.06] bg-white/[0.02] p-3">
          <p className="text-[10px] font-medium uppercase tracking-[0.18em] text-slate-500">
            Dica
          </p>
          <p className="mt-1.5 text-[11px] leading-5 text-slate-400">
            Use filtros por intervalo para cruzar conversão e origem em tempo real.
          </p>
        </div>
      </div>
    </aside>
  );
}
