import { useEffect } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowUpRight,
  Calendar,
  CreditCard,
  Loader2,
  Phone as PhoneIcon,
  Tag,
  Users,
  X,
} from "@/components/icons";
import { Badge } from "@/components/ui/Badge";
import {
  kpiConfigService,
  type KpiSourceConfig,
  type KpiSourceType,
} from "@/services/kpiConfig";
import { useStageNames } from "@/hooks/useStageNames";
import { cn, formatDate, formatNumber } from "@/lib/utils";

export interface KpiDrillTarget {
  kpiKey: string;
  label: string;
  /** Fonte inline opcional — usada p/ drill-down arbitrário (ex.: valor de campo). */
  source?: { source_type: KpiSourceType; config: KpiSourceConfig };
}

/**
 * Drawer lateral que mostra QUEM são os leads por trás de um KPI do dashboard.
 * Clica no card → abre aqui a lista (nome, telefone, etapa, origem, data), cada um
 * com link para o detalhe do lead.
 */
export function KpiDrillDown({
  target,
  unitId,
  dateFrom,
  dateTo,
  onClose,
}: {
  target: KpiDrillTarget | null;
  unitId: number | null;
  dateFrom?: string;
  dateTo?: string;
  onClose: () => void;
}) {
  const open = target != null;

  const leads = useQuery({
    queryKey: ["kpi-drill", unitId, target?.kpiKey, target?.source, dateFrom, dateTo],
    queryFn: () =>
      kpiConfigService.drillLeads(unitId, {
        kpi_key: target!.kpiKey,
        source_type: target!.source?.source_type,
        config: target!.source?.config,
        date_from: dateFrom,
        date_to: dateTo,
      }),
    enabled: open,
  });

  const { resolve: resolveStage } = useStageNames(unitId);

  // Fecha no ESC.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  const data = leads.data;

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      {/* backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden
      />

      {/* painel */}
      <aside className="relative flex h-full w-full max-w-md flex-col border-l border-white/10 bg-[#0a0a0d] shadow-2xl">
        <header className="flex items-start justify-between gap-3 border-b border-white/[0.06] px-5 py-4">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-emerald-300/90">
              Leads do KPI
            </p>
            <h2 className="mt-0.5 text-lg font-semibold text-slate-50">{target!.label}</h2>
            <p className="mt-1 flex items-center gap-1.5 text-[11.5px] text-slate-400">
              <Users className="h-3.5 w-3.5" />
              {leads.isLoading
                ? "carregando…"
                : `${formatNumber(data?.total ?? 0)} lead${(data?.total ?? 0) === 1 ? "" : "s"}`}
              {data?.truncated && <span className="text-amber-300">· mostrando os primeiros 500</span>}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full p-1.5 text-slate-400 transition hover:bg-white/10 hover:text-slate-100"
          >
            <X className="h-5 w-5" />
          </button>
        </header>

        <div className="flex-1 overflow-y-auto px-3 py-3">
          {leads.isLoading ? (
            <div className="grid h-40 place-items-center text-slate-500">
              <Loader2 className="h-6 w-6 animate-spin" />
            </div>
          ) : data?.note ? (
            <div className="m-2 rounded-lg border border-amber-400/20 bg-amber-400/[0.06] p-4 text-[12.5px] text-amber-100">
              {data.note}
            </div>
          ) : (data?.items.length ?? 0) === 0 ? (
            <div className="grid h-40 place-items-center text-[12.5px] text-slate-500">
              Nenhum lead neste KPI no período.
            </div>
          ) : (
            <ul className="space-y-1.5">
              {data!.items.map((l) => (
                <li key={l.id}>
                  <Link
                    to={`/leads/${l.id}`}
                    className="group flex flex-col gap-1 rounded-lg border border-white/[0.05] bg-white/[0.015] px-3 py-2.5 transition hover:border-white/[0.12] hover:bg-white/[0.04]"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="truncate text-[13px] font-medium text-slate-100">
                        {l.name || "(sem nome)"}
                      </span>
                      <ArrowUpRight className="h-3.5 w-3.5 shrink-0 text-slate-600 transition group-hover:text-emerald-300" />
                    </div>

                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-slate-400">
                      {l.phone && (
                        <span className="flex items-center gap-1">
                          <PhoneIcon className="h-3 w-3" /> {l.phone}
                        </span>
                      )}
                      <span className="flex items-center gap-1">
                        <Calendar className="h-3 w-3" /> {formatDate(l.created_at)}
                      </span>
                      {l.has_payment && (
                        <span className="flex items-center gap-1 text-emerald-300">
                          <CreditCard className="h-3 w-3" /> pago
                        </span>
                      )}
                    </div>

                    <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
                      <Badge tone="slate">
                        {resolveStage(l.current_stage, l.current_stage_id)}
                      </Badge>
                      {l.source && (
                        <span className="rounded-full bg-white/[0.04] px-2 py-0.5 text-[10px] uppercase tracking-wide text-slate-400 ring-1 ring-inset ring-white/[0.06]">
                          {l.source}
                        </span>
                      )}
                      {l.matched_value && (
                        <span className="flex items-center gap-1 rounded-full bg-cyan-400/[0.1] px-2 py-0.5 text-[10px] text-cyan-200 ring-1 ring-inset ring-cyan-400/20">
                          <Tag className="h-2.5 w-2.5" /> {l.matched_value}
                        </span>
                      )}
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      </aside>
    </div>
  );
}
