// Espelho client-side do RejectionReasons.cs do backend. Mantém a UX rápida
// (não precisa de roundtrip pra mostrar o motivo no perfil de um lead) e a
// classificação consistente. Se o backend mudar, atualizar aqui também.

export type ReasonKey =
  | "preco"
  | "vai_pensar"
  | "convenio"
  | "familia"
  | "tempo_distancia"
  | "medo"
  | "concorrente"
  | "nao_atendeu"
  | "desistiu";

interface ReasonCategory {
  key: ReasonKey;
  label: string;
  keywords: string[];
}

export const REASON_CATEGORIES: ReasonCategory[] = [
  { key: "preco", label: "Preço / valor",
    keywords: ["caro", "preço", "preco", "valor", "custo", "dinheiro",
               "não tem condição", "nao tem condicao", "sem condicao",
               "fora do orçamento", "fora do orcamento", "desconto"] },
  { key: "vai_pensar", label: "Vai pensar",
    keywords: ["pensar", "pensando", "decidir", "depois", "vai retornar",
               "voltar a falar", "vai analisar", "analisando"] },
  { key: "convenio", label: "Quer convênio",
    keywords: ["convenio", "convênio", "plano de saude", "plano de saúde",
               "particular não", "particular nao"] },
  { key: "familia", label: "Consultar família",
    keywords: ["marido", "esposa", "esposo", "família", "familia",
               "consultar", "namorado", "namorada", "pais", "mãe", "mae", "pai"] },
  { key: "tempo_distancia", label: "Tempo / distância",
    keywords: ["longe", "distância", "distancia", "viagem", "tempo",
               "horario", "horário", "trabalho", "ocupado", "ocupada"] },
  { key: "medo", label: "Medo / dúvida clínica",
    keywords: ["medo", "dor", "ansioso", "ansiosa", "receio", "duvida",
               "dúvida", "nervoso", "nervosa"] },
  { key: "concorrente", label: "Foi pra concorrente",
    keywords: ["outro lugar", "outra clinica", "outra clínica",
               "concorrente", "outro dentista", "já fechou em", "ja fechou em"] },
  { key: "nao_atendeu", label: "Não atendeu / sumiu",
    keywords: ["nao atende", "não atende", "sumiu", "não respondeu",
               "nao respondeu", "fora do ar", "celular off",
               "fora de área", "fora de area"] },
  { key: "desistiu", label: "Desistiu",
    keywords: ["desistiu", "desistencia", "desistência", "cancelou",
               "cancelamento", "não quer", "nao quer"] },
];

export interface ClassifiedReason {
  key: ReasonKey;
  label: string;
  matchedKeywords: string[];
}

export function classifyReason(observations?: string | null): ClassifiedReason | null {
  if (!observations || !observations.trim()) return null;
  const text = observations.toLowerCase();
  for (const cat of REASON_CATEGORIES) {
    const matched = cat.keywords.filter((kw) => text.includes(kw));
    if (matched.length > 0) {
      return { key: cat.key, label: cat.label, matchedKeywords: matched };
    }
  }
  return null;
}

export const REASON_TONE: Record<ReasonKey, { ring: string; text: string }> = {
  preco:           { ring: "ring-rose-500/30",   text: "text-rose-300" },
  vai_pensar:      { ring: "ring-amber-500/30",  text: "text-amber-300" },
  convenio:        { ring: "ring-violet-500/30", text: "text-violet-300" },
  familia:         { ring: "ring-sky-500/30",    text: "text-sky-300" },
  tempo_distancia: { ring: "ring-cyan-500/30",   text: "text-cyan-300" },
  medo:            { ring: "ring-fuchsia-500/30",text: "text-fuchsia-300" },
  concorrente:     { ring: "ring-rose-500/30",   text: "text-rose-300" },
  nao_atendeu:     { ring: "ring-slate-500/30",  text: "text-slate-300" },
  desistiu:        { ring: "ring-slate-500/30",  text: "text-slate-400" },
};
