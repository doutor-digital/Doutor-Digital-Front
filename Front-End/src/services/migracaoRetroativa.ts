import { api } from "@/lib/api";

/** Uma movimentação de card feita no mutirão. */
export interface MovimentoMigracao {
  history_id: number;
  paciente: string | null;
  etapa: string;
  /** Quando a SDR arrastou o card — o que a Kommo carimbou. */
  arrastado_em: string;
  /** Quando a franquia lançou o tratamento — a data verdadeira. Só vem em `datar`. */
  lancado_em?: string | null;
}

export interface PreviaMigracao {
  unit_id: number;
  janela_de: string;
  janela_ate: string;
  movimentacoes_na_janela: number;
  leads_com_tratamento: number;
  leads_com_mais_de_um_tratamento: number;
  /** O que dá para corrigir sozinho: tem tratamento na franquia, em outro dia. */
  datar: MovimentoMigracao[];
  /** Sem tratamento casado — a SDR não corrige, sobe para o gestor. */
  sem_vinculo: MovimentoMigracao[];
}

/**
 * Migração retroativa: devolver a data real aos cards movidos em mutirão.
 *
 * A Kommo carimba a entrada na etapa com a hora do ARRASTE e não deixa editar. Quando a
 * SDR migra tratamentos antigos, um mês inteiro desaba no dia de hoje. Aqui ela carimba
 * a data em que a franquia lançou o tratamento.
 *
 * A data NUNCA vai daqui para o servidor — só os ids. Quem decide a data é o cruzamento
 * com a franquia, no back. É isso que torna seguro deixar a tela na mão de quem tem meta.
 */
export const migracaoRetroativaService = {
  async previa(params: {
    unitId: number;
    de: string;
    ate: string;
    movidoDe: string;
    movidoAte: string;
  }): Promise<PreviaMigracao> {
    const { data } = await api.get<PreviaMigracao>("/api/admin/stage-history/migracao", {
      params: {
        unitId: params.unitId,
        de: params.de,
        ate: params.ate,
        movidoDe: params.movidoDe,
        movidoAte: params.movidoAte,
      },
    });
    return data;
  },

  async aplicar(params: {
    unitId: number;
    de: string;
    ate: string;
    movidoDe: string;
    movidoAte: string;
    historyIds: number[];
  }): Promise<{ ok: boolean; corrigidas: number }> {
    const { data } = await api.post<{ ok: boolean; corrigidas: number }>(
      "/api/admin/stage-history/migracao/aplicar",
      { history_ids: params.historyIds },
      {
        params: {
          unitId: params.unitId,
          de: params.de,
          ate: params.ate,
          movidoDe: params.movidoDe,
          movidoAte: params.movidoAte,
        },
      }
    );
    return data;
  },
};
