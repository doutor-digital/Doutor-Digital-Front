import { useEffect, useMemo, useState } from "react";
import { X, Loader2, Plus, Trash2, Check, AlertCircle } from "lucide-react";
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

// ═══════════════════════════════════════════════════════════════════════════
// BRAND MARKS — SVG para cada forma de pagamento (no lugar dos ícones)
// ═══════════════════════════════════════════════════════════════════════════

type BrandMarkProps = { className?: string };

const PixMark = ({ className }: BrandMarkProps) => (
  <svg viewBox="0 0 32 32" fill="none" className={className}>
    <path d="M6 16 L16 6 L26 16 L16 26 Z" stroke="currentColor" strokeWidth="2"
      strokeLinejoin="round" fill="currentColor" fillOpacity="0.08"/>
    <path d="M11.5 16 L16 11.5 L20.5 16 L16 20.5 Z" fill="currentColor"/>
  </svg>
);

const DinheiroMark = ({ className }: BrandMarkProps) => (
  <svg viewBox="0 0 32 32" fill="none" className={className}>
    <rect x="4" y="9" width="24" height="14" rx="2" stroke="currentColor" strokeWidth="1.75"
      fill="currentColor" fillOpacity="0.06"/>
    <circle cx="16" cy="16" r="3.5" stroke="currentColor" strokeWidth="1.75" fill="none"/>
    <path d="M16 13.5 V 18.5 M14.5 14.5 H17 a1 1 0 0 1 0 2 H15 a1 1 0 0 0 0 2 H17.5"
      stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" fill="none"/>
    <circle cx="7.5" cy="16" r="0.9" fill="currentColor" opacity=".5"/>
    <circle cx="24.5" cy="16" r="0.9" fill="currentColor" opacity=".5"/>
  </svg>
);

const DebitoMark = ({ className }: BrandMarkProps) => (
  <svg viewBox="0 0 32 32" fill="none" className={className}>
    <rect x="4" y="8" width="24" height="16" rx="2.5" stroke="currentColor" strokeWidth="1.75"
      fill="currentColor" fillOpacity="0.06"/>
    <rect x="4" y="12" width="24" height="3" fill="currentColor" opacity="0.7"/>
    <rect x="7" y="19" width="5" height="1.5" rx="0.5" fill="currentColor" opacity="0.5"/>
    <rect x="14" y="19" width="3" height="1.5" rx="0.5" fill="currentColor" opacity="0.5"/>
  </svg>
);

const CreditoMark = ({ className }: BrandMarkProps) => (
  <svg viewBox="0 0 32 32" fill="none" className={className}>
    <rect x="4" y="8" width="24" height="16" rx="2.5" stroke="currentColor" strokeWidth="1.75"
      fill="currentColor" fillOpacity="0.06"/>
    <rect x="7" y="12" width="5" height="4" rx="0.8" fill="currentColor" opacity="0.85"/>
    <rect x="7.8" y="13.2" width="3.4" height="0.4" fill="currentColor" opacity="0.3"/>
    <rect x="7.8" y="14.3" width="3.4" height="0.4" fill="currentColor" opacity="0.3"/>
    <rect x="14" y="19" width="10" height="1.2" rx="0.6" fill="currentColor" opacity="0.55"/>
    <rect x="14" y="21.2" width="6" height="1.2" rx="0.6" fill="currentColor" opacity="0.35"/>
  </svg>
);

const BoletoMark = ({ className }: BrandMarkProps) => (
  <svg viewBox="0 0 32 32" fill="none" className={className}>
    <rect x="4" y="8" width="24" height="16" rx="1.5" stroke="currentColor" strokeWidth="1.75"
      fill="currentColor" fillOpacity="0.06"/>
    {[[7,1],[9,2.5],[12.5,1],[14.5,2],[17,1],[19,3],[22.5,1.5],[25,2]].map(([x,w],i)=>(
      <rect key={i} x={x} y="11" width={w} height="10"
        fill="currentColor" opacity={0.55 + (i%2)*0.3}/>
    ))}
  </svg>
);

const TransferenciaMark = ({ className }: BrandMarkProps) => (
  <svg viewBox="0 0 32 32" fill="none" className={className}>
    <path d="M8 14 H22 M18 10 L22 14 L18 18" stroke="currentColor" strokeWidth="1.75"
      strokeLinecap="round" strokeLinejoin="round" fill="none"/>
    <path d="M24 20 H10 M14 24 L10 20 L14 16" stroke="currentColor" strokeWidth="1.75"
      strokeLinecap="round" strokeLinejoin="round" fill="none"/>
  </svg>
);

const METHOD_META: Record<
  PaymentMethod,
  { mark: React.ComponentType<BrandMarkProps>; tone: string; dot: string; short: string }
> = {
  pix:           { mark: PixMark,           tone: "text-teal-300",    dot: "bg-teal-400",    short: "PIX" },
  dinheiro:      { mark: DinheiroMark,      tone: "text-emerald-300", dot: "bg-emerald-400", short: "Dinheiro" },
  debito:        { mark: DebitoMark,        tone: "text-sky-300",     dot: "bg-sky-400",     short: "Débito" },
  credito:       { mark: CreditoMark,       tone: "text-indigo-300",  dot: "bg-indigo-400",  short: "Crédito" },
  boleto:        { mark: BoletoMark,        tone: "text-amber-300",   dot: "bg-amber-400",   short: "Boleto" },
  transferencia: { mark: TransferenciaMark, tone: "text-rose-300",    dot: "bg-rose-400",    short: "TED/DOC" },
};

// ═══════════════════════════════════════════════════════════════════════════
// COMPONENTE PRINCIPAL
// ═══════════════════════════════════════════════════════════════════════════

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

  const remaining = Math.max(0, treatmentValue - downPayment);
  const installmentValue = installments > 0 ? remaining / installments : 0;

  const splitTotal = useMemo(
    () => splits.reduce((acc, s) => acc + (Number.isFinite(s.amount) ? s.amount : 0), 0),
    [splits]
  );
  const splitRemaining = Math.round((treatmentValue - splitTotal) * 100) / 100;
  const splitDiff = Math.round((splitTotal - treatmentValue) * 100) / 100;
  const splitValid = splits.length >= 2 && Math.abs(splitDiff) < 0.01;

  const ctaAmount = splitMode ? splitTotal : treatmentValue;

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
    const next = (Object.keys(PAYMENT_METHOD_LABEL) as PaymentMethod[]).find((k) => !used.has(k));
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
    const others = splits.filter((s) => s.uid !== uid).reduce((acc, s) => acc + s.amount, 0);
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
        leadId, clinicId,
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
        leadId, clinicId,
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
    !!leadId && !!treatmentKey && !!clinicId &&
    !createMutation.isPending && (splitMode ? splitValid : true);

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/60 backdrop-blur-sm">
      <div className={cn(
        "relative w-full sm:max-w-2xl max-h-[96vh] flex flex-col",
        "rounded-t-2xl sm:rounded-xl border border-white/[0.06]",
        "bg-[#0a0a0d] shadow-[0_24px_60px_-12px_rgba(0,0,0,0.7)]"
      )}>

        {/* ═════════ HEADER ═════════ */}
        <div className="flex items-start justify-between px-6 pt-6 pb-5 border-b border-white/[0.05] shrink-0">
          <div>
            <p className="text-[10px] font-medium uppercase tracking-[0.22em] text-slate-500">
              Financeiro · Novo lançamento
            </p>
            <h3 className="mt-2 text-[18px] font-semibold text-slate-50 tracking-tight">
              Registrar pagamento
            </h3>
          </div>
          <button
            onClick={onClose}
            className="h-8 w-8 grid place-items-center rounded-md text-slate-500 hover:text-slate-200 hover:bg-white/[0.04] transition"
            aria-label="Fechar"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* ═════════ BODY ═════════ */}
        <div className="flex-1 overflow-y-auto px-6 py-6 space-y-7">

          {/* 01 · Paciente */}
          <Section number="01" label="Paciente">
            <LeadSelect value={leadId} onChange={(id) => setLeadId(id)} />
            <p className="mt-2 text-[11px] text-slate-500">
              Digite nome, telefone ou ID para filtrar.
            </p>
          </Section>

          {/* 02 · Tratamento */}
          <Section number="02" label="Tratamento">
            <div className="grid grid-cols-3 gap-3">
              <div className="col-span-2">
                <FieldLabel>Procedimento</FieldLabel>
                {loadingTreatments ? (
                  <div className="h-10 mt-2 rounded-md bg-white/[0.04] animate-pulse" />
                ) : (
                  <Select className="mt-2" value={treatmentKey}
                    onChange={(e) => onPickTreatment(e.target.value)}>
                    {treatments.map((t) => (
                      <option key={t.key} value={t.name}>{t.name}</option>
                    ))}
                  </Select>
                )}
              </div>
              <div>
                <FieldLabel>Duração</FieldLabel>
                <div className="relative mt-2">
                  <Input type="number" min={0} value={durationMonths}
                    onChange={(e) => setDurationMonths(Math.max(0, Number(e.target.value)))}
                    className="pr-14 tabular-nums"/>
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] uppercase tracking-wider text-slate-500 pointer-events-none">
                    meses
                  </span>
                </div>
              </div>
            </div>

            <div className="mt-3">
              <FieldLabel>Valor do tratamento</FieldLabel>
              <div className="relative mt-2">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[11px] font-medium text-slate-500 pointer-events-none">R$</span>
                <Input type="number" step="0.01" min={0}
                  className="pl-9 tabular-nums text-base font-medium"
                  value={treatmentValue}
                  onChange={(e) => setTreatmentValue(Math.max(0, Number(e.target.value)))}/>
              </div>
              <p className="mt-1.5 text-[10px] text-slate-600 tabular-nums">
                Padrão {formatCurrency(DEFAULT_TREATMENT_VALUE)}
              </p>
            </div>
          </Section>

          {/* 03 · Forma de pagamento */}
          <Section number="03" label="Forma de pagamento">
            <div className="inline-flex items-center p-0.5 rounded-lg bg-white/[0.04] border border-white/[0.05]">
              <SegmentButton active={!splitMode} onClick={disableSplitMode}>
                Forma única
              </SegmentButton>
              <SegmentButton active={splitMode} onClick={() => !splitMode && enableSplitMode()}>
                Dividir pagamento
              </SegmentButton>
            </div>
            <p className="mt-2 text-[11px] text-slate-500">
              {splitMode
                ? "Combine várias formas — cada uma com seu próprio parcelamento."
                : "Um único método para o valor total."}
            </p>

            {/* MODO SIMPLES */}
            {!splitMode && (
              <div className="mt-5 space-y-5">
                <div>
                  <FieldLabel>Selecione o método</FieldLabel>
                  <div className="mt-2 grid grid-cols-3 sm:grid-cols-6 gap-2">
                    {(Object.keys(PAYMENT_METHOD_LABEL) as PaymentMethod[]).map((k) => (
                      <MethodCard key={k} methodKey={k}
                        selected={method === k}
                        onClick={() => setMethod(k)}/>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <FieldLabel>Entrada</FieldLabel>
                    <div className="relative mt-2">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[11px] text-slate-500 pointer-events-none">R$</span>
                      <Input type="number" step="0.01" min={0} max={treatmentValue}
                        className="pl-9 tabular-nums"
                        value={downPayment}
                        onChange={(e) =>
                          setDownPayment(Math.max(0, Math.min(treatmentValue, Number(e.target.value))))
                        }/>
                    </div>
                  </div>
                  <div>
                    <FieldLabel>Parcelas</FieldLabel>
                    <div className="relative mt-2">
                      <Input type="number" min={1} max={60}
                        className="pr-8 tabular-nums"
                        value={installments}
                        onChange={(e) =>
                          setInstallments(Math.max(1, Math.min(60, Number(e.target.value))))
                        }/>
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[11px] text-slate-500 pointer-events-none">×</span>
                    </div>
                  </div>
                  <div>
                    <FieldLabel>Data</FieldLabel>
                    <Input type="datetime-local"
                      className="mt-2 tabular-nums text-[13px]"
                      value={paidAt}
                      onChange={(e) => setPaidAt(e.target.value)}/>
                  </div>
                </div>
              </div>
            )}

            {/* MODO SPLIT */}
            {splitMode && (
              <div className="mt-5 space-y-3">
                <SplitStatusBar total={treatmentValue} current={splitTotal}
                  valid={splitValid} remaining={splitRemaining} diff={splitDiff} splits={splits}/>

                <div className="space-y-2.5">
                  {splits.map((s, idx) => (
                    <SplitRowCard key={s.uid} index={idx} row={s}
                      canDelete={splits.length > 2}
                      onChange={(patch) => updateSplit(s.uid, patch)}
                      onRemove={() => removeSplit(s.uid)}
                      onFillRemaining={() => distributeRemaining(s.uid)}/>
                  ))}
                </div>

                <div className="flex items-center justify-between pt-1">
                  <Button variant="ghost" onClick={addSplit}
                    disabled={splits.length >= 6}
                    className="gap-1.5 text-slate-300 hover:text-slate-100">
                    <Plus className="h-4 w-4" /> Adicionar forma
                  </Button>
                  <div className="flex items-center gap-2">
                    <label className="text-[10px] uppercase tracking-widest text-slate-500">Data</label>
                    <Input type="datetime-local" value={paidAt}
                      onChange={(e) => setPaidAt(e.target.value)}
                      className="text-[12px] py-1.5 tabular-nums"/>
                  </div>
                </div>
              </div>
            )}
          </Section>

          {/* 04 · Observações */}
          <Section number="04" label="Observações" optional>
            <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2}
              placeholder="Anestesia usada, convênio, detalhes internos…"
              className={cn(
                "w-full bg-white/[0.02] border border-white/[0.06] rounded-md px-3 py-2.5 text-sm text-slate-100",
                "placeholder:text-slate-600 focus:outline-none focus:border-white/[0.15]",
                "transition resize-none"
              )}/>
          </Section>

          {/* Resumo (só modo simples) */}
          {!splitMode && (
            <div className="rounded-lg border border-white/[0.06] bg-white/[0.015] overflow-hidden">
              <div className="flex items-center justify-between px-4 py-2.5 border-b border-white/[0.05]">
                <p className="text-[10px] font-medium uppercase tracking-[0.22em] text-slate-500">
                  Resumo
                </p>
                <div className="flex items-center gap-1.5">
                  <span className={cn("h-1.5 w-1.5 rounded-full", METHOD_META[method].dot)} />
                  <p className="text-[10px] font-medium uppercase tracking-wider text-slate-400">
                    {PAYMENT_METHOD_LABEL[method]}
                  </p>
                </div>
              </div>
              <div className="divide-y divide-white/[0.04]">
                <SummaryLine label="Valor total" value={formatCurrency(treatmentValue)} />
                <SummaryLine label="Entrada"
                  value={downPayment > 0 ? `− ${formatCurrency(downPayment)}` : "—"}
                  muted={downPayment === 0}/>
                {installments > 1 ? (
                  <SummaryLine label={`Parcelamento · ${installments}×`}
                    value={formatCurrency(installmentValue)}
                    hint={`Total ${formatCurrency(remaining)}`}/>
                ) : (
                  <SummaryLine label="Saldo" value={formatCurrency(remaining)} />
                )}
              </div>
            </div>
          )}
        </div>

        {/* ═════════ FOOTER com total vivo ═════════ */}
        <div className="shrink-0 border-t border-white/[0.06] bg-[#0a0a0d]">
          <div className="px-6 py-4 flex items-center gap-3 justify-between">
            <div className="min-w-0">
              <p className="text-[10px] font-medium uppercase tracking-[0.2em] text-slate-500">
                Total a registrar
              </p>
              <p className="text-[15px] font-semibold tabular-nums text-slate-50 truncate">
                {formatCurrency(ctaAmount)}
                {splitMode && !splitValid && (
                  <span className="ml-2 text-[11px] font-normal text-amber-400">
                    ajustar splits
                  </span>
                )}
              </p>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <Button variant="ghost" onClick={onClose}
                disabled={createMutation.isPending}
                className="text-slate-400 hover:text-slate-200">
                Cancelar
              </Button>
              <Button onClick={onSubmit} disabled={!canSubmit}
                className={cn(
                  "gap-2 px-5 rounded-md font-semibold transition",
                  canSubmit
                    ? "bg-emerald-500 hover:bg-emerald-400 text-emerald-950 shadow-sm"
                    : "bg-white/[0.06] text-slate-500 cursor-not-allowed"
                )}>
                {createMutation.isPending ? (
                  <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Salvando…</>
                ) : (
                  <>Registrar pagamento</>
                )}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// SUBCOMPONENTES
// ═══════════════════════════════════════════════════════════════════════════

function Section({
  number, label, optional, children,
}: {
  number: string; label: string; optional?: boolean; children: React.ReactNode;
}) {
  return (
    <section>
      <div className="flex items-center gap-3 mb-3">
        <span className="text-[10px] font-mono tabular-nums text-slate-600">{number}</span>
        <span className="text-[11px] font-medium uppercase tracking-[0.18em] text-slate-300">
          {label}
        </span>
        {optional && (
          <span className="text-[9px] font-medium uppercase tracking-wider text-slate-600">
            opcional
          </span>
        )}
        <div className="flex-1 h-px bg-white/[0.05]" />
      </div>
      {children}
    </section>
  );
}

function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <label className="text-[10px] font-medium uppercase tracking-[0.14em] text-slate-500">
      {children}
    </label>
  );
}

function SegmentButton({
  active, onClick, children,
}: {
  active: boolean; onClick: () => void; children: React.ReactNode;
}) {
  return (
    <button type="button" onClick={onClick}
      className={cn(
        "relative px-4 py-1.5 text-[12px] font-medium rounded-md transition",
        active
          ? "bg-white/[0.08] text-slate-50 shadow-sm"
          : "text-slate-400 hover:text-slate-200"
      )}>
      {children}
    </button>
  );
}

function MethodCard({
  methodKey, selected, onClick,
}: {
  methodKey: PaymentMethod; selected: boolean; onClick: () => void;
}) {
  const meta = METHOD_META[methodKey];
  const Mark = meta.mark;
  return (
    <button type="button" onClick={onClick} aria-pressed={selected}
      className={cn(
        "group relative flex flex-col items-center gap-1.5 px-2 py-3 rounded-lg border transition",
        selected
          ? "border-white/20 bg-white/[0.04]"
          : "border-white/[0.05] bg-white/[0.015] hover:border-white/10 hover:bg-white/[0.03]"
      )}>
      {selected && (
        <span className="absolute top-1.5 right-1.5 h-3.5 w-3.5 rounded-full bg-emerald-500 grid place-items-center">
          <Check className="h-2.5 w-2.5 text-emerald-950" strokeWidth={3} />
        </span>
      )}
      <Mark className={cn(
        "h-7 w-7 transition",
        selected ? meta.tone : "text-slate-500 group-hover:text-slate-400"
      )}/>
      <span className={cn(
        "text-[10px] font-medium tracking-wide transition",
        selected ? "text-slate-100" : "text-slate-500 group-hover:text-slate-300"
      )}>
        {meta.short}
      </span>
    </button>
  );
}

function SplitStatusBar({
  total, current, valid, remaining, diff, splits,
}: {
  total: number; current: number; valid: boolean;
  remaining: number; diff: number; splits: SplitRow[];
}) {
  const statusText = valid
    ? "Valores conferem"
    : diff > 0
    ? `Excede ${formatCurrency(diff)}`
    : `Faltam ${formatCurrency(Math.max(0, remaining))}`;

  return (
    <div className="rounded-lg border border-white/[0.06] bg-white/[0.015] p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[10px] font-medium uppercase tracking-[0.22em] text-slate-500">
            Composição
          </p>
          <p className="mt-1 text-[20px] font-semibold tabular-nums text-slate-50 leading-none">
            {formatCurrency(current)}
            <span className="text-[12px] font-normal text-slate-500 ml-1.5">
              / {formatCurrency(total)}
            </span>
          </p>
        </div>
        <div className={cn(
          "shrink-0 inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10.5px] font-medium",
          valid
            ? "bg-emerald-500/10 text-emerald-300 ring-1 ring-inset ring-emerald-500/20"
            : diff > 0
            ? "bg-rose-500/10 text-rose-300 ring-1 ring-inset ring-rose-500/20"
            : "bg-amber-500/10 text-amber-300 ring-1 ring-inset ring-amber-500/20"
        )}>
          {valid ? <Check className="h-3 w-3" strokeWidth={3} /> : <AlertCircle className="h-3 w-3" />}
          {statusText}
        </div>
      </div>

      <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-white/[0.04] flex">
        {splits.map((s) => {
          const sPct = total > 0 ? Math.max(0, Math.min(100, (s.amount / total) * 100)) : 0;
          return (
            <div key={s.uid}
              className={cn("h-full transition-all", METHOD_META[s.paymentMethod].dot)}
              style={{ width: `${sPct}%` }}/>
          );
        })}
      </div>

      <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5">
        {splits.map((s) => (
          <div key={s.uid} className="flex items-center gap-1.5">
            <span className={cn("h-1.5 w-1.5 rounded-full", METHOD_META[s.paymentMethod].dot)} />
            <span className="text-[11px] text-slate-400">
              {PAYMENT_METHOD_LABEL[s.paymentMethod]}
            </span>
            <span className="text-[11px] tabular-nums text-slate-200">
              {formatCurrency(s.amount)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function SplitRowCard({
  index, row, canDelete, onChange, onRemove, onFillRemaining,
}: {
  index: number; row: SplitRow; canDelete: boolean;
  onChange: (patch: Partial<Omit<SplitRow, "uid">>) => void;
  onRemove: () => void;
  onFillRemaining: () => void;
}) {
  const meta = METHOD_META[row.paymentMethod];
  const Mark = meta.mark;
  const perInstallment = row.installments > 0 ? row.amount / row.installments : 0;

  return (
    <div className="rounded-lg border border-white/[0.06] bg-white/[0.015] overflow-hidden">
      <div className="flex items-center gap-3 px-3 py-2.5 border-b border-white/[0.04]">
        <div className={cn(
          "h-7 w-7 shrink-0 grid place-items-center rounded-md bg-white/[0.04]",
          meta.tone
        )}>
          <Mark className="h-5 w-5" />
        </div>
        <span className="text-[10px] font-mono tabular-nums text-slate-600">
          {String(index + 1).padStart(2, "0")}
        </span>
        <Select value={row.paymentMethod}
          onChange={(e) => onChange({ paymentMethod: e.target.value as PaymentMethod })}
          className="flex-1 !py-1.5 !text-[13px]">
          {(Object.keys(PAYMENT_METHOD_LABEL) as PaymentMethod[]).map((k) => (
            <option key={k} value={k}>{PAYMENT_METHOD_LABEL[k]}</option>
          ))}
        </Select>
        <button type="button" onClick={onRemove} disabled={!canDelete}
          aria-label="Remover forma"
          className={cn(
            "h-7 w-7 shrink-0 grid place-items-center rounded-md text-slate-500 transition",
            canDelete
              ? "hover:bg-rose-500/10 hover:text-rose-300"
              : "opacity-30 cursor-not-allowed"
          )}>
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>

      <div className="grid grid-cols-[1fr_auto_1fr] gap-3 p-3 items-end">
        <div>
          <FieldLabel>Valor</FieldLabel>
          <div className="relative mt-1.5">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[11px] text-slate-500 pointer-events-none">R$</span>
            <Input type="number" step="0.01" min={0} value={row.amount}
              onChange={(e) => onChange({ amount: Math.max(0, Number(e.target.value)) })}
              onBlur={(e) => {
                const n = Math.max(0, Number(e.target.value));
                onChange({ amount: Math.round(n * 100) / 100 });
              }}
              className="pl-9 tabular-nums"/>
          </div>
        </div>

        <button type="button" onClick={onFillRemaining}
          className="h-10 px-3 text-[11px] font-medium text-slate-400 border border-white/[0.05] rounded-md hover:border-white/[0.12] hover:text-slate-200 transition whitespace-nowrap"
          title="Preencher com o valor restante">
          Preencher resto
        </button>

        <div>
          <FieldLabel>Parcelas</FieldLabel>
          <div className="relative mt-1.5">
            <Input type="number" min={1} max={60} value={row.installments}
              onChange={(e) =>
                onChange({ installments: Math.max(1, Math.min(60, Number(e.target.value))) })
              }
              className="pr-8 tabular-nums"/>
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[11px] text-slate-500 pointer-events-none">×</span>
          </div>
        </div>
      </div>

      <div className="px-3 py-2 bg-white/[0.015] border-t border-white/[0.04]">
        <span className="text-[11px] text-slate-500">
          {row.installments}× de{" "}
          <span className="tabular-nums text-slate-300">{formatCurrency(perInstallment)}</span>
        </span>
      </div>
    </div>
  );
}

function SummaryLine({
  label, value, hint, muted,
}: {
  label: string; value: string; hint?: string; muted?: boolean;
}) {
  return (
    <div className="flex items-baseline justify-between px-4 py-2.5">
      <span className="text-[12px] text-slate-400">{label}</span>
      <div className="text-right">
        <span className={cn(
          "text-[13px] font-medium tabular-nums",
          muted ? "text-slate-600" : "text-slate-100"
        )}>
          {value}
        </span>
        {hint && <p className="text-[10px] text-slate-600 tabular-nums">{hint}</p>}
      </div>
    </div>
  );
}