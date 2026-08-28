import { useQuery } from "@tanstack/react-query";
import { isSemAutorizacaoFranquia, spineService, type SpineTratamentos } from "@/services/spine";
import { SemAutorizacaoFranquia } from "@/components/dashboard/SemAutorizacaoFranquia";

interface Props {
  unitId?: number;
  de?: string;
  ate?: string;
  className?: string;
}

/** Cores por situação do tratamento (do CRM da franquia). */
const COR: Record<string, string> = {
  "EM ANDAMENTO": "#38bdf8",
  FINALIZADO: "#34d399",
  CONCLUÍDO: "#34d399",
  "NÃO INICIADO": "#fbbf24",
  ATENDIDO: "#a3e635",
  "DESISTÊNCIA A PEDIDO DO PACIENTE": "#f87171",
  OUTROS: "#94a3b8",
};

const brl = (n: number) =>
  n.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });

/**
 * Situação dos tratamentos da unidade, vinda da rota oficial da franquia desde que ela
 * foi liberada. Quando a unidade não tem token, o back cai no export raspado do CRM web
 * — e o card diz qual das duas respondeu, porque o retroativo das duas não é o mesmo.
 */
export function TratamentosCard({ unitId, de, ate, className = "" }: Props) {
  const q = useQuery({
    queryKey: ["spine-tratamentos", unitId, de, ate],
    queryFn: () => spineService.tratamentos(unitId!, de, ate),
    enabled: !!unitId,
    staleTime: 5 * 60 * 1000,
    retry: false,
  });

  const d: SpineTratamentos | undefined = q.data;

  return (
    <div className={`rounded-2xl border border-white/10 bg-[#0d1526] p-5 ${className}`}>
      <div className="mb-3 flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-white">Tratamentos</h3>
          <p className="text-xs text-slate-400">
            Situação e valor · {d?.fonte === "web" ? "export do CRM da franquia" : "API da franquia"}
          </p>
        </div>
        {d && (
          <span className="rounded-full bg-white/5 px-2.5 py-1 text-[10px] font-medium text-slate-300">
            {d.total} no período
          </span>
        )}
      </div>

      {q.isLoading && <div className="h-24 w-full animate-pulse rounded-lg bg-white/5" />}

      {q.isError && isSemAutorizacaoFranquia(q.error) && (
        <SemAutorizacaoFranquia recurso="A situação dos tratamentos" />
      )}

      {q.isError && !isSemAutorizacaoFranquia(q.error) && (
        <p className="text-xs text-amber-400">
          Não foi possível carregar (CRM da franquia indisponível).
        </p>
      )}

      {d && (
        <>
          <div className="mb-4 flex items-baseline gap-2">
            <span className="text-3xl font-bold text-white">{brl(d.valorTotal)}</span>
            <span className="text-xs text-slate-400">valor total</span>
          </div>

          {/* Barra empilhada por situação */}
          <div className="mb-3 flex h-2.5 w-full overflow-hidden rounded-full bg-white/5">
            {d.porSituacao.map((s) => (
              <div
                key={s.situacao}
                title={`${s.situacao}: ${s.quantidade}`}
                style={{
                  width: `${d.total ? (s.quantidade / d.total) * 100 : 0}%`,
                  background: COR[s.situacao] ?? "#64748b",
                }}
              />
            ))}
          </div>

          <ul className="space-y-1.5">
            {d.porSituacao.map((s) => (
              <li key={s.situacao} className="flex items-center justify-between text-xs">
                <span className="flex items-center gap-2 text-slate-300">
                  <span
                    className="inline-block h-2 w-2 rounded-full"
                    style={{ background: COR[s.situacao] ?? "#64748b" }}
                  />
                  {s.situacao}
                </span>
                <span className="tabular-nums text-slate-400">
                  <b className="text-white">{s.quantidade}</b> · {brl(s.valor)}
                </span>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
