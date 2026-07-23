/**
 * Dados operacionais do sistema clínico (API Spine do Doutor Hérnia).
 *
 * Fonte de verdade diferente do resto do dashboard: aqui o número vem da agenda
 * real da clínica, não de campo preenchido na Kommo. Comparecimento, falta e
 * desmarque são status da agenda (ATENDIDO / NÃO COMPARECEU / DESMARCADO).
 */

import { api } from "@/lib/api";

export interface SpineAvaliacoesPorDia {
  dia: string;
  agendadas: number;
  compareceram: number;
}

export interface SpineAvaliacoesPorProfissional {
  profissional: string;
  atendimentos: number;
}

export interface SpineAvaliacoes {
  de: string;
  ate: string;
  agendadas: number;
  compareceram: number;
  naoCompareceram: number;
  desmarcadas: number;
  remarcadas: number;
  aguardandoAtendimento: number;
  /** Compareceram ÷ agendadas, em %. Ver `alertaQualidadeDados`. */
  taxaComparecimento: number;
  pacientesDistintos: number;
  /**
   * true quando há desmarques mas quase nenhum no-show registrado — sinal de que
   * a recepção usa DESMARCADO como categoria guarda-chuva e a taxa está inflada.
   */
  alertaQualidadeDados: boolean;
  porDia: SpineAvaliacoesPorDia[];
  porProfissional: SpineAvaliacoesPorProfissional[];
}

export const spineService = {
  /** Janela máxima aceita pela API do Doutor Hérnia: 100 dias. */
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
