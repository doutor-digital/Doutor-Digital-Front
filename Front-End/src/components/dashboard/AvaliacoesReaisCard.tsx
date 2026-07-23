import { useQuery } from "@tanstack/react-query";
import { AlertTriangle } from "@/components/icons";
import { spineService } from "@/services/spine";

interface AvaliacoesReaisCardProps {
  unitId?: number;
  /** yyyy-MM-dd. Sem valor, o backend usa os últimos 30 dias. */
  de?: string;
  ate?: string;
}

/** Limite duro da API do Doutor Hérnia: nenhuma consulta pode passar de 100 dias. */
const MAX_DIAS = 100;

/**
 * Corta a janela para caber no limite da API, mantendo o fim e recuando o início.
 * Necessário porque o dashboard tem filtro de "ano", que estoura os 100 dias.
 */
function limitarJanela(de?: string, ate?: string): { de?: string; ate?: string; cortada: boolean } {
  if (!de || !ate) return { de, ate, cortada: false };
  const dias = (Date.parse(ate) - Date.parse(de)) / 86_400_000;
  if (dias <= MAX_DIAS) return { de, ate, cortada: false };
  const inicio = new Date(Date.parse(ate) - MAX_DIAS * 86_400_000);
  return { de: inicio.toISOString().slice(0, 10), ate, cortada: true };
}

function Linha({ rotulo, valor, tom }: { rotulo: string; valor: number; tom?: string }) {
  return (
    <div className="flex items-baseline justify-between py-1.5">
      <span className="text-sm text-slate-400">{rotulo}</span>
      <span className={`text-sm font-medium tabular-nums ${tom ?? "text-slate-200"}`}>{valor}</span>
    </div>
  );
}

/**
 * Avaliações — comparecimento real, vindo da agenda do Doutor Hérnia.
 *
 * Diferente dos demais cards do dashboard, o dado aqui não passa pela Kommo:
 * é o status da agenda da clínica. Serve de contraprova do campo "Compareceu"
 * preenchido pela recepção no CRM.
 */
export function AvaliacoesReaisCard({ unitId, de, ate }: AvaliacoesReaisCardProps) {
  const janela = limitarJanela(de, ate);

  const q = useQuery({
    queryKey: ["spine-avaliacoes", unitId, janela.de, janela.ate],
    queryFn: () => spineService.avaliacoes(unitId!, janela.de, janela.ate),
    enabled: !!unitId,
    staleTime: 5 * 60_000,
    retry: false,
  });

  if (!unitId) return null;

  return (
    <div className="rounded-xl border border-white/5 bg-slate-900/60 p-5">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-slate-200">Avaliações</h3>
          <p className="text-xs text-slate-500">
            Agenda do Doutor Hérnia
            {janela.cortada && ` · últimos ${MAX_DIAS} dias`}
          </p>
        </div>
        {q.data && (
          <div className="text-right">
            <div className="text-2xl font-semibold tabular-nums text-slate-100">
              {q.data.taxaComparecimento.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%
            </div>
            <div className="text-xs text-slate-500">comparecimento</div>
          </div>
        )}
      </div>

      {q.isLoading && <div className="h-24 animate-pulse rounded-lg bg-white/5" />}

      {q.isError && (
        <p className="text-sm text-slate-500">
          Integração indisponível. Verifique o token da unidade na Central de Integrações.
        </p>
      )}

      {q.data && (
        <>
          <div className="divide-y divide-white/5">
            <Linha rotulo="Agendadas" valor={q.data.agendadas} />
            <Linha rotulo="Compareceram" valor={q.data.compareceram} tom="text-emerald-400" />
            <Linha rotulo="Não compareceram" valor={q.data.naoCompareceram} tom="text-amber-400" />
            <Linha rotulo="Desmarcadas" valor={q.data.desmarcadas} tom="text-slate-400" />
            {q.data.aguardandoAtendimento > 0 && (
              <Linha rotulo="Ainda por atender" valor={q.data.aguardandoAtendimento} />
            )}
          </div>

          {q.data.alertaQualidadeDados && (
            <div className="mt-4 flex gap-2 rounded-lg border border-amber-500/20 bg-amber-500/5 p-3">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />
              <p className="text-xs leading-relaxed text-amber-200/80">
                {q.data.desmarcadas} desmarques contra {q.data.naoCompareceram} falta
                {q.data.naoCompareceram === 1 ? "" : "s"} registrada
                {q.data.naoCompareceram === 1 ? "" : "s"}. A recepção provavelmente está usando
                “desmarcado” para quem faltou — a taxa real de falta pode ser maior.
              </p>
            </div>
          )}

          {q.data.porProfissional.length > 0 && (
            <div className="mt-4 border-t border-white/5 pt-3">
              <p className="mb-2 text-xs text-slate-500">Atendimentos por profissional</p>
              {q.data.porProfissional.map((p) => (
                <Linha key={p.profissional} rotulo={p.profissional} valor={p.atendimentos} />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
