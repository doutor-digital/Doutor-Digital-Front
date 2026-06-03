import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { unitsService } from "@/services/units";
import { stageLabel } from "@/lib/stageLabels";

export type StageResolver = (
  raw?: string | number | null,
  stageId?: number | null,
) => string;

/**
 * Resolve o status_id cru da Kommo (ex.: "104945887") para o nome real da etapa
 * (ex.: "Resgate") puxando os pipelines da Kommo da unidade.
 *
 * Ordem de resolução:
 *   1. nome real vindo do pipeline da Kommo (por stageId ou por valor numérico cru);
 *   2. fallback para {@link stageLabel} — traduz etapas canônicas e devolve
 *      "Etapa #<id>" quando o id ainda não foi mapeado.
 *
 * Requer que a unidade tenha KommoSubdomain + token salvos; caso contrário o
 * resolver simplesmente cai no fallback sem quebrar.
 */
export function useStageNames(unitId?: number | string | null) {
  const id = unitId != null ? Number(unitId) : null;
  const enabled = id != null && Number.isFinite(id) && id > 0;

  const pipelines = useQuery({
    queryKey: ["kommo-pipelines", id],
    queryFn: () => unitsService.kommoPipelines(id!),
    enabled,
    staleTime: 1000 * 60 * 30, // pipelines mudam raramente — 30 min de cache
    retry: false,
  });

  const byId = useMemo(() => {
    const map = new Map<string, string>();
    for (const p of pipelines.data ?? []) {
      for (const s of p.statuses ?? []) {
        if (s?.id != null && s?.name) map.set(String(s.id), s.name);
      }
    }
    return map;
  }, [pipelines.data]);

  const resolve: StageResolver = useMemo(
    () => (raw, stageId) => {
      const sid =
        stageId != null && stageId > 0
          ? String(stageId)
          : raw != null && /^\d+$/.test(String(raw).trim())
            ? String(raw).trim()
            : "";
      if (sid && byId.has(sid)) return byId.get(sid)!;
      return stageLabel(raw != null ? String(raw) : null);
    },
    [byId],
  );

  return { resolve, isLoading: pipelines.isLoading, map: byId };
}
