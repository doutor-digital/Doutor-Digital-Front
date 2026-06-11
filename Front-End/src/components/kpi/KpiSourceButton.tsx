import { useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Check, Filter, Layers, Loader2, SlidersHorizontal, Tag, X } from "@/components/icons";
import { Select } from "@/components/ui/Select";
import { Input } from "@/components/ui/Input";
import { useAuth } from "@/hooks/useAuth";
import { isAdminLevel } from "@/lib/roles";
import type { KommoPipeline, KommoCustomField } from "@/services/units";
import {
  kpiConfigService,
  type KpiConfigItem,
  type KpiSourceConfig,
  type KpiSourceType,
} from "@/services/kpiConfig";
import { cn } from "@/lib/utils";

const SOURCE_LABELS: Record<KpiSourceType, string> = {
  kommo_stage: "Etapa da Kommo",
  custom_field_count: "Campo (contagem por valor)",
  custom_field_sum: "Campo (soma numérica)",
  stage_field_filter: "Etapa + campo",
  recovery_attempt: "Tentativa de resgate (data do evento)",
};
// "created" não aparece no seletor — é o default implícito de "criados no período".
// "recovery_attempt" não usa stage nem campo: conta leads distintos cujo field
// "Tentativas de resgastes" foi preenchido na Kommo dentro do período (data do evento,
// não da criação do lead). Ideal pro card "Resgate" porque reflete o trabalho do dia.

/**
 * Botão compacto no card do KPI que abre um popover para o ANALISTA escolher, na
 * própria dashboard, de qual etapa/campo aquele KPI puxa. Some para os demais papéis.
 */
export function KpiSourceButton({
  unitId,
  kpiKey,
  label,
  pipelines,
  customFields,
  saved,
}: {
  unitId: number | null;
  kpiKey: string;
  label: string;
  pipelines: KommoPipeline[];
  customFields: KommoCustomField[];
  saved?: KpiConfigItem;
}) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);

  const [sourceType, setSourceType] = useState<KpiSourceType>(
    (saved?.source_type as KpiSourceType) ?? "kommo_stage",
  );
  const [config, setConfig] = useState<KpiSourceConfig>(saved?.config ?? {});

  const save = useMutation({
    mutationFn: () =>
      kpiConfigService.save(unitId!, [{ kpi_key: kpiKey, source_type: sourceType, config }]),
    onSuccess: () => {
      toast.success(`Fonte de "${label}" salva.`);
      qc.invalidateQueries({ queryKey: ["dash-amo"] });
      qc.invalidateQueries({ queryKey: ["kpi-config", unitId] });
      setOpen(false);
    },
    onError: () => toast.error("Falha ao salvar a fonte."),
  });

  /**
   * Restaura o KPI pra fonte padrão (criados no período) removendo o
   * mapeamento custom salvo. Útil quando o analista configurou errado
   * (ex.: setou 'Etapa da Kommo' pra 'Total de leads' achando que era isso).
   */
  const reset = useMutation({
    mutationFn: () => kpiConfigService.remove(unitId!, kpiKey),
    onSuccess: () => {
      toast.success(`"${label}" voltou ao padrão (criados no período).`);
      qc.invalidateQueries({ queryKey: ["dash-amo"] });
      qc.invalidateQueries({ queryKey: ["kpi-config", unitId] });
      setOpen(false);
    },
    onError: () => toast.error("Falha ao restaurar."),
  });

  const selectedField = useMemo(
    () => customFields.find((f) => f.id === config.fieldId),
    [customFields, config.fieldId],
  );

  if (!isAdminLevel(user?.role) || unitId == null) return null;

  const usesStage = sourceType === "kommo_stage" || sourceType === "stage_field_filter";
  const usesField =
    sourceType === "custom_field_count" ||
    sourceType === "custom_field_sum" ||
    sourceType === "stage_field_filter";
  const usesMatch = sourceType === "custom_field_count" || sourceType === "stage_field_filter";

  const summary = saved
    ? SOURCE_LABELS[saved.source_type as KpiSourceType] ?? "Configurada"
    : kpiKey === "total_leads"
      ? "Criados no período"
      : "Configurar fonte";

  const toggleStage = (id: number) => {
    const set = new Set(config.stageIds ?? []);
    set.has(id) ? set.delete(id) : set.add(id);
    setConfig((c) => ({ ...c, stageIds: [...set] }));
  };
  const toggleMatch = (value: string) => {
    const set = new Set(config.matchValues ?? []);
    set.has(value) ? set.delete(value) : set.add(value);
    setConfig((c) => ({ ...c, matchValues: [...set] }));
  };

  return (
    <div className="mt-3">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={cn(
          "flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10.5px] font-medium transition",
          saved
            ? "bg-emerald-400/[0.1] text-emerald-200 ring-1 ring-inset ring-emerald-400/25 hover:bg-emerald-400/20"
            : "bg-white/[0.04] text-white/50 ring-1 ring-inset ring-white/[0.08] hover:bg-white/[0.08] hover:text-white/80",
        )}
      >
        <SlidersHorizontal className="h-3 w-3" />
        <span className="truncate">fonte: {summary}</span>
      </button>

      {open && createPortal(
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => setOpen(false)}
            aria-hidden
          />
          <div className="relative max-h-[85vh] w-full max-w-sm overflow-y-auto rounded-2xl border border-white/12 bg-[#0a0f1f] p-4 shadow-2xl ring-1 ring-white/5">
          <div className="mb-2 flex items-center justify-between">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-300">
              Fonte de {label}
            </p>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="rounded-full p-1 text-slate-400 hover:bg-white/10 hover:text-slate-100"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>

          <Select
            value={sourceType}
            onChange={(e) => setSourceType(e.target.value as KpiSourceType)}
            className="text-[12px]"
          >
            {Object.entries(SOURCE_LABELS).map(([v, l]) => (
              <option key={v} value={v}>
                {l}
              </option>
            ))}
          </Select>

          {usesStage && (
            <div className="mt-2">
              <p className="mb-1 flex items-center gap-1 text-[10px] uppercase tracking-wider text-slate-500">
                <Layers className="h-3 w-3" /> Etapas ({config.stageIds?.length ?? 0})
              </p>
              <div className="max-h-64 space-y-0.5 overflow-y-auto rounded-md border border-white/[0.07] p-1.5">
                {pipelines.length === 0 && (
                  <p className="px-1 py-1 text-[11px] text-slate-500">Sem pipelines da Kommo.</p>
                )}
                {pipelines.map((p) => (
                  <div key={p.id}>
                    <p className="px-1 text-[9px] font-semibold uppercase tracking-wider text-slate-600">
                      {p.name}
                    </p>
                    {p.statuses.map((s) => {
                      const on = (config.stageIds ?? []).includes(s.id);
                      return (
                        <button
                          key={s.id}
                          type="button"
                          onClick={() => toggleStage(s.id)}
                          className={cn(
                            "flex w-full items-center gap-1.5 rounded px-1.5 py-1 text-left text-[11.5px] transition",
                            on
                              ? "bg-emerald-400/[0.12] text-emerald-100"
                              : "text-slate-300 hover:bg-white/[0.04]",
                          )}
                        >
                          <span
                            className={cn(
                              "grid h-3 w-3 place-items-center rounded-[2px] border text-[8px]",
                              on ? "border-emerald-400 bg-emerald-400 text-[#0a0a0d]" : "border-white/20",
                            )}
                          >
                            {on ? "✓" : ""}
                          </span>
                          <span className="truncate">{s.name}</span>
                        </button>
                      );
                    })}
                  </div>
                ))}
              </div>
            </div>
          )}

          {usesField && (
            <div className="mt-2">
              <p className="mb-1 flex items-center gap-1 text-[10px] uppercase tracking-wider text-slate-500">
                <Tag className="h-3 w-3" /> Campo customizado
              </p>
              <Select
                value={config.fieldId ?? ""}
                onChange={(e) => {
                  const id = e.target.value ? Number(e.target.value) : undefined;
                  const f = customFields.find((x) => x.id === id);
                  setConfig((c) => ({ ...c, fieldId: id, fieldCode: f?.code ?? null, matchValues: [] }));
                }}
                className="text-[12px]"
              >
                <option value="">— selecione —</option>
                {customFields.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.name} ({f.type})
                  </option>
                ))}
              </Select>
            </div>
          )}

          {usesMatch && selectedField && (
            <div className="mt-2">
              <p className="mb-1 flex items-center gap-1 text-[10px] uppercase tracking-wider text-slate-500">
                <Filter className="h-3 w-3" /> Valores (vazio = qualquer)
              </p>
              {selectedField.enums.length > 0 ? (
                <div className="flex max-h-24 flex-wrap gap-1 overflow-y-auto">
                  {selectedField.enums.map((en) => {
                    const on = (config.matchValues ?? []).includes(en.value);
                    return (
                      <button
                        key={en.id}
                        type="button"
                        onClick={() => toggleMatch(en.value)}
                        className={cn(
                          "rounded-full px-2 py-0.5 text-[10.5px] transition",
                          on
                            ? "bg-emerald-400/[0.12] text-emerald-100 ring-1 ring-inset ring-emerald-400/25"
                            : "bg-white/[0.03] text-slate-300 ring-1 ring-inset ring-white/[0.06]",
                        )}
                      >
                        {en.value}
                      </button>
                    );
                  })}
                </div>
              ) : (
                <Input
                  placeholder="valores separados por vírgula"
                  value={(config.matchValues ?? []).join(", ")}
                  onChange={(e) =>
                    setConfig((c) => ({
                      ...c,
                      matchValues: e.target.value.split(",").map((s) => s.trim()).filter(Boolean),
                    }))
                  }
                />
              )}
            </div>
          )}

          <button
            type="button"
            onClick={() => save.mutate()}
            disabled={save.isPending}
            className="mt-3 flex w-full items-center justify-center gap-1.5 rounded-lg bg-emerald-500/90 px-3 py-1.5 text-[12px] font-semibold text-[#06231a] transition hover:bg-emerald-400 disabled:opacity-60"
          >
            {save.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
            Salvar e aplicar
          </button>

          {saved && (
            <button
              type="button"
              onClick={() => reset.mutate()}
              disabled={reset.isPending}
              title="Volta o KPI pra fonte padrão (leads criados no período)"
              className="mt-2 flex w-full items-center justify-center gap-1.5 rounded-lg bg-white/[0.04] px-3 py-1.5 text-[11.5px] font-medium text-slate-300 ring-1 ring-inset ring-white/[0.08] transition hover:bg-white/[0.08] hover:text-white disabled:opacity-60"
            >
              {reset.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : "↺"}
              Restaurar padrão (criados no período)
            </button>
          )}
          </div>
        </div>,
        document.body,
      )}
    </div>
  );
}
