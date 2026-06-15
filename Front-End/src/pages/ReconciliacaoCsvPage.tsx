import { useState } from "react";
import { Link } from "react-router-dom";
import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  AlertTriangle,
  ArrowLeft,
  Ban,
  Calendar,
  Check,
  FileUp,
  Loader2,
  Play,
  Upload,
} from "@/components/icons";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card, CardBody } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { useClinic } from "@/hooks/useClinic";
import {
  kpiReconcileService,
  type ReconcileKpi,
  type ReconcileResult,
} from "@/services/kpiReconcile";
import { cn, formatNumber } from "@/lib/utils";

interface KpiSpec {
  key: ReconcileKpi;
  label: string;
  csvHint: string;
  description: string;
}

const KPIS: KpiSpec[] = [
  {
    key: "tratamentos",
    label: "Tratamentos",
    csvHint: "Tratamentos Realizados.csv",
    description:
      "Corrige a data efetiva de FechouTratamento e marca 'não contar' quem está fechado no banco mas não aparece no CSV.",
  },
  {
    key: "agendados",
    label: "Agendados",
    csvHint: "Cadastro Geral.csv (linhas onde Cliente Agendou? = Sim)",
    description:
      "Corrige a data efetiva da entrada em Agendado e marca 'não contar' quem está agendado no banco mas não aparece no CSV.",
  },
  {
    key: "compareceu",
    label: "Compareceu",
    csvHint: "Consultas Comparecidas.csv",
    description:
      "Marca AttendanceStatus='compareceu' nos leads que de fato compareceram. Não cria exclusão.",
  },
];

function dateTimeBR(iso?: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function ReconciliacaoCsvPage() {
  const { unitId } = useClinic();
  const [kpi, setKpi] = useState<ReconcileKpi>("tratamentos");
  const [file, setFile] = useState<File | null>(null);
  const [dryResult, setDryResult] = useState<ReconcileResult | null>(null);

  const dryRun = useMutation({
    mutationFn: async () => {
      if (!unitId) throw new Error("Selecione uma unidade no topo.");
      if (!file) throw new Error("Escolha o CSV antes de simular.");
      return kpiReconcileService.run(kpi, { unitId, file, dryRun: true });
    },
    onSuccess: (data) => {
      setDryResult(data);
      toast.success("Simulação concluída. Confira os números abaixo.");
    },
    onError: (e) => toast.error(`Falha no dry-run: ${(e as Error).message}`),
  });

  const apply = useMutation({
    mutationFn: async () => {
      if (!unitId) throw new Error("Selecione uma unidade no topo.");
      if (!file) throw new Error("Escolha o CSV antes de aplicar.");
      return kpiReconcileService.run(kpi, { unitId, file, dryRun: false });
    },
    onSuccess: (data) => {
      setDryResult(data);
      toast.success(
        `Aplicado. ${data.datesCorrected} datas corrigidas, ${data.exclusionsAdded} 'não contar' adicionados.`,
      );
    },
    onError: (e) => toast.error(`Falha ao aplicar: ${(e as Error).message}`),
  });

  const onPickFile = (f: File | null) => {
    setFile(f);
    setDryResult(null);
  };

  const onConfirmApply = () => {
    if (!dryResult) {
      toast.error("Rode o dry-run primeiro.");
      return;
    }
    const msg =
      `Aplicar reconciliação de ${kpi} para a unidade ${unitId}?\n\n` +
      `→ ${dryResult.datesCorrected} datas serão corrigidas\n` +
      `→ ${dryResult.exclusionsAdded} leads marcados 'não contar'\n` +
      (kpi === "compareceu" ? `→ ${dryResult.attendanceMarked} marcados como comparecidos\n` : "") +
      `\nEsta operação NÃO é revertida automaticamente.`;
    if (window.confirm(msg)) apply.mutate();
  };

  const selectedSpec = KPIS.find((k) => k.key === kpi)!;

  return (
    <>
      <PageHeader
        title="Reconciliação por CSV"
        description="Sobe o relatório oficial da clínica e ajusta os KPIs do dashboard de uma vez só. Sempre simula antes de aplicar."
        actions={
          <Link to="/">
            <Button variant="outline" size="sm">
              <ArrowLeft className="mr-2 h-4 w-4" /> Voltar
            </Button>
          </Link>
        }
      />

      <Card className="mt-4">
        <CardBody className="space-y-4">
          {/* Passo 1: escolher KPI */}
          <div>
            <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-emerald-300/80">
              1. Qual KPI vai reconciliar
            </p>
            <div className="grid grid-cols-1 gap-2 md:grid-cols-3">
              {KPIS.map((spec) => (
                <button
                  key={spec.key}
                  type="button"
                  onClick={() => {
                    setKpi(spec.key);
                    setDryResult(null);
                  }}
                  className={cn(
                    "rounded-lg border px-3 py-2.5 text-left text-[12px] transition",
                    kpi === spec.key
                      ? "border-emerald-400/40 bg-emerald-400/[0.08] text-emerald-100"
                      : "border-white/[0.06] bg-white/[0.02] text-slate-300 hover:border-white/[0.12] hover:bg-white/[0.04]",
                  )}
                >
                  <p className="text-[13px] font-semibold">{spec.label}</p>
                  <p className="mt-0.5 text-[10.5px] text-slate-400">CSV esperado: {spec.csvHint}</p>
                </button>
              ))}
            </div>
            <p className="mt-2 text-[11px] text-slate-400">{selectedSpec.description}</p>
          </div>

          {/* Passo 2: arquivo */}
          <div>
            <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-emerald-300/80">
              2. Arquivo CSV ({selectedSpec.csvHint})
            </p>
            <label className="flex cursor-pointer items-center gap-3 rounded-lg border border-dashed border-white/15 bg-white/[0.02] px-4 py-4 transition hover:border-emerald-400/40 hover:bg-emerald-400/[0.04]">
              <FileUp className="h-5 w-5 text-slate-400" />
              <div className="flex-1">
                <p className="text-[13px] text-slate-100">
                  {file ? file.name : "Clique para escolher o CSV"}
                </p>
                {file && (
                  <p className="text-[10.5px] text-slate-500">
                    {(file.size / 1024).toFixed(1)} KB
                  </p>
                )}
              </div>
              <input
                type="file"
                accept=".csv,text/csv"
                className="hidden"
                onChange={(e) => onPickFile(e.target.files?.[0] ?? null)}
              />
            </label>
          </div>

          {/* Passo 3: ações */}
          <div className="flex flex-wrap items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={() => dryRun.mutate()}
              disabled={!file || !unitId || dryRun.isPending}
            >
              {dryRun.isPending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Play className="mr-2 h-4 w-4" />
              )}
              Simular (dry-run)
            </Button>
            <Button
              size="sm"
              onClick={onConfirmApply}
              disabled={!dryResult || apply.isPending}
            >
              {apply.isPending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Upload className="mr-2 h-4 w-4" />
              )}
              Aplicar de verdade
            </Button>
            {unitId == null && (
              <span className="text-[11px] text-amber-200">
                Selecione uma unidade no topo da página.
              </span>
            )}
          </div>
        </CardBody>
      </Card>

      {/* Resultado */}
      {dryResult && (
        <Card className="mt-4">
          <CardBody className="space-y-4">
            <div className="flex flex-wrap items-center gap-2">
              <Badge tone={dryResult.dryRun ? "neutral" : "emerald"}>
                {dryResult.dryRun ? "Simulação" : "Aplicado"}
              </Badge>
              <Badge tone="slate">KPI: {dryResult.kpiKey}</Badge>
              <span className="text-[11px] text-slate-400">
                {dryResult.durationMs} ms
              </span>
            </div>

            <div className="grid grid-cols-2 gap-2 text-[12px] md:grid-cols-4">
              <Stat label="Linhas no CSV" value={dryResult.csvRows} />
              <Stat label="Únicas (dedup tel.)" value={dryResult.uniqueRows} />
              <Stat label="Match no banco" value={dryResult.matched} tone="ok" />
              <Stat label="Não achados" value={dryResult.missed} tone="warn" />
              <Stat label="Ambíguos" value={dryResult.ambiguous} tone="warn" />
              <Stat label="Sem histórico" value={dryResult.matchedNoHistory} tone="warn" />
              <Stat
                label={dryResult.dryRun ? "Vai corrigir data" : "Datas corrigidas"}
                value={dryResult.datesCorrected}
                tone="ok"
              />
              <Stat
                label={dryResult.dryRun ? "Vai marcar 'não contar'" : "Marcados 'não contar'"}
                value={dryResult.exclusionsAdded}
                tone="warn"
              />
              {dryResult.kpiKey === "compareceu" && (
                <Stat
                  label={dryResult.dryRun ? "Vai marcar comparecidos" : "Comparecidos marcados"}
                  value={dryResult.attendanceMarked}
                  tone="ok"
                />
              )}
            </div>

            {/* Amostras */}
            {dryResult.sampleCorrections.length > 0 && (
              <SamplesBlock
                title="Datas que serão corrigidas (amostra)"
                icon={<Calendar className="h-4 w-4 text-sky-300" />}
              >
                <table className="w-full text-[12px]">
                  <thead className="text-[10px] uppercase tracking-wide text-slate-500">
                    <tr>
                      <th className="px-2 py-1 text-left">Lead</th>
                      <th className="px-2 py-1 text-left">Era contado em</th>
                      <th className="px-2 py-1 text-left">Vai contar em</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/[0.04]">
                    {dryResult.sampleCorrections.map((c) => (
                      <tr key={c.leadId}>
                        <td className="px-2 py-1">
                          <Link to={`/leads/${c.leadId}`} className="text-slate-100 hover:text-emerald-300">
                            {c.leadName}
                          </Link>
                        </td>
                        <td className="px-2 py-1 text-slate-400">{dateTimeBR(c.from)}</td>
                        <td className="px-2 py-1 text-sky-200">{dateTimeBR(c.to)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </SamplesBlock>
            )}

            {dryResult.sampleExclusions.length > 0 && (
              <SamplesBlock
                title="Leads que serão marcados 'não contar' (amostra)"
                icon={<Ban className="h-4 w-4 text-red-300" />}
              >
                <ul className="space-y-1">
                  {dryResult.sampleExclusions.map((e) => (
                    <li key={e.leadId} className="flex items-center justify-between text-[12px]">
                      <Link
                        to={`/leads/${e.leadId}`}
                        className="text-slate-100 hover:text-emerald-300"
                      >
                        {e.leadName}
                      </Link>
                      <Badge tone="slate">{e.currentStage}</Badge>
                    </li>
                  ))}
                </ul>
              </SamplesBlock>
            )}

            {dryResult.sampleMissed.length > 0 && (
              <SamplesBlock
                title="Não achados no banco (amostra)"
                icon={<AlertTriangle className="h-4 w-4 text-amber-300" />}
              >
                <ul className="space-y-0.5 text-[11.5px] text-slate-300">
                  {dryResult.sampleMissed.map((m, i) => (
                    <li key={i}>{m}</li>
                  ))}
                </ul>
              </SamplesBlock>
            )}

            {dryResult.sampleNoHistory.length > 0 && (
              <SamplesBlock
                title="Match mas sem histórico de etapa (amostra)"
                icon={<AlertTriangle className="h-4 w-4 text-amber-300" />}
              >
                <p className="mb-1 text-[11px] text-slate-400">
                  O lead foi encontrado mas nunca passou pela etapa do KPI no Kommo — a SDR não
                  moveu. A reconciliação não consegue corrigir a data; mova manualmente ou
                  mapeie um override.
                </p>
                <ul className="space-y-0.5 text-[11.5px] text-slate-300">
                  {dryResult.sampleNoHistory.map((m, i) => (
                    <li key={i}>{m}</li>
                  ))}
                </ul>
              </SamplesBlock>
            )}

            {dryResult.dryRun && (dryResult.datesCorrected > 0 || dryResult.exclusionsAdded > 0) && (
              <div className="flex items-center gap-2 rounded-md border border-emerald-400/20 bg-emerald-400/[0.06] p-3 text-[12px] text-emerald-100">
                <Check className="h-4 w-4" />
                Simulação ok. Clique em <b>Aplicar de verdade</b> pra persistir as mudanças.
              </div>
            )}
          </CardBody>
        </Card>
      )}
    </>
  );
}

function Stat({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone?: "ok" | "warn";
}) {
  const cls =
    tone === "ok"
      ? "border-emerald-400/30 bg-emerald-400/[0.06] text-emerald-100"
      : tone === "warn"
        ? "border-amber-400/25 bg-amber-400/[0.05] text-amber-100"
        : "border-white/[0.06] bg-white/[0.02] text-slate-200";
  return (
    <div className={cn("rounded-md border px-3 py-2", cls)}>
      <p className="text-[10px] uppercase tracking-wide opacity-70">{label}</p>
      <p className="mt-0.5 text-[16px] font-semibold tabular-nums">{formatNumber(value)}</p>
    </div>
  );
}

function SamplesBlock({
  title,
  icon,
  children,
}: {
  title: string;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-lg border border-white/[0.06] bg-white/[0.015] p-3">
      <p className="mb-2 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wide text-slate-300">
        {icon}
        {title}
      </p>
      {children}
    </div>
  );
}
