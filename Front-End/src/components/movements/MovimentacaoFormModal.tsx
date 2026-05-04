import { useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  ArrowDownLeft,
  ArrowUpRight,
  Loader2,
  Paperclip,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { cn, formatCurrency } from "@/lib/utils";
import {
  CASH_MOVEMENT_CATEGORIES,
  CASH_MOVEMENT_STATUSES,
  CATEGORY_LABEL,
  MOVEMENT_PAYMENT_METHODS,
  PAYMENT_METHOD_LABEL,
  STATUS_LABEL,
  type CashMovement,
  type CashMovementCategory,
  type CashMovementStatus,
  type CashMovementType,
  type CreateCashMovementInput,
  type MovementTypePayment,
} from "@/services/cashMovements";
import { PAYMENT_ICON } from "@/components/movements/MovimentacaoBadges";
import {
  useCreateCashMovement,
  useUpdateCashMovement,
} from "@/hooks/useCashMovements";

interface Props {
  open: boolean;
  onClose: () => void;
  /** Quando presente, o modal entra em modo edição. */
  movement?: CashMovement | null;
}

const ENTRY_CATEGORIES: CashMovementCategory[] = ["SALE", "CHANGE", "OTHER_IN"];
const EXIT_CATEGORIES: CashMovementCategory[] = [
  "EXPENSE",
  "WITHDRAWAL",
  "PAYMENT",
];

function nowLocalISO(): string {
  // 'YYYY-MM-DDTHH:mm' for datetime-local input
  const d = new Date();
  const tz = d.getTimezoneOffset() * 60000;
  return new Date(d.getTime() - tz).toISOString().slice(0, 16);
}

function isoToLocalInput(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const tz = d.getTimezoneOffset() * 60000;
  return new Date(d.getTime() - tz).toISOString().slice(0, 16);
}

function localInputToISO(local: string): string | null {
  if (!local) return null;
  const d = new Date(local);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString();
}

export function MovimentacaoFormModal({ open, onClose, movement }: Props) {
  const isEdit = !!movement;
  const createMutation = useCreateCashMovement();
  const updateMutation = useUpdateCashMovement();

  const [type, setType] = useState<CashMovementType>("ENTRY");
  const [category, setCategory] = useState<CashMovementCategory>("SALE");
  const [status, setStatus] = useState<CashMovementStatus>("COMPLETED");
  const [paymentMethod, setPaymentMethod] = useState<MovementTypePayment>("PIX");
  const [value, setValue] = useState<number>(0);
  const [description, setDescription] = useState<string>("");
  const [date, setDate] = useState<string>(nowLocalISO());
  const [dueDate, setDueDate] = useState<string>("");
  const [paidAt, setPaidAt] = useState<string>("");
  const [referenceCode, setReferenceCode] = useState<string>("");
  const [counterpartyName, setCounterpartyName] = useState<string>("");
  const [counterpartyDocument, setCounterpartyDocument] = useState<string>("");
  const [notes, setNotes] = useState<string>("");
  const [attachmentUrl, setAttachmentUrl] = useState<string>("");

  // Hidrata o estado quando abrir em modo edição
  useEffect(() => {
    if (!open) return;
    if (movement) {
      setType(movement.type);
      setCategory(movement.category);
      setStatus(movement.status);
      setPaymentMethod(movement.typePayment ?? "PIX");
      setValue(Number(movement.value));
      setDescription(movement.description ?? "");
      setDate(isoToLocalInput(movement.date) || nowLocalISO());
      setDueDate(isoToLocalInput(movement.dueDate));
      setPaidAt(isoToLocalInput(movement.paidAt));
      setReferenceCode(movement.referenceCode ?? "");
      setCounterpartyName(movement.counterpartyName ?? "");
      setCounterpartyDocument(movement.counterpartyDocument ?? "");
      setNotes(movement.notes ?? "");
      setAttachmentUrl(movement.attachmentUrl ?? "");
    } else {
      setType("ENTRY");
      setCategory("SALE");
      setStatus("COMPLETED");
      setPaymentMethod("PIX");
      setValue(0);
      setDescription("");
      setDate(nowLocalISO());
      setDueDate("");
      setPaidAt("");
      setReferenceCode("");
      setCounterpartyName("");
      setCounterpartyDocument("");
      setNotes("");
      setAttachmentUrl("");
    }
  }, [open, movement]);

  // Garante categoria coerente com o tipo
  useEffect(() => {
    const valid = type === "ENTRY" ? ENTRY_CATEGORIES : EXIT_CATEGORIES;
    if (!valid.includes(category)) {
      setCategory(valid[0]);
    }
  }, [type, category]);

  const errors = useMemo(() => {
    const e: Record<string, string> = {};
    if (!description.trim()) e.description = "Descrição é obrigatória.";
    if (!(value > 0)) e.value = "Valor precisa ser positivo.";
    if (description.length > 255) e.description = "Máximo de 255 caracteres.";
    if (counterpartyDocument && counterpartyDocument.length > 20)
      e.counterpartyDocument = "Documento muito longo.";
    if (attachmentUrl && !/^https?:\/\//i.test(attachmentUrl))
      e.attachmentUrl = "Use uma URL http(s) válida.";
    return e;
  }, [description, value, counterpartyDocument, attachmentUrl]);

  const isValid = Object.keys(errors).length === 0;
  const submitting = createMutation.isPending || updateMutation.isPending;

  async function onSubmit() {
    if (!isValid || submitting) return;

    const payload: CreateCashMovementInput = {
      type,
      category,
      status,
      typePayment: paymentMethod,
      value: Number(value),
      description: description.trim(),
      date: localInputToISO(date) ?? new Date().toISOString(),
      dueDate: dueDate ? localInputToISO(dueDate) : null,
      paidAt: paidAt ? localInputToISO(paidAt) : null,
      referenceCode: referenceCode.trim() || null,
      counterpartyName: counterpartyName.trim() || null,
      counterpartyDocument: counterpartyDocument.trim() || null,
      notes: notes.trim() || null,
      attachmentUrl: attachmentUrl.trim() || null,
    };

    if (isEdit && movement) {
      await updateMutation.mutateAsync({ id: movement.id, input: payload });
    } else {
      await createMutation.mutateAsync(payload);
    }
    onClose();
  }

  if (!open) return null;

  const validCategories = type === "ENTRY" ? ENTRY_CATEGORIES : EXIT_CATEGORIES;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/60 backdrop-blur-sm">
      <div
        className={cn(
          "relative w-full sm:max-w-2xl max-h-[96vh] flex flex-col",
          "rounded-t-2xl sm:rounded-xl border border-white/[0.06]",
          "bg-[#0a0a0d] shadow-[0_24px_60px_-12px_rgba(0,0,0,0.7)]",
        )}
      >
        {/* HEADER */}
        <div className="flex items-start justify-between px-6 pt-6 pb-5 border-b border-white/[0.05] shrink-0">
          <div>
            <p className="text-[10px] font-medium uppercase tracking-[0.22em] text-slate-500">
              Financeiro · {isEdit ? "Edição de movimentação" : "Nova movimentação"}
            </p>
            <h3 className="mt-2 text-[18px] font-semibold text-slate-50 tracking-tight">
              {isEdit ? "Editar lançamento" : "Registrar movimentação"}
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

        {/* BODY */}
        <div className="flex-1 overflow-y-auto px-6 py-6 space-y-7">
          {/* 01 · Natureza */}
          <Section number="01" label="Natureza">
            <div className="grid grid-cols-2 gap-3">
              <NatureCard
                active={type === "ENTRY"}
                tone="emerald"
                onClick={() => setType("ENTRY")}
                icon={<ArrowDownLeft className="h-5 w-5" />}
                title="Entrada"
                hint="Aumenta o saldo"
              />
              <NatureCard
                active={type === "EXIT"}
                tone="rose"
                onClick={() => setType("EXIT")}
                icon={<ArrowUpRight className="h-5 w-5" />}
                title="Saída"
                hint="Reduz o saldo"
              />
            </div>

            <div className="mt-4 grid grid-cols-2 gap-3">
              <div>
                <FieldLabel>Categoria</FieldLabel>
                <Select
                  className="mt-2"
                  value={category}
                  onChange={(e) =>
                    setCategory(e.target.value as CashMovementCategory)
                  }
                >
                  {validCategories.map((c) => (
                    <option key={c} value={c}>
                      {CATEGORY_LABEL[c]}
                    </option>
                  ))}
                </Select>
              </div>
              <div>
                <FieldLabel>Status</FieldLabel>
                <Select
                  className="mt-2"
                  value={status}
                  onChange={(e) =>
                    setStatus(e.target.value as CashMovementStatus)
                  }
                >
                  {CASH_MOVEMENT_STATUSES.map((s) => (
                    <option key={s} value={s}>
                      {STATUS_LABEL[s]}
                    </option>
                  ))}
                </Select>
              </div>
            </div>
          </Section>

          {/* 02 · Valor & forma de pagamento */}
          <Section number="02" label="Valor & forma de pagamento">
            <div className="grid grid-cols-3 gap-3">
              <div className="col-span-2">
                <FieldLabel>Valor</FieldLabel>
                <div className="relative mt-2">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[11px] font-medium text-slate-500 pointer-events-none">
                    R$
                  </span>
                  <Input
                    type="number"
                    step="0.01"
                    min={0}
                    value={value}
                    onChange={(e) => setValue(Math.max(0, Number(e.target.value)))}
                    className="pl-9 tabular-nums text-base font-medium"
                  />
                </div>
                {errors.value && (
                  <FieldError>{errors.value}</FieldError>
                )}
              </div>
              <div>
                <FieldLabel>Data</FieldLabel>
                <Input
                  type="datetime-local"
                  className="mt-2 tabular-nums text-[13px]"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                />
              </div>
            </div>

            <div className="mt-4">
              <FieldLabel>Método de pagamento</FieldLabel>
              <div className="mt-2 grid grid-cols-4 sm:grid-cols-8 gap-2">
                {MOVEMENT_PAYMENT_METHODS.map((m) => (
                  <PaymentCard
                    key={m}
                    methodKey={m}
                    selected={paymentMethod === m}
                    onClick={() => setPaymentMethod(m)}
                  />
                ))}
              </div>
            </div>
          </Section>

          {/* 03 · Descrição & referência */}
          <Section number="03" label="Descrição & referência">
            <div>
              <FieldLabel>Descrição</FieldLabel>
              <Input
                type="text"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Ex.: Venda de produto X / Pagamento fornecedor Y"
                className="mt-2"
                maxLength={255}
              />
              <div className="mt-1 flex items-center justify-between">
                {errors.description ? (
                  <FieldError>{errors.description}</FieldError>
                ) : (
                  <span />
                )}
                <span className="text-[10px] tabular-nums text-slate-600">
                  {description.length}/255
                </span>
              </div>
            </div>

            <div className="mt-3 grid grid-cols-2 gap-3">
              <div>
                <FieldLabel>Código de referência</FieldLabel>
                <Input
                  type="text"
                  value={referenceCode}
                  onChange={(e) => setReferenceCode(e.target.value)}
                  placeholder="Ex.: NF 001234"
                  className="mt-2"
                />
              </div>
              <div>
                <FieldLabel>Anexo (URL)</FieldLabel>
                <Input
                  type="url"
                  value={attachmentUrl}
                  onChange={(e) => setAttachmentUrl(e.target.value)}
                  placeholder="https://…/comprovante.pdf"
                  className="mt-2"
                  icon={<Paperclip className="h-3.5 w-3.5" />}
                />
                {errors.attachmentUrl && (
                  <FieldError>{errors.attachmentUrl}</FieldError>
                )}
              </div>
            </div>
          </Section>

          {/* 04 · Datas adicionais */}
          <Section number="04" label="Vencimento & pagamento" optional>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <FieldLabel>Vencimento</FieldLabel>
                <Input
                  type="datetime-local"
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                  className="mt-2 tabular-nums text-[13px]"
                />
              </div>
              <div>
                <FieldLabel>Pago em</FieldLabel>
                <Input
                  type="datetime-local"
                  value={paidAt}
                  onChange={(e) => setPaidAt(e.target.value)}
                  className="mt-2 tabular-nums text-[13px]"
                />
              </div>
            </div>
            <p className="mt-2 text-[11px] text-slate-500">
              Use vencimento para movimentações <em>Pendentes</em> ou <em>Agendadas</em>.
              O <em>Pago em</em> registra a data efetiva quando diferente da data
              do lançamento.
            </p>
          </Section>

          {/* 05 · Cliente / fornecedor */}
          <Section number="05" label="Cliente ou fornecedor" optional>
            <div className="grid grid-cols-3 gap-3">
              <div className="col-span-2">
                <FieldLabel>Nome do contato</FieldLabel>
                <Input
                  type="text"
                  value={counterpartyName}
                  onChange={(e) => setCounterpartyName(e.target.value)}
                  placeholder="Nome / Razão social"
                  className="mt-2"
                />
              </div>
              <div>
                <FieldLabel>CPF / CNPJ</FieldLabel>
                <Input
                  type="text"
                  value={counterpartyDocument}
                  onChange={(e) => setCounterpartyDocument(e.target.value)}
                  placeholder="000.000.000-00"
                  className="mt-2 tabular-nums"
                />
                {errors.counterpartyDocument && (
                  <FieldError>{errors.counterpartyDocument}</FieldError>
                )}
              </div>
            </div>
          </Section>

          {/* 06 · Observações */}
          <Section number="06" label="Observações" optional>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              placeholder="Detalhes internos, justificativa, condições especiais…"
              className={cn(
                "w-full bg-white/[0.02] border border-white/[0.06] rounded-md px-3 py-2.5 text-sm text-slate-100",
                "placeholder:text-slate-600 focus:outline-none focus:border-white/[0.15]",
                "transition resize-none",
              )}
              maxLength={2000}
            />
            <div className="mt-1 text-right">
              <span className="text-[10px] tabular-nums text-slate-600">
                {notes.length}/2000
              </span>
            </div>
          </Section>
        </div>

        {/* FOOTER */}
        <div className="shrink-0 border-t border-white/[0.06] bg-[#0a0a0d]">
          <div className="px-6 py-4 flex items-center gap-3 justify-between">
            <div className="min-w-0">
              <p className="text-[10px] font-medium uppercase tracking-[0.2em] text-slate-500">
                Total a registrar
              </p>
              <p
                className={cn(
                  "text-[15px] font-semibold tabular-nums truncate",
                  type === "ENTRY" ? "text-emerald-300" : "text-rose-300",
                )}
              >
                {type === "EXIT" ? "− " : "+ "}
                {formatCurrency(value || 0)}
                {!isValid && (
                  <span className="ml-2 text-[11px] font-normal text-amber-400 inline-flex items-center gap-1">
                    <AlertCircle className="h-3 w-3" /> revise os campos
                  </span>
                )}
              </p>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <Button
                variant="ghost"
                onClick={onClose}
                disabled={submitting}
                className="text-slate-400 hover:text-slate-200"
              >
                Cancelar
              </Button>
              <Button
                onClick={onSubmit}
                disabled={!isValid || submitting}
                className={cn(
                  "gap-2 px-5 rounded-md font-semibold transition",
                  isValid
                    ? "bg-emerald-500 hover:bg-emerald-400 text-emerald-950 shadow-sm"
                    : "bg-white/[0.06] text-slate-500 cursor-not-allowed",
                )}
              >
                {submitting ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 animate-spin" /> Salvando…
                  </>
                ) : isEdit ? (
                  "Salvar alterações"
                ) : (
                  "Registrar movimentação"
                )}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Subcomponentes ─────────────────────────────────────────────────────────

function Section({
  number,
  label,
  optional,
  children,
}: {
  number: string;
  label: string;
  optional?: boolean;
  children: React.ReactNode;
}) {
  return (
    <section>
      <div className="flex items-center gap-3 mb-3">
        <span className="text-[10px] font-mono tabular-nums text-slate-600">
          {number}
        </span>
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

function FieldError({ children }: { children: React.ReactNode }) {
  return (
    <p className="mt-1 text-[10.5px] text-rose-400 inline-flex items-center gap-1">
      <AlertCircle className="h-3 w-3" /> {children}
    </p>
  );
}

function NatureCard({
  active,
  tone,
  onClick,
  icon,
  title,
  hint,
}: {
  active: boolean;
  tone: "emerald" | "rose";
  onClick: () => void;
  icon: React.ReactNode;
  title: string;
  hint: string;
}) {
  const tones =
    tone === "emerald"
      ? {
          ring: "ring-emerald-500/40",
          iconText: "text-emerald-300",
          iconBg: "bg-emerald-500/10",
        }
      : {
          ring: "ring-rose-500/40",
          iconText: "text-rose-300",
          iconBg: "bg-rose-500/10",
        };
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "flex items-center gap-3 px-4 py-3 rounded-lg border text-left transition",
        active
          ? "border-white/15 bg-white/[0.04] ring-1 " + tones.ring
          : "border-white/[0.06] bg-white/[0.015] hover:border-white/[0.12] hover:bg-white/[0.03]",
      )}
    >
      <span
        className={cn(
          "h-9 w-9 grid place-items-center rounded-md",
          tones.iconBg,
          tones.iconText,
        )}
      >
        {icon}
      </span>
      <div>
        <p className="text-[13px] font-semibold text-slate-100">{title}</p>
        <p className="text-[11px] text-slate-500">{hint}</p>
      </div>
    </button>
  );
}

function PaymentCard({
  methodKey,
  selected,
  onClick,
}: {
  methodKey: MovementTypePayment;
  selected: boolean;
  onClick: () => void;
}) {
  const Icon = PAYMENT_ICON[methodKey];
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      className={cn(
        "group relative flex flex-col items-center gap-1.5 px-2 py-2.5 rounded-lg border transition",
        selected
          ? "border-white/20 bg-white/[0.04]"
          : "border-white/[0.05] bg-white/[0.015] hover:border-white/10 hover:bg-white/[0.03]",
      )}
    >
      <Icon
        className={cn(
          "h-5 w-5 transition",
          selected ? "text-emerald-300" : "text-slate-500 group-hover:text-slate-300",
        )}
      />
      <span
        className={cn(
          "text-[10px] font-medium tracking-wide leading-tight text-center transition",
          selected
            ? "text-slate-100"
            : "text-slate-500 group-hover:text-slate-300",
        )}
      >
        {PAYMENT_METHOD_LABEL[methodKey]}
      </span>
    </button>
  );
}

// also export categories for external usage if needed
export { CASH_MOVEMENT_CATEGORIES };
