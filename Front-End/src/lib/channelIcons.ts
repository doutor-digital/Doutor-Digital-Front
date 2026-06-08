/**
 * Mapeia o VALOR de uma origem de lead (vindo de um campo customizado da Kommo) para um
 * ícone + cor de canal. Reconhece Instagram, Facebook e Orgânico; qualquer outro valor
 * ganha uma cor estável derivada do texto (pra "ver todos" os tipos de origem).
 */

export interface ChannelVisual {
  /** Logo do canal (quando conhecido). */
  iconUrl?: string;
  /** Cor de destaque da barra/marcador. */
  color: string;
}

// Ícones locais (em /public/source-icons) — estáveis, sem depender de CDNs externos.
const INSTAGRAM_ICON = "/source-icons/instagram.png";
const FACEBOOK_ICON = "/source-icons/facebook.png";
const SEM_ORIGEM_ICON = "/source-icons/sem-origem.png";
const INDICACAO_ICON = "/source-icons/indicacao.png";
const GOOGLE_ICON = "/source-icons/google.png";

/** Paleta para origens desconhecidas — escolhida de forma estável por hash do texto. */
const PALETTE = [
  "#60a5fa", "#a78bfa", "#f472b6", "#fb923c",
  "#22d3ee", "#facc15", "#4ade80", "#f87171",
];

function normalize(v: string): string {
  return v
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "") // remove acentos (marcas diacríticas)
    .trim();
}

function hashColor(v: string): string {
  let h = 0;
  for (let i = 0; i < v.length; i++) h = (h * 31 + v.charCodeAt(i)) | 0;
  return PALETTE[Math.abs(h) % PALETTE.length];
}

/** Resolve o visual (ícone + cor) de um valor de origem. */
export function channelVisual(value: string): ChannelVisual {
  const n = normalize(value);

  // "Sem origem" precisa vir ANTES de "org" (organic), senão "sem origem" casaria
  // com o includes("org") por causa de "ORIGem".
  if (!n || n.includes("sem orig") || n.includes("sem-orig") || n === "n/a" || n === "-")
    return { iconUrl: SEM_ORIGEM_ICON, color: "#94a3b8" };

  if (n.includes("insta") || n === "ig") return { iconUrl: INSTAGRAM_ICON, color: "#e1306c" };
  if (n.includes("face") || n === "fb" || n.includes("meta"))
    return { iconUrl: FACEBOOK_ICON, color: "#1877f2" };
  if (n.includes("google") || n.includes("search") || n.includes("ads"))
    return { iconUrl: GOOGLE_ICON, color: "#4285f4" };
  if (n.includes("indica") || n.includes("refer"))
    return { iconUrl: INDICACAO_ICON, color: "#f59e0b" };
  if (n.includes("org") || n.includes("organic")) return { color: "#34d399" };
  if (n.includes("whats") || n.includes("zap")) return { color: "#25d366" };
  if (n.includes("outro") || n.includes("other")) return { color: "#94a3b8" };

  return { color: hashColor(n) };
}
