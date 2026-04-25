import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import {
  Building2,
  ChevronDown,
  Phone,
  RefreshCw,
  AlertTriangle,
  Clock,
  Sparkles,
  Search,
  Check,
} from "lucide-react";
import { cn, formatNumber, stageLabel, truncate } from "@/lib/utils";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card, CardHeader, CardBody } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { StateBadge } from "@/components/ui/Badge";
import { webhooksService } from "@/services/webhooks";
import { unitsService } from "@/services/units";
import { useClinic } from "@/hooks/useClinic";
import type { Unit } from "@/types";

const FALLBACK_CLINIC_ID = 8020;

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

function unitClinicId(u: Unit): number {
  return typeof u.clinicId === "number" ? u.clinicId : Number(u.clinicId);
}

function unitLabel(u: Unit): string {
  return (u.name?.trim() && u.name.trim()) || `Unidade ${unitClinicId(u)}`;
}

// ── Unit selector ─────────────────────────────────────────────────────────────
function UnitSelector({
  units,
  loading,
  selected,
  onSelect,
}: {
  units: Unit[];
  loading: boolean;
  selected: number | null;
  onSelect: (clinicId: number) => void;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const selectedUnit = useMemo(
    () => units.find((u) => unitClinicId(u) === selected),
    [units, selected],
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return units;
    return units.filter((u) => {
      const haystack = `${unitLabel(u)} ${unitClinicId(u)}`.toLowerCase();
      return haystack.includes(q);
    });
  }, [units, query]);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        disabled={loading}
        className={cn(
          "inline-flex items-center gap-2 rounded-md border border-white/[0.08] bg-white/[0.03]",
          "px-3 py-2 text-[12.5px] font-medium text-slate-200 transition",
          "hover:border-white/[0.14] hover:bg-white/[0.05]",
          "disabled:cursor-not-allowed disabled:opacity-60",
        )}
      >
        <Building2 className="h-4 w-4 text-emerald-300" />
        <span className="max-w-[180px] truncate">
          {loading
            ? "Carregando unidades…"
            : selectedUnit
              ? unitLabel(selectedUnit)
              : "Selecionar unidade"}
        </span>
        {selectedUnit && (
          <span className="rounded bg-white/[0.05] px-1.5 py-0.5 font-mono text-[10px] text-slate-400">
            #{unitClinicId(selectedUnit)}
          </span>
        )}
        <ChevronDown
          className={cn(
            "h-3.5 w-3.5 text-slate-400 transition-transform",
            open && "rotate-180",
          )}
        />
      </button>

      {open && (
        <div
          className={cn(
            "absolute right-0 z-30 mt-2 w-[280px] overflow-hidden rounded-lg",
            "border border-white/[0.08] bg-[#0c0c10] shadow-xl",
            "ring-1 ring-inset ring-white/[0.04]",
          )}
        >
          <div className="flex items-center gap-2 border-b border-white/[0.05] px-3 py-2">
            <Search className="h-3.5 w-3.5 text-slate-500" />
            <input
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar unidade…"
              className="w-full bg-transparent text-[12.5px] text-slate-200 placeholder:text-slate-600 focus:outline-none"
            />
          </div>
          <div className="max-h-[280px] overflow-y-auto py-1">
            {filtered.length === 0 ? (
              <p className="px-3 py-3 text-center text-[12px] text-slate-500">
                Nenhuma unidade
              </p>
            ) : (
              filtered.map((u) => {
                const id = unitClinicId(u);
                const active = id === selected;
                return (
                  <button
                    key={`${u.id}-${id}`}
                    type="button"
                    onClick={() => {
                      onSelect(id);
                      setOpen(false);
                      setQuery("");
                    }}
                    className={cn(
                      "flex w-full items-center gap-3 px-3 py-2 text-left text-[12.5px] transition",
                      active
                        ? "bg-emerald-400/10 text-slate-50"
                        : "text-slate-300 hover:bg-white/[0.03]",
                    )}
                  >
                    <div
                      className={cn(
                        "grid h-7 w-7 shrink-0 place-items-center rounded-md",
                        active
                          ? "bg-emerald-400/15 text-emerald-300 ring-1 ring-emerald-400/30"
                          : "bg-white/[0.04] text-slate-400",
                      )}
                    >
                      <Building2 className="h-3.5 w-3.5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium">{unitLabel(u)}</p>
                      <p className="font-mono text-[10px] text-slate-500">
                        Clinic ID #{id}
                        {typeof u.leadsCount === "number" && (
                          <>
                            <span className="mx-1.5 text-slate-700">·</span>
                            {formatNumber(u.leadsCount)} leads
                          </>
                        )}
                      </p>
                    </div>
                    {active && <Check className="h-3.5 w-3.5 text-emerald-300" />}
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────
export default function AmanheceuPage() {
  const { tenantId } = useClinic();

  const unitsQ = useQuery({
    queryKey: ["units"],
    queryFn: () => unitsService.list(),
    staleTime: 60_000,
  });

  const units = unitsQ.data ?? [];

  const [selectedClinicId, setSelectedClinicId] = useState<number | null>(null);

  // Initial selection: persisted clinic → first available unit → fallback.
  useEffect(() => {
    if (selectedClinicId !== null) return;
    if (tenantId) {
      setSelectedClinicId(tenantId);
      return;
    }
    if (units.length > 0) {
      setSelectedClinicId(unitClinicId(units[0]));
      return;
    }
    if (!unitsQ.isLoading) {
      setSelectedClinicId(FALLBACK_CLINIC_ID);
    }
  }, [tenantId, units, unitsQ.isLoading, selectedClinicId]);

  const overnight = useQuery({
    queryKey: ["overnight", selectedClinicId],
    queryFn: () =>
      webhooksService.amanheceu({ clinicId: selectedClinicId ?? undefined }),
    enabled: selectedClinicId !== null,
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
    [hourBuckets],
  );

  const headerDescription = data
    ? `${formatLocal(data.periodStartLocal)} até ${formatLocal(data.periodEndLocal)} · ${data.unitName}`
    : "Leads capturados durante a madrugada — selecione a unidade";

  return (
    <>
      <PageHeader
        title="Amanheceu — madrugada"
        badge="20h → 07h"
        description={headerDescription}
        actions={
          <>
            <UnitSelector
              units={units}
              loading={unitsQ.isLoading}
              selected={selectedClinicId}
              onSelect={(id) => setSelectedClinicId(id)}
            />
            <Button
              size="sm"
              variant="outline"
              onClick={() => overnight.refetch()}
              disabled={overnight.isFetching || selectedClinicId === null}
            >
              <RefreshCw
                className={cn("h-4 w-4", overnight.isFetching && "animate-spin")}
              />
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
        <p className="mb-1 text-xs font-medium text-slate-500">
          Leads capturados essa madrugada
        </p>
        <div className="flex items-end gap-4">
          <span className="text-[52px] font-black leading-none tabular-nums text-white">
            {overnight.isLoading || selectedClinicId === null
              ? "—"
              : formatNumber(total)}
          </span>
          <span className="mb-2 text-sm text-slate-400">
            {total === 1 ? "novo lead" : "novos leads"} ·{" "}
            <span className="text-slate-300">
              {data?.unitName ?? "Selecione uma unidade"}
            </span>
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
              #{data?.clinicId ?? selectedClinicId ?? "—"}
            </span>
          </span>
        </div>
      </div>

      {/* ── Gráfico + Fontes ──────────────────────────────────── */}
      <div className="mb-6 grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader
            title="Chegadas por hora"
            subtitle="Distribuição ao longo da madrugada"
          />
          <CardBody>
            {overnight.isLoading || selectedClinicId === null ? (
              <div className="skeleton h-52 w-full rounded-lg" />
            ) : hourBuckets.every((b) => b.count === 0) ? (
              <EmptyState title="Nenhum lead nesse período" />
            ) : (
              <div className="flex h-52 items-end gap-1.5">
                {hourBuckets.map((b) => {
                  const pct = (b.count / maxHour) * 100;
                  const isLate = b.hour >= 5;
                  return (
                    <div
                      key={b.hour}
                      className="flex flex-1 flex-col items-center gap-2"
                    >
                      <div className="relative flex w-full flex-1 items-end">
                        <div
                          className={cn(
                            "w-full rounded-t transition-all duration-300",
                            isLate ? "bg-amber-400/70" : "bg-indigo-400/60",
                          )}
                          style={{
                            height: `${pct}%`,
                            minHeight: b.count > 0 ? 4 : 2,
                          }}
                        >
                          {b.count > 0 && (
                            <div className="absolute -top-5 left-1/2 -translate-x-1/2 text-[10px] font-semibold tabular-nums text-slate-300">
                              {b.count}
                            </div>
                          )}
                        </div>
                      </div>
                      <span className="text-[10px] text-slate-500">
                        {formatHour(b.hour)}
                      </span>
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
            {overnight.isLoading || selectedClinicId === null ? (
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
                        <span className="font-medium tabular-nums text-slate-200">
                          {s.count}{" "}
                          <span className="font-normal text-slate-500">
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
            !overnight.isLoading &&
            selectedClinicId !== null && (
              <span className="text-xs text-slate-500">{total} total</span>
            )
          }
        />
        <CardBody className="p-0">
          {overnight.isLoading || selectedClinicId === null ? (
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
                      <span className="truncate">
                        {lead.phone ?? "Sem telefone"}
                      </span>
                      <span className="text-slate-600">·</span>
                      <span className="text-slate-400">
                        {lead.source.replace(/_/g, " ")}
                      </span>
                    </p>
                  </div>

                  <div className="flex shrink-0 flex-col items-end gap-1">
                    <div className="flex items-center gap-1 text-[11px] tabular-nums text-slate-400">
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
