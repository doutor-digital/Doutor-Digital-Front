import { useState } from "react";
import { Check, Cog, RotateCcw, Users, X } from "@/components/icons";
import { useKpiOverrides } from "@/hooks/useKpiOverrides";
import { RichTooltip } from "@/components/ui/RichTooltip";
import { cn } from "@/lib/utils";

/**
 * Valor de KPI editável manualmente.
 *
 * Mostra o número grande do card; uma engrenagem no canto abre um editor inline
 * que sobrepõe (override) o valor vindo do backend. Enquanto houver override,
 * exibe um selo "manual" e um botão pra voltar ao automático.
 *
 * Deve ser usado dentro de um container `position: relative` (o DarkCard já é).
 */
export function EditableKpiValue({
  okey,
  live,
  valueClass = "text-white",
  align = "left",
  format = (n) => new Intl.NumberFormat("pt-BR").format(n),
  onDrill,
}: {
  /** Chave canônica do override (use kpiKey(unitId, metric)). */
  okey: string;
  /** Valor vindo do backend (usado quando não há override). */
  live: number;
  valueClass?: string;
  align?: "left" | "right";
  format?: (n: number) => string;
  /** Quando fornecido, clicar no número abre o drill-down (ver os leads). */
  onDrill?: () => void;
}) {
  const overrides = useKpiOverrides((s) => s.overrides);
  const setOverride = useKpiOverrides((s) => s.setOverride);
  const clearOverride = useKpiOverrides((s) => s.clearOverride);

  const override = overrides[okey];
  const isManual = override != null;
  const display = isManual ? override : live;

  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");

  const open = () => {
    setDraft(String(display ?? 0));
    setEditing(true);
  };
  const save = () => {
    const n = Number(draft);
    if (draft.trim() !== "" && !Number.isNaN(n)) setOverride(okey, n);
    setEditing(false);
  };
  const reset = () => {
    clearOverride(okey);
    setEditing(false);
  };

  return (
    <>
      {/* Engrenagem (canto superior direito do card) — abre o editor manual.
          O tooltip explica POR QUE alguém usaria isso: quando a SDR move o lead
          na etapa/dia errado, o número automático fica torto e precisa de ajuste
          manual até a Reconciliação por CSV ser aplicada. */}
      <RichTooltip
        side="left"
        className="absolute right-3 top-3 z-10"
        content={
          <span>
            <b>Editar valor manualmente.</b>
            <br />
            Use quando a SDR moveu leads na etapa/dia errado e o número do CRM
            estiver divergindo do relatório real. Pra um ajuste definitivo, suba
            o CSV em <i>Reconciliação por CSV</i>.
          </span>
        }
      >
        <button
          type="button"
          onClick={() => (editing ? setEditing(false) : open())}
          className={`rounded-full p-1.5 transition ${
            isManual
              ? "bg-violet-500/20 text-violet-200 hover:bg-violet-500/30"
              : "text-white/30 hover:bg-white/10 hover:text-white/80"
          }`}
        >
          <Cog className="h-4 w-4" />
        </button>
      </RichTooltip>

      <div className={align === "right" ? "text-right" : ""}>
        {onDrill ? (
          <button
            type="button"
            onClick={onDrill}
            title="Ver os leads deste KPI"
            className={cn(
              "group mt-4 flex items-baseline gap-2 text-5xl font-bold leading-none transition hover:opacity-90",
              align === "right" && "ml-auto flex-row-reverse",
              valueClass,
            )}
          >
            {format(display)}
            <Users className="h-4 w-4 self-center text-white/25 transition group-hover:text-white/70" />
          </button>
        ) : (
          <p className={cn("mt-4 text-5xl font-bold leading-none", valueClass)}>
            {format(display)}
          </p>
        )}
        {isManual && (
          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            <RichTooltip
              side="bottom"
              content={
                <span>
                  Esse número foi <b>ajustado pelo admin</b> porque a SDR moveu
                  leads na etapa/dia errado no CRM. O cálculo automático ainda é{" "}
                  <b>{format(live)}</b>, mas o card mostra o valor manual pra
                  bater com o relatório oficial até a reconciliação por CSV ser
                  aplicada.
                </span>
              }
            >
              <span className="inline-flex cursor-help items-center gap-1 rounded-full bg-violet-500/15 px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-violet-200">
                manual
              </span>
            </RichTooltip>
            <span className="text-[10px] text-white/45">
              ajustado por movimentação errada da SDR
            </span>
          </div>
        )}
      </div>

      {/* Editor inline */}
      {editing && (
        <div className="mt-3 rounded-xl border border-violet-400/30 bg-[#0a1631]/90 p-3 ring-1 ring-white/5">
          <label className="text-[10px] font-medium uppercase tracking-wider text-white/50">
            Valor manual
          </label>
          <div className="mt-1.5 flex items-center gap-1.5">
            <input
              type="number"
              autoFocus
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") save();
                if (e.key === "Escape") setEditing(false);
              }}
              className="w-full rounded-lg border border-white/10 bg-white/5 px-2.5 py-1.5 text-sm text-white outline-none focus:border-violet-400/50"
            />
            <button
              type="button"
              onClick={save}
              title="Salvar"
              className="shrink-0 rounded-lg bg-violet-500/80 p-1.5 text-white hover:bg-violet-500"
            >
              <Check className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => setEditing(false)}
              title="Cancelar"
              className="shrink-0 rounded-lg border border-white/10 bg-white/5 p-1.5 text-white/70 hover:bg-white/10"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          {isManual && (
            <button
              type="button"
              onClick={reset}
              className="mt-2 flex items-center gap-1 text-[11px] text-white/40 hover:text-white/80"
            >
              <RotateCcw className="h-3 w-3" />
              Voltar ao automático ({format(live)})
            </button>
          )}
        </div>
      )}
    </>
  );
}
