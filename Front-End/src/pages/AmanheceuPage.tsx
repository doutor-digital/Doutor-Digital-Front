import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import {
  Moon, Sunrise, Phone, Sparkles, MapPin, Clock, Flame,
  TrendingUp, AlertTriangle, RefreshCw,
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

function greetingByHour(h: number) {
  if (h < 6) return "Madrugada";
  if (h < 12) return "Amanhecer";
  if (h < 18) return "Tarde";
  return "Noite";
}

export default function AmanheceuPage() {
  const overnight = useQuery({
    queryKey: ["overnight-araguaina"],
    queryFn: () => webhooksService.amanheceu({ clinicId: ARAGUAINA_CLINIC_ID }),
    refetchInterval: 60_000,
    refetchOnWindowFocus: true,
  });

  const data = overnight.data;
  const now = new Date();

  const hourBuckets = useMemo(() => {
    if (!data) return [];
    // Ordena 20, 21, 22, 23, 00, 01, ... 06
    const order = [20, 21, 22, 23, 0, 1, 2, 3, 4, 5, 6];
    const byHour = new Map(data.hourBreakdown.map((b) => [b.hour, b.count]));
    return order.map((h) => ({ hour: h, count: byHour.get(h) ?? 0 }));
  }, [data]);

  const maxHour = useMemo(
    () => Math.max(1, ...hourBuckets.map((b) => b.count)),
    [hourBuckets]
  );

  const total = data?.total ?? 0;

  return (
    <>
      <PageHeader
        title="Araguaína amanheceu"
        badge="Madrugada · 20h → 07h"
        backgroundImage="https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=1600&q=70"
        description={
          data
            ? `De ${formatLocal(data.periodStartLocal)} até ${formatLocal(data.periodEndLocal)} · ${data.unitName}`
            : "Leads capturados durante a madrugada da unidade de Araguaína"
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

      {/* ══ HERO anunciando o total ══════════════════════════════ */}
      <div
        className={cn(
          "relative mb-6 overflow-hidden rounded-3xl",
          "border border-indigo-500/20",
          "bg-gradient-to-br from-[#0b0c23] via-[#0d0b2a] to-[#140b22]",
          "shadow-[0_10px_40px_rgba(79,70,229,0.18),inset_0_1px_0_rgba(255,255,255,0.05)]",
          "px-6 py-7 md:px-10 md:py-9"
        )}
      >
        {/* Estrelinhas de fundo */}
        <div aria-hidden className="pointer-events-none absolute inset-0">
          <div className="absolute top-6 left-[8%] h-1 w-1 rounded-full bg-white/60 animate-pulse" />
          <div className="absolute top-14 left-[22%] h-[2px] w-[2px] rounded-full bg-white/70" />
          <div className="absolute top-24 left-[40%] h-1 w-1 rounded-full bg-white/50 animate-pulse" />
          <div className="absolute top-10 right-[14%] h-[2px] w-[2px] rounded-full bg-white/70" />
          <div className="absolute top-24 right-[30%] h-1 w-1 rounded-full bg-white/50 animate-pulse" />
          <div className="absolute bottom-12 left-[30%] h-[2px] w-[2px] rounded-full bg-white/60" />
          <div className="absolute bottom-8 right-[18%] h-1 w-1 rounded-full bg-white/50 animate-pulse" />
          <div className="absolute -right-16 -top-16 h-64 w-64 rounded-full bg-indigo-500/15 blur-3xl" />
          <div className="absolute -left-10 -bottom-10 h-48 w-48 rounded-full bg-violet-500/15 blur-3xl" />
        </div>

        <div className="relative flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
          {/* Texto principal */}
          <div className="flex-1">
            <div className="mb-3 flex items-center gap-2">
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-500/15 ring-1 ring-indigo-400/30">
                <Moon className="h-4.5 w-4.5 text-indigo-300" />
              </span>
              <span className="text-[11px] font-bold uppercase tracking-[0.18em] text-indigo-300/80">
                {greetingByHour(now.getHours())} · Tempo real
              </span>
            </div>

            <h2 className="text-[28px] md:text-[36px] font-extrabold leading-tight tracking-tight text-white">
              Araguaína amanheceu com{" "}
              <span
                className={cn(
                  "relative mx-1 inline-block px-2",
                  "bg-gradient-to-r from-amber-300 via-orange-300 to-rose-300 bg-clip-text text-transparent",
                  "drop-shadow-[0_0_14px_rgba(251,191,36,0.35)]"
                )}
              >
                {overnight.isLoading ? "…" : formatNumber(total)}
              </span>
              {" "}lead{total === 1 ? "" : "s"} novos ✨
            </h2>

            <p className="mt-2 max-w-xl text-[13px] leading-6 text-slate-400">
              Contagem consolidada da unidade{" "}
              <span className="text-slate-200 font-semibold">{data?.unitName ?? "Araguaína"}</span>{" "}
              entre as{" "}
              <span className="text-amber-300 font-semibold">{formatHour(data?.startHour ?? 20)}</span>
              {" "}de ontem e as{" "}
              <span className="text-amber-300 font-semibold">{formatHour(data?.endHour ?? 7)}</span>
              {" "}de hoje.
            </p>

            {/* Mini stats */}
            <div className="mt-5 flex flex-wrap gap-2">
              <StatPill
                icon={<Flame className="h-3.5 w-3.5" />}
                label="Total madrugada"
                value={formatNumber(total)}
                tone="amber"
              />
              <StatPill
                icon={<Phone className="h-3.5 w-3.5" />}
                label="Com telefone"
                value={formatNumber(
                  (data?.leads ?? []).filter((l) => l.phone).length
                )}
                tone="emerald"
              />
              <StatPill
                icon={<TrendingUp className="h-3.5 w-3.5" />}
                label="Fonte #1"
                value={data?.sourceBreakdown?.[0]?.source ?? "—"}
                tone="violet"
              />
              <StatPill
                icon={<MapPin className="h-3.5 w-3.5" />}
                label="Unidade"
                value={`#${data?.clinicId ?? ARAGUAINA_CLINIC_ID}`}
                tone="indigo"
              />
            </div>
          </div>

          {/* Contador gigante */}
          <div className="shrink-0">
            <div
              className={cn(
                "relative flex h-40 w-40 items-center justify-center rounded-full",
                "bg-gradient-to-br from-amber-400/20 via-rose-500/10 to-indigo-500/20",
                "ring-1 ring-white/10",
                "shadow-[inset_0_2px_30px_rgba(255,255,255,0.06),0_12px_40px_rgba(251,191,36,0.15)]"
              )}
            >
              <div aria-hidden className="absolute inset-0 rounded-full bg-gradient-to-br from-amber-300/15 to-transparent blur-xl" />
              <Sunrise className="absolute top-3 h-5 w-5 text-amber-300/80" />
              <div className="text-center">
                <div className="text-[13px] uppercase tracking-[0.14em] text-amber-200/80 font-semibold">
                  novos
                </div>
                <div className="text-[52px] font-black leading-none text-white tabular-nums">
                  {overnight.isLoading ? "…" : formatNumber(total)}
                </div>
                <div className="text-[11px] uppercase tracking-widest text-slate-400 mt-1">
                  leads
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ══ Distribuição por hora + Fontes ════════════════════════ */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
        <Card className="lg:col-span-2">
          <CardHeader
            title="Chegadas por hora"
            subtitle="Como os leads caíram durante a madrugada"
          />
          <CardBody>
            {overnight.isLoading ? (
              <div className="skeleton h-56 w-full rounded-lg" />
            ) : hourBuckets.every((b) => b.count === 0) ? (
              <EmptyState
                title="Nenhum lead durante a madrugada"
                icon={<Moon className="h-5 w-5 text-indigo-300" />}
              />
            ) : (
              <div className="flex h-56 items-end gap-2">
                {hourBuckets.map((b) => {
                  const pct = (b.count / maxHour) * 100;
                  const isDawn = b.hour >= 5 && b.hour <= 6;
                  const isDeep = b.hour >= 1 && b.hour <= 4;
                  return (
                    <div key={b.hour} className="flex flex-1 flex-col items-center gap-2">
                      <div className="relative flex w-full flex-1 items-end">
                        <div
                          className={cn(
                            "relative w-full rounded-t-lg transition-all duration-500",
                            isDawn
                              ? "bg-gradient-to-t from-amber-500/70 via-orange-400/80 to-rose-300"
                              : isDeep
                                ? "bg-gradient-to-t from-indigo-700/70 via-indigo-500/80 to-violet-400"
                                : "bg-gradient-to-t from-indigo-600/70 via-violet-500/80 to-fuchsia-400"
                          )}
                          style={{ height: `${pct}%`, minHeight: b.count > 0 ? 6 : 2 }}
                        >
                          {b.count > 0 && (
                            <div className="absolute -top-5 left-1/2 -translate-x-1/2 text-[10px] font-bold text-slate-100 tabular-nums">
                              {b.count}
                            </div>
                          )}
                        </div>
                      </div>
                      <span className="text-[10px] font-semibold text-slate-500">
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
          <CardHeader
            title="Top fontes"
            subtitle="De onde vieram esses leads"
          />
          <CardBody>
            {overnight.isLoading ? (
              <div className="skeleton h-56 w-full rounded-lg" />
            ) : !data?.sourceBreakdown?.length ? (
              <EmptyState title="Sem fontes detectadas" />
            ) : (
              <div className="space-y-3">
                {data.sourceBreakdown.slice(0, 6).map((s) => {
                  const pct = total > 0 ? (s.count / total) * 100 : 0;
                  return (
                    <div key={s.source}>
                      <div className="mb-1 flex items-center justify-between text-xs">
                        <span className="truncate text-slate-300 font-medium">
                          {s.source.replace(/_/g, " ")}
                        </span>
                        <span className="tabular-nums font-semibold text-slate-100">
                          {s.count}{" "}
                          <span className="text-slate-500 font-normal">
                            ({pct.toFixed(0)}%)
                          </span>
                        </span>
                      </div>
                      <div className="h-2 overflow-hidden rounded-full bg-white/5">
                        <div
                          className="h-full rounded-full bg-gradient-to-r from-indigo-400 via-violet-400 to-fuchsia-400"
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

      {/* ══ Lista dos leads ═══════════════════════════════════════ */}
      <Card>
        <CardHeader
          title="Leads capturados"
          subtitle="Ordenados por horário (mais recentes primeiro)"
          action={
            <span className="rounded-full bg-indigo-500/15 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.14em] text-indigo-300 ring-1 ring-indigo-500/25">
              {overnight.isLoading ? "…" : `${total} total`}
            </span>
          }
        />
        <CardBody className="p-0">
          {overnight.isLoading ? (
            <div className="divide-y divide-white/5">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="flex items-center gap-3 p-4">
                  <div className="skeleton h-10 w-10 rounded-full" />
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
              icon={<AlertTriangle className="h-5 w-5 text-amber-400" />}
            />
          ) : (
            <div className="divide-y divide-white/5">
              {data.leads.map((lead) => (
                <Link
                  key={lead.id}
                  to={`/leads/${lead.id}`}
                  className="group/row flex items-center gap-3 p-4 transition-colors hover:bg-white/[0.04]"
                >
                  <div
                    className={cn(
                      "flex h-10 w-10 shrink-0 items-center justify-center rounded-full",
                      "bg-gradient-to-br from-indigo-400 via-violet-500 to-fuchsia-500",
                      "text-sm font-bold text-white",
                      "ring-1 ring-white/10 shadow-lg shadow-violet-500/20"
                    )}
                  >
                    {(lead.name ?? "?").charAt(0).toUpperCase()}
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="truncate text-[13px] font-semibold text-slate-100">
                        {truncate(lead.name || "Sem nome", 40)}
                      </p>
                      <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-300/80">
                        · {stageLabel(lead.currentStage)}
                      </span>
                    </div>
                    <p className="mt-0.5 flex items-center gap-2 text-[11px] text-slate-400">
                      <Phone className="h-3 w-3 shrink-0" />
                      <span className="truncate">{lead.phone ?? "Aguardando coleta"}</span>
                      <span className="text-slate-600">·</span>
                      <span className="rounded-md bg-white/[0.04] px-1.5 py-0.5 font-medium text-slate-300">
                        {lead.source.replace(/_/g, " ")}
                      </span>
                    </p>
                  </div>

                  <div className="flex shrink-0 flex-col items-end gap-1">
                    <div className="flex items-center gap-1 text-[11px] font-semibold text-slate-300 tabular-nums">
                      <Clock className="h-3 w-3 text-indigo-300" />
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

// ─── StatPill ─────────────────────────────────────────────────────────────────

function StatPill({
  icon,
  label,
  value,
  tone = "indigo",
}: {
  icon: React.ReactNode;
  label: string;
  value: string | number;
  tone?: "amber" | "emerald" | "violet" | "indigo";
}) {
  const tones = {
    amber: "border-amber-400/25 bg-amber-400/10 text-amber-200",
    emerald: "border-emerald-400/25 bg-emerald-400/10 text-emerald-200",
    violet: "border-violet-400/25 bg-violet-400/10 text-violet-200",
    indigo: "border-indigo-400/25 bg-indigo-400/10 text-indigo-200",
  } as const;

  return (
    <div
      className={cn(
        "flex items-center gap-2 rounded-xl border px-3 py-1.5",
        "text-[11px] font-semibold backdrop-blur-sm",
        tones[tone]
      )}
    >
      <span className="opacity-80">{icon}</span>
      <span className="text-slate-400/90 font-medium">{label}:</span>
      <span className="tabular-nums">{value}</span>
    </div>
  );
}
