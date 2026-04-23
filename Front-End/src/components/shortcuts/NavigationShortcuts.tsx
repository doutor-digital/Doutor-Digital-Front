import { useNavigate } from "react-router-dom";
import { useShortcut } from "@/hooks/useShortcut";

/**
 * Monta os atalhos "g X" de navegação entre páginas.
 * Renderiza nada — é só efeito colateral.
 */
export function NavigationShortcuts() {
  const navigate = useNavigate();
  useShortcut("g d", () => navigate("/"));
  useShortcut("g l", () => navigate("/leads"));
  useShortcut("g c", () => navigate("/contacts"));
  useShortcut("g r", () => navigate("/reports"));
  useShortcut("g a", () => navigate("/analytics"));
  useShortcut("g e", () => navigate("/evolution"));
  useShortcut("g u", () => navigate("/units"));
  useShortcut("g s", () => navigate("/settings"));
  useShortcut("g v", () => navigate("/live"));
  useShortcut("g f", () => navigate("/funnel"));
  useShortcut("g o", () => navigate("/sources"));
  return null;
}
