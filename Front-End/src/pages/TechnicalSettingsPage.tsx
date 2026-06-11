import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  AlertTriangle,
  Building2,
  Hash,
  Filter,
  Layers,
  Loader2,
  Save,
  Tag,
} from "@/components/icons";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Select } from "@/components/ui/Select";
import { Input } from "@/components/ui/Input";
import { useClinic } from "@/hooks/useClinic";
import { unitsService } from "@/services/units";
import {
  kpiConfigService,
  type KpiSourceConfig,
  type KpiSourceType,
} from "@/services/kpiConfig";
import { cn, formatNumber } from "@/lib/utils";

const SOURCE_LABELS: Record<KpiSourceType, string> = {
  kommo_stage: "Etapa da Kommo (contagem)",
  custom_field_count: "Campo customizado (contagem por valor)",
  custom_field_sum: "Campo customizado (soma numérica)",
  stage_field_filter: "Etapa + campo (filtro combinado)",
  recovery_attempt: "Tentativa de resgate (data do evento)",
};

type Draft = { sourceType: KpiSourceType; config: KpiSourceConfig };

export default function TechnicalSettingsPage() {
  const qc = useQueryClient();
  const { unitId } = useClinic();
  const hasUnit = unitId != null && unitId > 0;

  const catalog = useQuery({
    queryKey: ["kpi-catalog"],
    queryFn: () => kpiConfigService.catalog(),
  });

  const saved = useQuery({
    queryKey: ["kpi-config", unitId],
    queryFn: () => kpiConfigService.list(unitId!),
    enabled: hasUnit,
  });

  const pipelines = useQuery({
    queryKey: ["kommo-pipelines", unitId],
    queryFn: () => unitsService.kommoPipelines(unitId!),
    enabled: hasUnit,
    staleTime: 1000 * 60 * 30,
    retry: false,
  });

  const customFields = useQuery({
    queryKey: ["kommo-custom-fields", unitId],
    queryFn: () => unitsService.kommoCustomFields(unitId!),
    enabled: hasUnit,
    staleTime: 1000 * 60 * 30,
    retry: false,
  });

  // Estado local dos rascunhos (kpiKey -> Draft), semeado pelo que está salvo.
  const [drafts, setDrafts] = useState<Record<string, Draft>>({});
  const initialDrafts = useMemo(() => {
    const map: Record<string, Draft> = {};
    for (const item of saved.data ?? []) {
      map[item.kpi_key] = { sourceType: item.source_type, config: item.config ?? {} };
    }
    return map;
  }, [saved.data]);

  // draft efetivo: rascunho editado OU o salvo OU default.
  const draftFor = (kpiKey: string): Draft =>
    drafts[kpiKey] ??
    initialDrafts[kpiKey] ?? { sourceType: "kommo_stage", config: {} };

  const setDraft = (kpiKey: string, next: Draft) =>
    setDrafts((d) => ({ ...d, [kpiKey]: next }));

  const save = useMutation({
    mutationFn: () => {
      const items = (catalog.data?.items ?? [])
        .map((c) => ({ kpiKey: c.key, draft: draftFor(c.key) }))
        .filter(({ draft }) => isConfigured(draft))
        .map(({ kpiKey, draft }) => ({
          kpi_key: kpiKey,
          source_type: draft.sourceType,
          config: draft.config,
        }));
      return kpiConfigService.save(unitId!, items);
    },
    onSuccess: (r) => {
      toast.success(`Mapeamentos salvos (${r?.count ?? 0}).`);
      qc.invalidateQueries({ queryKey: ["kpi-config", unitId] });
    },
    onError: () => toast.error("Falha ao salvar os mapeamentos."),
  });

  return (
    <div className="space-y-4">
      <PageHeader
        title="Configurações Técnicas · KPIs"
        description="Defina de onde cada número do dashboard principal é puxado. Área restrita ao analista de TI."
      />

      {!hasUnit ? (
        <Card>
          <CardBody className="flex items-center gap-3 py-6 text-[13px] text-slate-300">
            <Building2 className="h-5 w-5 text-amber-300" />
            Selecione uma <strong>unidade específica</strong> no topo (não “Todas as unidades”) —
            o mapeamento de KPI é por unidade, pois cada conta Kommo tem IDs de etapa próprios.
          </CardBody>
        </Card>
      ) : (
        <>
          {(pipelines.isError || customFields.isError) && (
            <Card>
              <CardBody className="flex items-center gap-3 py-4 text-[12.5px] text-amber-200">
                <AlertTriangle className="h-4 w-4 shrink-0" />
                Não consegui ler as etapas/campos da Kommo desta unidade. Confirme o
                Subdomínio e o Token da Kommo nas configurações da unidade.
              </CardBody>
            </Card>
          )}

          <div className="flex items-center justify-between">
            <p className="text-[12px] text-slate-400">
              {catalog.data?.items.length ?? 0} KPIs · preview considera os{" "}
              <span className="text-slate-200">últimos 30 dias</span>.
            </p>
            <Button onClick={() => save.mutate()} disabled={save.isPending}>
              {save.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Save className="h-4 w-4" />
              )}
              Salvar mapeamentos
            </Button>
          </div>

          <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
            {(catalog.data?.items ?? []).map((kpi) => (
              <KpiMappingCard
                key={kpi.key}
                kpiKey={kpi.key}
                label={kpi.label}
                description={kpi.description}
                draft={draftFor(kpi.key)}
                onChange={(d) => setDraft(kpi.key, d)}
                pipelines={pipelines.data ?? []}
                customFields={customFields.data ?? []}
                unitId={unitId!}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function isConfigured(d: Draft): boolean {
  const c = d.config ?? {};
  if (d.sourceType === "kommo_stage") return (c.stageIds?.length ?? 0) > 0;
  if (d.sourceType === "stage_field_filter")
    return (c.stageIds?.length ?? 0) > 0 || c.fieldId != null;
  // recovery_attempt não tem parâmetros — basta escolher a fonte.
  if (d.sourceType === "recovery_attempt") return true;
  return c.fieldId != null; // custom_field_*
}

// ─────────────────────────────────────────────────────────────────────────────

interface CardProps {
  kpiKey: string;
  label: string;
  description: string;
  draft: Draft;
  onChange: (d: Draft) => void;
  pipelines: Awaited<ReturnType<typeof unitsService.kommoPipelines>>;
  customFields: Awaited<ReturnType<typeof unitsService.kommoCustomFields>>;
  unitId: number;
}

function KpiMappingCard({
  label,
  description,
  draft,
  onChange,
  pipelines,
  customFields,
  unitId,
}: CardProps) {
  const { sourceType, config } = draft;
  const usesStage = sourceType === "kommo_stage" || sourceType === "stage_field_filter";
  const usesField =
    sourceType === "custom_field_count" ||
    sourceType === "custom_field_sum" ||
    sourceType === "stage_field_filter";
  const usesMatch =
    sourceType === "custom_field_count" || sourceType === "stage_field_filter";

  const selectedField = useMemo(
    () => customFields.find((f) => f.id === config.fieldId),
    [customFields, config.fieldId],
  );

  const preview = useMutation({
    mutationFn: () =>
      kpiConfigService.preview(unitId, { source_type: sourceType, config }),
  });

  const patch = (partial: Partial<KpiSourceConfig>) =>
    onChange({ sourceType, config: { ...config, ...partial } });

  const toggleStage = (id: number) => {
    const set = new Set(config.stageIds ?? []);
    set.has(id) ? set.delete(id) : set.add(id);
    patch({ stageIds: [...set] });
  };

  const toggleMatch = (value: string) => {
    const set = new Set(config.matchValues ?? []);
    set.has(value) ? set.delete(value) : set.add(value);
    patch({ matchValues: [...set] });
  };

  return (
    <Card>
      <CardHeader
        title={label}
        subtitle={description}
        action={
          preview.data ? (
            <Badge tone="emerald">{formatNumber(preview.data.value)}</Badge>
          ) : (
            <Badge tone="slate">—</Badge>
          )
        }
      />
      <CardBody className="space-y-3">
        <div>
          <label className="label">Fonte do número</label>
          <Select
            value={sourceType}
            onChange={(e) =>
              onChange({ sourceType: e.target.value as KpiSourceType, config })
            }
          >
            {Object.entries(SOURCE_LABELS).map(([v, l]) => (
              <option key={v} value={v}>
                {l}
              </option>
            ))}
          </Select>
        </div>

        {usesStage && (
          <div>
            <label className="label flex items-center gap-1.5">
              <Layers className="h-3.5 w-3.5" /> Etapas da Kommo
              <span className="text-slate-500">
                ({config.stageIds?.length ?? 0} selecionada
                {(config.stageIds?.length ?? 0) === 1 ? "" : "s"})
              </span>
            </label>
            <div className="max-h-44 space-y-2 overflow-y-auto rounded-md border border-white/[0.07] bg-white/[0.01] p-2">
              {pipelines.length === 0 && (
                <p className="px-1 py-2 text-[11.5px] text-slate-500">
                  Sem pipelines (verifique o token da Kommo da unidade).
                </p>
              )}
              {pipelines.map((p) => (
                <div key={p.id}>
                  <p className="px-1 text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                    {p.name}
                  </p>
                  <div className="mt-1 space-y-0.5">
                    {p.statuses.map((s) => {
                      const on = (config.stageIds ?? []).includes(s.id);
                      return (
                        <button
                          key={s.id}
                          type="button"
                          onClick={() => toggleStage(s.id)}
                          className={cn(
                            "flex w-full items-center gap-2 rounded px-2 py-1 text-left text-[12px] transition",
                            on
                              ? "bg-emerald-400/[0.1] text-emerald-100 ring-1 ring-inset ring-emerald-400/25"
                              : "text-slate-300 hover:bg-white/[0.03]",
                          )}
                        >
                          <span
                            className={cn(
                              "grid h-3.5 w-3.5 place-items-center rounded-[3px] border text-[9px]",
                              on
                                ? "border-emerald-400 bg-emerald-400 text-[#0a0a0d]"
                                : "border-white/20",
                            )}
                          >
                            {on ? "✓" : ""}
                          </span>
                          <span className="truncate">{s.name}</span>
                          <span className="ml-auto font-mono text-[10px] text-slate-600">
                            {s.id}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {usesField && (
          <div>
            <label className="label flex items-center gap-1.5">
              <Tag className="h-3.5 w-3.5" /> Campo customizado
            </label>
            <Select
              value={config.fieldId ?? ""}
              onChange={(e) => {
                const id = e.target.value ? Number(e.target.value) : undefined;
                const f = customFields.find((x) => x.id === id);
                patch({ fieldId: id, fieldCode: f?.code ?? null, matchValues: [] });
              }}
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
          <div>
            <label className="label flex items-center gap-1.5">
              <Filter className="h-3.5 w-3.5" /> Valores que contam
              <span className="text-slate-500">(vazio = qualquer valor preenchido)</span>
            </label>
            {selectedField.enums.length > 0 ? (
              <div className="flex flex-wrap gap-1.5">
                {selectedField.enums.map((en) => {
                  const on = (config.matchValues ?? []).includes(en.value);
                  return (
                    <button
                      key={en.id}
                      type="button"
                      onClick={() => toggleMatch(en.value)}
                      className={cn(
                        "rounded-full px-2.5 py-1 text-[11.5px] transition",
                        on
                          ? "bg-emerald-400/[0.12] text-emerald-100 ring-1 ring-inset ring-emerald-400/25"
                          : "bg-white/[0.03] text-slate-300 ring-1 ring-inset ring-white/[0.06] hover:bg-white/[0.06]",
                      )}
                    >
                      {en.value}
                    </button>
                  );
                })}
              </div>
            ) : (
              <Input
                placeholder="valores separados por vírgula (ex.: Araguaína, Palmas)"
                value={(config.matchValues ?? []).join(", ")}
                onChange={(e) =>
                  patch({
                    matchValues: e.target.value
                      .split(",")
                      .map((s) => s.trim())
                      .filter(Boolean),
                  })
                }
              />
            )}
          </div>
        )}

        <div className="flex items-center justify-between border-t border-white/[0.05] pt-3">
          <div className="text-[12px] text-slate-400">
            {preview.isPending ? (
              <span className="flex items-center gap-1.5">
                <Loader2 className="h-3.5 w-3.5 animate-spin" /> calculando…
              </span>
            ) : preview.data ? (
              <span>
                <span className="text-lg font-semibold text-emerald-300">
                  {formatNumber(preview.data.value)}
                </span>{" "}
                <span className="text-slate-500">
                  de {formatNumber(preview.data.sample_size)} leads
                  {preview.data.note ? ` · ${preview.data.note}` : ""}
                </span>
              </span>
            ) : (
              <span className="text-slate-500">
                clique em calcular para ver o número
              </span>
            )}
          </div>
          <Button variant="outline" onClick={() => preview.mutate()} disabled={preview.isPending}>
            <Hash className="h-4 w-4" /> Calcular
          </Button>
        </div>
      </CardBody>
    </Card>
  );
}
