import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import {
  Phone, RefreshCw, AlertTriangle, Clock, Sparkles,
} from "lucide-react";
import { cn, formatNumber, stageLabel, truncate } from "@/lib/utils";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card, CardHeader, CardBody } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { StateBadge } from "@/components/ui/Badge";
import { webhooksService } from "@/services/webhooks";

const ARAGUAINA_CLINIC_ID = 8020;

function formatLocal(dt: string | Date) {
  const d = typeof dt === "string" ? new Date(dt) : dt;
  if (Number.isNaN(d.getTime())) return "—";
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(d);
}

function formatHour(hour: number) {
  return `${String(hour).padStart(2, "0")}h`;
}

export default function AmanheceuPage() {
  const overnight = useQuery({
    queryKey: ["overnight-araguaina"],
    queryFn: () => webhooksService.amanheceu({ clinicId: ARAGUAINA_CLINIC_ID }),
    refetchInterval: 60_000,
    refetchOnWindowFocus: true,
  });

  const data = overnight.data;
  const total = data?.total ?? 0;

  const hourBuckets = useMemo(() => {
    if (!data) return [];
    const order = [20, 21, 22, 23, 0, 1, 2, 3, 4, 5, 6];
    const byHour = new Map(data.hourBreakdown.map((b) => [b.hour, b.count]));
    return order.map((h) => ({ hour: h, count: byHour.get(h) ?? 0 }));
  }, [data]);

  const maxHour = useMemo(
    () => Math.max(1, ...hourBuckets.map((b) => b.count)),
    [hourBuckets]
  );

  return (
    <>
      <PageHeader
        title="Araguaína — madrugada"
        badge="20h → 07h"
        description={
          data
            ? `${formatLocal(data.periodStartLocal)} até ${formatLocal(data.periodEndLocal)} · ${data.unitName}`
            : "Leads capturados durante a madrugada"
        }
        actions={
          <>
            <Button
              size="sm"
              variant="outline"
              onClick={() => overnight.refetch()}
              disabled={overnight.isFetching}
            >
              <RefreshCw className={cn("h-4 w-4", overnight.isFetching && "animate-spin")} />
              Atualizar
            </Button>
            <Link to="/leads">
              <Button size="sm">
                <Sparkles className="h-4 w-4" />
                Ver todos os leads
              </Button>
            </Link>
          </>
        }
      />

      {/* ── Hero ─────────────────────────────────────────────── */}
      <div className="mb-6 rounded-2xl border border-white/8 bg-white/[0.03] px-6 py-6 md:px-8">
        <p className="text-xs font-medium text-slate-500 mb-1">
          Leads capturados essa madrugada
        </p>
        <div className="flex items-end gap-4">
          <span className="text-[52px] font-black leading-none tabular-nums text-white">
            {overnight.isLoading ? "—" : formatNumber(total)}
          </span>
          <span className="mb-2 text-sm text-slate-400">
            {total === 1 ? "novo lead" : "novos leads"} ·{" "}
            <span className="text-slate-300">{data?.unitName ?? "Araguaína"}</span>
          </span>
        </div>

        <div className="mt-4 flex flex-wrap gap-4 text-xs text-slate-400">
          <span>
            <span className="font-semibold text-slate-200">
              {formatNumber((data?.leads ?? []).filter((l) => l.phone).length)}
            </span>{" "}
            com telefone
          </span>
          <span>
            <span className="font-semibold text-slate-200">
              {data?.sourceBreakdown?.[0]?.source ?? "—"}
            </span>{" "}
            fonte principal
          </span>
          <span>
            Unidade{" "}
            <span className="font-semibold text-slate-200">
              #{data?.clinicId ?? ARAGUAINA_CLINIC_ID}
            </span>
          </span>
        </div>
      </div>

      {/* ── Gráfico + Fontes ──────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
        <Card className="lg:col-span-2">
          <CardHeader
            title="Chegadas por hora"
            subtitle="Distribuição ao longo da madrugada"
          />
          <CardBody>
            {overnight.isLoading ? (
              <div className="skeleton h-52 w-full rounded-lg" />
            ) : hourBuckets.every((b) => b.count === 0) ? (
              <EmptyState title="Nenhum lead nesse período" />
            ) : (
              <div className="flex h-52 items-end gap-1.5">
                {hourBuckets.map((b) => {
                  const pct = (b.count / maxHour) * 100;
                  const isLate = b.hour >= 5;
                  return (
                    <div key={b.hour} className="flex flex-1 flex-col items-center gap-2">
                      <div className="relative flex w-full flex-1 items-end">
                        <div
                          className={cn(
                            "w-full rounded-t transition-all duration-300",
                            isLate ? "bg-amber-400/70" : "bg-indigo-400/60"
                          )}
                          style={{ height: `${pct}%`, minHeight: b.count > 0 ? 4 : 2 }}
                        >
                          {b.count > 0 && (
                            <div className="absolute -top-5 left-1/2 -translate-x-1/2 text-[10px] font-semibold text-slate-300 tabular-nums">
                              {b.count}
                            </div>
                          )}
                        </div>
                      </div>
                      <span className="text-[10px] text-slate-500">{formatHour(b.hour)}</span>
                    </div>
                  );
                })}
              </div>
            )}
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="Fontes" subtitle="Origem dos leads" />
          <CardBody>
            {overnight.isLoading ? (
              <div className="skeleton h-52 w-full rounded-lg" />
            ) : !data?.sourceBreakdown?.length ? (
              <EmptyState title="Sem fontes detectadas" />
            ) : (
              <div className="space-y-3">
                {data.sourceBreakdown.slice(0, 6).map((s) => {
                  const pct = total > 0 ? (s.count / total) * 100 : 0;
                  return (
                    <div key={s.source}>
                      <div className="mb-1 flex items-center justify-between text-xs">
                        <span className="truncate text-slate-300">
                          {s.source.replace(/_/g, " ")}
                        </span>
                        <span className="tabular-nums text-slate-200 font-medium">
                          {s.count}{" "}
                          <span className="text-slate-500 font-normal">
                            ({pct.toFixed(0)}%)
                          </span>
                        </span>
                      </div>
                      <div className="h-1.5 overflow-hidden rounded-full bg-white/5">
                        <div
                          className="h-full rounded-full bg-indigo-400/70"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardBody>
        </Card>
      </div>

      {/* ── Lista ────────────────────────────────────────────── */}
      <Card>
        <CardHeader
          title="Leads capturados"
          subtitle="Mais recentes primeiro"
          action={
            !overnight.isLoading && (
              <span className="text-xs text-slate-500">{total} total</span>
            )
          }
        />
        <CardBody className="p-0">
          {overnight.isLoading ? (
            <div className="divide-y divide-white/5">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="flex items-center gap-3 p-4">
                  <div className="skeleton h-9 w-9 rounded-full" />
                  <div className="flex-1 space-y-2">
                    <div className="skeleton h-3 w-40" />
                    <div className="skeleton h-3 w-24" />
                  </div>
                </div>
              ))}
            </div>
          ) : !data?.leads?.length ? (
            <EmptyState
              title="Nenhum lead capturado durante a madrugada"
              icon={<AlertTriangle className="h-5 w-5 text-slate-500" />}
            />
          ) : (
            <div className="divide-y divide-white/5">
              {data.leads.map((lead) => (
                <Link
                  key={lead.id}
                  to={`/leads/${lead.id}`}
                  className="group flex items-center gap-3 p-4 transition-colors hover:bg-white/[0.03]"
                >
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white/8 text-sm font-semibold text-slate-200 ring-1 ring-white/10">
                    {(lead.name ?? "?").charAt(0).toUpperCase()}
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="truncate text-[13px] font-medium text-slate-100">
                        {truncate(lead.name || "Sem nome", 40)}
                      </p>
                      <span className="text-[11px] text-slate-500">
                        {stageLabel(lead.currentStage)}
                      </span>
                    </div>
                    <p className="mt-0.5 flex items-center gap-2 text-[11px] text-slate-400">
                      <Phone className="h-3 w-3 shrink-0" />
                      <span className="truncate">{lead.phone ?? "Sem telefone"}</span>
                      <span className="text-slate-600">·</span>
                      <span className="text-slate-400">{lead.source.replace(/_/g, " ")}</span>
                    </p>
                  </div>

                  <div className="flex shrink-0 flex-col items-end gap-1">
                    <div className="flex items-center gap-1 text-[11px] text-slate-400 tabular-nums">
                      <Clock className="h-3 w-3" />
                      {formatLocal(lead.createdAtLocal)}
                    </div>
                    <StateBadge state={lead.conversationState ?? undefined} />
                  </div>
                </Link>
              ))}
            </div>
          )}
        </CardBody>
      </Card>
    </>
  );
}