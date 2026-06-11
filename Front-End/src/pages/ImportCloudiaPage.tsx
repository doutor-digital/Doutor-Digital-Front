import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Upload, FileText, AlertCircle, CheckCircle2, Loader2, RotateCcw, History,
} from "@/components/icons";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { unitsService } from "@/services/units";
import {
  importsService,
  type CloudiaImportResult, type CloudiaImportBatch,
} from "@/services/imports";
import { cn, formatDate } from "@/lib/utils";

export default function ImportCloudiaPage() {
  const qc = useQueryClient();
  const [unitId, setUnitId] = useState<number | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [updateLeadType, setUpdateLeadType] = useState(true);
  const [result, setResult] = useState<CloudiaImportResult | null>(null);

  const units = useQuery({ queryKey: ["units"], queryFn: () => unitsService.list() });

  const batches = useQuery({
    queryKey: ["cloudia-batches", unitId],
    queryFn: () => importsService.listBatches(unitId!),
    enabled: !!unitId,
  });

  const dryRun = useMutation({
    mutationFn: () => importsService.cloudiaCsv({
      file: file!, unitId: unitId!, dryRun: true, updateLeadType,
    }),
    onSuccess: (r) => { setResult(r); toast.success(`Preview: ${r.matched} leads vão ser atualizados`); },
    onError: (e: unknown) => toast.error(e instanceof Error ? e.message : "Falha no preview"),
  });

  const apply = useMutation({
    mutationFn: () => importsService.cloudiaCsv({
      file: file!, unitId: unitId!, dryRun: false, updateLeadType,
    }),
    onSuccess: (r) => {
      setResult(r);
      toast.success(`Aplicado! ${r.updated} leads corrigidos`);
      qc.invalidateQueries({ queryKey: ["cloudia-batches", unitId] });
    },
    onError: (e: unknown) => toast.error(e instanceof Error ? e.message : "Falha ao aplicar"),
  });

  const revert = useMutation({
    mutationFn: (batchId: number) => importsService.revertBatch(batchId),
    onSuccess: (r) => {
      toast.success(`Revertido! ${r.leads_restored} leads restaurados`);
      qc.invalidateQueries({ queryKey: ["cloudia-batches", unitId] });
    },
    onError: (e: unknown) => toast.error(e instanceof Error ? e.message : "Falha ao reverter"),
  });

  const busy = dryRun.isPending || apply.isPending;
  const canRun = !!(file && unitId && !busy);

  const unitName = useMemo(
    () => units.data?.find(u => Number(u.id) === unitId)?.name ?? "—",
    [units.data, unitId]
  );

  return (
    <div className="space-y-6 p-6">
      <PageHeader
        title="Importar Leads Históricos (Cloudia)"
        description="Sobe o CSV 'Cadastro Geral' da Cloudia pra corrigir a data REAL dos leads e marcá-los como Resgate. Só atualiza leads que já existem no DB — não cria novos nem mexe na Kommo."
        badge="ADMIN"
      />

      <Card>
        <CardHeader title={<span className="flex items-center gap-2"><Upload className="w-4 h-4"/> 1. Configurar o import</span>} />
        <CardBody className="space-y-4">

          {/* Unidade alvo */}
          <div>
            <label className="text-sm font-medium block mb-1">Unidade</label>
            <select
              value={unitId ?? ""}
              onChange={(e) => setUnitId(e.target.value ? Number(e.target.value) : null)}
              disabled={units.isLoading || busy}
              className="w-full rounded-md border border-slate-300 bg-white text-slate-900 px-3 py-2 text-sm"
            >
              <option value="">Selecione a unidade alvo…</option>
              {units.data?.map(u => (
                <option key={u.id} value={Number(u.id)}>
                  {u.name ?? `Unidade ${u.id}`} (id={u.id})
                </option>
              ))}
            </select>
          </div>

          {/* Upload */}
          <div>
            <label className="text-sm font-medium block mb-1">Arquivo CSV</label>
            <label className={cn(
              "flex items-center gap-3 rounded-lg border-2 border-dashed border-slate-600 p-4 cursor-pointer hover:bg-white/5",
              file && "border-emerald-500 bg-emerald-500/5"
            )}>
              <Upload className="w-5 h-5 text-slate-400" />
              <div className="flex-1">
                <div className="text-sm font-medium">
                  {file ? file.name : "Clique pra escolher o CSV"}
                </div>
                <div className="text-xs text-slate-400">
                  {file ? `${(file.size/1024).toFixed(1)} KB` : "Formato 'Cadastro Geral' da Cloudia (até 50 MB)"}
                </div>
              </div>
              <input
                type="file" accept=".csv,text/csv" className="hidden"
                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                disabled={busy}
              />
            </label>
          </div>

          {/* Opções */}
          <div>
            <label className="text-sm font-medium block mb-2">Opções</label>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox" checked={updateLeadType}
                onChange={(e) => setUpdateLeadType(e.target.checked)}
                disabled={busy}
              />
              Marcar os leads atualizados como <code className="bg-white/10 px-1 rounded">LeadType = "resgate"</code>
              <span className="text-xs text-slate-400"> (recomendado pra dashboard separar Cadastro vs Resgate)</span>
            </label>
          </div>

          {/* Ações */}
          <div className="flex gap-2 pt-2">
            <Button
              onClick={() => dryRun.mutate()}
              disabled={!canRun}
              variant="outline"
            >
              {dryRun.isPending ? <Loader2 className="w-4 h-4 animate-spin"/> : <FileText className="w-4 h-4"/>}
              Pré-visualizar (não escreve)
            </Button>
            <Button
              onClick={() => {
                if (!result || result.dry_run) {
                  if (!confirm(`Aplicar UPDATE em ${result?.matched ?? '?'} leads da unidade "${unitName}"?`)) return;
                }
                apply.mutate();
              }}
              disabled={!canRun}
            >
              {apply.isPending ? <Loader2 className="w-4 h-4 animate-spin"/> : <CheckCircle2 className="w-4 h-4"/>}
              Aplicar
            </Button>
          </div>
        </CardBody>
      </Card>

      {result && <ResultCard result={result} unitName={unitName} />}

      {/* Histórico de imports da unidade selecionada — com botão de revert */}
      {unitId && (
        <Card>
          <CardHeader title={
            <span className="flex items-center gap-2">
              <History className="w-4 h-4"/> Histórico de imports — {unitName}
            </span>
          } />
          <CardBody>
            {batches.isLoading && <div className="text-sm text-slate-400">Carregando…</div>}
            {!batches.isLoading && (batches.data?.length ?? 0) === 0 && (
              <div className="text-sm text-slate-400">Nenhum import aplicado ainda.</div>
            )}
            {(batches.data?.length ?? 0) > 0 && (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-xs uppercase text-slate-400 border-b border-white/10">
                      <th className="py-2 px-2">Data</th>
                      <th className="py-2 px-2">Arquivo</th>
                      <th className="py-2 px-2 text-right">Atualizados</th>
                      <th className="py-2 px-2">Status</th>
                      <th className="py-2 px-2"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {batches.data!.map(b => (
                      <BatchRow
                        key={b.id} batch={b}
                        revertingId={revert.isPending && revert.variables === b.id ? b.id : null}
                        onRevert={() => {
                          if (!confirm(`Reverter o batch #${b.id}? Vai restaurar ${b.updated} leads aos valores anteriores.`)) return;
                          revert.mutate(b.id);
                        }}
                      />
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardBody>
        </Card>
      )}
    </div>
  );
}

function BatchRow({ batch, revertingId, onRevert }: {
  batch: CloudiaImportBatch;
  revertingId: number | null;
  onRevert: () => void;
}) {
  const isReverted = batch.status === "reverted";
  return (
    <tr className="border-b border-white/5 last:border-0">
      <td className="py-2 px-2 text-slate-300">{formatDate(batch.created_at)}</td>
      <td className="py-2 px-2 text-slate-400">{batch.filename ?? "—"}</td>
      <td className="py-2 px-2 text-right font-medium">{batch.updated.toLocaleString("pt-BR")}</td>
      <td className="py-2 px-2">
        {isReverted ? (
          <span className="inline-flex items-center gap-1 text-xs rounded-full bg-amber-500/10 text-amber-400 px-2 py-0.5">
            revertido
          </span>
        ) : (
          <span className="inline-flex items-center gap-1 text-xs rounded-full bg-emerald-500/10 text-emerald-400 px-2 py-0.5">
            aplicado
          </span>
        )}
      </td>
      <td className="py-2 px-2 text-right">
        {!isReverted && (
          <Button
            variant="outline"
            size="sm"
            onClick={onRevert}
            disabled={revertingId === batch.id}
          >
            {revertingId === batch.id
              ? <Loader2 className="w-3 h-3 animate-spin"/>
              : <RotateCcw className="w-3 h-3"/>}
            Reverter
          </Button>
        )}
      </td>
    </tr>
  );
}

function ResultCard({ result, unitName }: { result: CloudiaImportResult; unitName: string }) {
  return (
    <div className="space-y-4">
      <Card>
        <CardHeader title={
          <span className="flex items-center gap-2">
            {result.dry_run ? (
              <><AlertCircle className="w-4 h-4 text-amber-400"/> Preview ({unitName})</>
            ) : (
              <><CheckCircle2 className="w-4 h-4 text-emerald-400"/> Aplicado ({unitName})</>
            )}
            <span className="text-xs font-normal text-slate-400 ml-auto">
              {(result.duration_ms/1000).toFixed(1)}s
            </span>
          </span>
        } />
        <CardBody>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <StatBlock label="Total no CSV" value={result.total_rows} />
            <StatBlock label="Dedup removidas" value={result.duplicates_removed} tone="warn" />
            <StatBlock label="Únicas após dedup" value={result.unique_rows} />
            <StatBlock label="Sem nome/data" value={result.invalid_input} tone="warn" />
            <StatBlock label="Match exato" value={result.matched} tone="ok" />
            <StatBlock label="Ambíguos" value={result.ambiguous} tone="warn" />
            <StatBlock label="Não achados" value={result.missed} tone="warn" />
            <StatBlock
              label={result.dry_run ? "Seriam atualizados" : "Atualizados"}
              value={result.dry_run ? result.matched : result.updated}
              tone="ok"
            />
          </div>
        </CardBody>
      </Card>

      {Object.keys(result.distribution_by_month).length > 0 && (
        <Card>
          <CardHeader title="Distribuição por mês (data real)" />
          <CardBody>
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-2 text-sm">
              {Object.entries(result.distribution_by_month).map(([mes, n]) => (
                <div key={mes} className="rounded-md border border-white/10 p-2 flex justify-between">
                  <span className="text-slate-400">{mes}</span>
                  <span className="font-semibold">{n}</span>
                </div>
              ))}
            </div>
          </CardBody>
        </Card>
      )}

      <div className="grid md:grid-cols-3 gap-4">
        {result.sample_matches.length > 0 && (
          <Card>
            <CardHeader title="Amostra match exato" />
            <CardBody>
              <ul className="text-xs space-y-1">
                {result.sample_matches.map((m, i) => (
                  <li key={i} className="flex flex-col">
                    <span className="font-medium">{m.csvName}</span>
                    <span className="text-slate-400">→ {m.dbName} · {m.dataOrigem}</span>
                  </li>
                ))}
              </ul>
            </CardBody>
          </Card>
        )}
        {result.sample_duplicates.length > 0 && (
          <Card>
            <CardHeader title="Duplicatas descartadas" />
            <CardBody>
              <ul className="text-xs space-y-1 text-slate-400">
                {result.sample_duplicates.map((d, i) => <li key={i}>• {d}</li>)}
              </ul>
            </CardBody>
          </Card>
        )}
        {result.sample_missed.length > 0 && (
          <Card>
            <CardHeader title="Não achados (Cloudia-only)" />
            <CardBody>
              <ul className="text-xs space-y-1 text-slate-400">
                {result.sample_missed.map((m, i) => <li key={i}>• {m}</li>)}
              </ul>
            </CardBody>
          </Card>
        )}
      </div>
    </div>
  );
}

function StatBlock({ label, value, tone }: { label: string; value: number; tone?: "ok"|"warn" }) {
  return (
    <div className={cn(
      "rounded-lg border p-3",
      tone === "ok"   ? "border-emerald-500/30 bg-emerald-500/5" :
      tone === "warn" ? "border-amber-500/30 bg-amber-500/5"     :
                        "border-white/10 bg-white/[0.02]"
    )}>
      <div className="text-xs text-slate-400">{label}</div>
      <div className="text-xl font-bold mt-1">{value.toLocaleString("pt-BR")}</div>
    </div>
  );
}
