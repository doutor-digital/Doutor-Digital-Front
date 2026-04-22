import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Clock3, RefreshCw, Users, Webhook } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card, CardBody } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { webhooksService } from "@/services/webhooks";
import { useClinic } from "@/hooks/useClinic";
import { cn, formatNumber } from "@/lib/utils";

type WindowPreset = "1" | "6" | "12" | "24" | "72" | "168" | "720" | "custom";

const PRESETS: { value: WindowPreset; label: string; hours: number }[] = [
  { value: "1", label: "1h", hours: 1 },
  { value: "6", label: "6h", hours: 6 },
  { value: "12", label: "12h", hours: 12 },
  { value: "24", label: "24h", hours: 24 },
  { value: "72", label: "3 dias", hours: 72 },
  { value: "168", label: "7 dias", hours: 168 },
  { value: "720", label: "30 dias", hours: 720 },
];

export default function RecentLeadsPage() {
  const { tenantId, unitId } = useClinic();
  const clinicId = tenantId ?? undefined;

  const [preset, setPreset] = useState<WindowPreset>("24");
  const [customHours, setCustomHours] = useState<number>(48);

  const hours = preset === "custom" ? customHours : Number(preset);

  const query = useQuery({
    queryKey: ["recent-leads", "page", clinicId, unitId, hours],
    queryFn: () =>
      webhooksService.recentLeads({
        clinicId,
        unitId: unitId ?? undefined,
        hours,
        limit: 200,
      }),
    enabled: !!clinicId,
    refetchInterval: 60_000,
    placeholderData: (prev) => prev,
  });

  const items = query.data?.items ?? [];

  const bySource = useMemo(() => {
    const m = new Map<string, number>();
    for (const i of items) {
      const k = i.source || "—";
      m.set(k, (m.get(k) ?? 0) + 1);
    }
    return Array.from(m.entries()).sort((a, b) => b[1] - a[1]);
  }, [items]);

  return (
    <>
      <PageHeader
        title="Leads recentes"
        description="Janela de tempo configurável. Atualiza a cada 60 segundos."
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

      {/* Seletor de janela */}
      <Card className="mb-4">
        <CardBody className="flex flex-wrap items-center gap-2">
          <span className="text-[11px] font-bold uppercase tracking-widest text-slate-500">
            Janela
          </span>
          {PRESETS.map((p) => (
            <button
              key={p.value}
              type="button"
              onClick={() => setPreset(p.value)}
              className={cn(
                "rounded-xl px-3 py-1.5 text-[12px] font-semibold transition-all",
                preset === p.value
                  ? "bg-white/[0.08] text-slate-50 ring-1 ring-inset ring-white/[0.1]"
                  : "text-slate-400 hover:bg-white/[0.04] hover:text-slate-200"
              )}
            >
              {p.label}
            </button>
          ))}
          <button
            type="button"
            onClick={() => setPreset("custom")}
            className={cn(
              "rounded-xl px-3 py-1.5 text-[12px] font-semibold transition-all",
              preset === "custom"
                ? "bg-white/[0.08] text-slate-50 ring-1 ring-inset ring-white/[0.1]"
                : "text-slate-400 hover:bg-white/[0.04] hover:text-slate-200"
            )}
          >
            Personalizado
          </button>
          {preset === "custom" && (
            <div className="flex items-center gap-2">
              <input
                type="number"
                min={1}
                max={720}
                value={customHours}
                onChange={(e) => setCustomHours(Math.max(1, Math.min(720, Number(e.target.value) || 1)))}
                className="h-8 w-20 rounded-md border border-white/[0.08] bg-white/[0.02] px-2 text-[12px] text-slate-200 outline-none focus:border-white/[0.18] focus:bg-white/[0.03] transition tabular-nums"
              />
              <span className="text-[11px] text-slate-500">horas (máx 720 / 30d)</span>
            </div>
          )}

          <div className="ml-auto text-[11px] text-slate-500">
            desde{" "}
            <span className="font-mono text-slate-300">
              {query.data ? formatDateTime(query.data.since) : "—"}
            </span>
          </div>
        </CardBody>
      </Card>

      {/* Resumo */}
      <div className="mb-4 grid grid-cols-1 gap-3 md:grid-cols-3">
        <SummaryCard
          icon={<Users className="h-4 w-4" />}
          label="Leads no período"
          value={query.data?.total ?? 0}
          loading={query.isLoading}
        />
        <SummaryCard
          icon={<Clock3 className="h-4 w-4" />}
          label="Janela"
          value={`${hours}h`}
          loading={false}
        />
        <SummaryCard
          icon={<Webhook className="h-4 w-4" />}
          label="Origens distintas"
          value={bySource.length}
          loading={query.isLoading}
        />
      </div>

      {/* Distribuição por origem */}
      {bySource.length > 0 && (
        <Card className="mb-4">
          <CardBody>
            <p className="mb-2 text-[11px] font-bold uppercase tracking-widest text-slate-500">
              Top origens
            </p>
            <div className="flex flex-wrap gap-2">
              {bySource.slice(0, 10).map(([source, count]) => (
                <span
                  key={source}
                  className="inline-flex items-center gap-1.5 rounded-md bg-white/[0.04] px-2.5 py-1 text-[11px] text-slate-300 ring-1 ring-white/[0.06]"
                >
                  {source}
                  <span className="tabular-nums font-semibold text-slate-100">{count}</span>
                </span>
              ))}
            </div>
          </CardBody>
        </Card>
      )}

      {/* Lista */}
      <Card>
        <CardBody className="p-0">
          {query.isLoading ? (
            <ul className="divide-y divide-slate-800/60">
              {Array.from({ length: 6 }).map((_, i) => (
                <li key={i} className="flex items-center gap-4 px-5 py-3.5">
                  <div className="skeleton h-9 w-9 rounded-full" />
                  <div className="flex-1 space-y-2">
                    <div className="skeleton h-3 w-48 rounded" />
                    <div className="skeleton h-2.5 w-32 rounded" />
                  </div>
                </li>
              ))}
            </ul>
          ) : items.length === 0 ? (
            <EmptyState
              title="Nenhum lead nessa janela"
              description={`Nenhum lead entrou nas últimas ${hours} horas para essa clínica.`}
            />
          ) : (
            <ul className="divide-y divide-slate-800/60">
              {items.map((lead) => (
                <li key={lead.id}>
                  <Link
                    to={`/leads/${lead.id}`}
                    className="group flex items-center gap-4 px-5 py-3.5 transition-colors hover:bg-white/[0.04]"
                  >
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-slate-800 text-[11px] font-semibold text-slate-300">
                      {initials(lead.name)}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="truncate text-sm font-medium text-slate-100 group-hover:text-white">
                          {lead.name}
                        </span>
                        {lead.current_stage && (
                          <span className="shrink-0 rounded bg-slate-800/60 px-1.5 py-0.5 text-[10px] text-slate-300 ring-1 ring-slate-700/60">
                            {lead.current_stage}
                          </span>
                        )}
                      </div>
                      <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[11px] text-slate-500">
                        <span>{timeAgo(lead.created_at)}</span>
                        {lead.source && <span>· {lead.source}</span>}
                        {lead.channel && <span>· {lead.channel}</span>}
                        {lead.unit_name && <span>· {lead.unit_name}</span>}
                        {lead.phone && <span className="tabular-nums">· {lead.phone}</span>}
                      </div>
                    </div>
                    <span className="hidden shrink-0 text-[11px] text-slate-500 md:block">
                      {formatDateTime(lead.created_at)}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </CardBody>
      </Card>

      <p className="mt-3 text-[11px] text-slate-500">
        Total exibido: {formatNumber(items.length)}
        {query.data?.total && query.data.total > items.length && (
          <> · {formatNumber(query.data.total)} no total (limite de 200 por página)</>
        )}
      </p>
    </>
  );
}

function SummaryCard({
  icon,
  label,
  value,
  loading,
}: {
  icon: React.ReactNode;
  label: string;
  value: number | string;
  loading: boolean;
}) {
  return (
    <Card>
      <CardBody className="flex items-center gap-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white/[0.05] text-slate-300 ring-1 ring-white/[0.08]">
          {icon}
        </div>
        <div className="min-w-0">
          <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500">
            {label}
          </p>
          <p className="text-lg font-bold tabular-nums text-slate-100">
            {loading ? "…" : typeof value === "number" ? formatNumber(value) : value}
          </p>
        </div>
      </CardBody>
    </Card>
  );
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

function formatDateTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString("pt-BR", {
    day: "2-digit",
    month: "short",
    year: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function initials(name: string): string {
  const parts = (name || "?").trim().split(/\s+/);
  const first = parts[0]?.[0] ?? "?";
  const last = parts.length > 1 ? parts[parts.length - 1]?.[0] : "";
  return (first + (last ?? "")).toUpperCase();
}
