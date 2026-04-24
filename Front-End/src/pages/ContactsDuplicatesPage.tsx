import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  useMutation,
  useQuery,
  useQueryClient,
  keepPreviousData,
} from "@tanstack/react-query";
import { toast } from "sonner";
import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Copy,
  Globe,
  RefreshCw,
  Shield,
  Trash2,
  Users,
} from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card, CardBody } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { DestructiveActionBar } from "@/components/ui/DestructiveActionBar";
import { contactsService } from "@/services/contacts";
import { useClinic } from "@/hooks/useClinic";
import { cn, formatDate, formatNumber } from "@/lib/utils";
import type { DuplicateDeleteJob } from "@/types";

const PAGE_SIZE = 50;
const BATCH_SIZE = 500;
const POLL_INTERVAL_MS = 1500;
const JOB_STORAGE_KEY = "dup-delete-job-id";

const isTerminal = (s: DuplicateDeleteJob["status"]) =>
  s === "Completed" || s === "Failed" || s === "Cancelled";

export default function ContactsDuplicatesPage() {
  const { tenantId } = useClinic();
  const queryClient = useQueryClient();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [ignoreTenant, setIgnoreTenant] = useState(false);
  const [page, setPage] = useState(1);
  const [activeJobId, setActiveJobId] = useState<string | null>(
    () => sessionStorage.getItem(JOB_STORAGE_KEY),
  );

  const report = useQuery({
    queryKey: ["contacts-duplicates", tenantId, ignoreTenant, page],
    queryFn: () =>
      contactsService.listDuplicates({
        clinicId: tenantId ?? undefined,
        ignoreTenant,
        page,
        pageSize: PAGE_SIZE,
      }),
    enabled: !!tenantId || ignoreTenant,
    retry: false,
    placeholderData: keepPreviousData,
  });

  const job = useQuery<DuplicateDeleteJob>({
    queryKey: ["dup-delete-job", activeJobId],
    queryFn: () => contactsService.getDeleteJob(activeJobId!),
    enabled: !!activeJobId,
    refetchInterval: (query) => {
      const s = query.state.data?.status;
      if (!s || isTerminal(s)) return false;
      return POLL_INTERVAL_MS;
    },
    refetchIntervalInBackground: true,
    retry: 2,
  });

  // Side-effect correto de finalização (useEffect, não durante render)
  useEffect(() => {
    const j = job.data;
    if (!j || !activeJobId || j.id !== activeJobId) return;
    if (!isTerminal(j.status)) return;

    sessionStorage.removeItem(JOB_STORAGE_KEY);
    setActiveJobId(null);
    setConfirmOpen(false);
    queryClient.invalidateQueries({ queryKey: ["contacts-duplicates"] });
    queryClient.invalidateQueries({ queryKey: ["contacts"] });

    if (j.status === "Completed") {
      toast.success(
        `${formatNumber(j.contactsDeleted)} contato(s) apagado(s) em ${j.batchesExecuted} lote(s).`,
      );
    } else if (j.status === "Cancelled") {
      toast.info(
        `Cancelado. ${formatNumber(j.contactsDeleted)} já haviam sido apagado(s).`,
      );
    } else if (j.status === "Failed") {
      toast.error(j.error ?? "Job falhou.");
    }
  }, [job.data, activeJobId, queryClient]);

  const startMut = useMutation({
    mutationFn: () =>
      contactsService.startDeleteJob({
        clinicId: tenantId ?? undefined,
        ignoreTenant,
        batchSize: BATCH_SIZE,
      }),
    onSuccess: (data) => {
      setActiveJobId(data.jobId);
      sessionStorage.setItem(JOB_STORAGE_KEY, data.jobId);
      toast.success("Job enfileirado. Você pode fechar a aba — continuará rodando.");
    },
    onError: (err: unknown) => {
      const e = err as {
        response?: { data?: { error?: string; detail?: string; title?: string } };
        message?: string;
        code?: string;
      };
      const timeout = e?.code === "ECONNABORTED";
      toast.error(
        timeout
          ? "Não foi possível enfileirar (tempo esgotado). Tente de novo."
          : e?.response?.data?.error ??
              e?.response?.data?.detail ??
              e?.response?.data?.title ??
              e?.message ??
              "Falha ao iniciar a exclusão",
      );
    },
    onSettled: () => {
      setConfirmOpen(false);
    },
  });

  const cancelMut = useMutation({
    mutationFn: (jobId: string) => contactsService.cancelDeleteJob(jobId),
    onSuccess: () =>
      toast.success("Cancelamento solicitado. Interrompendo após o lote atual."),
    onError: () => toast.error("Falha ao solicitar cancelamento."),
  });

  const j = job.data;
  const running = !!j && (j.status === "Queued" || j.status === "Running" || j.status === "Cancelling");

  const data = report.data;
  const groups = data?.groups ?? [];
  const totalToDelete = data?.contactsToDelete ?? 0;
  const hasDuplicates = totalToDelete > 0;

  const barOpen = confirmOpen || running;

  return (
    <>
      <DestructiveActionBar
        open={barOpen}
        title={
          running
            ? "Apagando contatos duplicados"
            : `${formatNumber(totalToDelete)} contato(s) serão apagados permanentemente`
        }
        description={
          running
            ? undefined
            : `Em ${formatNumber(data?.groupsFound ?? 0)} grupo(s). Mantemos o mais antigo de cada grupo. Essa ação é irreversível.`
        }
        confirmLabel={`Apagar ${formatNumber(totalToDelete)} contato(s)`}
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
                current: j.contactsDeleted,
                total: j.contactsToDeleteTotal,
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
        title="Contatos duplicados"
        description="Contatos com mesmo telefone. O mais antigo de cada grupo é mantido."
        actions={
          <>
            <Link to="/contacts">
              <Button variant="ghost">
                <ArrowLeft className="mr-2 h-4 w-4" />
                Voltar
              </Button>
            </Link>
            <Button
              variant="outline"
              onClick={() => report.refetch()}
              disabled={report.isFetching || running}
            >
              <RefreshCw
                className={cn("mr-2 h-4 w-4", report.isFetching && "animate-spin")}
              />
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

      <Card>
        <CardBody className="py-3">
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
                <span className="text-[13px] font-semibold text-slate-100">
                  Incluir outros tenants
                </span>
              </div>
              <p className="text-[11.5px] text-slate-500 mt-1">
                Agrupa contatos só pelo telefone, <b>ignorando o tenant</b>.
                <span className="text-amber-300"> Cuidado:</span> ao apagar, o mais
                antigo vence mesmo em outro tenant.
              </p>
            </div>
          </label>
        </CardBody>
      </Card>

      {!tenantId && !ignoreTenant && (
        <Card>
          <CardBody>
            <EmptyState
              title="Selecione uma unidade"
              description="Escolha um tenant/unidade, ou marque 'Incluir outros tenants' para varrer tudo."
            />
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
            <EmptyState
              title="Falha ao buscar duplicados"
              description="Verifique se você está autenticado e tente de novo."
            />
          </CardBody>
        </Card>
      )}

      {(tenantId || ignoreTenant) && data && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <SummaryCard
              icon={<Users className="h-4 w-4" />}
              label="Grupos de duplicados"
              value={formatNumber(data.groupsFound)}
              tone="amber"
            />
            <SummaryCard
              icon={<Trash2 className="h-4 w-4" />}
              label="Contatos a apagar"
              value={formatNumber(data.contactsToDelete)}
              tone="rose"
            />
            <SummaryCard
              icon={<Shield className="h-4 w-4" />}
              label="Serão mantidos"
              value={formatNumber(data.groupsFound)}
              tone="emerald"
            />
          </div>

          {!hasDuplicates ? (
            <Card>
              <CardBody>
                <EmptyState
                  title="Nenhum duplicado encontrado 🎉"
                  description="Todos os contatos deste tenant têm telefones únicos."
                />
              </CardBody>
            </Card>
          ) : (
            <Card>
              <CardBody className="p-0">
                <div className="px-4 py-3 border-b border-white/[0.05] flex items-center gap-2.5 bg-amber-500/[0.04]">
                  <AlertTriangle className="h-4 w-4 text-amber-300 shrink-0" />
                  <p className="text-[12px] text-amber-200">
                    Mostrando <b>{groups.length}</b> grupo(s) — página{" "}
                    <b>{data.page}</b> de <b>{data.totalPages}</b>. O{" "}
                    <b>mantido</b> é o mais antigo; os <b>em vermelho</b> serão
                    apagados.
                  </p>
                </div>
                <ul className="divide-y divide-white/[0.05]">
                  {groups.map((g) => (
                    <GroupItem
                      key={`${g.tenantId}-${g.phoneNormalized}`}
                      group={g}
                    />
                  ))}
                </ul>
                <Pagination
                  page={data.page}
                  totalPages={data.totalPages}
                  disabled={report.isFetching || running}
                  onChange={setPage}
                />
              </CardBody>
            </Card>
          )}
        </>
      )}

    </>
  );
}

function GroupItem({
  group: g,
}: {
  group: {
    tenantId: number;
    phoneNormalized: string;
    count: number;
    keepContactId: number;
    keepName: string;
    keepCreatedAt: string;
    deleteContactIds: number[];
  };
}) {
  const MAX_INLINE = 20;
  const shown = g.deleteContactIds.slice(0, MAX_INLINE);
  const hidden = Math.max(0, g.deleteContactIds.length - MAX_INLINE);

  return (
    <li className="p-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <span className="font-mono text-[13px] tabular-nums text-slate-200">
            {g.phoneNormalized}
          </span>
          <button
            onClick={() => navigator.clipboard.writeText(g.phoneNormalized)}
            className="text-slate-600 hover:text-slate-300 transition"
            title="Copiar telefone"
          >
            <Copy className="h-3.5 w-3.5" />
          </button>
          <span className="text-[11px] text-slate-500">· tenant {g.tenantId}</span>
        </div>
        <span className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-300 ring-1 ring-inset ring-amber-500/20">
          {g.count} entradas
        </span>
      </div>

      <div className="mt-3 grid gap-2">
        <KeepRow
          id={g.keepContactId}
          name={g.keepName}
          createdAt={g.keepCreatedAt}
        />
        {shown.map((id) => (
          <DeleteRow key={id} id={id} />
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
        <Button
          variant="ghost"
          onClick={() => onChange(Math.max(1, page - 1))}
          disabled={disabled || page <= 1}
        >
          <ChevronLeft className="h-4 w-4" />
          Anterior
        </Button>
        <Button
          variant="ghost"
          onClick={() => onChange(Math.min(totalPages, page + 1))}
          disabled={disabled || page >= totalPages}
        >
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
        <span className="text-[10px] font-medium uppercase tracking-[0.14em] text-slate-500">
          {label}
        </span>
        <span className={s.text}>{icon}</span>
      </div>
      <p className={cn("text-[24px] font-bold tracking-tight tabular-nums leading-none", s.val)}>
        {value}
      </p>
    </div>
  );
}

function KeepRow({ id, name, createdAt }: { id: number; name: string; createdAt: string }) {
  return (
    <Link
      to={`/contacts/${id}`}
      className="flex items-center justify-between gap-3 p-2.5 rounded-md bg-emerald-500/[0.06] ring-1 ring-inset ring-emerald-500/20 hover:ring-emerald-500/30 transition"
    >
      <div className="flex items-center gap-2 min-w-0">
        <CheckCircle2 className="h-4 w-4 text-emerald-300 shrink-0" />
        <span className="text-[11px] font-medium uppercase tracking-wider text-emerald-300">
          Mantido
        </span>
        <span className="text-[13px] text-slate-100 font-medium truncate">{name}</span>
      </div>
      <div className="flex items-center gap-3 text-[11px] text-slate-400 shrink-0 tabular-nums">
        <span>#{id}</span>
        <span>{formatDate(createdAt)}</span>
      </div>
    </Link>
  );
}

function DeleteRow({ id }: { id: number }) {
  return (
    <Link
      to={`/contacts/${id}`}
      className="flex items-center justify-between gap-3 p-2.5 rounded-md bg-rose-500/[0.05] ring-1 ring-inset ring-rose-500/15 hover:ring-rose-500/25 transition"
    >
      <div className="flex items-center gap-2 min-w-0">
        <Trash2 className="h-4 w-4 text-rose-300 shrink-0" />
        <span className="text-[11px] font-medium uppercase tracking-wider text-rose-300">
          Será apagado
        </span>
      </div>
      <span className="text-[11px] text-slate-400 tabular-nums">#{id}</span>
    </Link>
  );
}

