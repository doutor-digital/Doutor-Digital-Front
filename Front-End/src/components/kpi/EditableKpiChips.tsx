import { useState } from "react";
import { Check, Pencil, RotateCcw, X } from "@/components/icons";
import { useKpiOverrides } from "@/hooks/useKpiOverrides";

export interface EditableChipItem {
  label: string;
  count: number;
  tone?: "ok" | "warn" | "neutral";
}

/**
 * Chips de breakdown editáveis manualmente (ex.: "Pagamento antecipado" e
 * "Origem" no card Agendados). Em exibição funciona igual ao KpiChips; um lápis
 * ao lado entra em modo edição, onde cada chip vira um input de número que
 * sobrepõe (override) o valor do backend.
 *
 * Reaproveita o store useKpiOverrides (localStorage, por unidade + período) —
 * mesma convenção do EditableKpiValue. Cada chip tem sua própria chave, montada
 * pelo `okeyFor(label)` que o card passa.
 */
export function EditableKpiChips({
  items,
  okeyFor,
  max = 8,
}: {
  items: EditableChipItem[];
  /** Monta a chave de override de um chip a partir do seu label. */
  okeyFor: (label: string) => string;
  max?: number;
}) {
  const overrides = useKpiOverrides((s) => s.overrides);
  const setOverride = useKpiOverrides((s) => s.setOverride);
  const clearOverride = useKpiOverrides((s) => s.clearOverride);
  const [editing, setEditing] = useState(false);

  const resolved = items.map((it) => {
    const okey = okeyFor(it.label);
    const override = overrides[okey];
    return { ...it, okey, isManual: override != null, value: override ?? it.count };
  });

  const visible = editing ? resolved : resolved.filter((c) => c.value > 0);

  if (!editing && visible.length === 0) {
    return (
      <div className="mt-1 flex items-center gap-1.5">
        <span className="text-[10px] italic text-white/30">sem dados</span>
        <button
          type="button"
          onClick={() => setEditing(true)}
          title="Editar manualmente"
          className="rounded-full p-0.5 text-white/30 transition hover:bg-white/10 hover:text-white/80"
        >
          <Pencil className="h-3 w-3" />
        </button>
      </div>
    );
  }

  const toneClass = (tone?: EditableChipItem["tone"], manual?: boolean) =>
    manual
      ? "bg-violet-500/[0.14] text-violet-100 ring-violet-400/30"
      : tone === "ok" ? "bg-emerald-400/[0.12] text-emerald-200 ring-emerald-400/20"
      : tone === "warn" ? "bg-amber-400/[0.12] text-amber-100 ring-amber-400/20"
      : "bg-white/[0.04] text-white/75 ring-white/10";

  return (
    <div className="mt-2 flex flex-wrap items-center gap-1">
      {visible.slice(0, max).map((c) =>
        editing ? (
          <span
            key={c.okey}
            className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] tracking-wide ring-1 ring-inset ${toneClass(c.tone, c.isManual)}`}
          >
            <span className="truncate">{c.label}</span> ·
            <input
              type="number"
              value={c.value}
              onChange={(e) => {
                const n = Number(e.target.value);
                if (e.target.value.trim() === "" || Number.isNaN(n)) return;
                setOverride(c.okey, n);
              }}
              className="w-12 rounded border border-white/15 bg-white/5 px-1 py-0 text-[10px] tabular-nums text-white outline-none focus:border-violet-400/50"
            />
            {c.isManual && (
              <button
                type="button"
                onClick={() => clearOverride(c.okey)}
                title="Voltar ao automático"
                className="text-white/40 transition hover:text-white/80"
              >
                <RotateCcw className="h-2.5 w-2.5" />
              </button>
            )}
          </span>
        ) : (
          <span
            key={c.okey}
            className={`rounded-full px-2 py-0.5 text-[10px] tracking-wide ring-1 ring-inset ${toneClass(c.tone, c.isManual)}`}
          >
            <span className="truncate">{c.label}</span> · <span className="tabular-nums text-white">{c.value}</span>
          </span>
        ),
      )}
      <button
        type="button"
        onClick={() => setEditing((v) => !v)}
        title={editing ? "Concluir edição" : "Editar manualmente"}
        className={`rounded-full p-0.5 transition ${
          editing
            ? "bg-violet-500/20 text-violet-200 hover:bg-violet-500/30"
            : "text-white/30 hover:bg-white/10 hover:text-white/80"
        }`}
      >
        {editing ? <Check className="h-3 w-3" /> : <Pencil className="h-3 w-3" />}
      </button>
    </div>
  );
}
