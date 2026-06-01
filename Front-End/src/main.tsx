import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster, toast } from "sonner";
import { registerSW } from "virtual:pwa-register";
import App from "./App";
import "./index.css";
import { initThemeEarly } from "./hooks/useTheme";
import { clearChunkReloadFlag } from "./lib/lazyWithRetry";

initThemeEarly();

// Se chegamos até aqui, o JS principal carregou — não precisamos mais da flag
// de "tentei recarregar pra resolver chunk ausente". Limpar libera o retry pra
// uma próxima vez que o usuário receber chunks do build novo enquanto navega.
clearChunkReloadFlag();

if (typeof window !== "undefined" && "serviceWorker" in navigator) {
  // Atualização do PWA sem precisar reinstalar: avisa quando há versão nova e
  // checa periodicamente. O usuário só toca em "Atualizar".
  const updateSW = registerSW({
    immediate: true,
    onRegisteredSW(_swUrl, reg) {
      if (reg) setInterval(() => reg.update().catch(() => {}), 60 * 60_000);
    },
    onNeedRefresh() {
      toast("Atualização disponível", {
        description: "Há uma nova versão do app.",
        duration: 30_000,
        action: {
          label: "Atualizar",
          onClick: () => updateSW(true),
        },
      });
    },
  });
}

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60_000,
      gcTime: 10 * 60_000,
      refetchOnWindowFocus: false,
      refetchOnReconnect: false,
      retry: 1,
    },
  },
});

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <App />
        <Toaster position="top-right" richColors />
      </BrowserRouter>
    </QueryClientProvider>
  </React.StrictMode>
);
