import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ChevronDown, ChevronRight } from "@/components/icons";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";

interface FilaItem {
  leadId?: number | null;
  nome?: string | null;
  telefone?: string | null;
  detalhe?: string | null;
  quando?: string | null;
}

interface Fila {
  id: string;
  titulo: string;
  /** Por que isso não pode esperar. */
  porque: string;
  /** alta · media */
  urgencia: string;
  quantidade: number;
  itens: FilaItem[];
}

interface FilasDto {
  totalPendente: number;
  filas: Fila[];
}

/**
 * O que precisa de alguém agora.
 *
 * O resto do dashboard responde "como foi o mês", e ninguém abre isso todo dia. Fila é o
 * que muda o hábito: listas curtas, com nome e telefone, que somem quando resolvidas.
 *
 * Cada uma nasceu de um buraco real desta operação — lead esquecido que só aparece quando
 * já virou perdido, agendado sem data que nunca entra em lembrete, e as faltas de ontem,
 * que ninguém procura no dia seguinte.
 */
export function FilasCard({ unitId }: { unitId?: number | null }) {
  const [aberta, setAberta] = useState<string | null>(null);

  const { data } = useQuery({
    queryKey: ["filas", unitId],
    queryFn: async () => {
      const { data } = await api.get<FilasDto>("/api/saude/filas", {
        params: unitId ? { unitId } : {},
      });
      return data;
    },
    enabled: !!unitId,
    staleTime: 2 * 60_000,
  });

  if (!data || data.filas.length === 0) return null;

  return (
    <div className="mb-4 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3.5">
      <p className="mb-3 text-[10.5px] font-semibold uppercase tracking-[0.14em] text-slate-500">
        Precisa de alguém agora
      </p>

      <div className="space-y-1.5">
        {data.filas.map((f) => {
          const abertaAqui = aberta === f.id;
          return (
            <div
              key={f.id}
              className={cn(
                "overflow-hidden rounded-lg border",
                f.urgencia === "alta"
                  ? "border-rose-400/20 bg-rose-400/[0.04]"
                  : "border-slate-200 bg-slate-50",
              )}
            >
              <button
                onClick={() => setAberta(abertaAqui ? null : f.id)}
                className="flex w-full items-center gap-3 px-3 py-2.5 text-left transition hover:bg-slate-50"
              >
                <span
                  className={cn(
                    "grid h-7 w-7 shrink-0 place-items-center rounded-md text-[13px] font-semibold tabular-nums",
                    f.urgencia === "alta"
                      ? "bg-rose-400/15 text-rose-300"
                      : "bg-slate-50 text-slate-300",
                  )}
                >
                  {f.quantidade}
                </span>

                <div className="min-w-0 flex-1">
                  <p className="truncate text-[12.5px] font-medium text-slate-200">{f.titulo}</p>
                  <p className="truncate text-[11px] text-slate-500">{f.porque}</p>
                </div>

                {abertaAqui ? (
                  <ChevronDown className="h-4 w-4 shrink-0 text-slate-500" />
                ) : (
                  <ChevronRight className="h-4 w-4 shrink-0 text-slate-500" />
                )}
              </button>

              {abertaAqui && (
                <ul className="max-h-64 divide-y divide-slate-200] overflow-y-auto border-t border-slate-200">
                  {f.itens.map((i, idx) => (
                    <li
                      key={`${f.id}-${i.leadId ?? idx}`}
                      className="flex items-baseline gap-3 px-3 py-2"
                    >
                      <span className="min-w-0 flex-1 truncate text-[12px] text-slate-300">
                        {i.nome?.trim() || "Sem nome"}
                        {i.detalhe && (
                          <span className="ml-1.5 text-[11px] text-slate-600">{i.detalhe}</span>
                        )}
                      </span>
                      {/* Telefone visível: a fila serve para ligar, não para admirar. */}
                      {i.telefone && (
                        <span className="shrink-0 text-[11.5px] tabular-nums text-slate-400">
                          {i.telefone}
                        </span>
                      )}
                      {i.quando && (
                        <span className="w-[86px] shrink-0 text-right text-[11px] tabular-nums text-slate-600">
                          {new Date(i.quando).toLocaleString("pt-BR", {
                            day: "2-digit",
                            month: "2-digit",
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </span>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
