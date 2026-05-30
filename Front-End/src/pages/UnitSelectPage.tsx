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
    <div className="relative min-h-screen w-full bg-[#f6f7fb] py-4 sm:py-6">
      <div className="min-h-[calc(100vh-2rem)] w-full border-y border-slate-200 bg-white px-4 py-8 shadow-sm sm:px-10 sm:py-10 lg:px-16 lg:py-12 xl:border-x xl:rounded-[32px]">
        <div className="flex items-center justify-end">
          <button
            onClick={logout}
            className="flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-semibold text-slate-800 transition hover:bg-slate-50"
          >
            <LogOut className="h-5 w-5" />
            Sair
          </button>
        </div>

        <div className="mt-6 text-center">
          <h1 className="text-3xl font-bold tracking-tight text-slate-800 sm:text-4xl">
            {isEmpty ? "Nenhuma unidade cadastrada" : "Escolha uma conta"}
          </h1>
          {isEmpty && (
            <p className="mx-auto mt-3 max-w-xl text-sm text-slate-500">
              Cadastre sua primeira unidade. Cada unidade gera uma URL própria de
              webhook da Kommo, pra os dados entrarem já separados por unidade.
            </p>
          )}
        </div>

        {isEmpty ? (
          <div className="mx-auto mt-12 flex max-w-md flex-col items-center gap-6">
            <button
              onClick={() => navigate("/units")}
              className="group flex h-44 w-44 flex-col items-center justify-center gap-3 rounded-full border-2 border-dashed border-blue-200 bg-blue-50 text-blue-600 transition hover:border-blue-400 hover:bg-blue-100"
            >
              <Plus className="h-10 w-10 transition group-hover:scale-110" />
              <span className="text-sm font-semibold">Criar unidade</span>
            </button>
            <button
              onClick={() => navigate("/units")}
              className="rounded-xl bg-blue-600 px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-blue-500/20 transition hover:bg-blue-700"
            >
              Ir para gestão de unidades
            </button>
          </div>
        ) : (
          <>
            <div className="mx-auto mt-10 max-w-[500px]">
              <div className="relative">
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Pesquisar sua conta"
                  className="h-12 w-full rounded-lg border border-slate-300 bg-white py-3 pl-4 pr-12 text-sm text-slate-700 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
                />
                <Search className="absolute right-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
              </div>
            </div>

            <div className="mt-16 grid grid-cols-1 gap-x-6 gap-y-12 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6">
              {options.map((unit) => (
                <button
                  key={unit.id}
                  onClick={() => {
                    setContext(unit.clinicId, Number(unit.id));
                    navigate("/");
                  }}
                  className="group flex flex-col items-center justify-start text-center transition-transform duration-200 hover:-translate-y-1"
                >
                  <div className="flex h-36 w-36 items-center justify-center overflow-hidden rounded-full bg-slate-50 p-4 transition duration-200 group-hover:bg-white group-hover:shadow-lg sm:h-40 sm:w-40">
                    <img
                      src={unit.logo}
                      alt={unit.name}
                      className="h-full w-full object-contain"
                      onError={(e) => {
                        (e.currentTarget as HTMLImageElement).src = DEFAULT_UNIT_LOGO;
                      }}
                    />
                  </div>

                  <p className="mt-6 w-full px-2 text-[13px] font-extrabold uppercase leading-snug text-slate-800 sm:text-[15px]">
                    {unit.name}
                  </p>
                </button>
              ))}

              {/* Botão "+" pra criar mais unidades direto daqui */}
              <button
                onClick={() => navigate("/units")}
                className="group flex flex-col items-center justify-start text-center transition-transform duration-200 hover:-translate-y-1"
              >
                <div className="flex h-36 w-36 items-center justify-center rounded-full border-2 border-dashed border-slate-300 bg-slate-50 text-slate-400 transition group-hover:border-blue-400 group-hover:bg-blue-50 group-hover:text-blue-500 sm:h-40 sm:w-40">
                  <Plus className="h-10 w-10" />
                </div>
                <p className="mt-6 w-full px-2 text-[13px] font-extrabold uppercase leading-snug text-slate-500 group-hover:text-blue-600 sm:text-[15px]">
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
