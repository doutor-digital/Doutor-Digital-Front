import { create } from "zustand";
import { persist } from "zustand/middleware";

interface ClinicStore {
  tenantId: number | null;
  unitId: number | null;

  // unitId pode ser null → "Todas as unidades" (agregado por tenant).
  setContext: (tenantId: number, unitId: number | null) => void;
}

export const useClinic = create<ClinicStore>()(
  persist(
    (set) => ({
      tenantId: null,
      unitId: null,
      setContext: (tenantId, unitId) => set({ tenantId, unitId }),
    }),
    { name: "doutor.digital.clinic" }
  )
);