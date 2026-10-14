import { useQuery } from "@tanstack/react-query";
import { AlertTriangle } from "@/components/icons";
import { unitsService } from "@/services/units";
import { useClinic } from "@/hooks/useClinic";
import { useAuth } from "@/hooks/useAuth";

/**
 * Aviso de conta da Kommo dividida entre unidades.
 *
 * POR QUE EXISTE
 * --------------
 * Petrópolis e Caxias usam o MESMO Kommo; cada cartão diz de qual clínica é no campo
 * ⌂ Unidade de atendimento. O painel separa as duas por esse campo. Os cartões com o campo
 * VAZIO não entram em nenhuma das duas — somá-los a uma delas seria um número plausível e
 * errado. Mas também não podem sumir: ficam numa unidade à parte, "sem unidade definida",
 * e este aviso diz quantos são, para alguém ir lá e preencher o campo.
 *
 * Conta de uma unidade só: o servidor devolve `dividida: false` e nada é desenhado.
 */
export function AvisoDivisaoDaConta({ unitId }: { unitId?: number | null }) {
  const { setContext } = useClinic();
  const { user } = useAuth();

  const { data } = useQuery({
    queryKey: ["divisao-da-conta", unitId],
    queryFn: () => unitsService.divisaoDaConta(unitId!),
    enabled: unitId != null,
    staleTime: 60_000,
  });

  if (!data?.dividida) return null;

  if (data.configuracaoInvalida) {
    return (
      <div className="mb-4 rounded-xl border border-rose-400/30 bg-rose-400/[0.07] px-4 py-3">
        <p className="text-[13px] font-semibold text-rose-100">
          A entrada de leads desta conta está parada
        </p>
        <p className="mt-0.5 text-[11.5px] text-rose-100/70">
          A divisão da conta Kommo entre as unidades está com a configuração errada, e o painel
          prefere parar a misturar as unidades. Avise a equipe Doutor Digital.
        </p>
      </div>
    );
  }

  const sem = data.semUnidade;
  const outras = (data.unidades ?? []).filter((u) => u.unitId !== unitId).map((u) => u.nome);
  const campo = data.campo ?? "Unidade de atendimento";
  const podeAbrirSem =
    sem != null && (!user?.unitIds?.length || user.unitIds.includes(Number(sem.unitId)));

  // Na própria caixa dos "sem unidade": explica o que ela é.
  if (data.papel === "sem-unidade") {
    return (
      <div className="mb-4 rounded-xl border border-amber-400/25 bg-amber-400/[0.06] px-4 py-3">
        <p className="text-[13px] font-semibold text-amber-100">
          Isto não é uma clínica: são os cartões sem unidade definida
        </p>
        <p className="mt-0.5 text-[11.5px] text-amber-100/70">
          {data.cartoesDestaUnidade ?? 0} cartões da conta de{" "}
          {(data.unidades ?? []).map((u) => u.nome).join(" e ")} estão com o campo {campo} vazio, e
          por isso não entram nos números de nenhuma das unidades. Preencha o campo no Kommo e o
          cartão vai sozinho para a unidade certa.
        </p>
      </div>
    );
  }

  return (
    <div className="mb-4 flex items-start gap-3 rounded-xl border border-amber-400/25 bg-amber-400/[0.06] px-4 py-3">
      <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-amber-400/15 text-amber-300">
        <AlertTriangle className="h-4 w-4" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-[13px] font-semibold text-amber-100">
          {sem && sem.cartoes > 0
            ? `${sem.cartoes} cartões da conta estão sem unidade definida`
            : "Conta do Kommo dividida entre unidades"}
        </p>
        <p className="mt-0.5 text-[11.5px] text-amber-100/70">
          Esta unidade divide o Kommo com {outras.length ? outras.join(" e ") : "outra unidade"}. Os números
          aqui contam só os cartões com {campo} desta unidade.
          {sem && sem.cartoes > 0
            ? ` Os ${sem.cartoes} cartões com o campo vazio não entram aqui nem na outra unidade — preencha o campo no Kommo.`
            : ""}
        </p>
      </div>
      {sem && sem.cartoes > 0 && podeAbrirSem && (
        <button
          onClick={() => setContext(Number(sem.clinicId), Number(sem.unitId))}
          className="shrink-0 rounded-md border border-amber-400/30 px-3 py-1.5 text-[11.5px] font-medium text-amber-100 transition hover:bg-amber-400/10"
        >
          Ver os {sem.cartoes}
        </button>
      )}
    </div>
  );
}
