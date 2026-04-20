import { useEffect, useMemo, useState } from "react";
import { X, CreditCard, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { LeadSelect } from "@/components/finance/LeadSelect";
import { cn, formatCurrency } from "@/lib/utils";
import {
  PAYMENT_METHOD_LABEL,
  type PaymentMethod,
  type TreatmentOption,
} from "@/services/payments";
import { useTreatments, useCreatePayment } from "@/hooks/useFinance";

const DEFAULT_TREATMENT_VALUE = 3800;

interface Props {
  open: boolean;
  onClose: () => void;
  TenantId?: number;
  defaultLeadId?: number;
}

export function PaymentModal({ open, onClose, TenantId, defaultLeadId }: Props) {
  const { data: treatments = [], isLoading: loadingTreatments } = useTreatments();
  const createMutation = useCreatePayment();

  const [leadId, setLeadId] = useState<number | null>(defaultLeadId ?? null);
  const [treatmentKey, setTreatmentKey] = useState<string>("");
  const [treatmentValue, setTreatmentValue] = useState<number>(DEFAULT_TREATMENT_VALUE);
  const [durationMonths, setDurationMonths] = useState<number>(1);
  const [method, setMethod] = useState<PaymentMethod>("pix");
  const [downPayment, setDownPayment] = useState<number>(0);
  const [installments, setInstallments] = useState<number>(1);
  const [paidAt, setPaidAt] = useState<string>(() =>
    new Date().toISOString().slice(0, 16)
  );
  const [notes, setNotes] = useState<string>("");

  useEffect(() => {
    if (open && defaultLeadId) setLeadId(defaultLeadId);
  }, [open, defaultLeadId]);

  useEffect(() => {
    if (!treatmentKey && treatments.length > 0) {
      const first = treatments[0];
      setTreatmentKey(first.name);
      setTreatmentValue(first.defaultValue ?? DEFAULT_TREATMENT_VALUE);
      setDurationMonths(first.defaultDurationMonths ?? 1);
    }
  }, [treatments, treatmentKey]);

  const currentTreatment: TreatmentOption | undefined = useMemo(
    () => treatments.find((t) => t.name === treatmentKey),
    [treatments, treatmentKey]
  );

  const remaining = Math.max(0, treatmentValue - downPayment);
  const installmentValue = installments > 0 ? remaining / installments : 0;

  function onPickTreatment(name: string) {
    setTreatmentKey(name);
    const t = treatments.find((x) => x.name === name);
    if (t) {
      setTreatmentValue(t.defaultValue ?? DEFAULT_TREATMENT_VALUE);
      setDurationMonths(t.defaultDurationMonths ?? 1);
    }
  }

  async function onSubmit() {
    if (!leadId) return;
    if (!TenantId) return;
    if (!treatmentKey) return;

    await createMutation.mutateAsync({
      leadId,
      TenantId,
      treatment: currentTreatment?.name ?? treatmentKey,
      treatmentDurationMonths: durationMonths,
      treatmentValue,
      paymentMethod: method,
      downPayment,
      installments,
      paidAt: new Date(paidAt).toISOString(),
      notes: notes || undefined,
    });

    setLeadId(null);
    setNotes("");
    setDownPayment(0);
    setInstallments(1);
    onClose();
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div
        className={cn(
          "relative w-full max-w-2xl max-h-[92vh] overflow-y-auto",
          "rounded-2xl border border-white/10",
          "bg-gradient-to-b from-[#0d1425] to-[#0a101c] shadow-2xl"
        )}
      >
        {/* Header */}
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-white/10 bg-[#0d1425]/95 backdrop-blur px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-brand-500 to-accent-500 grid place-items-center shadow-lg">
              <CreditCard className="h-5 w-5 text-white" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-50">
                Registrar pagamento
              </h3>
              <p className="text-xs text-slate-400">
                Tratamento, forma, entrada e parcelamento
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="h-8 w-8 grid place-items-center rounded-lg text-slate-400 hover:bg-white/5 hover:text-slate-200"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-5">
          {/* Lead */}
          <div>
            <label className="text-[11px] font-semibold uppercase tracking-widest text-slate-400">
              Lead
            </label>
            <div className="mt-1.5">
              <LeadSelect value={leadId} onChange={(id) => setLeadId(id)} />
            </div>
            <p className="mt-1 text-[11px] text-slate-500">
              Comece a digitar o nome, telefone ou ID para filtrar.
            </p>
          </div>

          {/* Tratamento */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="md:col-span-2">
              <label className="text-[11px] font-semibold uppercase tracking-widest text-slate-400">
                Tratamento
              </label>
              {loadingTreatments ? (
                <div className="skeleton h-10 mt-1.5 rounded-lg" />
              ) : (
                <Select
                  className="mt-1.5"
                  value={treatmentKey}
                  onChange={(e) => onPickTreatment(e.target.value)}
                >
                  {treatments.map((t) => (
                    <option key={t.key} value={t.name}>
                      {t.name}
                    </option>
                  ))}
                </Select>
              )}
            </div>
            <div>
              <label className="text-[11px] font-semibold uppercase tracking-widest text-slate-400">
                Duração (meses)
              </label>
              <Input
                type="number"
                min={0}
                className="mt-1.5"
                value={durationMonths}
                onChange={(e) => setDurationMonths(Math.max(0, Number(e.target.value)))}
              />
            </div>
          </div>

          {/* Valor do tratamento */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div>
              <label className="text-[11px] font-semibold uppercase tracking-widest text-slate-400">
                Valor do tratamento
              </label>
              <Input
                type="number"
                step="0.01"
                min={0}
                className="mt-1.5"
                value={treatmentValue}
                onChange={(e) => setTreatmentValue(Math.max(0, Number(e.target.value)))}
              />
              <p className="mt-1 text-[10.5px] text-slate-500">
                Padrão {formatCurrency(DEFAULT_TREATMENT_VALUE)}
              </p>
            </div>
            <div>
              <label className="text-[11px] font-semibold uppercase tracking-widest text-slate-400">
                Entrada
              </label>
              <Input
                type="number"
                step="0.01"
                min={0}
                max={treatmentValue}
                className="mt-1.5"
                value={downPayment}
                onChange={(e) =>
                  setDownPayment(
                    Math.max(0, Math.min(treatmentValue, Number(e.target.value)))
                  )
                }
              />
            </div>
            <div>
              <label className="text-[11px] font-semibold uppercase tracking-widest text-slate-400">
                Parcelas
              </label>
              <Input
                type="number"
                min={1}
                max={60}
                className="mt-1.5"
                value={installments}
                onChange={(e) =>
                  setInstallments(Math.max(1, Math.min(60, Number(e.target.value))))
                }
              />
            </div>
          </div>

          {/* Forma + data */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="text-[11px] font-semibold uppercase tracking-widest text-slate-400">
                Forma de pagamento
              </label>
              <Select
                className="mt-1.5"
                value={method}
                onChange={(e) => setMethod(e.target.value as PaymentMethod)}
              >
                {(Object.keys(PAYMENT_METHOD_LABEL) as PaymentMethod[]).map((k) => (
                  <option key={k} value={k}>
                    {PAYMENT_METHOD_LABEL[k]}
                  </option>
                ))}
              </Select>
            </div>
            <div>
              <label className="text-[11px] font-semibold uppercase tracking-widest text-slate-400">
                Data do pagamento
              </label>
              <Input
                type="datetime-local"
                className="mt-1.5"
                value={paidAt}
                onChange={(e) => setPaidAt(e.target.value)}
              />
            </div>
          </div>

          {/* Notas */}
          <div>
            <label className="text-[11px] font-semibold uppercase tracking-widest text-slate-400">
              Observações
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              placeholder="Opcional"
              className={cn(
                "mt-1.5 w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-slate-100",
                "placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-brand-500/60 focus:border-brand-500/60 transition"
              )}
            />
          </div>

          {/* Resumo */}
          <div className="rounded-xl border border-brand-500/25 bg-gradient-to-br from-brand-500/10 via-transparent to-accent-500/10 p-4">
            <p className="text-[11px] font-bold uppercase tracking-widest text-brand-200">
              Resumo do parcelamento
            </p>
            <div className="mt-3 grid grid-cols-2 md:grid-cols-4 gap-3 text-center">
              <div>
                <p className="text-[10px] uppercase tracking-wider text-slate-400">Total</p>
                <p className="mt-0.5 text-base font-bold text-slate-50 tabular-nums">
                  {formatCurrency(treatmentValue)}
                </p>
              </div>
              <div>
                <p className="text-[10px] uppercase tracking-wider text-slate-400">Entrada</p>
                <p className="mt-0.5 text-base font-bold text-emerald-300 tabular-nums">
                  {formatCurrency(downPayment)}
                </p>
              </div>
              <div>
                <p className="text-[10px] uppercase tracking-wider text-slate-400">Restante</p>
                <p className="mt-0.5 text-base font-bold text-amber-300 tabular-nums">
                  {formatCurrency(remaining)}
                </p>
              </div>
              <div>
                <p className="text-[10px] uppercase tracking-wider text-slate-400">
                  Parcela
                </p>
                <p className="mt-0.5 text-base font-bold text-brand-200 tabular-nums">
                  {installments}× {formatCurrency(installmentValue)}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="sticky bottom-0 flex items-center justify-end gap-2 border-t border-white/10 bg-[#0d1425]/95 backdrop-blur px-6 py-4">
          <Button variant="ghost" onClick={onClose} disabled={createMutation.isPending}>
            Cancelar
          </Button>
          <Button
            onClick={onSubmit}
            disabled={
              !leadId || !treatmentKey || !TenantId || createMutation.isPending
            }
          >
            {createMutation.isPending ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" /> Salvando…
              </>
            ) : (
              "Registrar pagamento"
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
