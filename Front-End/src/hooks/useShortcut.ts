import { useEffect, useRef } from "react";

export type KeyCombo = string; // e.g. "mod+k", "?", "g l", "esc"

interface ShortcutOptions {
  /** When true, ignores when focus is inside <input>, <textarea>, or contenteditable. Default: true */
  ignoreInEditable?: boolean;
  /** When false, hook is disabled. */
  enabled?: boolean;
  /** Preventing default for the matched key event. Default: true */
  preventDefault?: boolean;
}

/**
 * Hook minimalista de atalhos de teclado.
 * - Suporta combos simples ("mod+k") e sequências ("g l", "g r").
 * - `mod` = ⌘ no mac, Ctrl em outros.
 * - Sequências: até 2 teclas, janela de 800ms entre elas.
 */
export function useShortcut(
  combo: KeyCombo,
  handler: (e: KeyboardEvent) => void,
  opts: ShortcutOptions = {},
) {
  const { ignoreInEditable = true, enabled = true, preventDefault = true } = opts;
  const handlerRef = useRef(handler);
  handlerRef.current = handler;

  const bufferRef = useRef<{ key: string; at: number } | null>(null);

  useEffect(() => {
    if (!enabled) return;

    const isMac = navigator.platform.toLowerCase().includes("mac");
    const parts = combo.trim().toLowerCase();

    const matchesCombo = (e: KeyboardEvent, target: string): boolean => {
      const tokens = target.split("+").map((t) => t.trim());
      const key = tokens[tokens.length - 1];
      const mods = tokens.slice(0, -1);

      const needMod = mods.includes("mod");
      const needCtrl = mods.includes("ctrl");
      const needMeta = mods.includes("meta");
      const needShift = mods.includes("shift");
      const needAlt = mods.includes("alt");

      if (needMod && !(isMac ? e.metaKey : e.ctrlKey)) return false;
      if (needCtrl && !e.ctrlKey) return false;
      if (needMeta && !e.metaKey) return false;
      if (needShift && !e.shiftKey) return false;
      if (needAlt && !e.altKey) return false;

      const k = e.key.toLowerCase();
      if (key === "?" && k === "?") return true;
      if (key === "esc" && k === "escape") return true;
      return k === key;
    };

    const onKeyDown = (e: KeyboardEvent) => {
      if (ignoreInEditable) {
        const target = e.target as HTMLElement | null;
        const tag = target?.tagName?.toLowerCase();
        const editable =
          tag === "input" ||
          tag === "textarea" ||
          tag === "select" ||
          (target?.getAttribute?.("contenteditable") === "true");
        // Allow ⌘K/Ctrl+K to work even inside inputs
        const hasMod = e.metaKey || e.ctrlKey;
        if (editable && !hasMod && parts !== "esc") return;
      }

      // sequência tipo "g l"
      if (parts.includes(" ")) {
        const [a, b] = parts.split(" ");
        const k = e.key.toLowerCase();
        const now = Date.now();

        if (bufferRef.current && now - bufferRef.current.at < 800) {
          if (bufferRef.current.key === a && k === b) {
            if (preventDefault) e.preventDefault();
            handlerRef.current(e);
            bufferRef.current = null;
            return;
          }
        }
        if (k === a && !e.metaKey && !e.ctrlKey && !e.altKey) {
          bufferRef.current = { key: k, at: now };
        } else {
          bufferRef.current = null;
        }
        return;
      }

      if (matchesCombo(e, parts)) {
        if (preventDefault) e.preventDefault();
        handlerRef.current(e);
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [combo, ignoreInEditable, enabled, preventDefault]);
}
