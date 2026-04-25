/**
 * Score de qualidade de lead 0-100 baseado em completude.
 * Critérios:
 *  - tem nome           +20
 *  - tem telefone válido +25
 *  - tem origem         +15
 *  - tem etapa          +10
 *  - tem observação     +15
 *  - tem atendente      +15
 */

export interface LeadLike {
  name?: string | null;
  phone?: string | null;
  origem?: string | null;
  stage?: string | null;
  observacoes?: string | null;
  attendantId?: number | null;
}

export interface QualityScore {
  score: number;
  grade: "A" | "B" | "C" | "D";
  missing: string[];
}

function isValidPhone(phone?: string | null): boolean {
  if (!phone) return false;
  const digits = phone.replace(/\D/g, "");
  return digits.length >= 10 && digits.length <= 13;
}

export function leadQuality(lead: LeadLike): QualityScore {
  let score = 0;
  const missing: string[] = [];

  if (lead.name?.trim()) score += 20;
  else missing.push("nome");

  if (isValidPhone(lead.phone)) score += 25;
  else missing.push("telefone");

  if (lead.origem?.trim()) score += 15;
  else missing.push("origem");

  if (lead.stage?.trim()) score += 10;
  else missing.push("etapa");

  if (lead.observacoes?.trim()) score += 15;
  else missing.push("observação");

  if (lead.attendantId) score += 15;
  else missing.push("atendente");

  const grade: QualityScore["grade"] =
    score >= 85 ? "A" : score >= 70 ? "B" : score >= 50 ? "C" : "D";

  return { score, grade, missing };
}

export function gradeColor(grade: QualityScore["grade"]): string {
  switch (grade) {
    case "A": return "text-emerald-300 ring-emerald-400/30 bg-emerald-400/10";
    case "B": return "text-sky-300 ring-sky-400/30 bg-sky-400/10";
    case "C": return "text-amber-300 ring-amber-400/30 bg-amber-400/10";
    case "D": return "text-rose-300 ring-rose-400/30 bg-rose-400/10";
  }
}
