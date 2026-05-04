import {
  ArrowDownLeft,
  ArrowUpRight,
  Banknote,
  Building,
  CalendarClock,
  CheckCircle2,
  CircleDashed,
  CircleSlash,
  Coins,
  CreditCard,
  FileText,
  Landmark,
  Smartphone,
  Wallet,
  XCircle,
} from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import {
  CATEGORY_LABEL,
  PAYMENT_METHOD_LABEL,
  STATUS_LABEL,
  TYPE_LABEL,
  type CashMovementCategory,
  type CashMovementStatus,
  type CashMovementType,
  type MovementTypePayment,
} from "@/services/cashMovements";

type Tone = "neutral" | "sky" | "emerald" | "amber" | "rose" | "indigo" | "slate";

const STATUS_TONE: Record<CashMovementStatus, Tone> = {
  COMPLETED: "emerald",
  PENDING: "amber",
  SCHEDULED: "sky",
  CANCELED: "slate",
  OVERDUE: "rose",
};

const STATUS_ICON: Record<CashMovementStatus, React.ComponentType<{ className?: string }>> = {
  COMPLETED: CheckCircle2,
  PENDING: CircleDashed,
  SCHEDULED: CalendarClock,
  CANCELED: CircleSlash,
  OVERDUE: XCircle,
};

export function StatusBadge({ status }: { status: CashMovementStatus }) {
  const Icon = STATUS_ICON[status];
  return (
    <Badge tone={STATUS_TONE[status]}>
      <Icon className="h-3 w-3" />
      {STATUS_LABEL[status]}
    </Badge>
  );
}

const CATEGORY_TONE: Record<CashMovementCategory, Tone> = {
  SALE: "emerald",
  CHANGE: "sky",
  OTHER_IN: "indigo",
  EXPENSE: "rose",
  WITHDRAWAL: "amber",
  PAYMENT: "slate",
};

export function CategoryBadge({ category }: { category: CashMovementCategory }) {
  return <Badge tone={CATEGORY_TONE[category]}>{CATEGORY_LABEL[category]}</Badge>;
}

export function TypePill({ type }: { type: CashMovementType }) {
  const isEntry = type === "ENTRY";
  return (
    <span
      className={
        "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium ring-1 ring-inset " +
        (isEntry
          ? "bg-emerald-500/10 text-emerald-300 ring-emerald-500/20"
          : "bg-rose-500/10 text-rose-300 ring-rose-500/20")
      }
    >
      {isEntry ? (
        <ArrowDownLeft className="h-3 w-3" />
      ) : (
        <ArrowUpRight className="h-3 w-3" />
      )}
      {TYPE_LABEL[type]}
    </span>
  );
}

export const PAYMENT_ICON: Record<
  MovementTypePayment,
  React.ComponentType<{ className?: string }>
> = {
  CASH: Banknote,
  PIX: Smartphone,
  CREDIT_CARD: CreditCard,
  DEBIT_CARD: Wallet,
  BANK_TRANSFER: Landmark,
  BANK_SLIP: FileText,
  CHECK: Building,
  OTHER: Coins,
};

export function PaymentMethodPill({
  method,
}: {
  method: MovementTypePayment | null | undefined;
}) {
  if (!method)
    return (
      <span className="inline-flex items-center gap-1 text-[11px] text-slate-500">—</span>
    );
  const Icon = PAYMENT_ICON[method];
  return (
    <span className="inline-flex items-center gap-1.5 text-[11.5px] text-slate-300">
      <Icon className="h-3.5 w-3.5 text-slate-400" />
      {PAYMENT_METHOD_LABEL[method]}
    </span>
  );
}
