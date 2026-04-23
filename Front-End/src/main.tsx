import React from "react";
import ReactDOM from "react-dom/client";
import { HashRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "sonner";
import { registerSW } from "virtual:pwa-register";
import App from "./App";
import "./index.css";
import { initThemeEarly } from "./hooks/useTheme";

initThemeEarly();

if (typeof window !== "undefined" && "serviceWorker" in navigator) {
  registerSW({ immediate: true });
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
      <HashRouter>
        <App />
        <Toaster position="top-right" richColors />
      </HashRouter>
    </QueryClientProvider>
  </React.StrictMode>
);
