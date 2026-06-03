import { useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Check, Filter, Layers, Loader2, Tag, Trash2, X } from "@/components/icons";
import { Select } from "@/components/ui/Select";
import { Input } from "@/components/ui/Input";
import type { KommoPipeline, KommoCustomField } from "@/services/units";
import {
  kpiConfigService,
  type KpiConfigItem,
  type KpiDisplayType,
  type KpiSourceConfig,
  type KpiSourceType,
} from "@/services/kpiConfig";
import { cn } from "@/lib/utils";

const SOURCE_LABELS: Record<KpiSourceType, string> = {
  kommo_stage: "Etapa da Kommo (contagem)",
  custom_field_count: "Campo (contagem por valor)",
  custom_field_sum: "Campo (soma numérica)",
  stage_field_filter: "Etapa + campo (filtro)",
};

/** Paleta de cores para a borda superior do card. */
const SWATCHES = [
  "#34d399", "#60a5fa", "#a78bfa", "#fbbf24",
  "#f87171", "#22d3ee", "#f472b6", "#fb923c",
];

function genKey() {
  const rnd =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID().replace(/-/g, "").slice(0, 10)
      : Math.abs(Date.now()).toString(36);
  return `custom_${rnd}`;
}

/**
 * Modal para CRIAR/EDITAR um KPI custom do dashboard: nome, cor da borda-top e a fonte
 * (etapa/campo da Kommo). Reaproveita o motor de preview/save das Configurações Técnicas.
 */
export function CustomKpiModal({
  unitId,
  pipelines,
  customFields,
  existing,
  onClose,
}: {
  unitId: number;
  pipelines: KommoPipeline[];
  customFields: KommoCustomField[];
  /** Quando presente, edita um KPI custom já salvo. */
  existing?: KpiConfigItem | null;
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const [name, setName] = useState(existing?.display_name ?? "");
  const [color, setColor] = useState(existing?.accent_color ?? SWATCHES[0]);
  const [sourceType, setSourceType] = useState<KpiSourceType>(
    (existing?.source_type as KpiSourceType) ?? "kommo_stage",
  );
  const [config, setConfig] = useState<KpiSourceConfig>(existing?.config ?? {});
  const [displayType, setDisplayType] = useState<KpiDisplayType>(
    (existing?.display_type as KpiDisplayType) ?? "number",
  );
  const [preview, setPreview] = useState<number | null>(null);

  const isChart = displayType === "source_chart";

  const selectedField = useMemo(
    () => customFields.find((f) => f.id === config.fieldId),
    [customFields, config.fieldId],
  );

  const usesStage = sourceType === "kommo_stage" || sourceType === "stage_field_filter";
  const usesField =
    sourceType === "custom_field_count" ||
    sourceType === "custom_field_sum" ||
    sourceType === "stage_field_filter";
  const usesMatch = sourceType === "custom_field_count" || sourceType === "stage_field_filter";

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["dash-amo"] });
    qc.invalidateQueries({ queryKey: ["kpi-config", unitId] });
  };

  const save = useMutation({
    mutationFn: () =>
      kpiConfigService.save(unitId, [
        {
          kpi_key: existing?.kpi_key ?? genKey(),
          // No modo gráfico a fonte é sempre o campo customizado (distribui os valores).
          source_type: isChart ? "custom_field_count" : sourceType,
          config,
          is_custom: true,
          display_name: name.trim(),
          accent_color: color,
          display_type: displayType,
          sort_order: existing?.sort_order ?? Date.now() % 100000,
        },
      ]),
    onSuccess: () => {
      toast.success(existing ? `"${name}" atualizado.` : `KPI "${name}" criado.`);
      invalidate();
      onClose();
    },
    onError: () => toast.error("Falha ao salvar o KPI."),
  });

  const remove = useMutation({
    mutationFn: () => kpiConfigService.remove(unitId, existing!.kpi_key),
    onSuccess: () => {
      toast.success("KPI removido.");
      invalidate();
      onClose();
    },
    onError: () => toast.error("Falha ao remover o KPI."),
  });

  const doPreview = useMutation({
    mutationFn: () =>
      kpiConfigService.preview(unitId, {
        source_type: isChart ? "custom_field_count" : sourceType,
        config,
      }),
    onSuccess: (r) => setPreview(r.value),
    onError: () => toast.error("Falha ao calcular a prévia."),
  });

  const toggleStage = (id: number) => {
    const set = new Set(config.stageIds ?? []);
    set.has(id) ? set.delete(id) : set.add(id);
    setConfig((c) => ({ ...c, stageIds: [...set] }));
    setPreview(null);
  };
  const toggleMatch = (value: string) => {
    const set = new Set(config.matchValues ?? []);
    set.has(value) ? set.delete(value) : set.add(value);
    setConfig((c) => ({ ...c, matchValues: [...set] }));
    setPreview(null);
  };

  const canSave =
    name.trim().length > 0 && !save.isPending && (!isChart || config.fieldId != null);

  return createPortal(
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} aria-hidden />
      <div className="relative max-h-[88vh] w-full max-w-md overflow-y-auto rounded-2xl border border-white/12 bg-[#0a0f1f] p-5 shadow-2xl ring-1 ring-white/5">
        <div className="mb-3 flex items-center justify-between">
          <p className="text-[12px] font-semibold uppercase tracking-wider text-slate-200">
            {existing ? "Editar KPI" : "Novo KPI"}
          </p>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full p-1 text-slate-400 hover:bg-white/10 hover:text-slate-100"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Nome */}
        <label className="mb-1 block text-[10px] uppercase tracking-wider text-slate-500">Nome do KPI</label>
        <Input
          placeholder="ex.: Orçamentos enviados"
          value={name}
          onChange={(e) => setName(e.target.value)}
          autoFocus
        />

        {/* Cor */}
        <label className="mb-1 mt-3 block text-[10px] uppercase tracking-wider text-slate-500">
          Cor da borda (topo)
        </label>
        <div className="flex flex-wrap items-center gap-2">
          {SWATCHES.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => setColor(c)}
              className={cn(
                "h-7 w-7 rounded-full ring-2 ring-offset-2 ring-offset-[#0a0f1f] transition",
                color === c ? "ring-white/80" : "ring-transparent hover:ring-white/30",
              )}
              style={{ background: c }}
              aria-label={c}
            />
          ))}
          <label className="ml-1 inline-flex h-7 w-7 cursor-pointer items-center justify-center rounded-full border border-white/15 text-[9px] text-slate-400">
            +
            <input
              type="color"
              value={color}
              onChange={(e) => setColor(e.target.value)}
              className="sr-only"
            />
          </label>
        </div>

        {/* Tipo do KPI: número ou gráfico de origens */}
        <label className="mb-1 mt-4 block text-[10px] uppercase tracking-wider text-slate-500">Tipo do KPI</label>
        <div className="inline-flex w-full items-center rounded-lg border border-white/[0.08] bg-white/[0.03] p-0.5">
          {([
            ["number", "Número"],
            ["source_chart", "Gráfico de origens"],
          ] as const).map(([v, l]) => (
            <button
              key={v}
              type="button"
              onClick={() => {
                setDisplayType(v);
                setPreview(null);
              }}
              className={cn(
                "flex-1 rounded-md px-3 py-1 text-[11.5px] font-medium transition",
                displayType === v ? "bg-white/[0.1] text-slate-50" : "text-slate-400 hover:text-slate-200",
              )}
            >
              {l}
            </button>
          ))}
        </div>

        {/* Fonte (só no modo número; no gráfico a fonte é sempre o campo de origem) */}
        {!isChart && (
          <>
            <label className="mb-1 mt-3 block text-[10px] uppercase tracking-wider text-slate-500">Fonte do número</label>
            <Select
              value={sourceType}
              onChange={(e) => {
                setSourceType(e.target.value as KpiSourceType);
                setPreview(null);
              }}
              className="text-[12px]"
            >
              {Object.entries(SOURCE_LABELS).map(([v, l]) => (
                <option key={v} value={v}>{l}</option>
              ))}
            </Select>
          </>
        )}

        {!isChart && usesStage && (
          <div className="mt-2">
            <p className="mb-1 flex items-center gap-1 text-[10px] uppercase tracking-wider text-slate-500">
              <Layers className="h-3 w-3" /> Etapas ({config.stageIds?.length ?? 0})
            </p>
            <div className="max-h-56 space-y-0.5 overflow-y-auto rounded-md border border-white/[0.07] p-1.5">
              {pipelines.length === 0 && (
                <p className="px-1 py-1 text-[11px] text-slate-500">Sem pipelines da Kommo.</p>
              )}
              {pipelines.map((p) => (
                <div key={p.id}>
                  <p className="px-1 text-[9px] font-semibold uppercase tracking-wider text-slate-600">{p.name}</p>
                  {p.statuses.map((s) => {
                    const on = (config.stageIds ?? []).includes(s.id);
                    return (
                      <button
                        key={s.id}
                        type="button"
                        onClick={() => toggleStage(s.id)}
                        className={cn(
                          "flex w-full items-center gap-1.5 rounded px-1.5 py-1 text-left text-[11.5px] transition",
                          on ? "bg-emerald-400/[0.12] text-emerald-100" : "text-slate-300 hover:bg-white/[0.04]",
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

        {(isChart || usesField) && (
          <div className="mt-2">
            <p className="mb-1 flex items-center gap-1 text-[10px] uppercase tracking-wider text-slate-500">
              <Tag className="h-3 w-3" /> {isChart ? "Campo de origem" : "Campo customizado"}
            </p>
            <Select
              value={config.fieldId ?? ""}
              onChange={(e) => {
                const id = e.target.value ? Number(e.target.value) : undefined;
                const f = customFields.find((x) => x.id === id);
                setConfig((c) => ({ ...c, fieldId: id, fieldCode: f?.code ?? null, matchValues: [] }));
                setPreview(null);
              }}
              className="text-[12px]"
            >
              <option value="">— selecione —</option>
              {customFields.map((f) => (
                <option key={f.id} value={f.id}>{f.name} ({f.type})</option>
              ))}
            </Select>
          </div>
        )}

        {!isChart && usesMatch && selectedField && (
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
                onChange={(e) => {
                  setConfig((c) => ({
                    ...c,
                    matchValues: e.target.value.split(",").map((s) => s.trim()).filter(Boolean),
                  }));
                  setPreview(null);
                }}
              />
            )}
          </div>
        )}

        {/* Preview */}
        <div className="mt-3 flex items-center justify-between rounded-lg border border-white/[0.07] bg-white/[0.02] px-3 py-2">
          <button
            type="button"
            onClick={() => doPreview.mutate()}
            disabled={doPreview.isPending}
            className="text-[11px] font-medium text-slate-300 underline-offset-2 hover:text-slate-100 hover:underline disabled:opacity-60"
          >
            {doPreview.isPending ? "Calculando…" : "Pré-visualizar (30 dias)"}
          </button>
          <span className="text-[15px] font-semibold tabular-nums text-emerald-300">
            {preview == null ? "—" : new Intl.NumberFormat("pt-BR").format(preview)}
          </span>
        </div>

        {/* Ações */}
        <div className="mt-4 flex items-center gap-2">
          {existing && (
            <button
              type="button"
              onClick={() => remove.mutate()}
              disabled={remove.isPending}
              className="inline-flex items-center gap-1.5 rounded-lg border border-rose-400/30 px-3 py-1.5 text-[12px] font-medium text-rose-300 transition hover:bg-rose-500/10 disabled:opacity-60"
            >
              {remove.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
              Excluir
            </button>
          )}
          <button
            type="button"
            onClick={() => save.mutate()}
            disabled={!canSave}
            className="ml-auto inline-flex items-center justify-center gap-1.5 rounded-lg bg-emerald-500/90 px-4 py-1.5 text-[12px] font-semibold text-[#06231a] transition hover:bg-emerald-400 disabled:opacity-50"
          >
            {save.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
            {existing ? "Salvar" : "Criar KPI"}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
