import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Building2, Check, ChevronDown } from "@/components/icons";
import { unitsService } from "@/services/units";
import { useClinic } from "@/hooks/useClinic";
import { useAuth } from "@/hooks/useAuth";
import { cn } from "@/lib/utils";

/**
 * Seletor global de unidade (dropdown inline no Topbar).
 *
 * Troca o contexto (`useClinic`) sem sair da página — o dashboard reage à
 * mudança de `unitId`. A opção "Todas as unidades" define `unitId = null`,
 * que o backend trata como agregação por tenant (consolidado).
 */
export function UnitSwitcher() {
  const { tenantId, unitId, setContext } = useClinic();
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const unitsQ = useQuery({
    queryKey: ["units", "switcher"],
    queryFn: () => unitsService.list(),
    staleTime: 60_000,
  });

  // Escopo no cliente: se o usuário tem unitIds atribuídas, mostra só as dele.
  const units = useMemo(() => {
    const all = unitsQ.data ?? [];
    const allowed = user?.unitIds;
    if (allowed && allowed.length) {
      return all.filter((u) => allowed.includes(Number(u.id)));
    }
    return all;
  }, [unitsQ.data, user?.unitIds]);

  const currentName = useMemo(() => {
    if (unitId == null) return "Todas as unidades";
    const u = units.find((x) => Number(x.id) === Number(unitId));
    return u?.name?.trim() || `Unidade ${unitId}`;
  }, [unitId, units]);

  // Fecha ao clicar fora.
  useEffect(() => {
    if (!open) return;
    function onDoc(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  function pick(nextTenant: number, nextUnit: number | null) {
    setContext(nextTenant, nextUnit);
    setOpen(false);
  }

  // Tenant base para "Todas": o atual, ou a clínica da 1ª unidade disponível.
  const baseTenant = tenantId ?? (units[0] ? Number(units[0].clinicId) : null);

  const itemCls =
    "flex w-full items-center justify-between gap-2 rounded-md px-3 py-2 text-left text-[12.5px] text-slate-300 transition hover:bg-white/[0.05] hover:text-slate-100";

  return (
    <div className="relative hidden md:block" ref={ref}>
      <button
        onClick={() => setOpen((o) => !o)}
        className={cn(
          "flex items-center gap-2 h-8 px-3 rounded-md",
          "border border-white/[0.07] bg-white/[0.02]",
          "transition hover:border-white/[0.14] hover:bg-white/[0.04]",
          "group",
        )}
      >
        <Building2 className="h-3.5 w-3.5 text-slate-500 transition group-hover:text-slate-300" />
        <span className="text-[10px] font-medium uppercase tracking-[0.14em] text-slate-500 transition group-hover:text-slate-400">
          Unidade
        </span>
        <span className="max-w-[9rem] truncate text-[11px] font-semibold text-slate-200">
          {currentName}
        </span>
        <ChevronDown className="h-3 w-3 text-slate-600 transition group-hover:text-slate-400" />
      </button>

      {open && (
        <div className="absolute right-0 z-50 mt-1.5 w-64 rounded-lg border border-white/[0.08] bg-[#0e0e12] p-1 shadow-xl">
          <button
            onClick={() => baseTenant != null && pick(baseTenant, null)}
            disabled={baseTenant == null}
            className={cn(itemCls, "font-medium disabled:opacity-40")}
          >
            <span>Todas as unidades</span>
            {unitId == null && <Check className="h-3.5 w-3.5 text-emerald-400" />}
          </button>

          <div className="my-1 h-px bg-white/[0.06]" />

          <div className="max-h-64 overflow-y-auto">
            {unitsQ.isLoading ? (
              <p className="px-3 py-2 text-[12px] text-slate-500">Carregando…</p>
            ) : units.length === 0 ? (
              <p className="px-3 py-2 text-[12px] text-slate-500">
                Nenhuma unidade
              </p>
            ) : (
              units.map((u) => {
                const active = Number(u.id) === Number(unitId);
                return (
                  <button
                    key={String(u.id)}
                    onClick={() => pick(Number(u.clinicId), Number(u.id))}
                    className={itemCls}
                  >
                    <span className="truncate">
                      {u.name?.trim() || `Unidade ${u.clinicId}`}
                    </span>
                    {active && <Check className="h-3.5 w-3.5 text-emerald-400" />}
                  </button>
                );
              })
            )}
          </div>

          <div className="my-1 h-px bg-white/[0.06]" />

          <Link
            to="/units"
            onClick={() => setOpen(false)}
            className="block rounded-md px-3 py-2 text-[11.5px] text-slate-400 transition hover:bg-white/[0.04] hover:text-slate-200"
          >
            Gerenciar unidades →
          </Link>
        </div>
      )}
    </div>
  );
}
