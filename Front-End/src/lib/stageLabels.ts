// ─────────────────────────────────────────────────────────────────────────
// Mapa de tradução de etapas do funil para nomes amigáveis em PT.
//
// As etapas chegam do backend como:
//   • LeadStages.* canônicos: "04_AGENDADO_SEM_PAGAMENTO", "09_FECHOU_TRATAMENTO" …
//   • status_id cru da Kommo (numérico) quando a unidade ainda não mapeou o status_id
//     para uma etapa canônica em Unit.KommoStageMapJson.
//
// Para os canônicos retornamos o nome em PT.
// Para IDs crus retornamos uma string "Etapa #<id>" — sinaliza que falta mapeamento.
// ─────────────────────────────────────────────────────────────────────────

const STAGE_LABELS: Record<string, string> = {
  // LeadStages.* — usados pelas queries do dashboard
  "01_ENTRADA_LEAD": "Entrada de lead",
  "02_EM_ATENDIMENTO": "Em atendimento",
  "03_QUALIFICADO": "Qualificado",
  "04_AGENDADO_SEM_PAGAMENTO": "Agendado sem pagamento",
  "05_AGENDADO_COM_PAGAMENTO": "Agendado com pagamento",
  "06_COMPARECEU": "Compareceu",
  "07_FALTOU": "Faltou",
  "08_NAO_FECHOU_TRATAMENTO": "Não fechou tratamento",
  "09_FECHOU_TRATAMENTO": "Fechou tratamento",
  "10_EM_TRATAMENTO": "Em tratamento",

  // CanonicalStages.* — caso o backend devolva direto
  ENTRADA_LEAD: "Entrada de lead",
  AGENDADO_SEM_PAGAMENTO: "Agendado sem pagamento",
  AGENDADO_COM_PAGAMENTO: "Agendado com pagamento",
  NAO_COMPARECEU: "Não compareceu",
  COMPARECEU_CONSULTA: "Compareceu",
  TRATAMENTO_FECHADO: "Tratamento fechado",
  NAO_DEU_CONTINUIDADE: "Não deu continuidade",

  // Auxiliares
  NOVO: "Novo",
  SEM_ETAPA: "Sem etapa",
};

export function stageLabel(raw?: string | null): string {
  if (!raw) return "—";
  const trimmed = raw.trim();
  if (!trimmed) return "—";
  const upper = trimmed.toUpperCase();
  if (STAGE_LABELS[upper]) return STAGE_LABELS[upper];
  // status_id puro da Kommo (numérico) — mostra com prefixo identificando.
  if (/^\d+$/.test(trimmed)) return `Etapa #${trimmed}`;
  return trimmed;
}
