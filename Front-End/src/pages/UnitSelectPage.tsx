import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { LogOut, Plus, Search } from "@/components/icons";
import { useNavigate } from "react-router-dom";
import { unitsService } from "@/services/units";
import { useClinic } from "@/hooks/useClinic";
import { useAuth } from "@/hooks/useAuth";

const DEFAULT_UNIT_LOGO =
  "https://stract.to/wp-content/uploads/2024/12/kommo-crm.png";

interface UnitOption {
  id: string | number;
  clinicId: number;
  name: string;
  logo: string;
}

export default function UnitSelectPage() {
  const navigate = useNavigate();
  const { logout } = useAuth();
  const { setContext } = useClinic();
  const [search, setSearch] = useState("");

  const units = useQuery({
    queryKey: ["units", "selector"],
    queryFn: () => unitsService.list(),
    retry: false,
  });

  const options = useMemo<UnitOption[]>(() => {
    const fromApi = (units.data ?? [])
      .map((unit): UnitOption | null => {
        const clinicId =
          typeof unit.clinicId === "number" ? unit.clinicId : Number(unit.clinicId);

        if (Number.isNaN(clinicId)) return null;

        return {
          id: unit.id,
          clinicId,
          name: unit.name?.trim() || `Unidade ${clinicId}`,
          logo: unit.photoUrl || unit.logo_url || DEFAULT_UNIT_LOGO,
        };
      })
      .filter((item): item is UnitOption => item !== null);

    return fromApi.filter((item) => {
      const normalized = `${item.name} ${item.clinicId}`.toLowerCase();
      return normalized.includes(search.toLowerCase());
    });
  }, [search, units.data]);

  const isEmpty = !units.isLoading && options.length === 0 && !search;
  return (
    <div
      className="relative min-h-screen w-full overflow-hidden px-4 py-6 text-white sm:px-8 lg:px-12"
      style={{
        background:
          "radial-gradient(ellipse at top, #1a3565 0%, #0a1a36 45%, #050d22 100%)",
        fontFamily: "'PT Sans', ui-sans-serif, system-ui, sans-serif",
      }}
    >
      {/* Padrão pontilhado + brilhos da marca */}
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.06]"
        style={{
          backgroundImage: "radial-gradient(rgba(255,255,255,0.6) 1px, transparent 1px)",
          backgroundSize: "22px 22px",
        }}
      />
      <div className="pointer-events-none absolute -top-32 -right-24 h-96 w-96 rounded-full bg-emerald-500/10 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-32 -left-24 h-96 w-96 rounded-full bg-cyan-500/10 blur-3xl" />

      <div className="relative mx-auto max-w-[1200px]">
        {/* Topo: marca + sair */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <img src="/logo-mark.png" alt="Doutor Digital Dash" className="h-8 w-auto object-contain" />
            <span className="text-[15px] font-semibold tracking-tight text-white/90">
              Doutor Digital
            </span>
          </div>
          <button
            onClick={logout}
            className="flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm font-medium text-white/80 transition hover:bg-white/10"
          >
            <LogOut className="h-4 w-4" />
            Sair
          </button>
        </div>

        <div className="mt-10 text-center animate-fade-in">
          <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
            {isEmpty ? "Nenhuma unidade cadastrada" : "Escolha uma conta"}
          </h1>
          <p className="mx-auto mt-3 max-w-xl text-sm text-white/50">
            {isEmpty
              ? "Cadastre sua primeira unidade. Cada unidade gera uma URL própria de webhook da Kommo, pra os dados entrarem já separados por unidade."
              : "Selecione a unidade que você quer acompanhar no painel."}
          </p>
        </div>

        {isEmpty ? (
          <div className="mx-auto mt-12 flex max-w-md flex-col items-center gap-6">
            <button
              onClick={() => navigate("/units/new")}
              className="group flex h-44 w-44 flex-col items-center justify-center gap-3 rounded-full border-2 border-dashed border-emerald-400/40 bg-emerald-500/10 text-emerald-300 transition hover:border-emerald-400/70 hover:bg-emerald-500/15"
            >
              <Plus className="h-10 w-10 transition group-hover:scale-110" />
              <span className="text-sm font-semibold">Criar unidade</span>
            </button>
            <button
              onClick={() => navigate("/units/new")}
              className="rounded-full bg-emerald-500 px-6 py-3 text-sm font-bold text-[#04210f] shadow-[0_0_24px_rgba(16,185,129,0.35)] transition hover:bg-emerald-400"
            >
              Ir para gestão de unidades
            </button>
          </div>
        ) : (
          <>
            <div className="mx-auto mt-9 max-w-[480px]">
              <div className="relative">
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Pesquisar sua conta"
                  className="h-12 w-full rounded-full border border-white/10 bg-white/5 py-3 pl-5 pr-12 text-sm text-white outline-none transition placeholder:text-white/40 focus:border-emerald-400/50 focus:bg-white/[0.07]"
                />
                <Search className="absolute right-4 top-1/2 h-5 w-5 -translate-y-1/2 text-white/40" />
              </div>
            </div>

            <div className="mt-10 grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
              {options.map((unit) => (
                <button
                  key={unit.id}
                  onClick={() => {
                    setContext(unit.clinicId, Number(unit.id));
                    navigate("/");
                  }}
                  className="group flex flex-col items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.04] p-4 text-center transition duration-200 hover:-translate-y-1 hover:border-emerald-400/40 hover:bg-white/[0.07]"
                >
                  <div className="flex h-24 w-24 items-center justify-center overflow-hidden rounded-full bg-white p-3 shadow-md sm:h-28 sm:w-28">
                    <img
                      src={unit.logo}
                      alt={unit.name}
                      className="h-full w-full object-contain"
                      onError={(e) => {
                        (e.currentTarget as HTMLImageElement).src = DEFAULT_UNIT_LOGO;
                      }}
                    />
                  </div>
                  <p className="w-full px-1 text-[12px] font-bold uppercase leading-snug text-white/85 sm:text-[13px]">
                    {unit.name}
                  </p>
                </button>
              ))}

              {/* Card "Nova unidade" */}
              <button
                onClick={() => navigate("/units/new")}
                className="group flex flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-white/15 bg-white/[0.02] p-4 text-center transition duration-200 hover:-translate-y-1 hover:border-emerald-400/50 hover:bg-emerald-500/5"
              >
                <div className="flex h-24 w-24 items-center justify-center rounded-full border-2 border-dashed border-white/15 text-white/40 transition group-hover:border-emerald-400/50 group-hover:text-emerald-300 sm:h-28 sm:w-28">
                  <Plus className="h-9 w-9" />
                </div>
                <p className="w-full px-1 text-[12px] font-bold uppercase leading-snug text-white/50 transition group-hover:text-emerald-300 sm:text-[13px]">
                  Nova unidade
                </p>
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
