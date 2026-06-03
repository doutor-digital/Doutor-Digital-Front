import { useState } from "react";
import { LogOut, RefreshCw, RotateCcw, Search } from "@/components/icons";
import { useAuth } from "@/hooks/useAuth";
import { useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";
import { ThemeToggle } from "@/components/ui/ThemeToggle";
import { NotificationsBell } from "@/components/layout/NotificationsBell";
import { AppointmentsBell } from "@/components/layout/AppointmentsBell";
import { AlertsIndicator } from "@/components/layout/AlertsIndicator";
import { UnitSwitcher } from "@/components/layout/UnitSwitcher";

export function Topbar() {
  const { user, logout } = useAuth();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [refreshing, setRefreshing] = useState(false);
  const [clearing, setClearing] = useState(false);

  async function handleRefresh() {
    setRefreshing(true);
    await qc.invalidateQueries();
    setTimeout(() => setRefreshing(false), 700);
  }

  /**
   * Limpa cache do PWA agressivamente e recarrega a página. Útil quando
   * o service worker está servindo bundle antigo após um deploy.
   * Não mexe em localStorage/cookies pra manter o usuário logado.
   */
  async function handleClearCache() {
    if (clearing) return;
    const ok = window.confirm(
      "Limpar cache do app e recarregar?\n\nIsso desregistra o service worker e busca a versão mais recente do servidor. Você continua logado.",
    );
    if (!ok) return;

    setClearing(true);
    try {
      // 1) Limpa caches da Cache API (PWA / workbox)
      if ("caches" in window) {
        const names = await caches.keys();
        await Promise.all(names.map((n) => caches.delete(n)));
      }

      // 2) Desregistra todos os service workers
      if ("serviceWorker" in navigator) {
        const regs = await navigator.serviceWorker.getRegistrations();
        await Promise.all(regs.map((r) => r.unregister()));
      }

      // 3) Limpa cache do React Query (em memória)
      qc.clear();

      // 4) Reload com cache-busting na URL pra forçar fetch novo do HTML
      const url = new URL(window.location.href);
      url.searchParams.set("_cb", Date.now().toString());
      window.location.replace(url.toString());
    } catch (err) {
      console.error("Falha ao limpar cache:", err);
      setClearing(false);
      alert("Não foi possível limpar o cache. Tente fechar e reabrir o navegador.");
    }
  }

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
        <UnitSwitcher />

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

        <button
          onClick={handleClearCache}
          disabled={clearing}
          title="Limpar cache (PWA) e recarregar"
          aria-label="Limpar cache e recarregar"
          className={cn(
            "flex h-8 w-8 items-center justify-center rounded-md",
            "text-slate-500 transition hover:bg-amber-500/10 hover:text-amber-300",
            "active:scale-95 disabled:opacity-50",
          )}
        >
          <RotateCcw
            className={cn(
              "h-3.5 w-3.5",
              clearing && "animate-spin text-amber-300",
            )}
          />
        </button>

        <AppointmentsBell />
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

          <button
            onClick={() => navigate("/perfil")}
            title="Meu perfil"
            className={cn(
              "relative h-8 w-8 shrink-0 select-none rounded-md overflow-hidden",
              "bg-white/[0.04] ring-1 ring-inset ring-white/[0.08]",
              "grid place-items-center",
              "text-[11px] font-semibold tracking-wide text-slate-100",
              "transition hover:ring-white/[0.18]",
            )}
          >
            {user?.photoUrl ? (
              <img
                src={user.photoUrl}
                alt={user?.name ?? "avatar"}
                referrerPolicy="no-referrer"
                className="h-full w-full object-cover"
                onError={(e) => {
                  (e.target as HTMLImageElement).style.display = "none";
                }}
              />
            ) : (
              initials
            )}
            <span
              aria-label="online"
              className="absolute -bottom-0.5 -right-0.5 h-2 w-2 rounded-full bg-emerald-400 ring-2 ring-[#0a0a0d]"
            />
          </button>

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
