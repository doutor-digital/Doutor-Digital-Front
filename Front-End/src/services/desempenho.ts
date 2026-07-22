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

  // ── Entrega (vem do Meta junto com o gasto) ──────────────────────────────
  impressoes: number;
  cliques: number;
  /** Conversas de WhatsApp iniciadas — o "lead" na visão do Meta. */
  conversas: number;
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

// ── Entrega. Sempre razão de somas (somar CTR de vários dias daria média errada).
/** Taxa de cliques (0–1). */
export const ctr = (cliques: number, impressoes: number) => div(cliques, impressoes);
/** Custo por clique. */
export const cpc = (investimento: number, cliques: number) => div(investimento, cliques);
/** Custo por mil impressões. */
export const cpm = (investimento: number, impressoes: number) =>
  impressoes > 0 ? (investimento / impressoes) * 1000 : null;
/** Custo por conversa iniciada — o "CPL" na visão do Meta. */
export const custoPorConversa = (investimento: number, conversas: number) =>
  div(investimento, conversas);

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
      impressoes: acc.impressoes + o.impressoes,
      cliques: acc.cliques + o.cliques,
      conversas: acc.conversas + o.conversas,
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
      impressoes: 0,
      cliques: 0,
      conversas: 0,
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

// ─── Carregador (ÚNICO ponto de integração) ────────────────────────────────────

/**
 * Carrega o desempenho de mídia paga do período.
 *
 * Cada linha é uma CAMPANHA real (Meta/Google), com o gasto que a Central de
 * Integrações gravou no nosso banco — o n8n puxa do Graph e a API persiste em
 * `campaign_daily_spend`. Ver GET /api/integrations/ads/spend.
 *
 * O funil (leads→qualificados→…→fechados) e a receita por campanha ainda NÃO são
 * calculados: ligar isso exige atribuir cada lead da Kommo à campanha de origem
 * (UTM/attribution) e reaproveitar as MESMAS regras de KPI do dashboard
 * (corte de dia às 19h, cadastro/resgate, datação por stage history) — senão os
 * números aqui contradizem os da home. Por isso ficam zerados em vez de inventados.
 */
export async function carregarDados(
  periodo: Periodo,
  clinicId?: number | null,
): Promise<DadosDashboard> {
  let origens: OrigemDesempenho[] = [];

  try {
    // clinicId é obrigatório pra super_admin (TenantId nulo no token) — sem ele
    // o endpoint devolve 400.
    const { items } = await integrationsService.spend({
      clinicId,
      from: periodo.inicio,
      to: periodo.fim,
    });

    origens = items.map((s) => ({
      nome: s.campaign_name?.trim() || `Campanha ${s.campaign_id}`,
      canal: canalDoProvider(s.provider),
      investimento: s.spend,
      leads: 0,
      qualificados: 0,
      agendados: 0,
      compareceram: 0,
      indicados: 0,
      fechados: 0,
      receita: 0,
      impressoes: s.impressions ?? 0,
      cliques: s.clicks ?? 0,
      conversas: s.conversations ?? 0,
    }));
  } catch {
    // Sem integração conectada / sem permissão: tabela vazia (nunca dado falso).
    origens = [];
  }

  return {
    periodo: { inicio: periodo.inicio, fim: periodo.fim },
    origens,
    motivosNaoAgendamento: [],
    motivosNaoFechamento: [],
  };
}

function canalDoProvider(p: string): Canal {
  if (p === "meta") return "meta";
  if (p === "google") return "google";
  return "outro";
}
