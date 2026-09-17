/**
 * Fila de altas e de pacientes que pararam no meio do tratamento.
 *
 * O dado NÃO mora no backend do dashboard: mora no agente (a mesma base que
 * cruza a agenda da franquia com o CRM). Por isso este serviço fala direto com
 * `agente-vps`, e não pelo `api` do .NET — não há cópia dos dados aqui, e não
 * pode haver: duas cópias divergem e a recepção passa a decidir sobre a errada.
 *
 * Autorização é o CÓDIGO da unidade (o mesmo da página de pausa), enviado em
 * cada chamada. Não usa cookie: a chamada é cross-origin e sem credenciais.
 *
 * Por que isso está no dashboard e não numa página solta: a página solta existe
 * desde 16/09 e, em dois dias, 170 pacientes entraram na fila e NENHUMA decisão
 * foi tomada. Endereço que ninguém abre não é ferramenta.
 */

const BASE =
  (import.meta.env.VITE_AGENTE_BASE_URL as string | undefined)?.replace(/\/$/, "") ||
  "https://agente-vps.doutordigitalconsultoria.com";

export type ClasseDaFila = "ALTA" | "PAROU";
export type Decisao = "alta" | "segue" | "recuperar" | "desistiu";

export interface CandidatoDaFila {
  id: string;
  leadId: number;
  nome: string | null;
  classe: ClasseDaFila;
  realizadas: number;
  previstas: number;
  ultimaSessao: string | null;
  faltam: number;
  diasParado: number | null;
  /** Frase pronta: "47/48 sessões · falta 1 · parado há 79 dias". */
  resumo: string;
}

export interface FilaDeAltas {
  unidade: string;
  slug: string;
  altas: CandidatoDaFila[];
  parados: CandidatoDaFila[];
}

export class CodigoInvalido extends Error {
  constructor() {
    super("Código da unidade não confere.");
    this.name = "CodigoInvalido";
  }
}

async function tratar(r: Response): Promise<unknown> {
  if (r.status === 401 || r.status === 403) throw new CodigoInvalido();
  if (!r.ok) {
    const corpo = await r.text().catch(() => "");
    throw new Error(`Agente respondeu ${r.status}. ${corpo.slice(0, 160)}`);
  }
  return r.json();
}

export const altasService = {
  async listar(slug: string, codigo: string): Promise<FilaDeAltas> {
    const url = `${BASE}/api/public/alta/${encodeURIComponent(slug)}?codigo=${encodeURIComponent(codigo)}`;
    return (await tratar(await fetch(url, { credentials: "omit" }))) as FilaDeAltas;
  },

  async decidir(
    slug: string,
    codigo: string,
    entrada: { id: string; decisao: Decisao; por?: string },
  ): Promise<{ ok: boolean; decisao: Decisao; movido: boolean }> {
    const r = await fetch(`${BASE}/api/public/alta/${encodeURIComponent(slug)}`, {
      method: "POST",
      credentials: "omit",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ codigo, ...entrada }),
    });
    return (await tratar(r)) as { ok: boolean; decisao: Decisao; movido: boolean };
  },
};

/** O código fica no navegador de quem usa, por unidade. Nunca vai para o nosso banco. */
const chaveDoCodigo = (slug: string) => `dd:alta:codigo:${slug}`;

export function lembrarCodigo(slug: string, codigo: string): void {
  try {
    localStorage.setItem(chaveDoCodigo(slug), codigo);
  } catch {
    /* navegador sem storage (anônima, site bloqueado): segue sem lembrar */
  }
}

export function codigoLembrado(slug: string): string {
  try {
    return localStorage.getItem(chaveDoCodigo(slug)) ?? "";
  } catch {
    return "";
  }
}

export function esquecerCodigo(slug: string): void {
  try {
    localStorage.removeItem(chaveDoCodigo(slug));
  } catch {
    /* idem */
  }
}
