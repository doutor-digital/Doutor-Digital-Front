import { ComponentType, lazy } from "react";

/**
 * Lazy import resiliente a deploys novos.
 *
 * Problema que isso resolve: quando um deploy novo sai, o `index.html` antigo
 * (cacheado no browser ou já carregado em uma aba aberta) referencia chunks com
 * hash que não existem mais no servidor. O navegador tenta importar e dá:
 *
 *     Failed to fetch dynamically imported module: .../DashboardLayout-{old-hash}.js
 *
 * Solução: detectar o erro de import dinâmico, marcar uma flag de "já tentei
 * recarregar" em sessionStorage, e dar reload na página. Após o reload, o browser
 * pega o `index.html` novo (com Cache-Control: must-revalidate) que referencia os
 * hashes corretos.
 *
 * A flag em sessionStorage previne loop infinito caso o problema seja outro
 * (ex.: chunk realmente quebrado no servidor) — nesse caso erra normal e mostra
 * o erro pro usuário.
 */

const RELOAD_FLAG_KEY = "vite_chunk_reload_attempted";

function isChunkLoadError(err: unknown): boolean {
  if (!(err instanceof Error)) return false;
  const msg = err.message;
  return (
    msg.includes("Failed to fetch dynamically imported module") ||
    msg.includes("Failed to load module script") ||
    msg.includes("Importing a module script failed") ||
    // Safari/Firefox variants
    msg.includes("error loading dynamically imported module") ||
    msg.includes("MIME type")
  );
}

function alreadyAttemptedReload(): boolean {
  try {
    return sessionStorage.getItem(RELOAD_FLAG_KEY) === "1";
  } catch {
    return false;
  }
}

function markReloadAttempted() {
  try {
    sessionStorage.setItem(RELOAD_FLAG_KEY, "1");
  } catch {
    // sessionStorage pode estar bloqueado (modo privado, etc) — ignora.
  }
}

/** Limpa a flag de reload — chamar isso depois que o app inicializa com sucesso. */
export function clearChunkReloadFlag() {
  try {
    sessionStorage.removeItem(RELOAD_FLAG_KEY);
  } catch {
    // ignore
  }
}

// Mesmo shape genérico que React.lazy aceita — `ComponentType<any>` cobre
// qualquer componente com qualquer prop signature.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function lazyWithRetry<T extends ComponentType<any>>(
  factory: () => Promise<{ default: T }>,
) {
  return lazy<T>(async () => {
    try {
      return await factory();
    } catch (err) {
      if (isChunkLoadError(err) && !alreadyAttemptedReload()) {
        markReloadAttempted();
        window.location.reload();
        // Promise que nunca resolve — evita que React tente renderizar erro
        // antes do reload acontecer.
        return new Promise<{ default: T }>(() => {});
      }
      throw err;
    }
  });
}
