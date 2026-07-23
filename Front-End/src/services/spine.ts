/**
 * Dados operacionais do sistema clínico (API Spine do Doutor Hérnia).
 *
 * Fonte de verdade diferente do resto do dashboard: o número vem da agenda real
 * da clínica, não de campo preenchido na Kommo. As situações são as da agenda
 * (ATENDIDO / NÃO COMPARECEU / DESMARCADO / REMARCADO / CONFIRMADO / AGENDADO).
 */

import { api } from "@/lib/api";

/** Desfecho de negócio de cada situação — o front colore por aqui, sem reimplementar a regra. */
export type GrupoSituacao = "realizado" | "falta" | "cancelado" | "pendente" | "desconhecido";

export interface SpineSituacao {
  idStatus: number;
  nome: string;
  grupo: GrupoSituacao;
  total: number;
}

export interface SpineAvaliacoesPorDia {
  dia: string;
  total: number;
  realizadas: number;
}

export interface SpineAvaliacoesPorProfissional {
  profissional: string;
  atendimentos: number;
}

export interface SpineAvaliacoes {
  de: string;
  ate: string;
  /** Todos os horários da janela, em qualquer situação. */
  total: number;
  /** ATENDIDO — é o número que a franquia chama de "Avaliações". */
  realizadas: number;
  /** Total menos os que ainda não aconteceram (agendado + confirmado). */
  resolvidas: number;
  /** realizadas ÷ resolvidas, em %. */
  taxaComparecimento: number;
  pacientesDistintos: number;
  /**
   * true quando há desmarques mas quase nenhum no-show registrado — sinal de que
   * a recepção usa "desmarcado" como categoria guarda-chuva.
   */
  alertaQualidadeDados: boolean;
  porSituacao: SpineSituacao[];
  porDia: SpineAvaliacoesPorDia[];
  porProfissional: SpineAvaliacoesPorProfissional[];
}

export const spineService = {
  /** Janela máxima aceita pela API do Doutor Hérnia: 99 dias. */
  async avaliacoes(unitId: number, de?: string, ate?: string): Promise<SpineAvaliacoes> {
    const { data } = await api.get<SpineAvaliacoes>("/api/spine/avaliacoes", {
      params: { unitId, de, ate },
    });
    return data;
  },

  async status(): Promise<{ provider: string; online: boolean }> {
    const { data } = await api.get("/api/spine/status");
    return data;
  },
};
