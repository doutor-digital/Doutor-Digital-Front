import { useCallback, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { useQuery, useQueryClient, keepPreviousData } from "@tanstack/react-query";
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
import { contactsService } from "@/services/contacts";
import { useClinic } from "@/hooks/useClinic";
import { cn, formatDate, formatNumber } from "@/lib/utils";
import type { DuplicateContactsDeleteProgress } from "@/types";

const PAGE_SIZE = 50;
const BATCH_SIZE = 500;
const MAX_BATCHES_PER_CALL = 4;

type DeleteState = {
  running: boolean;
  deletedTotal: number;
  expectedTotal: number;
  batchesTotal: number;
  startedAt: number | null;
  error: string | null;
};

const INITIAL_DELETE: DeleteState = {
  running: false,
  deletedTotal: 0,
  expectedTotal: 0,
  batchesTotal: 0,
  startedAt: null,
  error: null,
};

export default function ContactsDuplicatesPage() {
  const { tenantId } = useClinic();
  const queryClient = useQueryClient();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [ignoreTenant, setIgnoreTenant] = useState(false);
  const [page, setPage] = useState(1);
  const [deleteState, setDeleteState] = useState<DeleteState>(INITIAL_DELETE);
  const cancelledRef = useRef(false);

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

  const data = report.data;
  const groups = data?.groups ?? [];
  const totalToDelete = data?.contactsToDelete ?? 0;
  const totalPages = data?.totalPages ?? 1;
  const hasDuplicates = totalToDelete > 0;

  const runDeleteLoop = useCallback(async () => {
    cancelledRef.current = false;
    setDeleteState({
      running: true,
      deletedTotal: 0,
      expectedTotal: totalToDelete,
      batchesTotal: 0,
      startedAt: performance.now(),
      error: null,
    });

    let deletedAcc = 0;
    let batchesAcc = 0;
    let lastProgress: DuplicateContactsDeleteProgress | null = null;

    try {
      // Loop síncrono: cada chamada faz até MAX_BATCHES_PER_CALL * BATCH_SIZE remoções.
      // Paramos quando o backend diz completed ou quando não há mais nada a apagar.
      // Um teto defensivo evita loop infinito caso algo externo esteja inserindo.
      const MAX_CALLS = 2000;
      for (let call = 0; call < MAX_CALLS; call++) {
        if (cancelledRef.current) break;

        const progress = await contactsService.deleteDuplicatesChunk({
          clinicId: tenantId ?? undefined,
          ignoreTenant,
          batchSize: BATCH_SIZE,
          maxBatches: MAX_BATCHES_PER_CALL,
        });
        lastProgress = progress;

        deletedAcc += progress.deletedThisCall;
        batchesAcc += progress.batches;

        setDeleteState((s) => ({
          ...s,
          deletedTotal: deletedAcc,
          batchesTotal: batchesAcc,
          expectedTotal: Math.max(s.expectedTotal, progress.contactsToDeleteTotal),
        }));

        if (progress.completed || progress.deletedThisCall === 0) break;
      }

      const took = deleteState.startedAt
        ? Math.round((performance.now() - deleteState.startedAt) / 100) / 10
        : null;

      const parts = [
        `${formatNumber(deletedAcc)} contato(s) duplicado(s) apagado(s)`,
        `${batchesAcc} lote(s)`,
      ];
      if (took !== null) parts.push(`${took}s`);

      toast.success(parts.join(" · "));
      setConfirmOpen(false);
      setDeleteState(INITIAL_DELETE);
      queryClient.invalidateQueries({ queryKey: ["contacts-duplicates"] });
      queryClient.invalidateQueries({ queryKey: ["contacts"] });
    } catch (err: unknown) {
      const e = err as {
        response?: { data?: { error?: string; detail?: string; title?: string } };
        message?: string;
        code?: string;
      };
      const timeout = e?.code === "ECONNABORTED";
      const msg = timeout
        ? "Tempo esgotado em um dos lotes. Tente retomar — o progresso até aqui foi salvo."
        : e?.response?.data?.error ??
          e?.response?.data?.detail ??
          e?.response?.data?.title ??
          e?.message ??
          "Falha ao apagar duplicados";

      toast.error(msg);
      setDeleteState((s) => ({
        ...s,
        running: false,
        deletedTotal: deletedAcc,
        batchesTotal: batchesAcc,
        error: msg,
      }));
      queryClient.invalidateQueries({ queryKey: ["contacts-duplicates"] });
    }

    // Se o laço terminou sem saltar pelo sucesso (ex.: cancelado), mantém o estado visível
    if (cancelledRef.current && lastProgress && !lastProgress.completed) {
      setDeleteState((s) => ({ ...s, running: false }));
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tenantId, ignoreTenant, totalToDelete, queryClient]);

  const handleCancel = () => {
    cancelledRef.current = true;
  };

  const progressPct =
    deleteState.expectedTotal > 0
      ? Math.min(100, Math.round((deleteState.deletedTotal / deleteState.expectedTotal) * 100))
      : 0;

  return (
    <>
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
              disabled={report.isFetching || deleteState.running}
            >
              <RefreshCw
                className={cn(
                  "mr-2 h-4 w-4",
                  report.isFetching && "animate-spin",
                )}
              />
              Recarregar
            </Button>
            <Button
              onClick={() => setConfirmOpen(true)}
              disabled={!hasDuplicates || deleteState.running}
              className="bg-rose-500/90 hover:bg-rose-500 text-white"
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
              disabled={deleteState.running}
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
                antigo vence mesmo que esteja em outro tenant.
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
                    Revisa a lista abaixo. O <b>mantido</b> é o mais antigo de
                    cada grupo. Os <b>marcados em vermelho</b> serão apagados.
                    Mostrando <b>{groups.length}</b> grupo(s) —{" "}
                    página <b>{data.page}</b> de <b>{data.totalPages}</b>.
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
                  disabled={report.isFetching || deleteState.running}
                  onChange={setPage}
                />
              </CardBody>
            </Card>
          )}
        </>
      )}

      {confirmOpen && (
        <ConfirmDialog
          total={totalToDelete}
          groups={data?.groupsFound ?? 0}
          running={deleteState.running}
          progressPct={progressPct}
          deleted={deleteState.deletedTotal}
          batches={deleteState.batchesTotal}
          error={deleteState.error}
          onCancel={() => {
            if (deleteState.running) {
              handleCancel();
            } else {
              setConfirmOpen(false);
              setDeleteState(INITIAL_DELETE);
            }
          }}
          onConfirm={runDeleteLoop}
        />
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
  // Protege a renderização contra grupos gigantes (n > 50 duplicados na mesma linha).
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
          <span className="text-[11px] text-slate-500">
            · tenant {g.tenantId}
          </span>
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
        <span className="text-[13px] text-slate-100 font-medium truncate">
          {name}
        </span>
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

function ConfirmDialog({
  total,
  groups,
  running,
  progressPct,
  deleted,
  batches,
  error,
  onCancel,
  onConfirm,
}: {
  total: number;
  groups: number;
  running: boolean;
  progressPct: number;
  deleted: number;
  batches: number;
  error: string | null;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/60 backdrop-blur-sm p-4">
      <div className="w-full max-w-md rounded-xl bg-[#0f1013] ring-1 ring-inset ring-white/[0.08] shadow-2xl overflow-hidden">
        <div className="p-5 border-b border-white/[0.05] flex items-start gap-3">
          <div className="h-10 w-10 rounded-md bg-rose-500/10 ring-1 ring-inset ring-rose-500/20 grid place-items-center shrink-0">
            <AlertTriangle className="h-5 w-5 text-rose-300" />
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="text-[15px] font-semibold text-slate-50">
              Apagar contatos duplicados?
            </h2>
            <p className="text-[12px] text-slate-400 mt-1">
              Essa ação é <b>irreversível</b>. {formatNumber(total)} contato(s)
              serão removidos em {formatNumber(groups)} grupo(s).
            </p>

            {running && (
              <div className="mt-4">
                <div className="flex items-center justify-between text-[11.5px] text-slate-300 tabular-nums mb-1.5">
                  <span>
                    {formatNumber(deleted)} / {formatNumber(total)} apagados
                    {" · "}
                    {batches} lote(s)
                  </span>
                  <span>{progressPct}%</span>
                </div>
                <div className="h-1.5 w-full rounded-full bg-white/[0.06] overflow-hidden">
                  <div
                    className="h-full bg-rose-500/80 transition-[width] duration-300"
                    style={{ width: `${progressPct}%` }}
                  />
                </div>
                <p className="text-[11px] text-amber-300 mt-2">
                  Processando em lotes de {BATCH_SIZE}. Você pode cancelar a
                  qualquer momento — o progresso até aqui é permanente.
                </p>
              </div>
            )}

            {error && (
              <p className="text-[11.5px] text-rose-300 mt-3">
                {error}
              </p>
            )}
          </div>
        </div>
        <div className="p-5 flex items-center justify-end gap-2">
          <Button variant="ghost" onClick={onCancel}>
            {running ? "Parar" : "Cancelar"}
          </Button>
          {!running && (
            <Button
              onClick={onConfirm}
              className="bg-rose-500/90 hover:bg-rose-500 text-white"
            >
              Confirmar e apagar
            </Button>
          )}
          {running && (
            <Button disabled className="bg-rose-500/60 text-white">
              <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
              Apagando...
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
