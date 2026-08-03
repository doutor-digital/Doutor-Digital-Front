import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Loader2 } from "@/components/icons";
import { PageHeader } from "@/components/layout/PageHeader";
import { CrmKanban, type KanbanColumn, type KanbanTone } from "@/components/charts/CrmKanban";
import { useClinic } from "@/hooks/useClinic";
import { webhooksService } from "@/services/webhooks";
import { unitsService } from "@/services/units";
import { stageLabel as fallbackStageLabel } from "@/lib/stageLabels";

type PeriodoKey = "7d" | "30d" | "90d" | "mes";

const PERIODOS: { key: PeriodoKey; label: string }[] = [
  { key: "7d", label: "7 dias" },
  { key: "30d", label: "30 dias" },
  { key: "90d", label: "90 dias" },
  { key: "mes", label: "Este mês" },
];

function rangeDe(p: PeriodoKey): { from: string; to: string; label: string } {
  const to = new Date();
  const from = new Date();
  if (p === "7d") from.setDate(to.getDate() - 7);
  else if (p === "30d") from.setDate(to.getDate() - 30);
  else if (p === "90d") from.setDate(to.getDate() - 90);
  else from.setDate(1);
  const iso = (d: Date) => d.toISOString().slice(0, 10);
  const br = (d: Date) => d.toLocaleDateString("pt-BR");
  return { from: iso(from), to: iso(to), label: `${br(from)} — ${br(to)}` };
}

/**
 * Funil de vendas em quadro (Kanban), com uma coluna por etapa do pipeline da Kommo.
 *
 * Vive em página própria, e não no dashboard: o quadro cresce com a base (uma
 * unidade com 4 mil leads enche a tela) e é ferramenta de trabalho do SDR, não
 * indicador de gestão. O dashboard responde "como estamos"; aqui se responde
 * "quem está parado em qual etapa".
 */
export default function PipelineBoardPage() {
  const { unitId, tenantId } = useClinic();
  const [periodo, setPeriodo] = useState<PeriodoKey>("30d");
  const range = useMemo(() => rangeDe(periodo), [periodo]);

  const pipelines = useQuery({
    queryKey: ["pipeline-board", "kommo-pipelines", unitId],
    queryFn: () => unitsService.kommoPipelines(unitId!),
    enabled: unitId != null,
    staleTime: 10 * 60_000,
    retry: false,
  });

  const leadsBoard = useQuery({
    queryKey: ["pipeline-board", "leads", tenantId, unitId, range.from, range.to],
    queryFn: () =>
      webhooksService.listLeads({
        clinicId: unitId ?? tenantId ?? undefined,
        startDate: range.from,
        endDate: range.to,
        pageSize: 500,
      }),
    enabled: tenantId != null,
    staleTime: 15_000,
  });

  /** status_id da Kommo → nome da etapa ao vivo. */
  const stageNameMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const p of pipelines.data ?? []) {
      for (const s of p.statuses ?? []) map.set(String(s.id), s.name);
    }
    return map;
  }, [pipelines.data]);

  const colunas = useMemo<KanbanColumn[]>(() => {
    const leads = leadsBoard.data ?? [];

    // Bolinha por recência da última atividade — proxy de "lead esfriando".
    const toneOf = (lead: (typeof leads)[number]): KanbanTone => {
      const ts = (lead.updatedAt as string) || (lead.createdAt as string);
      if (!ts) return "red";
      const dias = (Date.now() - new Date(ts).getTime()) / 86_400_000;
      if (dias <= 2) return "green";
      if (dias <= 7) return "yellow";
      return "red";
    };

    const valueOf = (lead: (typeof leads)[number]): number | null => {
      const v =
        (lead.price as number | undefined) ??
        (lead.treatmentPlanValue as number | undefined) ??
        (lead.treatmentBudget as number | undefined) ??
        (lead.consultationValue as number | undefined);
      return typeof v === "number" && v > 0 ? v : null;
    };

    // Começa pelas etapas do pipeline, na ordem da Kommo, para que etapa vazia
    // continue aparecendo — coluna sumida esconde gargalo.
    const grupos = new Map<string, KanbanColumn["cards"]>();
    for (const p of pipelines.data ?? []) {
      for (const s of p.statuses ?? []) if (!grupos.has(s.name)) grupos.set(s.name, []);
    }

    for (const lead of leads) {
      const stageId = lead.currentStageId as number | string | null | undefined;
      const label =
        (stageId != null ? stageNameMap.get(String(stageId)) : undefined) ??
        fallbackStageLabel(lead.currentStage ?? "");
      if (!grupos.has(label)) grupos.set(label, []);
      grupos.get(label)!.push({
        id: lead.id,
        name: lead.name || `Lead #${lead.id}`,
        subtitle: (lead.source as string) || lead.attendantName || "—",
        value: valueOf(lead),
        tone: toneOf(lead),
      });
    }

    return Array.from(grupos.entries()).map(([title, cards], i) => ({
      id: `${title}-${i}`,
      title,
      cards,
    }));
  }, [leadsBoard.data, pipelines.data, stageNameMap]);

  const total = colunas.reduce((s, c) => s + c.cards.length, 0);

  return (
    <div className="space-y-4">
      <PageHeader
        title="Funil de vendas"
        description={`${total.toLocaleString("pt-BR")} negócios · ${range.label}`}
      />

      <div className="flex flex-wrap items-center gap-2">
        {PERIODOS.map((p) => (
          <button
            key={p.key}
            type="button"
            onClick={() => setPeriodo(p.key)}
            className={`rounded-full px-3 py-1.5 text-xs font-medium transition ${
              periodo === p.key
                ? "bg-white/10 text-white ring-1 ring-inset ring-white/20"
                : "text-slate-400 hover:bg-white/5 hover:text-slate-200"
            }`}
          >
            {p.label}
          </button>
        ))}
      </div>

      <div className="rounded-2xl border border-white/10 bg-[#0d1526] p-5">
        {leadsBoard.isLoading && !leadsBoard.data ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="h-6 w-6 animate-spin text-white/40" />
          </div>
        ) : (
          <CrmKanban columns={colunas} />
        )}

        {unitId == null && (
          <p className="mt-3 text-[11px] text-white/40">
            Selecione uma unidade para que as colunas saiam com os nomes do pipeline da Kommo.
          </p>
        )}
      </div>
    </div>
  );
}
