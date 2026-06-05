import { api } from "@/lib/api";

export interface AiSettings {
  hasKey: boolean;
}

export interface AiPingResponse {
  ok: boolean;
  error?: string | null;
}

export interface AiAnalyzeResponse {
  markdown: string;
  tokens: number;
  durationSec: number;
}

/**
 * Cliente da API de I.A. do painel (backend → OpenAI GPT-4o-mini + Whisper).
 * A chave fica guardada por tenant no backend, cifrada — o front nunca recebe
 * o valor de volta, só o boolean `hasKey`.
 */
export const aiService = {
  async getSettings(): Promise<AiSettings> {
    const { data } = await api.get<AiSettings>("/api/ai/settings");
    return { hasKey: Boolean(data?.hasKey) };
  },

  async setKey(apiKey: string): Promise<AiSettings> {
    const { data } = await api.put<AiSettings>("/api/ai/settings", { apiKey });
    return { hasKey: Boolean(data?.hasKey) };
  },

  async deleteKey(): Promise<void> {
    await api.delete("/api/ai/settings");
  },

  async test(): Promise<AiPingResponse> {
    const { data } = await api.post<AiPingResponse>("/api/ai/settings/test");
    return data;
  },

  async analyzeUnit(payload: {
    unitId: number;
    dateFrom?: string;
    dateTo?: string;
  }): Promise<AiAnalyzeResponse> {
    const { data } = await api.post<AiAnalyzeResponse>(
      "/api/ai/analyze",
      payload,
      { timeout: 180_000 }, // GPT pode levar ~30-60s pra responder
    );
    return {
      markdown: data?.markdown ?? "",
      tokens: data?.tokens ?? 0,
      durationSec: data?.durationSec ?? 0,
    };
  },

  async chat(payload: {
    messages: Array<{ role: "user" | "assistant"; content: string }>;
    unitId?: number | null;
    dateFrom?: string;
    dateTo?: string;
    currentPath?: string;
  }): Promise<string> {
    const { data } = await api.post<{ content: string }>(
      "/api/ai/chat",
      {
        messages: payload.messages,
        unitId: payload.unitId ?? null,
        dateFrom: payload.dateFrom,
        dateTo: payload.dateTo,
        currentPath: payload.currentPath,
      },
      { timeout: 120_000 },
    );
    return data?.content ?? "";
  },

  /**
   * Manda áudio gravado pelo browser pra Whisper transcrever (pt-BR).
   * Aceita webm/wav/m4a/mp3. Cap 25MB do Whisper.
   */
  async transcribe(blob: Blob, fileName = "audio.webm"): Promise<string> {
    const form = new FormData();
    form.append("audio", blob, fileName);
    const { data } = await api.post<{ text: string }>("/api/ai/transcribe", form, {
      headers: { "Content-Type": "multipart/form-data" },
      timeout: 120_000,
    });
    return data?.text ?? "";
  },
};
