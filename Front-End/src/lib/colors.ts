/**
 * Paleta de cores determinísticas para avatars/badges.
 * Mesmo input → mesma cor, sempre. Contraste WCAG AA em superfícies escuras.
 */
export const AVATAR_COLORS: Array<{ bg: string; fg: string; ring: string }> = [
  { bg: "bg-sky-500/15", fg: "text-sky-200", ring: "ring-sky-500/25" },
  { bg: "bg-emerald-500/15", fg: "text-emerald-200", ring: "ring-emerald-500/25" },
  { bg: "bg-amber-500/15", fg: "text-amber-200", ring: "ring-amber-500/25" },
  { bg: "bg-rose-500/15", fg: "text-rose-200", ring: "ring-rose-500/25" },
  { bg: "bg-indigo-500/15", fg: "text-indigo-200", ring: "ring-indigo-500/25" },
  { bg: "bg-teal-500/15", fg: "text-teal-200", ring: "ring-teal-500/25" },
  { bg: "bg-pink-500/15", fg: "text-pink-200", ring: "ring-pink-500/25" },
  { bg: "bg-violet-500/15", fg: "text-violet-200", ring: "ring-violet-500/25" },
  { bg: "bg-cyan-500/15", fg: "text-cyan-200", ring: "ring-cyan-500/25" },
  { bg: "bg-fuchsia-500/15", fg: "text-fuchsia-200", ring: "ring-fuchsia-500/25" },
];

/** djb2 hash simples e estável. */
function hash(s: string): number {
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

export function pickColor(key: string): (typeof AVATAR_COLORS)[number] {
  return AVATAR_COLORS[hash(key) % AVATAR_COLORS.length];
}

export function initials(name?: string | null, max = 2): string {
  if (!name) return "—";
  const parts = name
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((p) => p[0]!.toUpperCase());
  if (parts.length === 0) return "—";
  if (parts.length === 1) return parts[0].slice(0, max);
  return (parts[0] + parts[parts.length - 1]).slice(0, max);
}
