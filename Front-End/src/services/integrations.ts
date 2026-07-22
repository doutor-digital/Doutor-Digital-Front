import { api } from "@/lib/api";
import { toInt } from "@/lib/http";

export type AdsProvider = "meta" | "google";

export interface AdAccount {
  id: number;
  provider: AdsProvider;
  external_account_id?: string | null;
  name?: string | null;
  status: "connected" | "disconnected";
  last_sync_at?: string | null;
  last_sync_note?: string | null;
  /** true = provedor com credenciais reais; false = modo demo (stub). */
  live: boolean;
}

export interface AdsProviderInfo {
  provider: AdsProvider;
  live: boolean;
}

export interface AdsSpendItem {
  provider: AdsProvider;
  campaign_id: string;
  campaign_name?: string | null;
  spend: number;
  currency: string;
  /** Contadores somados no período (CTR/CPC/CPM são derivados a partir deles). */
  impressions?: number;
  clicks?: number;
  /** Conversas de WhatsApp iniciadas — o "lead" na visão do Meta. */
  conversations?: number;
}

/** Estado das credenciais de um provedor (NUNCA traz o segredo em texto). */
export interface AdsCredentialStatus {
  provider: AdsProvider;
  client_id?: string | null;
  has_secret: boolean;
  developer_token?: string | null;
  live: boolean;
  /** "none" = nada configurado · "config" = via env · "db" = salvo pela tela. */
  source: "none" | "config" | "db";
}

/** Central de Integrações — contas de Meta/Google Ads + gasto por campanha. */
export const integrationsService = {
  /** Contas conectadas + provedores disponíveis. */
  async listAds(clinicId?: number | string | null): Promise<{
    items: AdAccount[];
    providers: AdsProviderInfo[];
  }> {
    const id = toInt(clinicId ?? 0);
    const { data } = await api.get<{ items: AdAccount[]; providers: AdsProviderInfo[] }>(
      "/api/integrations/ads",
      { params: id ? { clinicId: id } : {} },
    );
    return { items: data?.items ?? [], providers: data?.providers ?? [] };
  },

  /** Início do OAuth: devolve a URL para onde mandar o usuário autorizar. */
  async connect(
    provider: AdsProvider,
    opts?: { clinicId?: number | string | null; unitId?: number | string | null },
  ): Promise<{ auth_url: string; live: boolean }> {
    const clinicId = toInt(opts?.clinicId ?? 0);
    const unitId = toInt(opts?.unitId ?? 0);
    const { data } = await api.get<{ auth_url: string; live: boolean }>(
      `/api/integrations/ads/${provider}/connect`,
      { params: { ...(clinicId ? { clinicId } : {}), ...(unitId ? { unitId } : {}) } },
    );
    return data;
  },

  /** Sincroniza o gasto da conta agora (últimos 30 dias). */
  async sync(id: number): Promise<{ rows: number; last_sync_at?: string | null }> {
    const { data } = await api.post<{ rows: number; last_sync_at?: string | null }>(
      `/api/integrations/ads/${id}/sync`,
    );
    return data;
  },

  /** Desconecta a conta (apaga tokens). */
  async disconnect(id: number): Promise<void> {
    await api.delete(`/api/integrations/ads/${id}`);
  },

  /** Status das credenciais do app por provedor. */
  async getCredentials(): Promise<{ items: AdsCredentialStatus[] }> {
    const { data } = await api.get<{ items: AdsCredentialStatus[] }>(
      "/api/integrations/ads/credentials",
    );
    return { items: data?.items ?? [] };
  },

  /** Salva as credenciais de um provedor (o segredo só troca se enviado). */
  async saveCredentials(
    provider: AdsProvider,
    body: { client_id?: string; client_secret?: string; developer_token?: string },
  ): Promise<{ live: boolean }> {
    const { data } = await api.put<{ live: boolean }>(
      `/api/integrations/ads/credentials/${provider}`,
      body,
    );
    return data;
  },

  /** Gasto agregado por campanha no período (consumido pelo /desempenho). */
  async spend(opts?: {
    clinicId?: number | string | null;
    from?: string;
    to?: string;
  }): Promise<{ items: AdsSpendItem[] }> {
    const clinicId = toInt(opts?.clinicId ?? 0);
    const { data } = await api.get<{ items: AdsSpendItem[] }>("/api/integrations/ads/spend", {
      params: {
        ...(clinicId ? { clinicId } : {}),
        ...(opts?.from ? { from: opts.from } : {}),
        ...(opts?.to ? { to: opts.to } : {}),
      },
    });
    return { items: data?.items ?? [] };
  },
};
