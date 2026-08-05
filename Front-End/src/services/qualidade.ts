import { api } from "@/lib/api";

/**
 * Qualidade do preenchimento dos cartões.
 *
 * Cada campo é medido só entre os leads que CHEGARAM na etapa em que ele passa a ser
 * exigido — a mesma regra que a Kommo declara em `required_statuses`. Por isso cada
 * item traz o próprio `universo`: sem ele a tela não explica por que um campo é medido
 * contra 48 leads e outro contra 320.
 */
export interface QualidadeCampo {
  campo: string;
  rotulo: string;
  /** Falso = a unidade não mapeou o campo. É pendência de configuração, não de quem preenche. */
  mapeado: boolean;
  /** Onde passa a ser exigido, por extenso ("a partir de Agendado"). */
  etapa: string;
  /** Quantos leads chegaram na etapa — o denominador. */
  universo: number;
  atingiuMeta: boolean;
  preenchidos: number;
  vazios: number;
  percentual: number;
}

export interface QualidadeRegra {
  id: string;
  titulo: string;
  /** O que quebra no número enquanto isso existir. */
  porque: string;
  quantidade: number;
  corrigivel: boolean;
  leadIds: number[];
}

export interface QualidadeResponsavel {
  responsavel: string;
  total: number;
  comIncoerencia: number;
  percentual: number;
}

export interface QualidadeDto {
  total: number;
  de: string;
  ate: string;
  leadsComIncoerencia: number;
  /** % de preenchimento a partir do qual o campo é considerado ok. */
  meta: number;
  camposAbaixoDaMeta: number;
  camposSemMapeamento: number;
  porCampo: QualidadeCampo[];
  regras: QualidadeRegra[];
  porResponsavel: QualidadeResponsavel[];
}

export const qualidadeService = {
  async preenchimento(params: {
    unitId?: number | null;
    de?: string;
    ate?: string;
  }): Promise<QualidadeDto> {
    const { data } = await api.get<QualidadeDto>("/api/qualidade/preenchimento", {
      params: {
        ...(params.unitId ? { unitId: params.unitId } : {}),
        ...(params.de ? { de: params.de } : {}),
        ...(params.ate ? { ate: params.ate } : {}),
      },
    });
    return data;
  },
};
