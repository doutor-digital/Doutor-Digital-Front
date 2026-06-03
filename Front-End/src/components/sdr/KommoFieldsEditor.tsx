import { useMemo, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { Loader2, Save } from "@/components/icons";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { upsertSdrLead } from "@/lib/sdr/sdr-store";
import { updateLeadCustomFields } from "@/services/sdr";
import type { KommoCustomField } from "@/services/units";
import type { SdrCustomField, SdrLead } from "@/types/sdr";

function isDateType(t?: string | null) {
  return t === "date" || t === "birthday" || t === "date_time";
}

/** Converte valor (unix ou ISO/texto) em yyyy-mm-dd pro <input type=date>. */
function toDateInput(v?: string | null): string {
  if (!v) return "";
  const s = v.trim();
  if (/^\d{8,}$/.test(s)) {
    const d = new Date(Number(s) * 1000);
    return Number.isNaN(d.getTime()) ? "" : d.toISOString().slice(0, 10);
  }
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? s : d.toISOString().slice(0, 10);
}

type EditState = Record<number, { value: string; enumId?: number; dirty: boolean }>;

/**
 * Editor dos campos da Kommo na revisão: cada campo vira input por tipo (select/data/
 * número/texto). "Salvar na Kommo" faz PATCH no CRM ao vivo + atualiza nosso banco e o store.
 */
export function KommoFieldsEditor({
  lead,
  schema,
  fields,
}: {
  lead: SdrLead;
  schema: KommoCustomField[];
  fields: SdrCustomField[];
}) {
  const schemaById = useMemo(() => {
    const m = new Map<number, KommoCustomField>();
    for (const s of schema) m.set(s.id, s);
    return m;
  }, [schema]);

  const [edits, setEdits] = useState<EditState>(() =>
    Object.fromEntries(fields.map((f) => [f.fieldId, { value: f.value ?? "", dirty: false }])),
  );

  const setField = (id: number, patch: Partial<{ value: string; enumId?: number }>) =>
    setEdits((e) => ({ ...e, [id]: { ...(e[id] ?? { value: "", dirty: false }), ...patch, dirty: true } }));

  const dirtyIds = Object.entries(edits)
    .filter(([, v]) => v.dirty)
    .map(([id]) => Number(id));

  const save = useMutation({
    mutationFn: () =>
      updateLeadCustomFields(
        Number(lead.backendId),
        dirtyIds.map((id) => {
          const sf = schemaById.get(id);
          const cf = fields.find((f) => f.fieldId === id);
          const e = edits[id];
          return {
            fieldId: id,
            fieldName: sf?.name ?? cf?.fieldName,
            fieldCode: sf?.code ?? cf?.fieldCode,
            type: sf?.type ?? cf?.type,
            value: e.value || null,
            enumId: e.enumId ?? null,
          };
        }),
      ),
    onSuccess: (r) => {
      toast.success("Campos gravados na Kommo!");
      upsertSdrLead({ ...lead, customFields: r.customFields });
      setEdits((e) =>
        Object.fromEntries(Object.entries(e).map(([k, v]) => [k, { ...v, dirty: false }])),
      );
    },
    onError: (err: unknown) => {
      const msg =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      toast.error(msg || "Falha ao gravar na Kommo.");
    },
  });

  return (
    <div className="mt-3">
      <div className="grid grid-cols-1 gap-x-4 gap-y-2.5 sm:grid-cols-2">
        {fields.map((f) => {
          const sf = schemaById.get(f.fieldId);
          const e = edits[f.fieldId] ?? { value: f.value ?? "", dirty: false };
          const enums = sf?.enums ?? [];
          const type = sf?.type ?? f.type;
          return (
            <div key={f.fieldId} className={e.dirty ? "rounded-md ring-1 ring-amber-400/30" : ""}>
              <label className="mb-1 block text-[10.5px] uppercase tracking-wider text-slate-500">
                {f.fieldName}
              </label>
              {enums.length > 0 ? (
                <Select
                  value={e.value}
                  onChange={(ev) => {
                    const val = ev.target.value;
                    const en = enums.find((x) => x.value === val);
                    setField(f.fieldId, { value: val, enumId: en?.id });
                  }}
                >
                  <option value="">— selecione —</option>
                  {enums.map((en) => (
                    <option key={en.id} value={en.value}>
                      {en.value}
                    </option>
                  ))}
                </Select>
              ) : isDateType(type) ? (
                <Input
                  type="date"
                  value={toDateInput(e.value)}
                  onChange={(ev) => setField(f.fieldId, { value: ev.target.value })}
                />
              ) : type === "numeric" ? (
                <Input
                  type="number"
                  value={e.value}
                  onChange={(ev) => setField(f.fieldId, { value: ev.target.value })}
                />
              ) : (
                <Input
                  value={e.value}
                  onChange={(ev) => setField(f.fieldId, { value: ev.target.value })}
                />
              )}
            </div>
          );
        })}
      </div>

      <div className="mt-3 flex items-center justify-end gap-3">
        {dirtyIds.length > 0 && (
          <span className="text-[11px] text-amber-300">{dirtyIds.length} campo(s) alterado(s)</span>
        )}
        <button
          type="button"
          onClick={() => save.mutate()}
          disabled={!lead.backendId || dirtyIds.length === 0 || save.isPending}
          className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-500/90 px-3.5 py-1.5 text-[12px] font-semibold text-[#06231a] transition hover:bg-emerald-400 disabled:opacity-50"
        >
          {save.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
          Salvar na Kommo
        </button>
      </div>
    </div>
  );
}
