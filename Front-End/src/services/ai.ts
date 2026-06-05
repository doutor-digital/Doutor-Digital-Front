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

export interface AiChatResponse {
  content: string;
  toolsCalled: string[];
}

/**
 * Cliente da API de I.A. do painel (backend → OpenAI gpt-4o-mini +
 * gpt-4o-mini-transcribe). A chave fica guardada por tenant no backend,
 * cifrada — o front nunca recebe o valor de volta.
 *
 * `tenantId` é incluído como query em toda chamada quando o caller é
 * super_admin sem tenant_id no JWT (caso típico de quem administra
 * o painel). O front pega de useClinic.tenantId.
 */
export const aiService = {
  async getSettings(tenantId?: number | null): Promise<AiSettings> {
    const { data } = await api.get<AiSettings>("/api/ai/settings", {
      params: tenantId ? { tenantId } : {},
    });
    return { hasKey: Boolean(data?.hasKey) };
  },

  async setKey(apiKey: string, tenantId?: number | null): Promise<AiSettings> {
    const { data } = await api.put<AiSettings>(
      "/api/ai/settings",
      { apiKey },
      { params: tenantId ? { tenantId } : {} },
    );
    return { hasKey: Boolean(data?.hasKey) };
  },

  async deleteKey(tenantId?: number | null): Promise<void> {
    await api.delete("/api/ai/settings", {
      params: tenantId ? { tenantId } : {},
    });
  },

  async test(tenantId?: number | null): Promise<AiPingResponse> {
    const { data } = await api.post<AiPingResponse>(
      "/api/ai/settings/test",
      {},
      { params: tenantId ? { tenantId } : {} },
    );
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
      { timeout: 180_000 },
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
    tenantId?: number | null;
  }): Promise<AiChatResponse> {
    const { data } = await api.post<{ content: string; toolsCalled: string[] }>(
      "/api/ai/chat",
      {
        messages: payload.messages,
        unitId: payload.unitId ?? null,
        dateFrom: payload.dateFrom,
        dateTo: payload.dateTo,
        currentPath: payload.currentPath,
      },
      {
        timeout: 120_000,
        params: payload.tenantId ? { tenantId: payload.tenantId } : {},
      },
    );
    return {
      content: data?.content ?? "",
      toolsCalled: data?.toolsCalled ?? [],
    };
  },

  /**
   * Manda áudio gravado pelo browser para o endpoint /v1/audio/transcriptions
   * da OpenAI (modelo gpt-4o-mini-transcribe). Aceita webm/wav/m4a/mp3.
   * Cap 25MB.
   */
  async transcribe(blob: Blob, fileName = "audio.webm", tenantId?: number | null): Promise<string> {
    const form = new FormData();
    form.append("audio", blob, fileName);
    const { data } = await api.post<{ text: string }>("/api/ai/transcribe", form, {
      headers: { "Content-Type": "multipart/form-data" },
      timeout: 120_000,
      params: tenantId ? { tenantId } : {},
    });
    return data?.text ?? "";
  },
};
