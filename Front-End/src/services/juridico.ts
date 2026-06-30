import { api } from "@/lib/api";
import { cleanParams, toInt } from "@/lib/http";
import type { JuridicoDashboard, JuridicoDashboardParams } from "@/types/juridico";

export const juridicoService = {
  /** Dashboard jurídico completo (7 grupos) — GET /api/juridico/dashboard. */
  async dashboard(params: JuridicoDashboardParams): Promise<JuridicoDashboard> {
    const { data } = await api.get<JuridicoDashboard>("/api/juridico/dashboard", {
      params: cleanParams({
        clinicId: toInt(params.clinicId),
        unitId: toInt(params.unitId),
        from: params.from,
        to: params.to,
      }),
    });
    return data;
  },
};
