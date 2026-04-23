/**
 * Parse de datas em linguagem natural (pt-BR) sem deps.
 * Suporta: "hoje", "ontem", "anteontem", "amanhã",
 * "há N dia(s)/semana(s)/mês(es)", "última segunda/terça/...",
 * "próxima segunda/...", ISO "YYYY-MM-DD", e variações "DD/MM" / "DD/MM/YYYY".
 */

const WEEKDAYS: Record<string, number> = {
  "domingo": 0, "segunda": 1, "terça": 2, "terca": 2, "quarta": 3,
  "quinta": 4, "sexta": 5, "sábado": 6, "sabado": 6,
};

function pad(n: number) {
  return String(n).padStart(2, "0");
}

function toIso(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function parseNaturalDate(input: string): string | null {
  const raw = input.trim().toLowerCase();
  if (!raw) return null;

  const now = new Date();
  now.setHours(0, 0, 0, 0);

  // ISO direto
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;

  // DD/MM/YYYY ou DD/MM
  const br = raw.match(/^(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?$/);
  if (br) {
    const d = Number(br[1]);
    const m = Number(br[2]);
    let y = br[3] ? Number(br[3]) : now.getFullYear();
    if (y < 100) y += 2000;
    const date = new Date(y, m - 1, d);
    if (!Number.isNaN(date.getTime())) return toIso(date);
  }

  // Palavras-chave simples
  if (raw === "hoje") return toIso(now);
  if (raw === "amanhã" || raw === "amanha") {
    const d = new Date(now);
    d.setDate(d.getDate() + 1);
    return toIso(d);
  }
  if (raw === "ontem") {
    const d = new Date(now);
    d.setDate(d.getDate() - 1);
    return toIso(d);
  }
  if (raw === "anteontem") {
    const d = new Date(now);
    d.setDate(d.getDate() - 2);
    return toIso(d);
  }

  // "há N dias/semanas/meses"
  const ha = raw.match(/^h[áa]\s+(\d+)\s+(dia|dias|semana|semanas|m[eê]s|meses)$/);
  if (ha) {
    const n = Number(ha[1]);
    const unit = ha[2];
    const d = new Date(now);
    if (unit.startsWith("dia")) d.setDate(d.getDate() - n);
    else if (unit.startsWith("semana")) d.setDate(d.getDate() - n * 7);
    else d.setMonth(d.getMonth() - n);
    return toIso(d);
  }

  // "última/próxima <weekday>"
  const wd = raw.match(/^(última|ultima|próxima|proxima)\s+(\w+)$/);
  if (wd && WEEKDAYS[wd[2]] !== undefined) {
    const target = WEEKDAYS[wd[2]];
    const d = new Date(now);
    const diff = (d.getDay() - target + 7) % 7 || 7;
    const isPast = wd[1].startsWith("ú") || wd[1].startsWith("u");
    d.setDate(d.getDate() + (isPast ? -diff : (7 - diff) % 7 || 7));
    return toIso(d);
  }

  return null;
}
