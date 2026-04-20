import { useEffect, useMemo, useState } from "react";
import {
  X,
  CreditCard,
  Loader2,
  Plus,
  Trash2,
  Split,
  AlertTriangle,
  CheckCircle2,
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { LeadSelect } from "@/components/finance/LeadSelect";
import { cn, formatCurrency } from "@/lib/utils";
import {
  PAYMENT_METHOD_LABEL,
  type PaymentMethod,
  type PaymentSplitInput,
  type TreatmentOption,
} from "@/services/payments";
import { useTreatments, useCreatePayment } from "@/hooks/useFinance";

const DEFAULT_TREATMENT_VALUE = 3800;

const METHOD_COLORS: Record<PaymentMethod, string> = {
  pix: "from-cyan-500/80 to-cyan-600/80",
  dinheiro: "from-emerald-500/80 to-emerald-600/80",
  debito: "from-blue-500/80 to-blue-600/80",
  credito: "from-purple-500/80 to-purple-600/80",
  boleto: "from-orange-500/80 to-orange-600/80",
  transferencia: "from-rose-500/80 to-rose-600/80",
};

interface Props {
  open: boolean;
  onClose: () => void;
  clinicId?: number;
  defaultLeadId?: number;
}

type SplitRow = {
  uid: string;
  paymentMethod: PaymentMethod;
  amount: number;
  installments: number;
};

function newSplit(paymentMethod: PaymentMethod, amount: number): SplitRow {
  return {
    uid: Math.random().toString(36).slice(2, 9),
    paymentMethod,
    amount,
    installments: 1,
  };
}

export function PaymentModal({ open, onClose, clinicId, defaultLeadId }: Props) {
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

  const [splitMode, setSplitMode] = useState<boolean>(false);
  const [splits, setSplits] = useState<SplitRow[]>([]);

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

  // ─── Cálculos legacy (single-method) ──────────────────────────────
  const remaining = Math.max(0, treatmentValue - downPayment);
  const installmentValue = installments > 0 ? remaining / installments : 0;

  // ─── Cálculos do split ────────────────────────────────────────────
  const splitTotal = useMemo(
    () => splits.reduce((acc, s) => acc + (Number.isFinite(s.amount) ? s.amount : 0), 0),
    [splits]
  );
  const splitRemaining = Math.round((treatmentValue - splitTotal) * 100) / 100;
  const splitDiff = Math.round((splitTotal - treatmentValue) * 100) / 100;
  const splitValid = splits.length >= 2 && Math.abs(splitDiff) < 0.01;

  function onPickTreatment(name: string) {
    setTreatmentKey(name);
    const t = treatments.find((x) => x.name === name);
    if (t) {
      setTreatmentValue(t.defaultValue ?? DEFAULT_TREATMENT_VALUE);
      setDurationMonths(t.defaultDurationMonths ?? 1);
    }
  }

  function enableSplitMode() {
    setSplitMode(true);
    setDownPayment(0);
    // pré-popula com 2 formas (PIX + crédito) dividindo o total igualmente
    const half = Math.round((treatmentValue / 2) * 100) / 100;
    const otherHalf = Math.round((treatmentValue - half) * 100) / 100;
    setSplits([newSplit("pix", half), newSplit("credito", otherHalf)]);
  }

  function disableSplitMode() {
    setSplitMode(false);
    setSplits([]);
  }

  function addSplit() {
    const used = new Set(splits.map((s) => s.paymentMethod));
    const next = (Object.keys(PAYMENT_METHOD_LABEL) as PaymentMethod[]).find(
      (k) => !used.has(k)
    );
    const remainingToFill = Math.max(0, splitRemaining);
    setSplits([...splits, newSplit(next ?? "pix", remainingToFill)]);
  }

  function removeSplit(uid: string) {
    setSplits(splits.filter((s) => s.uid !== uid));
  }

  function updateSplit(uid: string, patch: Partial<Omit<SplitRow, "uid">>) {
    setSplits(splits.map((s) => (s.uid === uid ? { ...s, ...patch } : s)));
  }

  function distributeRemaining(uid: string) {
    const others = splits
      .filter((s) => s.uid !== uid)
      .reduce((acc, s) => acc + s.amount, 0);
    const value = Math.max(0, Math.round((treatmentValue - others) * 100) / 100);
    updateSplit(uid, { amount: value });
  }

  function reset() {
    setLeadId(null);
    setNotes("");
    setDownPayment(0);
    setInstallments(1);
    setSplitMode(false);
    setSplits([]);
  }

  async function onSubmit() {
    if (!leadId || !clinicId || !treatmentKey) return;

    if (splitMode) {
      if (!splitValid) return;
      const payload: PaymentSplitInput[] = splits.map((s) => ({
        paymentMethod: s.paymentMethod,
        amount: s.amount,
        installments: s.installments,
      }));

      await createMutation.mutateAsync({
        leadId,
        clinicId,
        treatment: currentTreatment?.name ?? treatmentKey,
        treatmentDurationMonths: durationMonths,
        treatmentValue,
        downPayment: 0,
        installments: 1,
        paidAt: new Date(paidAt).toISOString(),
        notes: notes || undefined,
        splits: payload,
      });
    } else {
      await createMutation.mutateAsync({
        leadId,
        clinicId,
        treatment: currentTreatment?.name ?? treatmentKey,
        treatmentDurationMonths: durationMonths,
        treatmentValue,
        paymentMethod: method,
        downPayment,
        installments,
        paidAt: new Date(paidAt).toISOString(),
        notes: notes || undefined,
      });
    }

    reset();
    onClose();
  }

  if (!open) return null;

  const canSubmit =
    !!leadId &&
    !!treatmentKey &&
    !!clinicId &&
    !createMutation.isPending &&
    (splitMode ? splitValid : true);

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
              <h3 className="text-base font-bold text-slate-50">Registrar pagamento</h3>
              <p className="text-xs text-slate-400">
                Tratamento, forma(s), entrada e parcelamento
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

          {/* Valor do tratamento (+ entrada/parcelas só em modo simples) */}
          <div className={cn("grid grid-cols-1 gap-3", !splitMode && "md:grid-cols-3")}>
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
            {!splitMode && (
              <>
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
              </>
            )}
          </div>

          {/* Toggle split */}
          <div
            className={cn(
              "rounded-xl border p-3 transition",
              splitMode
                ? "border-brand-500/40 bg-brand-500/5"
                : "border-white/10 bg-white/[0.02]"
            )}
          >
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-start gap-2.5 min-w-0">
                <div
                  className={cn(
                    "h-8 w-8 shrink-0 grid place-items-center rounded-lg",
                    splitMode
                      ? "bg-gradient-to-br from-brand-500 to-accent-500 text-white"
                      : "bg-white/5 text-slate-400"
                  )}
                >
                  <Split className="h-4 w-4" />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-slate-100">
                    Dividir em várias formas de pagamento
                  </p>
                  <p className="text-[11px] text-slate-400">
                    Ex.: parte no PIX, parte no crédito. Cada forma pode ter seu
                    próprio parcelamento.
                  </p>
                </div>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={splitMode}
                onClick={() => (splitMode ? disableSplitMode() : enableSplitMode())}
                className={cn(
                  "relative h-6 w-11 shrink-0 rounded-full transition-colors",
                  splitMode ? "bg-brand-500" : "bg-white/10"
                )}
              >
                <span
                  className={cn(
                    "absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all",
                    splitMode ? "left-5" : "left-0.5"
                  )}
                />
              </button>
            </div>
          </div>

          {/* Forma de pagamento (modo simples) */}
          {!splitMode && (
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
          )}

          {/* Splits (modo split) */}
          {splitMode && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <label className="text-[11px] font-semibold uppercase tracking-widest text-slate-400">
                  Formas de pagamento ({splits.length})
                </label>
                <span
                  className={cn(
                    "inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-semibold",
                    splitValid
                      ? "bg-emerald-500/15 text-emerald-300"
                      : splitDiff > 0
                      ? "bg-rose-500/15 text-rose-300"
                      : "bg-amber-500/15 text-amber-300"
                  )}
                >
                  {splitValid ? (
                    <>
                      <CheckCircle2 className="h-3 w-3" /> Confere
                    </>
                  ) : splitDiff > 0 ? (
                    <>
                      <AlertTriangle className="h-3 w-3" /> Excede {formatCurrency(splitDiff)}
                    </>
                  ) : (
                    <>
                      <AlertTriangle className="h-3 w-3" /> Faltam{" "}
                      {formatCurrency(Math.max(0, splitRemaining))}
                    </>
                  )}
                </span>
              </div>

              <div className="space-y-2">
                {splits.map((s, idx) => (
                  <div
                    key={s.uid}
                    className="rounded-xl border border-white/10 bg-white/[0.02] p-3"
                  >
                    <div className="flex items-center gap-2">
                      <div
                        className={cn(
                          "h-8 w-8 shrink-0 grid place-items-center rounded-lg text-[11px] font-bold text-white bg-gradient-to-br",
                          METHOD_COLORS[s.paymentMethod]
                        )}
                      >
                        {idx + 1}
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-[1fr_1fr_120px] gap-2 flex-1 min-w-0">
                        <Select
                          value={s.paymentMethod}
                          onChange={(e) =>
                            updateSplit(s.uid, {
                              paymentMethod: e.target.value as PaymentMethod,
                            })
                          }
                        >
                          {(Object.keys(PAYMENT_METHOD_LABEL) as PaymentMethod[]).map(
                            (k) => (
                              <option key={k} value={k}>
                                {PAYMENT_METHOD_LABEL[k]}
                              </option>
                            )
                          )}
                        </Select>
                        <div className="relative">
                          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[11px] font-semibold text-slate-500 pointer-events-none">
                            R$
                          </span>
                          <Input
                            type="number"
                            step="0.01"
                            min={0}
                            value={s.amount}
                            onChange={(e) =>
                              updateSplit(s.uid, {
                                amount: Math.max(0, Number(e.target.value)),
                              })
                            }
                            onBlur={(e) => {
                              const n = Math.max(0, Number(e.target.value));
                              updateSplit(s.uid, { amount: Math.round(n * 100) / 100 });
                            }}
                            className="pl-9"
                          />
                        </div>
                        <Input
                          type="number"
                          min={1}
                          max={60}
                          title="Parcelas"
                          value={s.installments}
                          onChange={(e) =>
                            updateSplit(s.uid, {
                              installments: Math.max(
                                1,
                                Math.min(60, Number(e.target.value))
                              ),
                            })
                          }
                        />
                      </div>
                      <button
                        type="button"
                        onClick={() => removeSplit(s.uid)}
                        disabled={splits.length <= 2}
                        title={
                          splits.length <= 2
                            ? "Pelo menos 2 formas são necessárias no modo dividido"
                            : "Remover"
                        }
                        className={cn(
                          "h-8 w-8 shrink-0 grid place-items-center rounded-lg text-slate-400 hover:bg-rose-500/10 hover:text-rose-300 transition",
                          splits.length <= 2 && "opacity-30 cursor-not-allowed hover:bg-transparent hover:text-slate-400"
                        )}
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                    <div className="mt-2 flex items-center justify-between text-[11px] text-slate-500">
                      <span>
                        {s.installments}× de{" "}
                        <span className="text-slate-300 tabular-nums">
                          {formatCurrency(
                            s.installments > 0 ? s.amount / s.installments : 0
                          )}
                        </span>
                      </span>
                      <button
                        type="button"
                        onClick={() => distributeRemaining(s.uid)}
                        className="text-brand-300 hover:text-brand-200 transition"
                      >
                        Preencher restante
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              <div className="flex items-center justify-between gap-2">
                <Button
                  variant="ghost"
                  onClick={addSplit}
                  disabled={splits.length >= 6}
                  className="gap-1.5"
                >
                  <Plus className="h-4 w-4" /> Adicionar forma
                </Button>
                <div className="flex items-center gap-1.5 text-[11px] text-slate-400">
                  <label className="uppercase tracking-widest text-slate-500">
                    Data
                  </label>
                  <Input
                    type="datetime-local"
                    value={paidAt}
                    onChange={(e) => setPaidAt(e.target.value)}
                    className="text-xs py-1.5"
                  />
                </div>
              </div>
            </div>
          )}

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
              {splitMode ? "Resumo do pagamento dividido" : "Resumo do parcelamento"}
            </p>
            {splitMode ? (
              <>
                <div className="mt-3 grid grid-cols-3 gap-3 text-center">
                  <div>
                    <p className="text-[10px] uppercase tracking-wider text-slate-400">
                      Total do tratamento
                    </p>
                    <p className="mt-0.5 text-base font-bold text-slate-50 tabular-nums">
                      {formatCurrency(treatmentValue)}
                    </p>
                  </div>
                  <div>
                    <p className="text-[10px] uppercase tracking-wider text-slate-400">
                      Soma das formas
                    </p>
                    <p
                      className={cn(
                        "mt-0.5 text-base font-bold tabular-nums",
                        splitValid
                          ? "text-emerald-300"
                          : splitDiff > 0
                          ? "text-rose-300"
                          : "text-amber-300"
                      )}
                    >
                      {formatCurrency(splitTotal)}
                    </p>
                  </div>
                  <div>
                    <p className="text-[10px] uppercase tracking-wider text-slate-400">
                      Diferença
                    </p>
                    <p
                      className={cn(
                        "mt-0.5 text-base font-bold tabular-nums",
                        splitValid ? "text-emerald-300" : "text-amber-300"
                      )}
                    >
                      {formatCurrency(Math.abs(splitDiff))}
                    </p>
                  </div>
                </div>
                {/* Barra de composição */}
                <div className="mt-4 h-2 w-full overflow-hidden rounded-full bg-white/5 flex">
                  {splits.map((s) => {
                    const pct = treatmentValue > 0 ? (s.amount / treatmentValue) * 100 : 0;
                    return (
                      <div
                        key={s.uid}
                        className={cn(
                          "h-full bg-gradient-to-r transition-all",
                          METHOD_COLORS[s.paymentMethod]
                        )}
                        style={{ width: `${Math.min(100, Math.max(0, pct))}%` }}
                      />
                    );
                  })}
                </div>
                <div className="mt-2 flex flex-wrap gap-2">
                  {splits.map((s) => (
                    <span
                      key={s.uid}
                      className="inline-flex items-center gap-1.5 rounded-full bg-white/5 px-2 py-0.5 text-[11px] text-slate-300"
                    >
                      <span
                        className={cn(
                          "h-2 w-2 rounded-full bg-gradient-to-r",
                          METHOD_COLORS[s.paymentMethod]
                        )}
                      />
                      {PAYMENT_METHOD_LABEL[s.paymentMethod]} ·{" "}
                      <span className="tabular-nums text-slate-200">
                        {formatCurrency(s.amount)}
                      </span>
                    </span>
                  ))}
                </div>
              </>
            ) : (
              <div className="mt-3 grid grid-cols-2 md:grid-cols-4 gap-3 text-center">
                <div>
                  <p className="text-[10px] uppercase tracking-wider text-slate-400">Total</p>
                  <p className="mt-0.5 text-base font-bold text-slate-50 tabular-nums">
                    {formatCurrency(treatmentValue)}
                  </p>
                </div>
                <div>
                  <p className="text-[10px] uppercase tracking-wider text-slate-400">
                    Entrada
                  </p>
                  <p className="mt-0.5 text-base font-bold text-emerald-300 tabular-nums">
                    {formatCurrency(downPayment)}
                  </p>
                </div>
                <div>
                  <p className="text-[10px] uppercase tracking-wider text-slate-400">
                    Restante
                  </p>
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
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="sticky bottom-0 flex items-center justify-end gap-2 border-t border-white/10 bg-[#0d1425]/95 backdrop-blur px-6 py-4">
          <Button variant="ghost" onClick={onClose} disabled={createMutation.isPending}>
            Cancelar
          </Button>
          <Button onClick={onSubmit} disabled={!canSubmit}>
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
