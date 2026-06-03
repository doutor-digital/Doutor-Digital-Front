/**
 * Camada de dados + cálculo do Dashboard de Desempenho de Mídia (ROAS).
 *
 * NÚCLEO ISOLADO: a página só conhece `carregarDados(periodo)` e os helpers de
 * fórmula/formatação daqui. Hoje devolve MOCK; quando a integração estiver pronta,
 * basta trocar o corpo de `carregarDados` — a UI não muda.
 *
 * Tudo é calculado no front a partir de `DadosDashboard`. Sem localStorage/sessionStorage.
 */

import { integrationsService, type AdsSpendItem } from "@/services/integrations";

// ─── Modelo de dados (contrato com a futura API) ───────────────────────────────

export type Canal = "meta" | "google" | "organico" | "outro";

export interface OrigemDesempenho {
  nome: string;
  canal: Canal;
  /** Vem da API de Ads via planilha/n8n — NÃO do lead. */
  investimento: number;
  leads: number;
  qualificados: number;
  agendados: number;
  compareceram: number;
  indicados: number;
  fechados: number;
  receita: number;
}

export interface MotivoPerda {
  motivo: string;
  quantidade: number;
}

export interface DadosDashboard {
  periodo: { inicio: string; fim: string };
  origens: OrigemDesempenho[];
  motivosNaoAgendamento: MotivoPerda[];
  motivosNaoFechamento: MotivoPerda[];
}

// ─── Período ───────────────────────────────────────────────────────────────────

export type PeriodoKey = "hoje" | "7d" | "30d" | "mes" | "custom";

export interface Periodo {
  key: PeriodoKey;
  inicio: string; // ISO yyyy-mm-dd
  fim: string; // ISO yyyy-mm-dd
}

export const PERIODO_PRESETS: Array<{ key: PeriodoKey; label: string }> = [
  { key: "hoje", label: "Hoje" },
  { key: "7d", label: "7 dias" },
  { key: "30d", label: "30 dias" },
  { key: "mes", label: "Mês" },
  { key: "custom", label: "Personalizado" },
];

function iso(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/** Converte um preset em intervalo de datas concreto (fim = hoje). */
export function periodoFromKey(key: Exclude<PeriodoKey, "custom">): Periodo {
  const fim = new Date();
  const inicio = new Date();
  switch (key) {
    case "hoje":
      break; // inicio = fim = hoje
    case "7d":
      inicio.setDate(inicio.getDate() - 6);
      break;
    case "30d":
      inicio.setDate(inicio.getDate() - 29);
      break;
    case "mes":
      inicio.setDate(1);
      break;
  }
  return { key, inicio: iso(inicio), fim: iso(fim) };
}

// ─── Fórmulas puras (guarda de divisão por zero → null = "não se aplica") ──────

const div = (a: number, b: number): number | null => (b > 0 ? a / b : null);

/** Custo por lead. */
export const cpl = (investimento: number, leads: number) => div(investimento, leads);
/** Custo de aquisição de cliente. */
export const cac = (investimento: number, fechados: number) => div(investimento, fechados);
/** Retorno sobre investimento em ads. null quando não houve investimento. */
export const roas = (receita: number, investimento: number) => div(receita, investimento);
/** Ticket médio por venda fechada. */
export const ticketMedio = (receita: number, fechados: number) => div(receita, fechados);
/** Taxa de qualificação (0–1). */
export const taxaQualificacao = (qualificados: number, leads: number) => div(qualificados, leads);
/** Taxa de no-show: agendados que não compareceram (0–1). */
export const taxaNoShow = (agendados: number, compareceram: number) =>
  div(agendados - compareceram, agendados);

/** Soma campo a campo todas as origens → totais do topo do dashboard. */
export function agregar(origens: OrigemDesempenho[]): Omit<OrigemDesempenho, "nome" | "canal"> {
  return origens.reduce(
    (acc, o) => ({
      investimento: acc.investimento + o.investimento,
      leads: acc.leads + o.leads,
      qualificados: acc.qualificados + o.qualificados,
      agendados: acc.agendados + o.agendados,
      compareceram: acc.compareceram + o.compareceram,
      indicados: acc.indicados + o.indicados,
      fechados: acc.fechados + o.fechados,
      receita: acc.receita + o.receita,
    }),
    {
      investimento: 0,
      leads: 0,
      qualificados: 0,
      agendados: 0,
      compareceram: 0,
      indicados: 0,
      fechados: 0,
      receita: 0,
    },
  );
}

// ─── Faixas de cor do ROAS ─────────────────────────────────────────────────────

export type RoasFaixa = "verde" | "ambar" | "vermelho" | "neutro";

/** ≥ 8x verde · 4–8x âmbar · < 4x vermelho · sem investimento → neutro. */
export function roasFaixa(valor: number | null): RoasFaixa {
  if (valor == null) return "neutro";
  if (valor >= 8) return "verde";
  if (valor >= 4) return "ambar";
  return "vermelho";
}

/** Classes Tailwind (texto + fundo) para a faixa de ROAS — usado na célula da tabela. */
export function roasCorClasse(faixa: RoasFaixa): string {
  switch (faixa) {
    case "verde":
      return "text-emerald-300 bg-emerald-500/10 ring-emerald-500/20";
    case "ambar":
      return "text-amber-300 bg-amber-500/10 ring-amber-500/20";
    case "vermelho":
      return "text-rose-300 bg-rose-500/10 ring-rose-500/20";
    default:
      return "text-slate-400 bg-white/[0.04] ring-white/[0.08]";
  }
}

// ─── Formatadores (pt-BR) ──────────────────────────────────────────────────────

const TRACO = "—";

/** R$ sem centavos. */
export function fmtBRL(v: number | null): string {
  if (v == null || !Number.isFinite(v)) return TRACO;
  return v.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
    maximumFractionDigits: 0,
  });
}

/** Inteiro com separador de milhar. */
export function fmtInt(v: number | null): string {
  if (v == null || !Number.isFinite(v)) return TRACO;
  return Math.round(v).toLocaleString("pt-BR");
}

/** Percentual a partir de uma razão 0–1, com 0–1 casa decimal. */
export function fmtPct(ratio: number | null): string {
  if (ratio == null || !Number.isFinite(ratio)) return TRACO;
  const pct = ratio * 100;
  const casas = Number.isInteger(pct) ? 0 : 1;
  return `${pct.toLocaleString("pt-BR", { minimumFractionDigits: casas, maximumFractionDigits: 1 })}%`;
}

/** ROAS com 1 casa + "x". */
export function fmtRoas(v: number | null): string {
  if (v == null || !Number.isFinite(v)) return TRACO;
  return `${v.toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 })}x`;
}

// ─── Mock (base = 30 dias) ─────────────────────────────────────────────────────

const ORIGENS_BASE: OrigemDesempenho[] = [
  { nome: "Meta · Implante (conversão)", canal: "meta", investimento: 12000, leads: 320, qualificados: 180, agendados: 95, compareceram: 70, indicados: 55, fechados: 28, receita: 168000 },
  { nome: "Google · Search Marca", canal: "google", investimento: 6000, leads: 140, qualificados: 95, agendados: 60, compareceram: 48, indicados: 38, fechados: 22, receita: 39000 },
  { nome: "Meta · Lookalike 1%", canal: "meta", investimento: 9000, leads: 260, qualificados: 110, agendados: 50, compareceram: 33, indicados: 22, fechados: 12, receita: 54000 },
  { nome: "Google · Display Remarketing", canal: "google", investimento: 4500, leads: 90, qualificados: 30, agendados: 12, compareceram: 7, indicados: 5, fechados: 3, receita: 15000 },
  { nome: "Orgânico · Instagram", canal: "organico", investimento: 0, leads: 80, qualificados: 50, agendados: 30, compareceram: 24, indicados: 20, fechados: 14, receita: 84000 },
  { nome: "Indicação · Boca a boca", canal: "outro", investimento: 0, leads: 45, qualificados: 38, agendados: 28, compareceram: 25, indicados: 22, fechados: 16, receita: 96000 },
];

const MOTIVOS_NAO_AGENDA_BASE: MotivoPerda[] = [
  { motivo: "Sem retorno / não atende", quantidade: 210 },
  { motivo: "Achou caro", quantidade: 140 },
  { motivo: "Só pesquisando preço", quantidade: 95 },
  { motivo: "Distância da clínica", quantidade: 60 },
  { motivo: "Horário indisponível", quantidade: 38 },
];

const MOTIVOS_NAO_FECHA_BASE: MotivoPerda[] = [
  { motivo: "Preço acima do orçamento", quantidade: 64 },
  { motivo: "Vai pensar / decidir depois", quantidade: 52 },
  { motivo: "Buscar segunda opinião", quantidade: 31 },
  { motivo: "Adiou por motivo financeiro", quantidade: 24 },
  { motivo: "Medo do procedimento", quantidade: 15 },
];

/** Fator de escala por período, só pra o mock "parecer vivo". */
const FATOR_PERIODO: Record<PeriodoKey, number> = {
  hoje: 0.04,
  "7d": 0.25,
  "30d": 1,
  mes: 1.05,
  custom: 1,
};

const escalar = (v: number, f: number) => Math.round(v * f);

function escalarOrigens(origens: OrigemDesempenho[], f: number): OrigemDesempenho[] {
  if (f === 1) return origens.map((o) => ({ ...o }));
  return origens.map((o) => ({
    ...o,
    investimento: escalar(o.investimento, f),
    leads: escalar(o.leads, f),
    qualificados: escalar(o.qualificados, f),
    agendados: escalar(o.agendados, f),
    compareceram: escalar(o.compareceram, f),
    indicados: escalar(o.indicados, f),
    fechados: escalar(o.fechados, f),
    receita: escalar(o.receita, f),
  }));
}

const escalarMotivos = (m: MotivoPerda[], f: number): MotivoPerda[] =>
  m.map((x) => ({ ...x, quantidade: escalar(x.quantidade, f) }));

// ─── Carregador (ÚNICO ponto de integração) ────────────────────────────────────

/**
 * Carrega os dados do dashboard para um período.
 *
 * TODO(integração): hoje devolve MOCK. Quando ligar de verdade:
 *  - funil (leads→qualificados→…→fechados) + receita por origem vêm da API da Kommo
 *    (agrupar leads por origem/etapa dentro de [periodo.inicio, periodo.fim]);
 *  - `investimento` por campanha NÃO vem do lead — vem da CENTRAL DE INTEGRAÇÕES: a nossa
 *    API puxa o Meta Ads / Google Ads e grava o gasto por campanha/dia no nosso banco
 *    (ex.: GET /api/integrations/ads/spend?clinicId&from&to → soma por campanha);
 *  - casar cada campanha com a `origem` da Kommo pelo nome/UTM.
 * O contrato de retorno (`DadosDashboard`) permanece igual — só troque o corpo abaixo.
 */
export async function carregarDados(periodo: Periodo): Promise<DadosDashboard> {
  // Simula latência de rede pra exercitar o estado de carregamento.
  await new Promise((r) => setTimeout(r, 350));

  const f = FATOR_PERIODO[periodo.key] ?? 1;
  let origens = escalarOrigens(ORIGENS_BASE, f);

  // Investimento REAL: vem da Central de Integrações (Meta/Google Ads → nosso banco).
  // Casa cada campanha com a origem por nome; se não houver gasto/permissão, mantém o mock.
  try {
    const { items } = await integrationsService.spend({ from: periodo.inicio, to: periodo.fim });
    if (items.length) origens = aplicarInvestimentoReal(origens, items);
  } catch {
    /* sem integração/sem permissão — segue com o investimento mock */
  }

  return {
    periodo: { inicio: periodo.inicio, fim: periodo.fim },
    origens,
    motivosNaoAgendamento: escalarMotivos(MOTIVOS_NAO_AGENDA_BASE, f),
    motivosNaoFechamento: escalarMotivos(MOTIVOS_NAO_FECHA_BASE, f),
  };
}

const tokens = (s: string) =>
  new Set(
    s
      .toLowerCase()
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .split(/[^a-z0-9]+/)
      .filter((t) => t.length > 2),
  );

/**
 * Substitui o `investimento` de cada origem pela soma do gasto real das campanhas que
 * casam com o nome dela (sobreposição de ≥2 tokens). Origem sem match mantém o mock.
 */
function aplicarInvestimentoReal(
  origens: OrigemDesempenho[],
  spend: AdsSpendItem[],
): OrigemDesempenho[] {
  const spendTokens = spend.map((s) => ({ s, t: tokens(s.campaign_name ?? "") }));
  return origens.map((o) => {
    const ot = tokens(o.nome);
    let total = 0;
    let matched = false;
    for (const { s, t } of spendTokens) {
      let overlap = 0;
      for (const tok of t) if (ot.has(tok)) overlap++;
      if (overlap >= 2) {
        total += s.spend;
        matched = true;
      }
    }
    return matched ? { ...o, investimento: Math.round(total) } : o;
  });
}
