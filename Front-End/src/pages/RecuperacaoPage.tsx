import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Phone as PhoneIcon, Building2, Target, RefreshCw, LifeBuoy } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card, CardBody } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { webhooksService } from "@/services/webhooks";
import { useClinic } from "@/hooks/useClinic";
import { cn, formatDate, formatNumber } from "@/lib/utils";

export default function RecuperacaoPage() {
  const { tenantId, unitId } = useClinic();
  const clinicId = tenantId ?? undefined;

  const query = useQuery({
    queryKey: ["recovery-queue", clinicId, unitId],
    queryFn: () =>
      webhooksService.recoveryQueue({
        clinicId,
        unitId: unitId ?? undefined,
      }),
    enabled: !!clinicId,
    placeholderData: (prev) => prev,
  });

  const items = query.data ?? [];

  return (
    <>
      <PageHeader
        title="Fila de recuperação"
        description="Leads que compareceram à consulta mas não fecharam tratamento (08_NAO_FECHOU_TRATAMENTO). Ação comercial recomendada: resgate."
        actions={
          <div className="flex gap-2">
            <Link to="/">
              <Button variant="outline" size="sm">
                <ArrowLeft className="mr-2 h-4 w-4" />
                Voltar
              </Button>
            </Link>
            <Button
              size="sm"
              variant="outline"
              onClick={() => query.refetch()}
              disabled={query.isFetching}
            >
              <RefreshCw className={cn("mr-2 h-4 w-4", query.isFetching && "animate-spin")} />
              Atualizar
            </Button>
          </div>
        }
      />

      <Card className="mt-4">
        <CardBody>
          <div className="mb-3 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-[12px] text-slate-400">
              <LifeBuoy className="h-3.5 w-3.5 text-amber-300" />
              <span className="font-medium text-slate-200">{formatNumber(items.length)}</span>
              <span>oportunidade(s) de recuperação</span>
            </div>
          </div>

          {query.isLoading ? (
            <div className="space-y-2">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="h-14 animate-pulse rounded-md bg-white/[0.02]" />
              ))}
            </div>
          ) : items.length === 0 ? (
            <EmptyState
              title="Sem leads na fila de recuperação"
              description="Nenhum lead em 08_NAO_FECHOU_TRATAMENTO no período."
            />
          ) : (
            <ul className="divide-y divide-white/[0.05]">
              {items.map((it) => (
                <li
                  key={it.id}
                  className="flex flex-col gap-2 px-2 py-3 transition hover:bg-white/[0.02] sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="min-w-0 flex-1">
                    <Link
                      to={`/leads/${it.id}`}
                      className="text-[13px] font-semibold text-slate-100 hover:text-emerald-300"
                    >
                      {it.name || `Lead #${it.id}`}
                    </Link>
                    <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-slate-500">
                      {it.phone && (
                        <span className="inline-flex items-center gap-1 font-mono tabular-nums">
                          <PhoneIcon className="h-3 w-3" />
                          {it.phone}
                        </span>
                      )}
                      {it.unitName && (
                        <span className="inline-flex items-center gap-1">
                          <Building2 className="h-3 w-3" />
                          {it.unitName}
                        </span>
                      )}
                      {it.source && (
                        <span className="inline-flex items-center gap-1">
                          <Target className="h-3 w-3" />
                          {it.source}
                          {it.campaign ? ` · ${it.campaign}` : ""}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="text-right text-[10.5px] tabular-nums text-slate-500">
                    <div>Compareceu: {it.attendanceStatusAt ? formatDate(it.attendanceStatusAt) : "—"}</div>
                    <div>Atualizado: {formatDate(it.updatedAt)}</div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardBody>
      </Card>
    </>
  );
}
