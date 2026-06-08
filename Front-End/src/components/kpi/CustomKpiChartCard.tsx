import { Pencil } from "@/components/icons";
import { channelVisual } from "@/lib/channelIcons";
import { cn } from "@/lib/utils";
import type { KpiBreakdownItem } from "@/services/kpiConfig";

const nf = (n: number) => new Intl.NumberFormat("pt-BR").format(n);

/**
 * Card de KPI custom no modo GRÁFICO: distribuição das origens dos leads em barras
 * horizontais (estilo "linha reta"), uma por valor, com ícone do canal
 * (Instagram/Facebook/Org/etc.). Clicar numa barra abre os leads daquele valor.
 */
export function CustomKpiChartCard({
  label,
  accent,
  total,
  breakdown,
  canEdit,
  onEdit,
  onDrillValue,
}: {
  label: string;
  accent?: string | null;
  total: number;
  breakdown: KpiBreakdownItem[];
  canEdit?: boolean;
  onEdit?: () => void;
  onDrillValue?: (value: string) => void;
}) {
  const max = breakdown.reduce((m, b) => Math.max(m, b.value), 0) || 1;

  return (
    <div
      className="relative overflow-hidden rounded-2xl bg-[#0f1f3a]/80 p-5 ring-1 ring-white/5 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]"
      style={accent ? { borderTop: `4px solid ${accent}` } : undefined}
    >
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-white/60">{label}</p>
          <p className="mt-1 text-[12px] text-white/40">
            {nf(total)} leads · {breakdown.length} origens
          </p>
        </div>
        {canEdit && (
          <button
            type="button"
            onClick={onEdit}
            className="shrink-0 rounded-full p-1 text-white/30 transition hover:bg-white/10 hover:text-white/70"
            aria-label={`Editar ${label}`}
          >
            <Pencil className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      {breakdown.length === 0 ? (
        <p className="mt-4 text-[12px] text-white/40">Sem dados de origem no período.</p>
      ) : (
        <ul className="mt-4 space-y-2.5">
          {breakdown.map((b) => {
            const vis = channelVisual(b.label);
            const width = Math.max(4, (b.value / max) * 100);
            const pct = total > 0 ? Math.round((b.value / total) * 100) : 0;
            const drillable = !!onDrillValue && b.label.toLowerCase() !== "outros";
            return (
              <li key={b.label}>
                <button
                  type="button"
                  disabled={!drillable}
                  onClick={() => drillable && onDrillValue!(b.label)}
                  className={cn(
                    "group flex w-full items-center gap-2.5 text-left",
                    drillable && "cursor-pointer",
                  )}
                >
                  {/* ícone do canal */}
                  <span
                    className="grid h-8 w-8 shrink-0 place-items-center overflow-hidden rounded-lg p-0.5"
                    style={{ background: vis.iconUrl ? "#fff" : vis.color }}
                  >
                    {vis.iconUrl ? (
                      <img src={vis.iconUrl} alt="" className="h-full w-full object-contain" />
                    ) : null}
                  </span>
                  {/* nome */}
                  <span className="w-24 shrink-0 truncate text-[12px] text-white/75 group-hover:text-white">
                    {b.label}
                  </span>
                  {/* barra horizontal */}
                  <span className="relative h-2.5 flex-1 overflow-hidden rounded-full bg-white/[0.05]">
                    <span
                      className="absolute inset-y-0 left-0 rounded-full transition-all"
                      style={{ width: `${width}%`, background: vis.color }}
                    />
                  </span>
                  {/* contagem + % */}
                  <span className="w-16 shrink-0 text-right text-[11px] tabular-nums text-white/60">
                    {nf(b.value)} <span className="text-white/35">{pct}%</span>
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
