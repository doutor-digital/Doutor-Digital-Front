import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CalendarDays, Check, ChevronDown, RefreshCw, TriangleAlert } from "@/components/icons";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card, CardBody } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { migracaoRetroativaService, type MovimentoMigracao } from "@/services/migracaoRetroativa";
import { useStageNames } from "@/hooks/useStageNames";
import { useClinic } from "@/hooks/useClinic";
import { cn } from "@/lib/utils";

/**
 * Migração retroativa — a tela que desfaz o estrago do mutirão.
 *
 * O QUE ELA RESOLVE
 * -----------------
 * A Kommo carimba a entrada na etapa com a hora em que a SDR ARRASTOU o card, e esse
 * carimbo não é editável lá. Quando ela migra tratamentos antigos, um mês inteiro desaba
 * no dia de hoje: o dia vira o recorde histórico da unidade e os meses reais ficam
 * vazios. Atinge todo número que conta por entrada na etapa — receita, semáforo, funil.
 *
 * POR QUE A SDR PODE USAR ISTO
 * ----------------------------
 * Porque ela não escolhe a data. O que ela faz é aceitar o dia em que a FRANQUIA lançou
 * o tratamento. A tela manda só os ids; a data quem decide é o servidor, pelo cruzamento
 * por telefone. Campo livre de data na mão de quem tem meta seria outra coisa.
 *
 * POR QUE AGRUPADO POR ETAPA
 * --------------------------
 * O mutirão é feito etapa por etapa ("hoje eu movo os EM TRATAMENTO"), então é assim que
 * a pessoa procura o próprio trabalho. E o agrupamento é pelo ID da etapa, nunca pelo
 * rótulo: na Imperatriz a mesma etapa 143 está gravada ora como "TRATAMENTO_CANCELADO",
 * ora como "143" — agrupar por texto partiria a mesma coisa em dois blocos.
 */

const hojeIso = () => new Date().toISOString().slice(0, 10);

const diasAtrasIso = (dias: number) => {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - dias);
  return d.toISOString().slice(0, 10);
};

const dataBR = (iso?: string | null) => {
  if (!iso) return "—";
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? "—"
    : d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" });
};

const horaBR = (iso?: string | null) => {
  if (!iso) return "";
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? ""
    : d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
};

/** Presets de "quando os cards foram movidos" — mutirão raramente passa de alguns dias. */
const PERIODOS = [
  { valor: "0", rotulo: "Hoje" },
  { valor: "1", rotulo: "Ontem e hoje" },
  { valor: "6", rotulo: "Últimos 7 dias" },
  { valor: "29", rotulo: "Últimos 30 dias" },
];

interface GrupoEtapa {
  etapaId: number;
  nome: string;
  itens: MovimentoMigracao[];
}

/** Agrupa pelo ID da etapa e resolve o nome de exibição. Maiores grupos primeiro. */
function agrupar(itens: MovimentoMigracao[], nomeDe: (rotulo: string, id: number) => string): GrupoEtapa[] {
  const mapa = new Map<number, MovimentoMigracao[]>();
  for (const m of itens) {
    const atual = mapa.get(m.etapa_id);
    if (atual) atual.push(m);
    else mapa.set(m.etapa_id, [m]);
  }
  return [...mapa.entries()]
    .map(([etapaId, lista]) => ({
      etapaId,
      nome: nomeDe(lista[0].etapa, etapaId),
      itens: lista,
    }))
    .sort((a, b) => b.itens.length - a.itens.length || a.nome.localeCompare(b.nome, "pt-BR"));
}

export default function MigracaoRetroativaPage() {
  const { unitId } = useClinic();
  const queryClient = useQueryClient();
  const { resolve: resolverEtapa } = useStageNames(unitId);

  const [periodo, setPeriodo] = useState("0");
  const [desmarcados, setDesmarcados] = useState<Set<number>>(new Set());
  const [recolhidos, setRecolhidos] = useState<Set<string>>(new Set());
  const [resultado, setResultado] = useState<string | null>(null);

  const movidoDe = `${diasAtrasIso(Number(periodo))}T00:00:00Z`;
  const movidoAte = `${hojeIso()}T23:59:59Z`;
  // Janela de lançamento na franquia: um ano para trás e ATÉ HOJE. Se parasse ontem, o
  // tratamento lançado hoje não seria encontrado e o trabalho normal do dia apareceria
  // como pendência — um alarme falso por dia, todo dia.
  const de = diasAtrasIso(365);
  const ate = hojeIso();

  const previa = useQuery({
    queryKey: ["migracao-retroativa", unitId, de, ate, movidoDe, movidoAte],
    queryFn: () =>
      migracaoRetroativaService.previa({ unitId: unitId!, de, ate, movidoDe, movidoAte }),
    enabled: unitId != null,
  });

  const aplicar = useMutation({
    mutationFn: (ids: number[]) =>
      migracaoRetroativaService.aplicar({ unitId: unitId!, de, ate, movidoDe, movidoAte, historyIds: ids }),
    onSuccess: (r) => {
      setResultado(
        r.corrigidas === 0
          ? "Nada foi alterado."
          : `${r.corrigidas} ${r.corrigidas === 1 ? "movimentação corrigida" : "movimentações corrigidas"}.`
      );
      setDesmarcados(new Set());
      queryClient.invalidateQueries({ queryKey: ["migracao-retroativa"] });
      // Os números do painel mudam junto: revalida o que lê entrada na etapa.
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
    },
  });

  const datar = previa.data?.datar ?? [];
  const semVinculo = previa.data?.sem_vinculo ?? [];
  // O total vem do servidor: a lista acima chega truncada de propósito.
  const semVinculoTotal = previa.data?.sem_vinculo_total ?? semVinculo.length;

  const grupos = useMemo(() => agrupar(datar, resolverEtapa), [datar, resolverEtapa]);
  const gruposSemVinculo = useMemo(
    () => agrupar(semVinculo, resolverEtapa),
    [semVinculo, resolverEtapa]
  );

  const selecionados = useMemo(
    () => datar.filter((m) => !desmarcados.has(m.history_id)),
    [datar, desmarcados]
  );

  const alterna = (id: number) =>
    setDesmarcados((atual) => {
      const novo = new Set(atual);
      if (novo.has(id)) novo.delete(id);
      else novo.add(id);
      return novo;
    });

  const alternaGrupo = (g: GrupoEtapa) => {
    const todosMarcados = g.itens.every((m) => !desmarcados.has(m.history_id));
    setDesmarcados((atual) => {
      const novo = new Set(atual);
      for (const m of g.itens) {
        if (todosMarcados) novo.add(m.history_id);
        else novo.delete(m.history_id);
      }
      return novo;
    });
  };

  // Chave com prefixo: as duas listas têm os mesmos ids de etapa, e um número só
  // faria recolher um grupo fechar o outro.
  const alternaRecolhido = (chave: string) =>
    setRecolhidos((atual) => {
      const novo = new Set(atual);
      if (novo.has(chave)) novo.delete(chave);
      else novo.add(chave);
      return novo;
    });

  if (unitId == null) {
    return (
      <div className="mx-auto w-full max-w-5xl px-4">
        <PageHeader title="Migração retroativa" />
        <EmptyState
          title="Escolha uma unidade"
          description="A correção é sempre de uma clínica por vez — o mutirão é dela, e os tratamentos também."
        />
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-5xl px-4 pb-16">
      <PageHeader
        title="Migração retroativa"
        description="Quando você move um card antigo, a Kommo marca a data de hoje. Aqui você devolve a data em que a clínica lançou o tratamento."
        actions={
          <Button variant="outline" size="sm" onClick={() => previa.refetch()} loading={previa.isFetching}>
            <RefreshCw className="mr-1.5 h-3.5 w-3.5" />
            Atualizar
          </Button>
        }
      />

      <div className="mb-5 flex flex-wrap items-center gap-2">
        <span className="text-[12px] text-slate-400">Cards movidos:</span>
        {PERIODOS.map((p) => (
          <button
            key={p.valor}
            onClick={() => {
              setPeriodo(p.valor);
              setDesmarcados(new Set());
              setResultado(null);
            }}
            className={cn(
              "rounded-lg px-3 py-1.5 text-[12px] transition-colors",
              periodo === p.valor
                ? "bg-white/[0.10] text-slate-100"
                : "text-slate-400 hover:bg-white/[0.04] hover:text-slate-200"
            )}
          >
            {p.rotulo}
          </button>
        ))}
      </div>

      {resultado && (
        <div className="mb-5 flex items-center gap-2 rounded-xl border border-emerald-400/20 bg-emerald-400/[0.06] px-4 py-3 text-[13px] text-emerald-200">
          <Check className="h-4 w-4 shrink-0" />
          {resultado}
        </div>
      )}

      {previa.isLoading ? (
        <Card>
          <CardBody className="py-10 text-center text-[13px] text-slate-400">Conferindo…</CardBody>
        </Card>
      ) : previa.isError ? (
        <EmptyState
          title="Não deu para conferir"
          description="A consulta ao servidor falhou. Tente atualizar; se continuar, avise o suporte."
        />
      ) : datar.length === 0 && semVinculo.length === 0 ? (
        <EmptyState
          title="Nada para corrigir"
          description={
            previa.data && previa.data.movimentacoes_na_janela > 0
              ? `As ${previa.data.movimentacoes_na_janela} movimentações desse período já estão na data certa.`
              : "Nenhum card foi movido nesse período."
          }
        />
      ) : (
        <div className="flex flex-col gap-6">
          {grupos.length > 0 && (
            <div className="flex flex-col gap-3">
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-white/[0.07] bg-white/[0.02] px-5 py-4">
                <div>
                  <h2 className="text-[14px] font-semibold text-slate-100">
                    {datar.length} {datar.length === 1 ? "card é" : "cards são"} de tratamento antigo
                  </h2>
                  <p className="mt-0.5 text-[12px] text-slate-400">
                    Em {grupos.length} {grupos.length === 1 ? "etapa" : "etapas"}. A clínica lançou esses
                    tratamentos em outra data.
                  </p>
                </div>
                <Button
                  onClick={() => aplicar.mutate(selecionados.map((m) => m.history_id))}
                  loading={aplicar.isPending}
                  disabled={selecionados.length === 0}
                >
                  <CalendarDays className="mr-1.5 h-4 w-4" />
                  Usar a data da clínica ({selecionados.length})
                </Button>
              </div>

              {grupos.map((g) => {
                const marcadosNoGrupo = g.itens.filter((m) => !desmarcados.has(m.history_id)).length;
                const recolhido = recolhidos.has(`datar:${g.etapaId}`);
                return (
                  <Card key={g.etapaId}>
                    <CardBody className="p-0">
                      <div className="flex flex-wrap items-center gap-3 border-b border-white/[0.06] px-5 py-3">
                        <button
                          onClick={() => alternaRecolhido(`datar:${g.etapaId}`)}
                          className="flex min-w-0 flex-1 items-center gap-2 text-left"
                          aria-expanded={!recolhido}
                        >
                          <ChevronDown
                            className={cn(
                              "h-3.5 w-3.5 shrink-0 text-slate-500 transition-transform",
                              recolhido && "-rotate-90"
                            )}
                          />
                          <span className="truncate text-[13px] font-semibold text-slate-100">{g.nome}</span>
                          <span className="shrink-0 rounded-md bg-white/[0.06] px-1.5 py-0.5 text-[11px] tabular-nums text-slate-300">
                            {g.itens.length}
                          </span>
                        </button>
                        <button
                          onClick={() => alternaGrupo(g)}
                          className="shrink-0 text-[11.5px] text-slate-400 underline-offset-2 hover:text-slate-200 hover:underline"
                        >
                          {marcadosNoGrupo === g.itens.length ? "Desmarcar etapa" : "Marcar etapa"}
                        </button>
                      </div>

                      {!recolhido && (
                        <div className="overflow-x-auto">
                          <table className="w-full text-[12.5px]">
                            <thead>
                              <tr className="border-b border-white/[0.05] text-left text-[11px] uppercase tracking-wide text-slate-500">
                                <th className="w-10 px-5 py-2" />
                                <th className="px-3 py-2 font-medium">Paciente</th>
                                <th className="px-3 py-2 font-medium">Você moveu</th>
                                <th className="px-3 py-2 font-medium text-emerald-300/80">Data real</th>
                              </tr>
                            </thead>
                            <tbody>
                              {g.itens.map((m) => {
                                const marcado = !desmarcados.has(m.history_id);
                                return (
                                  <tr
                                    key={m.history_id}
                                    className={cn(
                                      "border-b border-white/[0.03] transition-opacity",
                                      !marcado && "opacity-35"
                                    )}
                                  >
                                    <td className="px-5 py-2.5">
                                      <input
                                        type="checkbox"
                                        checked={marcado}
                                        onChange={() => alterna(m.history_id)}
                                        className="h-3.5 w-3.5 cursor-pointer accent-emerald-400"
                                        aria-label={`Corrigir ${m.paciente ?? "lead"}`}
                                      />
                                    </td>
                                    <td className="px-3 py-2.5 text-slate-200">{m.paciente ?? "—"}</td>
                                    <td className="px-3 py-2.5 tabular-nums text-slate-400">
                                      {dataBR(m.arrastado_em)}{" "}
                                      <span className="text-slate-600">{horaBR(m.arrastado_em)}</span>
                                    </td>
                                    <td className="px-3 py-2.5 font-medium tabular-nums text-emerald-300">
                                      {dataBR(m.lancado_em)}
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </CardBody>
                  </Card>
                );
              })}
            </div>
          )}

          {semVinculo.length > 0 && (
            <div className="flex flex-col gap-3">
              <div className="flex items-start gap-2.5 rounded-xl border border-amber-400/15 bg-amber-400/[0.04] px-5 py-4">
                <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0 text-amber-300/70" />
                <div>
                  <h2 className="text-[14px] font-semibold text-slate-100">
                    {semVinculoTotal} {semVinculoTotal === 1 ? "card fica" : "cards ficam"} na data de hoje
                  </h2>
                  <p className="mt-0.5 max-w-2xl text-[12px] text-slate-400">
                    Não achamos o tratamento desses pacientes no sistema da clínica, então não existe data
                    verdadeira para usar — e inventar uma seria pior. Avise o gestor: ele consegue ajustar a
                    data à mão em Mudanças de etapa.
                  </p>
                  {semVinculoTotal > semVinculo.length && (
                    <p className="mt-1.5 text-[11.5px] text-slate-500">
                      Mostrando os {semVinculo.length} mais recentes.
                    </p>
                  )}
                </div>
              </div>

              {gruposSemVinculo.map((g) => {
                // Nasce recolhido: é lista informativa, não trabalho a fazer.
                const recolhido = !recolhidos.has(`sem:${g.etapaId}`);
                return (
                  <Card key={g.etapaId}>
                    <CardBody className="p-0">
                      <button
                        onClick={() => alternaRecolhido(`sem:${g.etapaId}`)}
                        className="flex w-full items-center gap-2 px-5 py-3 text-left"
                        aria-expanded={!recolhido}
                      >
                        <ChevronDown
                          className={cn(
                            "h-3.5 w-3.5 shrink-0 text-slate-500 transition-transform",
                            recolhido && "-rotate-90"
                          )}
                        />
                        <span className="truncate text-[13px] text-slate-300">{g.nome}</span>
                        <span className="shrink-0 rounded-md bg-white/[0.06] px-1.5 py-0.5 text-[11px] tabular-nums text-slate-400">
                          {g.itens.length}
                        </span>
                      </button>

                      {!recolhido && (
                        <div className="overflow-x-auto border-t border-white/[0.06]">
                          <table className="w-full text-[12.5px]">
                            <tbody>
                              {g.itens.map((m) => (
                                <tr key={m.history_id} className="border-b border-white/[0.03]">
                                  <td className="px-5 py-2.5 text-slate-300">{m.paciente ?? "—"}</td>
                                  <td className="px-3 py-2.5 text-right tabular-nums text-slate-500">
                                    {dataBR(m.arrastado_em)}{" "}
                                    <span className="text-slate-600">{horaBR(m.arrastado_em)}</span>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </CardBody>
                  </Card>
                );
              })}
            </div>
          )}

          {previa.data && previa.data.leads_com_mais_de_um_tratamento > 0 && (
            <p className="px-1 text-[11.5px] leading-relaxed text-slate-500">
              {previa.data.leads_com_mais_de_um_tratamento}{" "}
              {previa.data.leads_com_mais_de_um_tratamento === 1
                ? "paciente tem mais de um tratamento"
                : "pacientes têm mais de um tratamento"}{" "}
              na clínica. Nesses casos usamos a data do primeiro — se o card foi movido uma vez só, o
              segundo tratamento fica sem data própria.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
