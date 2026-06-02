import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useMutation, useQuery, useQueryClient, keepPreviousData } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  AlertTriangle,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Copy,
  Globe,
  Info,
  RefreshCw,
  Shield,
  Tag,
  Trash2,
  Users,
} from "@/components/icons";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card, CardBody } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { DestructiveActionBar } from "@/components/ui/DestructiveActionBar";
import ContactsDuplicatesPage from "@/pages/ContactsDuplicatesPage";
import { leadDuplicatesService } from "@/services/leadDuplicates";
import { unitsService } from "@/services/units";
import { useClinic } from "@/hooks/useClinic";
import { cn, formatDate, formatNumber } from "@/lib/utils";
import type { DuplicateDeleteJobStatus } from "@/types";
import type { LeadDuplicateDeleteJob, LeadDuplicateGroup } from "@/types/leadDuplicates";

type Tab = "leads" | "contacts";

export default function DuplicatesPage() {
  const [tab, setTab] = useState<Tab>("leads");

  return (
    <>
      <div className="mb-4 flex gap-1 rounded-xl border border-hairline bg-surface p-1">
        <TabButton active={tab === "leads"} onClick={() => setTab("leads")} icon={<Trash2 className="h-4 w-4" />}>
          Leads
        </TabButton>
        <TabButton active={tab === "contacts"} onClick={() => setTab("contacts")} icon={<Users className="h-4 w-4" />}>
          Contatos
        </TabButton>
      </div>

      {tab === "leads" ? <LeadsDuplicatesTab /> : <ContactsDuplicatesPage />}
    </>
  );
}

function TabButton({
  active,
  onClick,
  icon,
  children,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex flex-1 items-center justify-center gap-2 rounded-lg px-3 py-2 text-[13px] font-semibold transition-colors",
        active ? "bg-brand-500 text-white" : "text-ink-500 hover:text-ink-900",
      )}
    >
      {icon}
      {children}
    </button>
  );
}

// ─── Aba de LEADS duplicados ─────────────────────────────────────────────────

const PAGE_SIZE = 50;
const BATCH_SIZE = 200;
const POLL_INTERVAL_MS = 1500;
const JOB_STORAGE_KEY = "lead-dup-delete-job-id";

const isTerminal = (s: DuplicateDeleteJobStatus) =>
  s === "Completed" || s === "Failed" || s === "Cancelled";

function LeadsDuplicatesTab() {
  const { tenantId, unitId } = useClinic();
  const queryClient = useQueryClient();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [ignoreTenant, setIgnoreTenant] = useState(false);
  const [tagInKommo, setTagInKommo] = useState(true);
  const [mode, setMode] = useState<"phone" | "name">("phone");
  const [page, setPage] = useState(1);
  const [activeJobId, setActiveJobId] = useState<string | null>(
    () => sessionStorage.getItem(JOB_STORAGE_KEY),
  );
  const [lastResult, setLastResult] = useState<LeadDuplicateDeleteJob | null>(null);

  // Unidade selecionada → saber se tem token Kommo salvo (pra avisar antes).
  const unitsQ = useQuery({
    queryKey: ["units-token-check"],
    queryFn: () => unitsService.list(),
    staleTime: 5 * 60_000,
  });
  const selectedUnit = unitsQ.data?.find(
    (u) => String(u.clinicId) === String(tenantId) || String(u.id) === String(unitId),
  );
  const noToken = !!selectedUnit && selectedUnit.hasKommoToken === false;

  const report = useQuery({
    queryKey: ["lead-duplicates", tenantId, ignoreTenant, mode, page],
    queryFn: () =>
      leadDuplicatesService.listDuplicates({
        tenantId: tenantId ?? undefined,
        ignoreTenant,
        mode,
        page,
        pageSize: PAGE_SIZE,
      }),
    enabled: !!tenantId || ignoreTenant,
    retry: false,
    placeholderData: keepPreviousData,
  });

  const job = useQuery<LeadDuplicateDeleteJob>({
    queryKey: ["lead-dup-delete-job", activeJobId],
    queryFn: () => leadDuplicatesService.getDeleteJob(activeJobId!),
    enabled: !!activeJobId,
    refetchInterval: (query) => {
      const s = query.state.data?.status;
      if (!s || isTerminal(s)) return false;
      return POLL_INTERVAL_MS;
    },
    refetchIntervalInBackground: true,
    retry: 2,
  });

  useEffect(() => {
    const j = job.data;
    if (!j || !activeJobId || j.id !== activeJobId) return;
    if (!isTerminal(j.status)) return;

    sessionStorage.removeItem(JOB_STORAGE_KEY);
    setActiveJobId(null);
    setConfirmOpen(false);
    setLastResult(j);
    queryClient.invalidateQueries({ queryKey: ["lead-duplicates"] });
    queryClient.invalidateQueries({ queryKey: ["dash-amo"] });

    if (j.status === "Completed") {
      const tagInfo = j.tagConfirmed > 0 ? ` · ${formatNumber(j.tagConfirmed)} confirmado(s) na Kommo` : "";
      toast.success(`${formatNumber(j.leadsDeleted)} lead(s) apagado(s)${tagInfo}.`);
      if (j.tagFailures > 0)
        toast.warning(`${formatNumber(j.tagFailures)} lead(s) falharam ao taguear na Kommo.`);
      if (j.tagSkipped > 0)
        toast.warning(
          `${formatNumber(j.tagSkipped)} lead(s) não tagueados: unidade sem token Kommo (foram apagados só no dashboard).`,
        );
    } else if (j.status === "Cancelled") {
      toast.info(`Cancelado. ${formatNumber(j.leadsDeleted)} já haviam sido apagado(s).`);
    } else if (j.status === "Failed") {
      toast.error(j.error ?? "Job falhou.");
    }
  }, [job.data, activeJobId, queryClient]);

  const startMut = useMutation({
    mutationFn: () =>
      leadDuplicatesService.startDeleteJob({
        tenantId: tenantId ?? undefined,
        ignoreTenant,
        batchSize: BATCH_SIZE,
        tagInKommo,
        mode,
      }),
    onSuccess: (data) => {
      setActiveJobId(data.jobId);
      sessionStorage.setItem(JOB_STORAGE_KEY, data.jobId);
      toast.success("Job enfileirado. Você pode fechar a aba — continuará rodando.");
    },
    onError: (err: unknown) => {
      const e = err as { response?: { data?: { error?: string; detail?: string; title?: string } }; message?: string };
      toast.error(
        e?.response?.data?.error ??
          e?.response?.data?.detail ??
          e?.response?.data?.title ??
          e?.message ??
          "Falha ao iniciar a exclusão",
      );
    },
    onSettled: () => setConfirmOpen(false),
  });

  const cancelMut = useMutation({
    mutationFn: (jobId: string) => leadDuplicatesService.cancelDeleteJob(jobId),
    onSuccess: () => toast.success("Cancelamento solicitado. Interrompendo após o lote atual."),
    onError: () => toast.error("Falha ao solicitar cancelamento."),
  });

  const j = job.data;
  const running = !!j && (j.status === "Queued" || j.status === "Running" || j.status === "Cancelling");

  const data = report.data;
  const groups = data?.groups ?? [];
  const totalToDelete = data?.leadsToDelete ?? 0;
  const hasDuplicates = totalToDelete > 0;
  const barOpen = confirmOpen || running;

  return (
    <>
      <DestructiveActionBar
        open={barOpen}
        title={
          running
            ? "Apagando leads duplicados"
            : `${formatNumber(totalToDelete)} lead(s) serão apagados permanentemente`
        }
        description={
          running
            ? undefined
            : `Em ${formatNumber(data?.groupsFound ?? 0)} grupo(s). Mantemos o mais avançado de cada grupo.${
                tagInKommo ? " Os duplicados serão marcados como DUPLICADO na Kommo." : ""
              } A exclusão no dashboard é irreversível.`
        }
        confirmLabel={`Apagar ${formatNumber(totalToDelete)} lead(s)`}
        onConfirm={() => startMut.mutate()}
        onDismiss={() => {
          if (running && j) {
            if (j.status !== "Cancelling") cancelMut.mutate(j.id);
          } else {
            setConfirmOpen(false);
          }
        }}
        pending={startMut.isPending}
        countdownSeconds={3}
        progress={
          running && j
            ? {
                current: j.leadsDeleted,
                total: j.leadsToDeleteTotal,
                label:
                  j.status === "Queued"
                    ? "aguardando na fila"
                    : j.status === "Cancelling"
                      ? "cancelando..."
                      : `${j.batchesExecuted} lote(s)`,
                onStop: () => cancelMut.mutate(j.id),
                stopping: cancelMut.isPending || j.status === "Cancelling",
              }
            : undefined
        }
      />

      <PageHeader
        title="Leads duplicados"
        description={
          mode === "name"
            ? "Leads com o MESMO NOME. O mais avançado é mantido."
            : "Leads com o MESMO TELEFONE. O mais avançado (pagamento/agendamento/etapa) é mantido."
        }
        actions={
          <>
            <Button variant="outline" onClick={() => report.refetch()} disabled={report.isFetching || running}>
              <RefreshCw className={cn("mr-2 h-4 w-4", report.isFetching && "animate-spin")} />
              Recarregar
            </Button>
            <Button
              variant="danger"
              onClick={() => setConfirmOpen(true)}
              disabled={!hasDuplicates || running || startMut.isPending || confirmOpen}
            >
              <Trash2 className="mr-2 h-4 w-4" />
              Apagar duplicados
            </Button>
          </>
        }
      />

      {/* Critério de duplicidade */}
      <div className="flex flex-wrap items-center gap-3">
        <span className="text-[12px] font-medium text-ink-500">Agrupar por:</span>
        <div className="flex rounded-xl border border-hairline bg-surface p-0.5">
          <button
            type="button"
            disabled={running}
            onClick={() => {
              setMode("phone");
              setPage(1);
            }}
            className={cn(
              "rounded-lg px-3 py-1.5 text-[12px] font-semibold transition-colors disabled:opacity-50",
              mode === "phone" ? "bg-brand-500 text-white" : "text-ink-500 hover:text-ink-900",
            )}
          >
            Telefone
          </button>
          <button
            type="button"
            disabled={running}
            onClick={() => {
              setMode("name");
              setPage(1);
            }}
            className={cn(
              "rounded-lg px-3 py-1.5 text-[12px] font-semibold transition-colors disabled:opacity-50",
              mode === "name" ? "bg-brand-500 text-white" : "text-ink-500 hover:text-ink-900",
            )}
          >
            Nome
          </button>
        </div>
        {report.data && (
          <span className="text-[11.5px] text-ink-500">
            {formatNumber(report.data.leadsScanned)} leads analisados
          </span>
        )}
      </div>

      {mode === "name" && (
        <div className="rounded-md p-3 ring-1 ring-inset ring-amber-500/25 bg-amber-500/[0.07] flex items-start gap-2.5">
          <Info className="h-4 w-4 text-amber-300 mt-0.5 shrink-0" />
          <p className="text-[12px] text-amber-200">
            Modo <b>Nome</b>: agrupa leads com o mesmo nome (útil pra importações repetidas). Cuidado: nomes
            iguais podem ser <b>pessoas diferentes</b> — confira o preview antes de apagar.
          </p>
        </div>
      )}

      {lastResult && !running && (
        <ResultPanel job={lastResult} onDismiss={() => setLastResult(null)} />
      )}

      {tagInKommo && noToken && !running && (
        <div className="rounded-md p-3 ring-1 ring-inset ring-amber-500/25 bg-amber-500/[0.07] flex items-start gap-2.5">
          <Info className="h-4 w-4 text-amber-300 mt-0.5 shrink-0" />
          <p className="text-[12px] text-amber-200">
            Esta unidade <b>não tem token da Kommo salvo</b>. Os duplicados serão{" "}
            <b>apagados no dashboard</b>, mas <b>não serão marcados como DUPLICADO na Kommo</b>. Para marcar,
            salve o token em Configurações → integração Kommo (ou desmarque a opção abaixo).
          </p>
        </div>
      )}

      <Card>
        <CardBody className="py-3 space-y-3">
          <label className="flex items-start gap-3 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={tagInKommo}
              onChange={(e) => setTagInKommo(e.target.checked)}
              className="mt-0.5 h-4 w-4 rounded accent-brand-500"
              disabled={running}
            />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <Tag className="h-4 w-4 text-brand-300" />
                <span className="text-[13px] font-semibold text-slate-100">Marcar &quot;DUPLICADO&quot; na Kommo</span>
              </div>
              <p className="text-[11.5px] text-slate-500 mt-1">
                A API da Kommo não apaga leads. Marcamos os duplicados com a tag <b>DUPLICADO</b> lá — depois você
                filtra por ela na Kommo e apaga em massa pela tela deles.
              </p>
            </div>
          </label>

          <label className="flex items-start gap-3 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={ignoreTenant}
              onChange={(e) => {
                setIgnoreTenant(e.target.checked);
                setPage(1);
              }}
              className="mt-0.5 h-4 w-4 rounded accent-brand-500"
              disabled={running}
            />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <Globe className="h-4 w-4 text-brand-300" />
                <span className="text-[13px] font-semibold text-slate-100">Incluir outras unidades</span>
              </div>
              <p className="text-[11.5px] text-slate-500 mt-1">
                Agrupa só pelo telefone, ignorando a unidade. <span className="text-amber-300">Só super admin.</span>
              </p>
            </div>
          </label>
        </CardBody>
      </Card>

      {!tenantId && !ignoreTenant && (
        <Card>
          <CardBody>
            <EmptyState title="Selecione uma unidade" description="Escolha uma unidade para varrer os leads duplicados." />
          </CardBody>
        </Card>
      )}

      {(tenantId || ignoreTenant) && report.isLoading && (
        <Card>
          <CardBody>
            <div className="h-32 animate-pulse bg-white/[0.02] rounded-md" />
          </CardBody>
        </Card>
      )}

      {(tenantId || ignoreTenant) && report.isError && (
        <Card>
          <CardBody>
            <EmptyState title="Falha ao buscar duplicados" description="Verifique se você está autenticado e tente de novo." />
          </CardBody>
        </Card>
      )}

      {(tenantId || ignoreTenant) && data && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <SummaryCard icon={<Users className="h-4 w-4" />} label="Grupos de duplicados" value={formatNumber(data.groupsFound)} tone="amber" />
            <SummaryCard icon={<Trash2 className="h-4 w-4" />} label="Leads a apagar" value={formatNumber(data.leadsToDelete)} tone="rose" />
            <SummaryCard icon={<Shield className="h-4 w-4" />} label="Serão mantidos" value={formatNumber(data.groupsFound)} tone="emerald" />
          </div>

          {!hasDuplicates ? (
            <Card>
              <CardBody>
                <EmptyState title="Nenhum lead duplicado 🎉" description="Todos os leads desta unidade têm telefones únicos." />
              </CardBody>
            </Card>
          ) : (
            <Card>
              <CardBody className="p-0">
                <div className="px-4 py-3 border-b border-white/[0.05] flex items-center gap-2.5 bg-amber-500/[0.04]">
                  <AlertTriangle className="h-4 w-4 text-amber-300 shrink-0" />
                  <p className="text-[12px] text-amber-200">
                    Mostrando <b>{groups.length}</b> grupo(s) — página <b>{data.page}</b> de <b>{data.totalPages}</b>. O{" "}
                    <b>mantido</b> é o mais avançado; os <b>em vermelho</b> serão apagados.
                  </p>
                </div>
                <ul className="divide-y divide-white/[0.05]">
                  {groups.map((g) => (
                    <LeadGroupItem key={`${g.tenantId}-${g.phoneNormalized}`} group={g} mode={mode} />
                  ))}
                </ul>
                <Pagination page={data.page} totalPages={data.totalPages} disabled={report.isFetching || running} onChange={setPage} />
              </CardBody>
            </Card>
          )}
        </>
      )}
    </>
  );
}

function ResultPanel({ job, onDismiss }: { job: LeadDuplicateDeleteJob; onDismiss: () => void }) {
  const failed = job.status === "Failed";
  const cancelled = job.status === "Cancelled";
  return (
    <div
      className={cn(
        "rounded-md p-4 ring-1 ring-inset",
        failed ? "bg-rose-500/[0.07] ring-rose-500/25" : "bg-emerald-500/[0.06] ring-emerald-500/20",
      )}
    >
      <div className="flex items-center justify-between gap-3 mb-3">
        <div className="flex items-center gap-2">
          {failed ? (
            <AlertTriangle className="h-4 w-4 text-rose-300" />
          ) : (
            <CheckCircle2 className="h-4 w-4 text-emerald-300" />
          )}
          <span className="text-[13px] font-semibold text-slate-100">
            {failed
              ? "Falhou"
              : cancelled
                ? "Cancelado — resultado parcial"
                : "Exclusão concluída"}
          </span>
        </div>
        <button onClick={onDismiss} className="text-[11px] text-slate-400 hover:text-slate-200">
          fechar
        </button>
      </div>

      {failed && job.error && <p className="mb-3 text-[12px] text-rose-200">{job.error}</p>}

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        <ResultStat label="Apagados (dashboard)" value={job.leadsDeleted} tone="rose" />
        <ResultStat label="Confirmados na Kommo" value={job.tagConfirmed} tone="emerald" />
        <ResultStat label="Falhas de tag" value={job.tagFailures} tone="amber" />
        <ResultStat label="Pulados (sem token)" value={job.tagSkipped} tone="slate" />
      </div>

      {job.taggedInKommo !== job.tagConfirmed && (
        <p className="mt-2 text-[11.5px] text-slate-400">
          Enviados {formatNumber(job.taggedInKommo)} PATCH(s) de tag; confirmados {formatNumber(job.tagConfirmed)}{" "}
          via re-leitura na Kommo.
        </p>
      )}

      {job.tagSkipped > 0 && (
        <p className="mt-3 text-[11.5px] text-amber-200">
          {formatNumber(job.tagSkipped)} lead(s) foram apagados no dashboard, mas <b>não</b> marcados na Kommo
          (unidade sem token). Salve o token e rode de novo para marcar os próximos.
        </p>
      )}
    </div>
  );
}

function ResultStat({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: "rose" | "emerald" | "amber" | "slate";
}) {
  const map: Record<"rose" | "emerald" | "amber" | "slate", string> = {
    rose: "text-rose-100",
    emerald: "text-emerald-100",
    amber: "text-amber-100",
    slate: "text-slate-100",
  };
  return (
    <div className="rounded-md bg-white/[0.03] ring-1 ring-inset ring-white/[0.06] p-2.5">
      <p className={cn("text-[20px] font-bold tabular-nums leading-none", map[tone])}>{formatNumber(value)}</p>
      <p className="mt-1 text-[10px] uppercase tracking-wide text-slate-500">{label}</p>
    </div>
  );
}

function LeadGroupItem({ group: g, mode }: { group: LeadDuplicateGroup; mode: "phone" | "name" }) {
  const MAX_INLINE = 20;
  const shownIds = g.deleteLeadIds.slice(0, MAX_INLINE);
  const hidden = Math.max(0, g.deleteLeadIds.length - MAX_INLINE);

  return (
    <li className="p-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <span
            className={cn(
              "text-[13px] text-slate-200",
              mode === "phone" ? "font-mono tabular-nums" : "font-semibold capitalize",
            )}
          >
            {mode === "phone" ? g.phoneNormalized : g.keepName || g.phoneNormalized}
          </span>
          <button
            onClick={() => navigator.clipboard.writeText(g.phoneNormalized)}
            className="text-slate-600 hover:text-slate-300 transition"
            title={mode === "phone" ? "Copiar telefone" : "Copiar nome"}
          >
            <Copy className="h-3.5 w-3.5" />
          </button>
        </div>
        <span className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-300 ring-1 ring-inset ring-amber-500/20">
          {g.count} entradas
        </span>
      </div>

      <div className="mt-3 grid gap-2">
        <Link
          to={`/leads/${g.keepLeadId}`}
          className="flex items-center justify-between gap-3 p-2.5 rounded-md bg-emerald-500/[0.06] ring-1 ring-inset ring-emerald-500/20 hover:ring-emerald-500/30 transition"
        >
          <div className="flex items-center gap-2 min-w-0">
            <CheckCircle2 className="h-4 w-4 text-emerald-300 shrink-0" />
            <span className="text-[11px] font-medium uppercase tracking-wider text-emerald-300">Mantido</span>
            <span className="text-[13px] text-slate-100 font-medium truncate">{g.keepName}</span>
            {g.keepHasPayment && (
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-200">pagou</span>
            )}
            {g.keepHasAppointment && (
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-sky-500/15 text-sky-200">agendado</span>
            )}
            {g.keepStage && (
              <span className="hidden sm:inline text-[10px] px-1.5 py-0.5 rounded bg-white/5 text-slate-300">{g.keepStage}</span>
            )}
          </div>
          <div className="flex items-center gap-3 text-[11px] text-slate-400 shrink-0 tabular-nums">
            <span>#{g.keepLeadId}</span>
            <span>{formatDate(g.keepCreatedAt)}</span>
          </div>
        </Link>

        {shownIds.map((id, i) => (
          <Link
            key={id}
            to={`/leads/${id}`}
            className="flex items-center justify-between gap-3 p-2.5 rounded-md bg-rose-500/[0.05] ring-1 ring-inset ring-rose-500/15 hover:ring-rose-500/25 transition"
          >
            <div className="flex items-center gap-2 min-w-0">
              <Trash2 className="h-4 w-4 text-rose-300 shrink-0" />
              <span className="text-[11px] font-medium uppercase tracking-wider text-rose-300">Será apagado</span>
              <span className="text-[13px] text-slate-300 truncate">{g.deleteNames[i] ?? ""}</span>
            </div>
            <span className="text-[11px] text-slate-400 tabular-nums">#{id}</span>
          </Link>
        ))}
        {hidden > 0 && (
          <p className="text-[11px] text-slate-500 pl-2">
            … e mais <b>{formatNumber(hidden)}</b> serão apagados neste grupo
          </p>
        )}
      </div>
    </li>
  );
}

function Pagination({
  page,
  totalPages,
  disabled,
  onChange,
}: {
  page: number;
  totalPages: number;
  disabled: boolean;
  onChange: (next: number) => void;
}) {
  if (totalPages <= 1) return null;
  return (
    <div className="px-4 py-3 border-t border-white/[0.05] flex items-center justify-between">
      <span className="text-[11.5px] text-slate-500 tabular-nums">
        Página {page} / {totalPages}
      </span>
      <div className="flex items-center gap-2">
        <Button variant="ghost" onClick={() => onChange(Math.max(1, page - 1))} disabled={disabled || page <= 1}>
          <ChevronLeft className="h-4 w-4" />
          Anterior
        </Button>
        <Button variant="ghost" onClick={() => onChange(Math.min(totalPages, page + 1))} disabled={disabled || page >= totalPages}>
          Próxima
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}

function SummaryCard({
  icon,
  label,
  value,
  tone,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  tone: "amber" | "rose" | "emerald";
}) {
  const p: Record<"amber" | "rose" | "emerald", { bg: string; ring: string; text: string; val: string }> = {
    amber: { bg: "bg-amber-500/8", ring: "ring-amber-500/20", text: "text-amber-300", val: "text-amber-100" },
    rose: { bg: "bg-rose-500/8", ring: "ring-rose-500/20", text: "text-rose-300", val: "text-rose-100" },
    emerald: { bg: "bg-emerald-500/8", ring: "ring-emerald-500/20", text: "text-emerald-300", val: "text-emerald-100" },
  };
  const s = p[tone];
  return (
    <div className={cn("rounded-md p-4 ring-1 ring-inset", s.bg, s.ring)}>
      <div className="flex items-center justify-between mb-2">
        <span className="text-[10px] font-medium uppercase tracking-[0.14em] text-slate-500">{label}</span>
        <span className={s.text}>{icon}</span>
      </div>
      <p className={cn("text-[24px] font-bold tracking-tight tabular-nums leading-none", s.val)}>{value}</p>
    </div>
  );
}
