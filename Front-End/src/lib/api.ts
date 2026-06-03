import axios, { AxiosError, AxiosRequestConfig } from "axios";
import type { ProblemDetails } from "@/types";
import { toast } from "sonner";

declare module "axios" {
  export interface AxiosRequestConfig {
    /**
     * Quando `true`, um 401 nessa request NÃO desloga o usuário.
     * Use em endpoints que podem retornar 401 por razões não relacionadas
     * ao JWT (ex.: missing admin key, expired admin key).
     */
    silent401?: boolean;
  }
}

export const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL || "http://localhost:5000";

export const api = axios.create({
  baseURL: API_BASE_URL,
  // 2 min: consultas pesadas (dashboard-overview com KPIs custom, chamadas ao vivo da
  // Kommo) passam de 30s sem ser erro. Endpoints específicos sobrescrevem com seu próprio
  // timeout quando precisam de mais (ex.: import em units.ts).
  timeout: 120_000,
  headers: { "Content-Type": "application/json" },
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem("auth_token");
  if (token) config.headers.Authorization = `Bearer ${token}`;

  const adminKey = localStorage.getItem("admin_key");
  if (adminKey) config.headers["X-Admin-Key"] = adminKey;

  const sourceBearerToken = localStorage.getItem("cloudia_bearer_token");
  if (sourceBearerToken) {
    config.headers["X-Cloudia-Bearer"] = sourceBearerToken;
  }

  const cloudiaBaseUrl = localStorage.getItem("cloudia_base_url");
  if (cloudiaBaseUrl) {
    config.headers["X-Cloudia-Base-Url"] = cloudiaBaseUrl;
  }

  return config;
});

api.interceptors.response.use(
  (r) => r,
  (error: AxiosError<ProblemDetails>) => {
    const status = error.response?.status;
    const msg =
      error.response?.data?.detail ||
      error.response?.data?.title ||
      error.message;

    const cfg = error.config as AxiosRequestConfig | undefined;
    const silent401 = cfg?.silent401 === true;

    // Timeout do axios / falha de rede (sem resposta do servidor): não joga a mensagem
    // crua ("timeout of 30000ms exceeded") num toast. Quem chamou (react-query) já trata
    // o estado de erro/loading; a consulta pesada normalmente segue rodando no servidor.
    const isTimeout = error.code === "ECONNABORTED" || /timeout/i.test(error.message || "");
    const semResposta = !error.response;

    if (status === 401 && !silent401) {
      localStorage.removeItem("auth_token");
      if (!window.location.pathname.startsWith("/login")) {
        window.location.href = "/login";
      }
    } else if (status === 401 && silent401) {
      // não desloga, deixa o caller tratar
    } else if (status && status >= 500) {
      toast.error(`Erro ${status}: ${msg || "falha no servidor"}`);
    } else if (status === 404) {
      // silent - deixa o caller decidir
    } else if (isTimeout || semResposta) {
      // silencioso (sem toast) — evita o erro cru de timeout/rede na tela
    } else if (msg && status !== 401) {
      toast.error(msg);
    }
    return Promise.reject(error);
  }
);

export function setAuthToken(token: string | null) {
  if (token) localStorage.setItem("auth_token", token);
  else localStorage.removeItem("auth_token");
}

export function setAdminKey(key: string | null) {
  if (key) localStorage.setItem("admin_key", key);
  else localStorage.removeItem("admin_key");
}


export function setSourceBearerToken(token: string | null) {
  if (token) localStorage.setItem("cloudia_bearer_token", token);
  else localStorage.removeItem("cloudia_bearer_token");
}

export function setCloudiaBaseUrl(url: string | null) {
  if (url) localStorage.setItem("cloudia_base_url", url);
  else localStorage.removeItem("cloudia_base_url");
}
