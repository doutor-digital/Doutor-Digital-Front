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

export interface SpineAgendaItem {
  idSchedule: number;
  idTreatment: number | null;
  paciente: string;
  /** Início já no fuso da clínica (o backend converte de UTC). */
  inicio: string;
  idCategoria: number;
  categoria: string;
  profissional: string;
  idStatus: number;
  status: string;
  grupo: GrupoSituacao;
}

export interface SpineAgenda {
  de: string;
  ate: string;
  total: number;
  categorias: string[];
  itens: SpineAgendaItem[];
}

/** Agenda da clínica no período — usada pelo Calendário (franquia). */
export async function agendaFranquia(
  unitId: number,
  de: string,
  ate: string,
): Promise<SpineAgenda> {
  const { data } = await api.get<SpineAgenda>("/api/spine/agenda", {
    params: { unitId, de, ate },
  });
  return data;
}

// ─── Ficha do paciente (clique no calendário) ────────────────────────────────

export interface SpinePacienteHistorico {
  idSchedule: number;
  quandoLocal: string;
  categoria: string | null;
  profissional: string | null;
  idStatus: number;
  situacao: string | null;
  grupo: GrupoSituacao;
}

export interface SpineLeadVinculado {
  kommoLeadId: number;
  nome: string;
  etapa: string | null;
  unitId: number | null;
}

export interface SpinePaciente {
  idClient: number;
  nome: string;
  origem: string | null;
  status: string | null;
  nascimento: string | null;
  idade: number | null;
  sexo: string | null;
  telefone: string | null;
  email: string | null;
  endereco: string | null;
  cidade: string | null;
  uf: string | null;
  totalAtendimentos: number;
  totalFaltas: number;
  primeiroAtendimento: string | null;
  ultimoAtendimento: string | null;
  historico: SpinePacienteHistorico[];
  /** Lead da Kommo do mesmo paciente, casado por telefone. null = sem correspondência. */
  leadVinculado: SpineLeadVinculado | null;
}

export interface SpinePacienteCandidato {
  idClient: number;
  nome: string;
  whatsapp: string | null;
  cidade: string | null;
  uf: string | null;
  origem: string | null;
}

export interface SpinePacienteResolucao {
  nomeBuscado: string;
  /** Preenchido quando há exatamente 1 correspondência exata. */
  detalhe: SpinePaciente | null;
  /** Preenchido quando há cadastro duplicado (>1) — usuário escolhe. */
  candidatos: SpinePacienteCandidato[];
}

/** Resolve o clique num horário → ficha do paciente, pelo nome que a agenda traz. */
export async function pacientePorNome(unitId: number, nome: string): Promise<SpinePacienteResolucao> {
  const { data } = await api.get<SpinePacienteResolucao>("/api/spine/paciente", {
    params: { unitId, nome },
  });
  return data;
}

/** Ficha pelo idClient — usado quando o usuário escolhe um candidato da colisão. */
export async function pacientePorId(unitId: number, idClient: number): Promise<SpinePaciente> {
  const { data } = await api.get<SpinePaciente>(`/api/spine/paciente/${idClient}`, {
    params: { unitId },
  });
  return data;
}

// ─── Histórico de avaliações (série longa, do nosso banco) ───────────────────

export interface SpineHistoricoMes {
  competencia: string; // "2026-07"
  agendadas: number;
  compareceram: number;
  naoCompareceram: number;
  desmarcadas: number;
  taxaComparecimento: number;
}

export interface SpineHistorico {
  unitId: number;
  /** Dia da primeira captura — antes disso não há série. null = nada capturado ainda. */
  capturandoDesde: string | null;
  serie: SpineHistoricoMes[];
}

export async function historicoAvaliacoes(unitId: number, meses = 12): Promise<SpineHistorico> {
  const { data } = await api.get<SpineHistorico>("/api/spine/historico", {
    params: { unitId, meses },
  });
  return data;
}

// ─── Onboarding self-service do token (Central de Integrações) ────────────────

export interface SpineConfigStatus {
  unitId: number;
  configurado: boolean;
  atualizadoEm: string | null;
  /** Prévia mascarada do token (ex.: "eyJhbG…OWQE"). Nunca o token inteiro. */
  previa: string | null;
}

// ─── Comparativo entre unidades (franqueador master) ─────────────────────────

export interface SpineRedeUnidade {
  unitId: number;
  unidade: string;
  agendadas: number;
  compareceram: number;
  naoCompareceram: number;
  desmarcadas: number;
  taxaComparecimento: number;
  pacientesDistintos: number;
  erro: string | null;
}

export interface SpineRede {
  de: string;
  ate: string;
  unidades: SpineRedeUnidade[];
  semToken: { unitId: number; unidade: string }[];
  totais: { unidades: number; agendadas: number; compareceram: number; taxaComparecimento: number };
}

export async function redeComparativo(de?: string, ate?: string): Promise<SpineRede> {
  const { data } = await api.get<SpineRede>("/api/spine/rede/comparativo", { params: { de, ate } });
  return data;
}

export const spineConfig = {
  async status(unitId: number): Promise<SpineConfigStatus> {
    const { data } = await api.get<SpineConfigStatus>("/api/spine/config", { params: { unitId } });
    return data;
  },

  /** Salva e valida o token na hora; rejeita (400) se o Doutor Hérnia recusar. */
  async salvar(unitId: number, token: string): Promise<SpineConfigStatus> {
    const { data } = await api.put<SpineConfigStatus>("/api/spine/config", { token }, {
      params: { unitId },
    });
    return data;
  },

  async remover(unitId: number): Promise<void> {
    await api.delete("/api/spine/config", { params: { unitId } });
  },
};
