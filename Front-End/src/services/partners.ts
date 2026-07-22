import { api } from "@/lib/api";
import { asArray } from "@/lib/http";

/**
 * Uma unidade parceira com cadastro, estado da integração Kommo e números
 * consolidados. Vem de `GET /partners/overview` (restrito a nível admin).
 */
export interface PartnerOverview {
  id: number;
  clinicId: number;
  name: string;
  slug: string | null;
  /** "saude" (clínicas) ou "juridico" (advocacia). */
  segment: string;
  city: string | null;
  state: string | null;
  photoUrl: string | null;
  responsibleName: string | null;
  isActive: boolean;

  kommoSubdomain: string | null;
  /** Tem access token salvo — sincroniza via API da Kommo. */
  hasKommoToken: boolean;
  /** Mapa de etapas da Kommo já configurado. */
  hasStageMap: boolean;

  totalLeads: number;
  leads30d: number;
  leads7d: number;
  agendados: number;
  fechados: number;
  faturamento: number;
  lastLeadAt: string | null;
  daysSinceLastLead: number | null;
}

export const partnersService = {
  async overview(): Promise<PartnerOverview[]> {
    const { data } = await api.get("/partners/overview");
    return asArray<PartnerOverview>(data);
  },
};
