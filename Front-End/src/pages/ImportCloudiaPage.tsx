import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Upload, FileText, AlertCircle, CheckCircle2, Loader2, RotateCcw, History, X,
} from "@/components/icons";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { unitsService } from "@/services/units";
import {
  importsService,
  type CloudiaImportResult, type CloudiaImportBatch,
  type KommoPatchField, type CloudiaKommoJob,
} from "@/services/imports";
import { cn, formatDate } from "@/lib/utils";

const KOMMO_FIELDS: { key: KommoPatchField; label: string; hint: string }[] = [
  { key: "tipo_lead",        label: "Tipo de lead",              hint: "Marca todos como Resgate (lead antigo)" },
  { key: "data_criacao",     label: "Data de criação lead",      hint: "Data real do CSV (ex: 03/02/2025)" },
  { key: "origem",           label: "Origem",                    hint: "Meta-FB / Meta-IG / Google / Indicação …" },
  { key: "interacao",        label: "Interação",                 hint: "Sim / Não" },
  { key: "motivo",           label: "Motivo do não agendamento", hint: "Quando aplicável" },
  { key: "tipo_resgate",     label: "Tipo de resgate",           hint: "Ligação / Mensagem / Disparo" },
  { key: "data_agendamento", label: "Data de agendamento",       hint: "Quando aplicável" },
  { key: "sexo",             label: "Sexo (heurística por nome)", hint: "M/F inferido do primeiro nome" },
  { key: "qualificacao",     label: "Qualificação do lead",      hint: "Agendou=Sim→Quente, Interação=Sim→Morno, senão Frio" },
  { key: "observacao",       label: "Observações de consulta",   hint: "Texto livre da SDR" },
];

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

  // Kommo PATCH job
  const [kommoBatchId, setKommoBatchId] = useState<number | null>(null);
  const [kommoFields, setKommoFields] = useState<KommoPatchField[]>([
    "tipo_lead", "data_criacao", "origem", "interacao", "motivo",
    "tipo_resgate", "data_agendamento", "sexo", "qualificacao", "observacao",
  ]);
  const [activeJobId, setActiveJobId] = useState<string | null>(null);

  const startKommo = useMutation({
    mutationFn: () => importsService.startKommoPatch(kommoBatchId!, kommoFields),
    onSuccess: (r) => {
      toast.success(`Job ${r.job_id.slice(0,8)} iniciado — ${r.total} leads`);
      setActiveJobId(r.job_id);
      setKommoBatchId(null);
      qc.invalidateQueries({ queryKey: ["kommo-jobs", unitId] });
    },
    onError: (e: unknown) => toast.error(e instanceof Error ? e.message : "Falha ao iniciar"),
  });

  // Polling do job ativo
  const jobStatus = useQuery({
    queryKey: ["kommo-job", activeJobId],
    queryFn: () => importsService.getKommoJob(activeJobId!),
    enabled: !!activeJobId,
    refetchInterval: (q) => {
      const s = q.state.data?.status;
      if (s === "completed" || s === "failed" || s === "cancelled") return false;
      return 3000;
    },
  });

  const kommoJobs = useQuery({
    queryKey: ["kommo-jobs", unitId],
    queryFn: () => importsService.listKommoJobs(unitId!),
    enabled: !!unitId,
    refetchInterval: 5000,
  });

  const cancelKommo = useMutation({
    mutationFn: (id: string) => importsService.cancelKommoJob(id),
    onSuccess: () => toast.success("Cancelamento solicitado"),
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

      {/* Job ativo de Kommo PATCH — banner com progresso */}
      {activeJobId && jobStatus.data && <KommoJobProgress
        job={jobStatus.data}
        onClose={() => setActiveJobId(null)}
        onCancel={() => cancelKommo.mutate(jobStatus.data!.id)}
      />}

      {/* Histórico de imports da unidade selecionada — com botão de revert + kommo PATCH */}
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
                        onKommoPatch={() => setKommoBatchId(b.id)}
                      />
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardBody>
        </Card>
      )}

      {/* Histórico de jobs Kommo PATCH */}
      {unitId && (kommoJobs.data?.length ?? 0) > 0 && (
        <Card>
          <CardHeader title="Histórico de jobs Kommo PATCH" />
          <CardBody>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs uppercase text-slate-400 border-b border-white/10">
                    <th className="py-2 px-2">Job</th>
                    <th className="py-2 px-2">Batch</th>
                    <th className="py-2 px-2">Status</th>
                    <th className="py-2 px-2 text-right">Progresso</th>
                    <th className="py-2 px-2 text-right">OK</th>
                    <th className="py-2 px-2 text-right">Erros</th>
                    <th className="py-2 px-2">Início</th>
                    <th className="py-2 px-2"></th>
                  </tr>
                </thead>
                <tbody>
                  {kommoJobs.data!.map(j => (
                    <tr key={j.id} className="border-b border-white/5 last:border-0">
                      <td className="py-2 px-2 text-xs font-mono text-slate-400">{j.id.slice(0,8)}</td>
                      <td className="py-2 px-2 text-slate-400">#{j.batch_id}</td>
                      <td className="py-2 px-2"><StatusBadge status={j.status} /></td>
                      <td className="py-2 px-2 text-right font-medium">{j.processed.toLocaleString("pt-BR")} / {j.total.toLocaleString("pt-BR")}</td>
                      <td className="py-2 px-2 text-right text-emerald-400">{j.succeeded.toLocaleString("pt-BR")}</td>
                      <td className="py-2 px-2 text-right text-rose-400">{j.failed.toLocaleString("pt-BR")}</td>
                      <td className="py-2 px-2 text-slate-400 text-xs">{j.started_at ? formatDate(j.started_at) : "—"}</td>
                      <td className="py-2 px-2 text-right">
                        {(j.status === "running" || j.status === "queued") && (
                          <Button variant="outline" size="sm" onClick={() => { setActiveJobId(j.id); }}>
                            Ver
                          </Button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardBody>
        </Card>
      )}

      {/* Modal de seleção de campos pra Kommo PATCH */}
      {kommoBatchId && (
        <KommoPatchModal
          batchId={kommoBatchId}
          selectedFields={kommoFields}
          onToggleField={(f) => setKommoFields(prev =>
            prev.includes(f) ? prev.filter(x => x !== f) : [...prev, f]
          )}
          onCancel={() => setKommoBatchId(null)}
          onConfirm={() => startKommo.mutate()}
          isStarting={startKommo.isPending}
        />
      )}
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { bg: string; text: string; label: string }> = {
    queued:     { bg: "bg-slate-500/10", text: "text-slate-300", label: "fila" },
    running:    { bg: "bg-sky-500/10", text: "text-sky-400", label: "rodando" },
    completed:  { bg: "bg-emerald-500/10", text: "text-emerald-400", label: "concluído" },
    failed:     { bg: "bg-rose-500/10", text: "text-rose-400", label: "falhou" },
    cancelling: { bg: "bg-amber-500/10", text: "text-amber-400", label: "cancelando" },
    cancelled:  { bg: "bg-amber-500/10", text: "text-amber-400", label: "cancelado" },
  };
  const m = map[status] ?? map.queued;
  return <span className={cn("inline-flex items-center gap-1 text-xs rounded-full px-2 py-0.5", m.bg, m.text)}>{m.label}</span>;
}

function KommoJobProgress({ job, onClose, onCancel }: {
  job: CloudiaKommoJob; onClose: () => void; onCancel: () => void;
}) {
  const pct = job.total > 0 ? Math.round((job.processed / job.total) * 100) : 0;
  const finished = job.status === "completed" || job.status === "failed" || job.status === "cancelled";
  return (
    <Card>
      <CardBody>
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-2">
              <Loader2 className={cn("w-4 h-4", finished ? "" : "animate-spin")}/>
              <span className="font-semibold">Kommo PATCH — Job {job.id.slice(0,8)}</span>
              <StatusBadge status={job.status} />
            </div>
            <div className="text-xs text-slate-400 mb-2">
              {job.processed.toLocaleString("pt-BR")} / {job.total.toLocaleString("pt-BR")} leads · {pct}% ·
              <span className="text-emerald-400 ml-1">OK {job.succeeded}</span> ·
              <span className="text-rose-400 ml-1">Erros {job.failed}</span>
            </div>
            <div className="w-full bg-white/5 rounded-full h-2 overflow-hidden">
              <div
                className={cn("h-full transition-all", finished ? "bg-emerald-500" : "bg-sky-500")}
                style={{ width: `${pct}%` }}
              />
            </div>
            {job.error_message && (
              <div className="text-xs text-rose-400 mt-2">{job.error_message}</div>
            )}
          </div>
          <div className="flex flex-col gap-2">
            {!finished && (
              <Button variant="outline" size="sm" onClick={onCancel}>Cancelar</Button>
            )}
            <Button variant="ghost" size="sm" onClick={onClose}><X className="w-3 h-3"/></Button>
          </div>
        </div>
      </CardBody>
    </Card>
  );
}

function KommoPatchModal({
  batchId, selectedFields, onToggleField, onCancel, onConfirm, isStarting,
}: {
  batchId: number;
  selectedFields: KommoPatchField[];
  onToggleField: (f: KommoPatchField) => void;
  onCancel: () => void;
  onConfirm: () => void;
  isStarting: boolean;
}) {
  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4" onClick={onCancel}>
      <div className="bg-slate-900 border border-white/10 rounded-xl max-w-lg w-full p-6" onClick={e => e.stopPropagation()}>
        <h3 className="text-lg font-semibold mb-2">Aplicar no Kommo — Batch #{batchId}</h3>
        <p className="text-sm text-slate-400 mb-4">
          Marque os campos que você quer preencher na Kommo. Roda em background (~280ms por lead).
        </p>
        <div className="space-y-2 max-h-96 overflow-y-auto pr-2">
          {KOMMO_FIELDS.map(f => (
            <label key={f.key} className="flex items-start gap-2 p-2 rounded hover:bg-white/5 cursor-pointer">
              <input
                type="checkbox"
                checked={selectedFields.includes(f.key)}
                onChange={() => onToggleField(f.key)}
                className="mt-0.5"
              />
              <div className="flex-1">
                <div className="text-sm font-medium">{f.label}</div>
                <div className="text-xs text-slate-400">{f.hint}</div>
              </div>
            </label>
          ))}
        </div>
        <div className="flex gap-2 justify-end mt-4">
          <Button variant="outline" onClick={onCancel} disabled={isStarting}>Cancelar</Button>
          <Button onClick={onConfirm} disabled={isStarting || selectedFields.length === 0}>
            {isStarting ? <Loader2 className="w-4 h-4 animate-spin"/> : null}
            Iniciar ({selectedFields.length} campos)
          </Button>
        </div>
      </div>
    </div>
  );
}

function BatchRow({ batch, revertingId, onRevert, onKommoPatch }: {
  batch: CloudiaImportBatch;
  revertingId: number | null;
  onRevert: () => void;
  onKommoPatch: () => void;
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
        <div className="flex items-center justify-end gap-1">
          {!isReverted && (
            <>
              <Button variant="outline" size="sm" onClick={onKommoPatch}>
                Aplicar no Kommo
              </Button>
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
            </>
          )}
        </div>
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
