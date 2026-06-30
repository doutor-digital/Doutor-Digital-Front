// Tipos do dashboard do segmento jurídico (espelham DTOs/Juridico/JuridicoDashboardDto.cs do back-end).

export interface LabeledCount {
  label: string;
  count: number;
}

export interface AreaCaso {
  area: string;
  leads: number;
  pct: number;
  porCriativo: LabeledCount[];
}

export interface Secretaria {
  nome: string;
  leads: number;
  agendados: number;
  taxaAgendamento: number;
  compareceram: number;
  noShow: number;
  taxaNoShow: number;
  contratos: number;
  taxaFechamento: number;
  perdas: number;
  principalMotivoPerda?: string | null;
}

export interface IaQualidade {
  leadsAtendidos: number;
  qualificados: number;
  taxaQualificacao: number;
  agendadosPelaIa: number;
  taxaIaAgendamento: number;
  handoffs: number;
  taxaHandoff: number;
  contribuiContratos: number;
  principalPerda?: string | null;
}

export interface GrupoSla {
  grupo: string;
  mediaMinutos?: number | null;
  leads: number;
}

export interface SlaJuridico {
  mediaMinutos?: number | null;
  medianaMinutos?: number | null;
  p90Minutos?: number | null;
  leadsComResposta: number;
  iaMediaMinutos?: number | null;
  humanoMediaMinutos?: number | null;
  porGrupo: GrupoSla[];
}

export interface ConversaoJuridica {
  lead: number;
  qualificado: number;
  agendado: number;
  compareceu: number;
  contrato: number;
  taxaQualificacao: number;
  taxaAgendamento: number;
  taxaComparecimento: number;
  taxaFechamento: number;
  taxaGeral: number;
  gargalo?: string | null;
}

export interface CriativoQualificacao {
  criativo: string;
  leads: number;
  qualificados: number;
  desqualificados: number;
  taxaQualificacao: number;
}

export interface Qualificacao {
  qualificados: number;
  desqualificados: number;
  taxaQualificacao: number;
  motivosDesqualificacao: LabeledCount[];
  porCriativo: CriativoQualificacao[];
}

export interface RoiCriativo {
  criativo: string;
  leads: number;
  contratos: number;
  valorEstimado: number;
  honorarioExito: number;
  investimento: number;
  roi?: number | null;
  custoPorLead?: number | null;
}

export interface ValorArea {
  area: string;
  valorEstimado: number;
  honorarioExito: number;
  contratos: number;
}

export interface RoiJuridico {
  porCriativo: RoiCriativo[];
  porArea: ValorArea[];
  valorEstimadoTotal: number;
  honorarioExitoTotal: number;
  investimentoTotal: number;
  roiGeral?: number | null;
}

export interface JuridicoDashboard {
  from: string;
  to: string;
  totalLeads: number;
  camposNaoMapeados: string[];
  areaCaso: AreaCaso[];
  secretarias: Secretaria[];
  ia: IaQualidade;
  sla: SlaJuridico;
  conversao: ConversaoJuridica;
  qualificacao: Qualificacao;
  roi: RoiJuridico;
}

export interface JuridicoDashboardParams {
  clinicId: number;
  unitId?: number | null;
  from?: string;
  to?: string;
}
