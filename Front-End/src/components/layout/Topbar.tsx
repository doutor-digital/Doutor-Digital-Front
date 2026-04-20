import { useState } from "react";
import { Building2, ChevronDown, LogOut, RefreshCw, Search } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useClinic } from "@/hooks/useClinic";
import { useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";
import { ThemeToggle } from "@/components/ui/ThemeToggle";
import { NotificationsBell } from "@/components/layout/NotificationsBell";
import { AlertsIndicator } from "@/components/layout/AlertsIndicator";

export function Topbar() {
  const { user, logout } = useAuth();
  const { setContext } = useClinic();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [refreshing, setRefreshing] = useState(false);

  const clinicId = useClinic().unitId || useClinic().tenantId;

  async function handleRefresh() {
    setRefreshing(true);
    await qc.invalidateQueries();
    setTimeout(() => setRefreshing(false), 700);
  }

  void setContext;

  const initials = (user?.name ?? "C")
    .split(" ")
    .map((n) => n[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <header
      className={cn(
        "sticky top-0 z-20",
        "flex h-14 items-center gap-2 px-4 lg:px-6",
        "border-b border-white/[0.05]",
        "bg-[#0a0a0d]/95 backdrop-blur",
      )}
    >
      <div className="relative w-56 lg:w-72 shrink-0">
        <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-600" />
        <input
          placeholder="Buscar leads…"
          className={cn(
            "h-8 w-full rounded-md pl-8 pr-8",
            "bg-white/[0.02] border border-white/[0.07]",
            "text-[12.5px] text-slate-200 placeholder:text-slate-600",
            "outline-none transition",
            "hover:border-white/[0.12] focus:border-white/[0.18] focus:bg-white/[0.03]",
          )}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              const v = (e.target as HTMLInputElement).value.trim();
              if (v) navigate(`/leads?search=${encodeURIComponent(v)}`);
            }
          }}
        />
        <kbd className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 rounded border border-white/[0.08] bg-white/[0.03] px-1 py-px text-[10px] font-mono text-slate-500">
          ↵
        </kbd>
      </div>

      <div className="flex-1" />

      <div className="flex items-center gap-1.5">
        <button
          onClick={() => navigate("/select-unit")}
          className={cn(
            "hidden md:flex items-center gap-2 h-8 px-3 rounded-md",
            "border border-white/[0.07] bg-white/[0.02]",
            "transition hover:border-white/[0.14] hover:bg-white/[0.04]",
            "group",
          )}
        >
          <Building2 className="h-3.5 w-3.5 text-slate-500 group-hover:text-slate-300 transition" />
          <span className="text-[10px] font-medium uppercase tracking-[0.14em] text-slate-500 group-hover:text-slate-400 transition">
            Unidade
          </span>
          <span
            className={cn(
              "text-[11px] font-semibold tabular-nums max-w-[6rem] truncate",
              clinicId ? "text-slate-200" : "text-slate-600",
            )}
          >
            {clinicId || "—"}
          </span>
          <ChevronDown className="h-3 w-3 text-slate-600 group-hover:text-slate-400 transition" />
        </button>

        <div className="mx-1 h-5 w-px bg-white/[0.05]" />

        <button
          onClick={handleRefresh}
          title="Recarregar dados"
          className={cn(
            "flex h-8 w-8 items-center justify-center rounded-md",
            "text-slate-500 transition hover:bg-white/[0.04] hover:text-slate-200",
            "active:scale-95",
          )}
        >
          <RefreshCw
            className={cn(
              "h-3.5 w-3.5",
              refreshing && "animate-spin text-emerald-300",
            )}
          />
        </button>

        <NotificationsBell />
        <AlertsIndicator />
        <ThemeToggle />

        <div className="mx-1 h-5 w-px bg-white/[0.05]" />

        <div className="flex items-center gap-2">
          <div className="hidden sm:flex flex-col items-end leading-none gap-0.5">
            <span className="text-[12px] font-medium text-slate-200 leading-none">
              {user?.name ?? "Convidado"}
            </span>
            <span className="text-[10px] text-slate-500 leading-none">
              {user?.email ?? "local"}
            </span>
          </div>

          <div
            className={cn(
              "relative h-8 w-8 shrink-0 select-none rounded-md",
              "bg-white/[0.04] ring-1 ring-inset ring-white/[0.08]",
              "grid place-items-center",
              "text-[11px] font-semibold tracking-wide text-slate-100",
            )}
          >
            {initials}
            <span
              aria-label="online"
              className="absolute -bottom-0.5 -right-0.5 h-2 w-2 rounded-full bg-emerald-400 ring-2 ring-[#0a0a0d]"
            />
          </div>

          <button
            onClick={logout}
            title="Sair da conta"
            className={cn(
              "flex h-8 w-8 items-center justify-center rounded-md",
              "text-slate-500 transition hover:bg-rose-500/10 hover:text-rose-300",
              "active:scale-95",
            )}
          >
            <LogOut className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    </header>
  );
}
