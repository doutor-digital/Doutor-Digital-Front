import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowLeft,
  Building2,
  Calendar,
  CalendarCheck,
  CheckCircle2,
  RefreshCw,
  Target,
  UserCog,
} from "@/components/icons";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card, CardBody } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { EmptyState } from "@/components/ui/EmptyState";
import { webhooksService } from "@/services/webhooks";
import { assignmentsService } from "@/services/assignments";
import { unitsService } from "@/services/units";
import { useClinic } from "@/hooks/useClinic";
import { cn, formatDate, formatCurrency, formatNumber } from "@/lib/utils";

type Kind = "scheduled" | "attended";

interface Props {
  kind: Kind;
}

interface Filters {
  dateFrom: string;
  dateTo: string;
  unitId: string;
  attendantId: string;
  source: string;
}

function today() {
  return new Date().toISOString().slice(0, 10);
}
function offsetDay(n: number) {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
}

function defaultFilters(): Filters {
  return {
    dateFrom: offsetDay(-29),
    dateTo: today(),
    unitId: "",
    attendantId: "",
    source: "",
  };
}

const COPY: Record<Kind, { title: string; description: string; icon: React.ReactNode; empty: string; tone: string }> = {
  scheduled: {
    title: "Consultas agendadas",
    description: "Leads que têm consulta agendada no período selecionado.",
    icon: <CalendarCheck className="h-4 w-4 text-amber-300" />,
    empty: "Nenhuma consulta agendada nesse período.",
    tone: "amber",
  },
  attended: {
    title: "Compareceram",
    description: "Leads que compareceram à consulta no período selecionado.",
    icon: <CheckCircle2 className="h-4 w-4 text-emerald-300" />,
    empty: "Ninguém compareceu nesse período.",
    tone: "emerald",
  },
};

export default function DashboardLeadListPage({ kind }: Props) {
  const { tenantId } = useClinic();
  const [filters, setFilters] = useState<Filters>(defaultFilters);
  const copy = COPY[kind];

  const unitsQ = useQuery({
    queryKey: ["units"],
    queryFn: () => unitsService.list(),
    staleTime: 60_000,
  });
  const attendantsQ = useQuery({
    queryKey: ["attendants"],
    queryFn: () => assignmentsService.listAttendants(),
    staleTime: 60_000,
  });
  const sourcesQ = useQuery({
    queryKey: ["sources", tenantId, filters.unitId],
    queryFn: () =>
      webhooksService.distinctSources({
        clinicId: tenantId ?? undefined,
        unitId: filters.unitId ? Number(filters.unitId) : undefined,
      }),
    enabled: !!tenantId,
    staleTime: 60_000,
  });

  const listQ = useQuery({
    queryKey: [
      "dashboard-leads",
      kind,
      tenantId,
      filters.dateFrom,
      filters.dateTo,
      filters.unitId,
      filters.attendantId,
      filters.source,
    ],
    queryFn: () => {
      const params = {
        clinicId: tenantId ?? undefined,
        dateFrom: filters.dateFrom,
        dateTo: filters.dateTo,
        unitId: filters.unitId ? Number(filters.unitId) : undefined,
        attendantId: filters.attendantId ? Number(filters.attendantId) : undefined,
        source: filters.source || undefined,
      };
      return kind === "scheduled"
        ? webhooksService.dashboardScheduledLeads(params)
        : webhooksService.dashboardAttendedLeads(params);
    },
    enabled: !!tenantId,
    placeholderData: (prev) => prev,
  });

  const items = listQ.data ?? [];
  const totalValue = useMemo(
    () =>
      items.reduce(
        (acc, x) => acc + (typeof x.consultationValue === "number" ? x.consultationValue : 0),
        0,
      ),
    [items],
  );

  return (
    <>
      <PageHeader
        title={copy.title}
        description={copy.description}
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
              onClick={() => listQ.refetch()}
              disabled={listQ.isFetching}
            >
              <RefreshCw className={cn("mr-2 h-4 w-4", listQ.isFetching && "animate-spin")} />
              Atualizar
            </Button>
          </div>
        }
      />

      {/* Filtros */}
      <Card className="mt-4">
        <CardBody>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
            <label className="block">
              <span className="mb-1 block text-[10.5px] font-medium uppercase tracking-[0.14em] text-slate-500">
                De
              </span>
              <Input
                type="date"
                icon={<Calendar className="h-3.5 w-3.5" />}
                value={filters.dateFrom}
                max={filters.dateTo || undefined}
                onChange={(e) => setFilters((p) => ({ ...p, dateFrom: e.target.value }))}
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-[10.5px] font-medium uppercase tracking-[0.14em] text-slate-500">
                Até
              </span>
              <Input
                type="date"
                icon={<Calendar className="h-3.5 w-3.5" />}
                value={filters.dateTo}
                min={filters.dateFrom || undefined}
                onChange={(e) => setFilters((p) => ({ ...p, dateTo: e.target.value }))}
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-[10.5px] font-medium uppercase tracking-[0.14em] text-slate-500">
                Unidade
              </span>
              <Select
                value={filters.unitId}
                onChange={(e) => setFilters((p) => ({ ...p, unitId: e.target.value }))}
              >
                <option value="">Todas</option>
                {(unitsQ.data ?? []).map((u) => (
                  <option key={u.id} value={String(u.id)}>
                    {u.name || `Unidade ${u.id}`}
                  </option>
                ))}
              </Select>
            </label>
            <label className="block">
              <span className="mb-1 block text-[10.5px] font-medium uppercase tracking-[0.14em] text-slate-500">
                Atendente
              </span>
              <Select
                value={filters.attendantId}
                onChange={(e) =>
                  setFilters((p) => ({ ...p, attendantId: e.target.value }))
                }
              >
                <option value="">Todos</option>
                {(attendantsQ.data ?? []).map((a) => (
                  <option key={a.id} value={String(a.id)}>
                    {a.name || a.email || `Atendente ${a.id}`}
                  </option>
                ))}
              </Select>
            </label>
            <label className="block">
              <span className="mb-1 block text-[10.5px] font-medium uppercase tracking-[0.14em] text-slate-500">
                Origem
              </span>
              <Select
                value={filters.source}
                onChange={(e) => setFilters((p) => ({ ...p, source: e.target.value }))}
              >
                <option value="">Todas</option>
                {(sourcesQ.data ?? []).map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </Select>
            </label>
          </div>
        </CardBody>
      </Card>

      {/* Lista */}
      <Card className="mt-4">
        <CardBody>
          <div className="mb-3 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-[12px] text-slate-400">
              {copy.icon}
              <span className="font-medium text-slate-200">{formatNumber(items.length)}</span>
              <span>lead(s)</span>
              {kind === "attended" && totalValue > 0 && (
                <span className="ml-3 text-slate-500">
                  · {formatCurrency(totalValue)} em consultas
                </span>
              )}
            </div>
          </div>

          {listQ.isLoading ? (
            <div className="space-y-2">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="h-14 animate-pulse rounded-md bg-white/[0.02]" />
              ))}
            </div>
          ) : items.length === 0 ? (
            <EmptyState title={copy.title} description={copy.empty} />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-[12.5px]">
                <thead>
                  <tr className="border-b border-white/[0.05] text-left text-[10.5px] font-medium uppercase tracking-[0.12em] text-slate-500">
                    <th className="py-2 pr-3">Lead</th>
                    <th className="py-2 pr-3">Unidade</th>
                    <th className="py-2 pr-3">Atendente</th>
                    <th className="py-2 pr-3">Origem</th>
                    <th className="py-2 pr-3">
                      {kind === "scheduled" ? "Agendamento" : "Comparecimento"}
                    </th>
                    {kind === "attended" && <th className="py-2 pr-3 text-right">Valor</th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/[0.04]">
                  {items.map((l) => (
                    <tr key={l.id} className="transition hover:bg-white/[0.02]">
                      <td className="py-2.5 pr-3">
                        <Link
                          to={`/leads/${l.id}`}
                          className="font-medium text-slate-100 hover:text-emerald-300"
                        >
                          {l.name || `Lead #${l.id}`}
                        </Link>
                        {l.phone && (
                          <div className="text-[10.5px] tabular-nums text-slate-500">
                            {l.phone}
                          </div>
                        )}
                      </td>
                      <td className="py-2.5 pr-3 text-slate-300">
                        {l.unitName ? (
                          <span className="inline-flex items-center gap-1">
                            <Building2 className="h-3 w-3 text-slate-500" />
                            {l.unitName}
                          </span>
                        ) : (
                          <span className="text-slate-600">—</span>
                        )}
                      </td>
                      <td className="py-2.5 pr-3 text-slate-300">
                        {l.attendantName ? (
                          <span className="inline-flex items-center gap-1">
                            <UserCog className="h-3 w-3 text-slate-500" />
                            {l.attendantName}
                          </span>
                        ) : (
                          <span className="text-slate-600">—</span>
                        )}
                      </td>
                      <td className="py-2.5 pr-3 text-slate-300">
                        {l.source ? (
                          <span className="inline-flex items-center gap-1">
                            <Target className="h-3 w-3 text-slate-500" />
                            {l.source}
                          </span>
                        ) : (
                          <span className="text-slate-600">—</span>
                        )}
                      </td>
                      <td className="py-2.5 pr-3 text-[11.5px] tabular-nums text-slate-400">
                        {kind === "scheduled"
                          ? l.appointmentScheduledAt
                            ? formatDate(l.appointmentScheduledAt)
                            : "—"
                          : l.attendanceStatusAt
                          ? formatDate(l.attendanceStatusAt)
                          : "—"}
                      </td>
                      {kind === "attended" && (
                        <td className="py-2.5 pr-3 text-right tabular-nums text-slate-200">
                          {l.consultationValue != null
                            ? formatCurrency(l.consultationValue)
                            : "—"}
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardBody>
      </Card>
    </>
  );
}
