import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { Bell, Building2, Menu, RefreshCw, Search } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useClinic } from "@/hooks/useClinic";
import { cn } from "@/lib/utils";

export function MobileTopbar({ onOpenMenu }: { onOpenMenu: () => void }) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { tenantId, unitId } = useClinic();
  const qc = useQueryClient();
  const [refreshing, setRefreshing] = useState(false);

  async function handleRefresh() {
    setRefreshing(true);
    await qc.invalidateQueries();
    setTimeout(() => setRefreshing(false), 700);
  }

  const initials = (user?.name ?? "U")
    .split(" ")
    .map((n) => n[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <header
      className={cn(
        "lg:hidden sticky top-0 z-30",
        "flex items-center gap-2 px-3",
        "bg-[#0a0a0d]/92 backdrop-blur-xl",
        "border-b border-white/[0.05]",
        "pt-safe",
      )}
      style={{ paddingTop: "max(env(safe-area-inset-top, 0px), 10px)" }}
    >
      <div className="flex items-center gap-2 h-12 w-full">
        <button
          onClick={onOpenMenu}
          className="h-9 w-9 grid place-items-center rounded-full hover:bg-white/[0.05] transition"
          aria-label="Menu"
        >
          <Menu className="h-5 w-5 text-slate-200" />
        </button>

        <div
          onClick={() => navigate("/")}
          className="flex items-center gap-2 select-none cursor-pointer"
        >
          <img
            src="https://i.postimg.cc/xjx4m8p5/Copia-de-logo-cor-original.png"
            alt="Doutor Digital"
            className="h-7 w-7 rounded-md object-cover ring-1 ring-inset ring-white/[0.08]"
          />
          <span className="text-[15px] font-semibold tracking-tight text-slate-50">
            Doutor Digital
          </span>
        </div>

        <div className="flex-1" />

        <button
          onClick={() => navigate("/select-unit")}
          className="h-9 w-9 grid place-items-center rounded-full hover:bg-white/[0.05] transition"
          aria-label="Selecionar unidade"
          title={unitId ? `Unidade ${unitId}` : `Tenant ${tenantId ?? "—"}`}
        >
          <Building2 className="h-[18px] w-[18px] text-slate-300" />
        </button>

        <button
          onClick={handleRefresh}
          className="h-9 w-9 grid place-items-center rounded-full hover:bg-white/[0.05] transition"
          aria-label="Atualizar"
        >
          <RefreshCw
            className={cn(
              "h-[18px] w-[18px] text-slate-300",
              refreshing && "animate-spin",
            )}
          />
        </button>

        <button
          onClick={() => navigate("/alerts")}
          className="h-9 w-9 grid place-items-center rounded-full hover:bg-white/[0.05] transition relative"
          aria-label="Alertas"
        >
          <Bell className="h-[18px] w-[18px] text-slate-300" />
        </button>

        <button
          onClick={() => navigate("/settings")}
          className="h-9 px-0.5 rounded-full grid place-items-center"
          aria-label="Perfil"
        >
          <div className="h-8 w-8 rounded-full bg-gradient-to-br from-brand-500 to-brand-700 grid place-items-center text-[11px] font-semibold text-white ring-2 ring-inset ring-white/[0.08]">
            {initials}
          </div>
        </button>
      </div>

      {/* Search row */}
      <div className="absolute inset-x-3 -bottom-12 h-10 hidden" />
    </header>
  );
}

export function MobileSearch() {
  const navigate = useNavigate();
  return (
    <div className="lg:hidden px-3 pt-2 pb-1">
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
        <input
          placeholder="Buscar leads, contatos…"
          className={cn(
            "h-10 w-full rounded-full pl-9 pr-4",
            "bg-white/[0.04] border border-white/[0.08]",
            "text-[14px] text-slate-100 placeholder:text-slate-500",
            "outline-none transition focus:bg-white/[0.06] focus:border-white/[0.14]",
          )}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              const v = (e.target as HTMLInputElement).value.trim();
              if (v) navigate(`/leads?search=${encodeURIComponent(v)}`);
            }
          }}
        />
      </div>
    </div>
  );
}
