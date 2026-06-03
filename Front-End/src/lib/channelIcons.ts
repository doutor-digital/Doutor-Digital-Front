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

const INSTAGRAM_ICON =
  "https://img.magnific.com/vetores-premium/icone-de-logotipo-de-vetor-do-instagram-logotipo-de-midia-social_901408-392.jpg?semt=ais_hybrid&w=740&q=80";
const FACEBOOK_ICON =
  "https://png.pngtree.com/png-clipart/20181003/ourmid/pngtree-facebook-logo-facebook-icon-png-image_3654755.png";

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

  if (n.includes("insta") || n === "ig") return { iconUrl: INSTAGRAM_ICON, color: "#e1306c" };
  if (n.includes("face") || n === "fb" || n.includes("meta"))
    return { iconUrl: FACEBOOK_ICON, color: "#1877f2" };
  if (n.includes("org") || n.includes("organic")) return { color: "#34d399" };
  if (n.includes("whats") || n.includes("zap")) return { color: "#25d366" };
  if (n.includes("google") || n.includes("search") || n.includes("ads")) return { color: "#fbbf24" };
  if (n.includes("indica") || n.includes("refer")) return { color: "#f472b6" };
  if (n.includes("outro") || n.includes("other") || n === "n/a" || n === "-")
    return { color: "#94a3b8" };

  return { color: hashColor(n) };
}
