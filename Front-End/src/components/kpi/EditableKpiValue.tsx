import { useState } from "react";
import { Check, Cog, RotateCcw, X } from "@/components/icons";
import { useKpiOverrides } from "@/hooks/useKpiOverrides";
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
}: {
  /** Chave canônica do override (use kpiKey(unitId, metric)). */
  okey: string;
  /** Valor vindo do backend (usado quando não há override). */
  live: number;
  valueClass?: string;
  align?: "left" | "right";
  format?: (n: number) => string;
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
      {/* Engrenagem (canto superior direito do card) */}
      <button
        type="button"
        onClick={() => (editing ? setEditing(false) : open())}
        title="Editar valor manualmente"
        className={`absolute right-3 top-3 z-10 rounded-full p-1.5 transition ${
          isManual
            ? "bg-violet-500/20 text-violet-200 hover:bg-violet-500/30"
            : "text-white/30 hover:bg-white/10 hover:text-white/80"
        }`}
      >
        <Cog className="h-4 w-4" />
      </button>

      <div className={align === "right" ? "text-right" : ""}>
        <p className={cn("mt-4 text-5xl font-bold leading-none", valueClass)}>
          {format(display)}
        </p>
        {isManual && (
          <span className="mt-2 inline-flex items-center gap-1 rounded-full bg-violet-500/15 px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-violet-200">
            manual
          </span>
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
