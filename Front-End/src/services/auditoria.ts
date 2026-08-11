/**
 * Auditoria de prontuários do CRM web da franquia.
 *
 * A unidade de auditoria é o TRATAMENTO, não o atendimento: /acompanhar/{id} abre a mesma
 * ficha para todas as sessões de um tratamento, então evolução, questionário de
 * incapacidade e CBDF pertencem ao tratamento. O backend agrupa antes de aplicar as regras.
 *
 * A chamada é cara — o backend abre uma ficha de ~290 KB por tratamento e cacheia por
 * 30 minutos. Não faça polling.
 */

import { api } from "@/lib/api";

export type Severidade = "critico" | "alerta" | "info";

export interface AuditoriaAtendimento {
  id: number;
  paciente: string;
  inicio: string | null;
  termino: string | null;
  /** Null para atendimento em aberto — a listagem devolve lixo de epoch nesse caso. */
  duracaoMin: number | null;
  fisioterapeuta: string;
  unidade: string;
  situacao: string;
}

export interface AuditoriaEvolucao {
  data: string;
  dataIso: string | null;
  profissional: string;
  protocolo: string;
  /** "DIA N" do cabeçalho. */
  diaRotulo: number | null;
  /** "PROTOCOLO DO DIA N" citado no corpo — divergir do rótulo é achado. */
  diaCorpo: number | null;
  evaInicial: number | null;
  evaFinal: number | null;
  texto: string;
}

export interface AuditoriaQuestionario {
  /** Quando o Roland-Morris foi criado — o campo decisivo da auditoria. */
  criadoEm: string | null;
  criadoEmIso: string | null;
  escoreInicial: number | null;
  escoreFinal: number | null;
}

export interface AuditoriaAchado {
  regra: string;
  severidade: Severidade;
  titulo: string;
  detalhe: string;
}

export interface AuditoriaProntuario {
  chave: string;
  /** tratamento | avaliacao — avaliação avulsa não tem aba de evolução. */
  tipo: "tratamento" | "avaliacao";
  idClient: number | null;
  idTreatment: number | null;
  nomePaciente: string;
  idade: number | null;
  plano: string;
  primeiraConsulta: string | null;
  primeiraIso: string | null;
  realizados: number | null;
  previstos: number | null;
  esteAtendimento: number | null;
  prognostico: string | null;
  cbdf: string[];
  principal: AuditoriaAtendimento;
  atendimentos: AuditoriaAtendimento[];
  evolucoes: AuditoriaEvolucao[];
  questionario: AuditoriaQuestionario | null;
  achados: AuditoriaAchado[];
  /** crítico × 10 + alerta × 3 + info × 1. */
  escore: number;
}

export interface AuditoriaRegra {
  regra: string;
  severidade: Severidade;
  titulo: string;
  total: number;
}

export interface AuditoriaProfissional {
  nome: string;
  atendimentos: number;
  criticos: number;
  alertas: number;
}

export interface Auditoria {
  unidade: string;
  periodo: string;
  /** Linhas da listagem varridas (sessões), antes do agrupamento. */
  atendimentos: number;
  /** Fichas após agrupar por tratamento. */
  total: number;
  avaliacoes: number;
  comAchados: number;
  criticos: number;
  alertas: number;
  atualizadoEm: string;
  prontuarios: AuditoriaProntuario[];
  porRegra: AuditoriaRegra[];
  porProfissional: AuditoriaProfissional[];
}

export const auditoriaService = {
  async get(unitId: number, de?: string, ate?: string): Promise<Auditoria> {
    const { data } = await api.get<Auditoria>("/api/spine/auditoria", {
      params: { unitId, de, ate },
    });
    return data;
  },
};
