import { useQuery } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import {
  AlertTriangle, Bell, Clock3, Pause, Play, RefreshCw, Timer, User,
} from "lucide-react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card, CardBody } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { Badge, StateBadge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import { analyticsService } from "@/services/analytics";
import { useClinic } from "@/hooks/useClinic";
import type { UnitAlert } from "@/types";
import { cn } from "@/lib/utils";

const POLL_INTERVAL_MS = 15_000;

export default function AlertsPage() {
  const { unitId: clinicUnitId } = useClinic();

  // Começa com a unidade ativa; permite sobrescrever manualmente.
  const [unitId, setUnitId] = useState(() => {
    const stored = localStorage.getItem("lf.alerts.unitId");
    return stored ?? (clinicUnitId ? String(clinicUnitId) : "");
  });
  const [livePolling, setLivePolling] = useState(true);

  const alerts = useQuery({
    queryKey: ["alerts", unitId],
    queryFn: () => analyticsService.unitAlerts(unitId),
    enabled: !!unitId,
    refetchInterval: livePolling ? POLL_INTERVAL_MS : false,
    refetchIntervalInBackground: true,
  });

  const items: UnitAlert[] = alerts.data?.alerts ?? [];
  const limits = alerts.data?.limits ?? {};

  // Dispara toast quando um alerta NOVO aparece entre dois polls.
  const seenLeadIdsRef = useRef<Set<number>>(new Set());
  const isFirstResponseRef = useRef(true);

  useEffect(() => {
    if (!alerts.data) return;
    const currentIds = new Set(items.map((a) => a.leadId));

    if (isFirstResponseRef.current) {
      // Primeira resposta após mount/trocar unit: só hidrata o snapshot,
      // senão estouraria um toast por alerta pré-existente.
      seenLeadIdsRef.current = currentIds;
      isFirstResponseRef.current = false;
      return;
    }

    const brandNew = items.filter((a) => !seenLeadIdsRef.current.has(a.leadId));
    if (brandNew.length > 0) {
      brandNew.slice(0, 3).forEach((a) => {
        toast.warning(`Lead sem resposta: ${a.name || "Sem nome"}`, {
          description: a.delayReason ?? "Fora do SLA",
          action: {
            label: "Abrir",
            onClick: () => window.location.assign(`/leads/${a.leadId}`),
          },
          duration: 8000,
        });
      });
      if (brandNew.length > 3) {
        toast.warning(`+${brandNew.length - 3} outros alertas novos`, {
          description: "Veja a lista completa nesta página.",
        });
      }
    }

    seenLeadIdsRef.current = currentIds;
  }, [alerts.dataUpdatedAt, alerts.data, items]);

  // Troca de unidade zera o snapshot pra não spamear toast ao carregar a lista dela.
  useEffect(() => {
    isFirstResponseRef.current = true;
    seenLeadIdsRef.current = new Set();
  }, [unitId]);

  return (
    <>
      <PageHeader
        title="Alertas"
        description="Leads fora do SLA · atualização em tempo real via polling"
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Input
              className="w-40"
              placeholder="Unit ID"
              value={unitId}
              onChange={(e) => {
                setUnitId(e.target.value);
                localStorage.setItem("lf.alerts.unitId", e.target.value);
              }}
            />
            <Button
              variant="outline"
              size="sm"
              onClick={() => setLivePolling((v) => !v)}
              title={livePolling ? "Pausar atualização automática" : "Retomar atualização automática"}
            >
              {livePolling ? <Pause className="mr-2 h-4 w-4" /> : <Play className="mr-2 h-4 w-4" />}
              {livePolling ? "Pausar" : "Ao vivo"}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => alerts.refetch()}
              disabled={alerts.isFetching || !unitId}
            >
              <RefreshCw className={cn("mr-2 h-4 w-4", alerts.isFetching && "animate-spin")} />
              Atualizar
            </Button>
          </div>
        }
      />

      {unitId && (
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-400">
          <div className="flex flex-wrap items-center gap-4">
            <span className="inline-flex items-center gap-1.5">
              <span
                className={cn(
                  "inline-block h-1.5 w-1.5 rounded-full",
                  livePolling ? "bg-emerald-400 animate-pulse" : "bg-slate-500"
                )}
              />
              {livePolling
                ? `Ao vivo · atualiza a cada ${POLL_INTERVAL_MS / 1000}s`
                : "Atualização automática pausada"}
            </span>
            {alerts.dataUpdatedAt > 0 && (
              <span>
                última resposta {timeAgo(new Date(alerts.dataUpdatedAt).toISOString())}
              </span>
            )}
          </div>
          {items.length > 0 && (
            <Badge tone="red">
              <AlertTriangle className="h-3 w-3" />
              {items.length} alerta{items.length === 1 ? "" : "s"}
            </Badge>
          )}
        </div>
      )}

      {unitId && (limits.bot || limits.queue || limits.service) && (
        <div className="mb-4 grid grid-cols-2 gap-2 md:grid-cols-3">
          <SlaPill label="BOT" value={limits.bot} tone="violet" />
          <SlaPill label="Fila" value={limits.queue} tone="amber" />
          <SlaPill label="Atendimento" value={limits.service} tone="blue" />
        </div>
      )}

      {!unitId ? (
        <Card className="p-8">
          <EmptyState
            icon={<Bell className="h-5 w-5 text-amber-400" />}
            title="Informe um Unit ID"
            description={
              clinicUnitId
                ? "Usaremos a unidade ativa, mas você pode sobrescrever no campo acima."
                : "Os alertas são escaneados por unidade. Selecione uma unidade na topbar ou digite um Unit ID."
            }
          />
        </Card>
      ) : alerts.isError ? (
        <Card className="p-8">
          <EmptyState
            icon={<AlertTriangle className="h-5 w-5 text-rose-400" />}
            title="Falha ao carregar alertas"
            description={
              (alerts.error as { response?: { data?: { message?: string } }; message?: string })
                ?.response?.data?.message ??
              (alerts.error as { message?: string })?.message ??
              "Verifique a conexão com o back-end."
            }
          />
        </Card>
      ) : alerts.isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="skeleton h-24 w-full rounded-xl" />
          ))}
        </div>
      ) : items.length > 0 ? (
        <div className="space-y-3">
          {items.map((a) => (
            <AlertCard key={a.leadId} alert={a} />
          ))}
        </div>
      ) : (
        <Card className="p-8">
          <EmptyState title="Nenhum alerta ativo" description="Tudo sob controle." />
        </Card>
      )}
    </>
  );
}

/* ─── Cards ────────────────────────────────────────────────────── */

function AlertCard({ alert: a }: { alert: UnitAlert }) {
  const state = (a.currentState ?? "").toLowerCase();
  const timeNow =
    state === "bot"
      ? a.timeInBotMinutes
      : state === "queue"
      ? a.timeInQueueMinutes
      : state === "service"
      ? a.timeInServiceMinutes
      : null;

  return (
    <Card className="border-amber-500/30 bg-amber-500/[0.04]">
      <CardBody>
        <div className="flex items-start gap-3">
          <div className="h-10 w-10 shrink-0 rounded-lg bg-amber-500/15 text-amber-300 grid place-items-center">
            <AlertTriangle className="h-5 w-5" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <Link
                to={`/leads/${a.leadId}`}
                className="truncate font-medium text-slate-100 hover:text-brand-300"
              >
                {a.name || `Lead #${a.leadId}`}
              </Link>
              <StateBadge state={a.currentState} />
              {a.phone && (
                <span className="tabular-nums text-[11px] text-slate-500">
                  {formatPhone(a.phone)}
                </span>
              )}
            </div>

            <div className="mt-2 flex flex-wrap items-center gap-2">
              {a.delayReason && (
                <Badge tone="red">
                  <AlertTriangle className="h-3 w-3" />
                  {a.delayReason}
                </Badge>
              )}
              {typeof timeNow === "number" && timeNow > 0 && (
                <Badge tone="yellow">
                  <Timer className="h-3 w-3" />
                  {formatMinutes(timeNow)} neste estado
                </Badge>
              )}
              {typeof a.timeToFirstResponseMinutes === "number" && a.timeToFirstResponseMinutes > 0 && (
                <Badge tone="slate">
                  <Clock3 className="h-3 w-3" />
                  {formatMinutes(a.timeToFirstResponseMinutes)} até 1º atendimento
                </Badge>
              )}
              {a.currentAttendantName && (
                <Badge tone="blue">
                  <User className="h-3 w-3" />
                  {a.currentAttendantName}
                </Badge>
              )}
              <span className="text-[11px] text-slate-500">
                criado {timeAgo(a.createdAt)}
              </span>
            </div>
          </div>

          <Link to={`/leads/${a.leadId}`}>
            <Button variant="outline" size="sm">Abrir</Button>
          </Link>
        </div>
      </CardBody>
    </Card>
  );
}

function SlaPill({
  label,
  value,
  tone,
}: {
  label: string;
  value?: string;
  tone: "violet" | "amber" | "blue";
}) {
  if (!value) return null;
  const toneCls = {
    violet: "border-violet-500/25 bg-violet-500/[0.06] text-violet-200",
    amber: "border-amber-500/25 bg-amber-500/[0.06] text-amber-200",
    blue: "border-sky-500/20 bg-sky-500/[0.06] text-sky-200",
  }[tone];
  return (
    <div className={cn("rounded-lg border px-3 py-2 text-[11.5px]", toneCls)}>
      <div className="text-[10px] font-semibold uppercase tracking-wider opacity-70">
        SLA {label}
      </div>
      <div className="mt-0.5 font-medium">{value}</div>
    </div>
  );
}

/* ─── helpers ─── */

function formatPhone(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  if (digits.length === 13 && digits.startsWith("55"))
    return `+55 (${digits.slice(2, 4)}) ${digits.slice(4, 9)}-${digits.slice(9)}`;
  if (digits.length === 12 && digits.startsWith("55"))
    return `+55 (${digits.slice(2, 4)}) ${digits.slice(4, 8)}-${digits.slice(8)}`;
  return phone;
}

function formatMinutes(min: number): string {
  if (min < 1) return "< 1 min";
  if (min < 60) return `${Math.round(min)} min`;
  const h = Math.floor(min / 60);
  const m = Math.round(min % 60);
  return m === 0 ? `${h}h` : `${h}h ${m}min`;
}

function timeAgo(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  if (Number.isNaN(diffMs) || diffMs < 0) return "agora";
  const m = Math.floor(diffMs / 60_000);
  if (m < 1) return "agora";
  if (m < 60) return `há ${m} min`;
  const h = Math.floor(m / 60);
  if (h < 24) return `há ${h}h`;
  const d = Math.floor(h / 24);
  return `há ${d}d`;
}
