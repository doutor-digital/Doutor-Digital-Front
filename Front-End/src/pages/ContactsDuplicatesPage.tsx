import { useState } from "react";
import { Link } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
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

export default function ContactsDuplicatesPage() {
  const { tenantId } = useClinic();
  const queryClient = useQueryClient();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [ignoreTenant, setIgnoreTenant] = useState(false);

  const report = useQuery({
    queryKey: ["contacts-duplicates", tenantId, ignoreTenant],
    queryFn: () =>
      contactsService.listDuplicates({
        clinicId: tenantId ?? undefined,
        ignoreTenant,
      }),
    enabled: !!tenantId || ignoreTenant,
    retry: false,
  });

  const deleteMut = useMutation({
    mutationFn: () =>
      contactsService.deleteDuplicates({
        clinicId: tenantId ?? undefined,
        dryRun: false,
        ignoreTenant,
      }),
    onSuccess: (data) => {
      const deleted =
        "contactsDeleted" in data ? data.contactsDeleted : data.contactsToDelete;
      const seconds =
        "durationMs" in data ? Math.round(data.durationMs / 100) / 10 : null;
      const batches = "batches" in data ? data.batches : null;

      const parts = [
        `${formatNumber(deleted)} contato(s) duplicado(s) apagado(s) em ${data.groupsFound} grupo(s)`,
      ];
      if (batches !== null) parts.push(`${batches} lote(s)`);
      if (seconds !== null) parts.push(`${seconds}s`);

      toast.success(parts.join(" · "));
      queryClient.invalidateQueries({ queryKey: ["contacts-duplicates"] });
      queryClient.invalidateQueries({ queryKey: ["contacts"] });
      setConfirmOpen(false);
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
          ? "Tempo esgotado. A operação pode ainda estar rodando no servidor — aguarde alguns segundos e recarregue."
          : e?.response?.data?.error ??
              e?.response?.data?.detail ??
              e?.response?.data?.title ??
              e?.message ??
              "Falha ao apagar duplicados",
      );
      setConfirmOpen(false);
    },
  });

  const data = report.data;
  const groups = data?.groups ?? [];
  const totalToDelete = data?.contactsToDelete ?? 0;
  const hasDuplicates = totalToDelete > 0;

  return (
    <>
      <PageHeader
        title="Contatos duplicados"
        description="Contatos com mesmo telefone no mesmo tenant. O mais antigo de cada grupo é mantido."
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
              disabled={report.isFetching}
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
              disabled={!hasDuplicates || deleteMut.isPending}
              className="bg-rose-500/90 hover:bg-rose-500 text-white"
            >
              <Trash2 className="mr-2 h-4 w-4" />
              Apagar duplicados
            </Button>
          </>
        }
      />

      {/* Toggle: buscar cross-tenant */}
      <Card>
        <CardBody className="py-3">
          <label className="flex items-start gap-3 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={ignoreTenant}
              onChange={(e) => setIgnoreTenant(e.target.checked)}
              className="mt-0.5 h-4 w-4 rounded accent-brand-500"
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
                Útil quando a migração de banco duplicou contatos em tenants
                diferentes. <span className="text-amber-300">Cuidado:</span> ao
                apagar, o mais antigo vence mesmo que esteja em outro tenant.
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
                  description={`Todos os contatos deste tenant têm telefones únicos.`}
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
                    cada grupo (mesmo telefone / tenant). Os{" "}
                    <b>marcados em vermelho</b> serão apagados quando você
                    clicar em <i>Apagar duplicados</i>.
                  </p>
                </div>
                <ul className="divide-y divide-white/[0.05]">
                  {groups.map((g) => (
                    <li key={`${g.tenantId}-${g.phoneNormalized}`} className="p-4">
                      <div className="flex items-center justify-between gap-3 flex-wrap">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-[13px] tabular-nums text-slate-200">
                            {g.phoneNormalized}
                          </span>
                          <button
                            onClick={() =>
                              navigator.clipboard.writeText(g.phoneNormalized)
                            }
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
                        {g.deleteContactIds.map((id) => (
                          <DeleteRow key={id} id={id} />
                        ))}
                      </div>
                    </li>
                  ))}
                </ul>
              </CardBody>
            </Card>
          )}
        </>
      )}

      {confirmOpen && (
        <ConfirmDialog
          total={totalToDelete}
          groups={data?.groupsFound ?? 0}
          pending={deleteMut.isPending}
          onCancel={() => setConfirmOpen(false)}
          onConfirm={() => deleteMut.mutate()}
        />
      )}
    </>
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
    amber: {
      bg: "bg-amber-500/8",
      ring: "ring-amber-500/20",
      text: "text-amber-300",
      val: "text-amber-100",
    },
    rose: {
      bg: "bg-rose-500/8",
      ring: "ring-rose-500/20",
      text: "text-rose-300",
      val: "text-rose-100",
    },
    emerald: {
      bg: "bg-emerald-500/8",
      ring: "ring-emerald-500/20",
      text: "text-emerald-300",
      val: "text-emerald-100",
    },
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

function KeepRow({
  id,
  name,
  createdAt,
}: {
  id: number;
  name: string;
  createdAt: string;
}) {
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
  pending,
  onCancel,
  onConfirm,
}: {
  total: number;
  groups: number;
  pending: boolean;
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
          <div>
            <h2 className="text-[15px] font-semibold text-slate-50">
              Apagar contatos duplicados?
            </h2>
            <p className="text-[12px] text-slate-400 mt-1">
              Essa ação é <b>irreversível</b>. {formatNumber(total)} contato(s)
              serão removidos em {formatNumber(groups)} grupo(s) — o mais antigo
              de cada grupo permanece.
            </p>
            {pending && (
              <p className="text-[11.5px] text-amber-300 mt-2">
                Apagando em lotes de 1000 — pode levar até ~1 minuto para
                volumes grandes. Não feche a aba.
              </p>
            )}
          </div>
        </div>
        <div className="p-5 flex items-center justify-end gap-2">
          <Button variant="ghost" onClick={onCancel} disabled={pending}>
            Cancelar
          </Button>
          <Button
            onClick={onConfirm}
            disabled={pending}
            className="bg-rose-500/90 hover:bg-rose-500 text-white"
          >
            {pending ? (
              <>
                <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                Apagando...
              </>
            ) : (
              "Confirmar e apagar"
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
