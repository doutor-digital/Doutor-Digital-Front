import { NavLink } from "react-router-dom";
import { useEffect } from "react";
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
  LogOut,
  Moon,
  Radio,
  Users2,
  Workflow,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/useAuth";

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

export function MobileDrawer({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const { user, logout } = useAuth();

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
    <div className="lg:hidden fixed inset-0 z-50">
      <div
        onClick={onClose}
        className="absolute inset-0 bg-black/60 backdrop-blur-sm animate-fade-in"
      />

      <aside
        className={cn(
          "absolute top-0 bottom-0 left-0 w-[84%] max-w-[320px]",
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
        <div className="flex items-center gap-3 px-4 py-4 border-b border-white/[0.05]">
          <div className="h-10 w-10 rounded-lg bg-gradient-to-br from-brand-500 to-brand-700 grid place-items-center text-[13px] font-semibold text-white ring-1 ring-inset ring-white/[0.08]">
            {initials}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[14px] font-semibold text-slate-50 truncate">
              {user?.name ?? "Usuário"}
            </p>
            <p className="text-[11px] text-slate-500 truncate">
              {user?.email ?? ""}
            </p>
          </div>
          <button
            onClick={onClose}
            className="h-9 w-9 grid place-items-center rounded-full hover:bg-white/[0.05] transition"
            aria-label="Fechar"
          >
            <X className="h-5 w-5 text-slate-300" />
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto px-2 py-3 space-y-4">
          {navGroups.map((group) => (
            <div key={group.label}>
              <p className="px-3 pb-1.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500">
                {group.label}
              </p>
              <div className="space-y-0.5">
                {group.items.map(({ to, label, icon: Icon, end }) => (
                  <NavLink
                    key={to}
                    to={to}
                    end={end}
                    onClick={onClose}
                    className={({ isActive }) =>
                      cn(
                        "flex items-center gap-3 rounded-lg px-3 py-2.5 transition",
                        "active:scale-[0.97]",
                        isActive
                          ? "bg-brand-500/15 text-brand-200 ring-1 ring-inset ring-brand-500/25"
                          : "text-slate-300 hover:bg-white/[0.04]",
                      )
                    }
                  >
                    {({ isActive }) => (
                      <>
                        <Icon
                          className={cn(
                            "h-[20px] w-[20px] shrink-0",
                            isActive ? "text-brand-300" : "text-slate-500",
                          )}
                        />
                        <span className="text-[14.5px] font-medium">
                          {label}
                        </span>
                      </>
                    )}
                  </NavLink>
                ))}
              </div>
            </div>
          ))}
        </nav>

        <div className="p-3 border-t border-white/[0.05]">
          <button
            onClick={() => {
              onClose();
              logout();
            }}
            className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-rose-300 hover:bg-rose-500/[0.08] active:scale-[0.97] transition"
          >
            <LogOut className="h-5 w-5" />
            <span className="text-[14.5px] font-medium">Sair</span>
          </button>
        </div>
      </aside>
    </div>
  );
}
