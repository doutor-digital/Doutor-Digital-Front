import { NavLink } from "react-router-dom";
import {
  LayoutDashboard,
  ListChecks,
  Contact as ContactIcon,
  DollarSign,
  MoreHorizontal,
} from "lucide-react";
import { cn } from "@/lib/utils";

const TABS = [
  { to: "/", label: "Início", icon: LayoutDashboard, end: true },
  { to: "/leads", label: "Leads", icon: ListChecks },
  { to: "/contacts", label: "Contatos", icon: ContactIcon },
  { to: "/finance", label: "Financeiro", icon: DollarSign },
  { to: "/settings", label: "Mais", icon: MoreHorizontal },
];

export function MobileBottomNav() {
  return (
    <nav
      className={cn(
        "lg:hidden fixed bottom-0 inset-x-0 z-40",
        "bg-[#0a0a0d]/95 backdrop-blur-xl",
        "border-t border-white/[0.06]",
      )}
      style={{
        paddingBottom: "env(safe-area-inset-bottom, 0px)",
      }}
    >
      <ul className="flex items-stretch justify-around h-14">
        {TABS.map(({ to, label, icon: Icon, end }) => (
          <li key={to} className="flex-1">
            <NavLink
              to={to}
              end={end}
              className={({ isActive }) =>
                cn(
                  "h-full w-full flex flex-col items-center justify-center gap-0.5",
                  "transition select-none",
                  "active:scale-[0.92]",
                  isActive ? "text-brand-400" : "text-slate-500",
                )
              }
            >
              {({ isActive }) => (
                <>
                  <Icon
                    className={cn(
                      "h-[22px] w-[22px] transition",
                      isActive
                        ? "stroke-[2.3] text-brand-400"
                        : "stroke-[1.8]",
                    )}
                  />
                  <span
                    className={cn(
                      "text-[10px] leading-none font-medium tracking-tight",
                      isActive ? "text-brand-300" : "text-slate-500",
                    )}
                  >
                    {label}
                  </span>
                </>
              )}
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  );
}
