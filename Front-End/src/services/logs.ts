import axios, { AxiosError } from "axios";
import { API_BASE_URL } from "@/lib/api";

export const LOGS_TOKEN_KEY = "logs_token";
export const LOGS_TOKEN_EXPIRES_AT_KEY = "logs_token_expires_at";

// Instância axios DEDICADA — não compartilha interceptors com a app principal.
// Evita que um 401 aqui derrube a sessão do usuário logado no dashboard.
const logsApi = axios.create({
  baseURL: API_BASE_URL,
  timeout: 15_000,
  headers: { "Content-Type": "application/json" },
});

logsApi.interceptors.request.use((config) => {
  const token = localStorage.getItem(LOGS_TOKEN_KEY);
  if (token) {
    config.headers["X-Logs-Token"] = token;
  }
  return config;
});

export type LogLevel =
  | "Trace"
  | "Debug"
  | "Information"
  | "Warning"
  | "Error"
  | "Critical";

export interface LogEntry {
  id: number;
  timestamp: string;
  level: LogLevel;
  category: string;
  message: string;
  exception?: string | null;
  path?: string | null;
  method?: string | null;
  traceId?: string | null;
}

export interface LogListResponse {
  total: number;
  returned: number;
  items: LogEntry[];
}

export interface LogStatsResponse {
  total: number;
  byLevel: Record<string, number>;
}

export interface ListLogsParams {
  level?: string;
  search?: string;
  sinceMinutes?: number;
  limit?: number;
}

export interface LogsAuthResponse {
  token: string;
  expiresAt: string;
  sessionTtlMinutes: number;
}

export class LogsSessionExpiredError extends Error {
  constructor() {
    super("Sessão do painel de logs expirada");
    this.name = "LogsSessionExpiredError";
  }
}

function handleAuthError(err: unknown): never {
  const ax = err as AxiosError<{ message?: string }>;
  if (ax.response?.status === 401) {
    localStorage.removeItem(LOGS_TOKEN_KEY);
    localStorage.removeItem(LOGS_TOKEN_EXPIRES_AT_KEY);
    throw new LogsSessionExpiredError();
  }
  throw err;
}

export const logsService = {
  hasSession(): boolean {
    const token = localStorage.getItem(LOGS_TOKEN_KEY);
    const exp = localStorage.getItem(LOGS_TOKEN_EXPIRES_AT_KEY);
    if (!token) return false;
    if (exp) {
      const expDate = new Date(exp).getTime();
      if (Number.isFinite(expDate) && expDate <= Date.now()) {
        localStorage.removeItem(LOGS_TOKEN_KEY);
        localStorage.removeItem(LOGS_TOKEN_EXPIRES_AT_KEY);
        return false;
      }
    }
    return true;
  },

  async login(username: string, password: string): Promise<LogsAuthResponse> {
    const { data } = await logsApi.post<LogsAuthResponse>("/logs/auth", {
      username,
      password,
    });
    localStorage.setItem(LOGS_TOKEN_KEY, data.token);
    localStorage.setItem(LOGS_TOKEN_EXPIRES_AT_KEY, data.expiresAt);
    return data;
  },

  async logout(): Promise<void> {
    try {
      await logsApi.post("/logs/logout");
    } catch {
      /* silencia — sempre limpa localmente */
    } finally {
      localStorage.removeItem(LOGS_TOKEN_KEY);
      localStorage.removeItem(LOGS_TOKEN_EXPIRES_AT_KEY);
    }
  },

  async list(params: ListLogsParams = {}): Promise<LogListResponse> {
    try {
      const { data } = await logsApi.get<LogListResponse>("/logs", {
        params: {
          level: params.level || undefined,
          search: params.search || undefined,
          sinceMinutes: params.sinceMinutes && params.sinceMinutes > 0 ? params.sinceMinutes : undefined,
          limit: params.limit ?? 500,
        },
      });
      return data;
    } catch (err) {
      handleAuthError(err);
    }
  },

  async stats(sinceMinutes?: number): Promise<LogStatsResponse> {
    try {
      const { data } = await logsApi.get<LogStatsResponse>("/logs/stats", {
        params: sinceMinutes && sinceMinutes > 0 ? { sinceMinutes } : undefined,
      });
      return data;
    } catch (err) {
      handleAuthError(err);
    }
  },

  async clear(): Promise<void> {
    try {
      await logsApi.delete("/logs");
    } catch (err) {
      handleAuthError(err);
    }
  },
};
