import { cn } from "@/lib/utils";
import {
  PAYMENT_METHOD_LABEL,
  type PaymentMethod,
} from "@/services/payments";

export type BrandMarkProps = { className?: string };

export const PixMark = ({ className }: BrandMarkProps) => (
  <svg viewBox="0 0 32 32" fill="none" className={className}>
    <path
      d="M6 16 L16 6 L26 16 L16 26 Z"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinejoin="round"
      fill="currentColor"
      fillOpacity="0.08"
    />
    <path d="M11.5 16 L16 11.5 L20.5 16 L16 20.5 Z" fill="currentColor" />
  </svg>
);

export const DinheiroMark = ({ className }: BrandMarkProps) => (
  <svg viewBox="0 0 32 32" fill="none" className={className}>
    <rect
      x="4" y="9" width="24" height="14" rx="2"
      stroke="currentColor" strokeWidth="1.75"
      fill="currentColor" fillOpacity="0.06"
    />
    <circle cx="16" cy="16" r="3.5" stroke="currentColor" strokeWidth="1.75" fill="none" />
    <path
      d="M16 13.5 V 18.5 M14.5 14.5 H17 a1 1 0 0 1 0 2 H15 a1 1 0 0 0 0 2 H17.5"
      stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" fill="none"
    />
    <circle cx="7.5" cy="16" r="0.9" fill="currentColor" opacity=".5" />
    <circle cx="24.5" cy="16" r="0.9" fill="currentColor" opacity=".5" />
  </svg>
);

export const DebitoMark = ({ className }: BrandMarkProps) => (
  <svg viewBox="0 0 32 32" fill="none" className={className}>
    <rect
      x="4" y="8" width="24" height="16" rx="2.5"
      stroke="currentColor" strokeWidth="1.75"
      fill="currentColor" fillOpacity="0.06"
    />
    <rect x="4" y="12" width="24" height="3" fill="currentColor" opacity="0.7" />
    <rect x="7" y="19" width="5" height="1.5" rx="0.5" fill="currentColor" opacity="0.5" />
    <rect x="14" y="19" width="3" height="1.5" rx="0.5" fill="currentColor" opacity="0.5" />
  </svg>
);

export const CreditoMark = ({ className }: BrandMarkProps) => (
  <svg viewBox="0 0 32 32" fill="none" className={className}>
    <rect
      x="4" y="8" width="24" height="16" rx="2.5"
      stroke="currentColor" strokeWidth="1.75"
      fill="currentColor" fillOpacity="0.06"
    />
    <rect x="7" y="12" width="5" height="4" rx="0.8" fill="currentColor" opacity="0.85" />
    <rect x="7.8" y="13.2" width="3.4" height="0.4" fill="currentColor" opacity="0.3" />
    <rect x="7.8" y="14.3" width="3.4" height="0.4" fill="currentColor" opacity="0.3" />
    <rect x="14" y="19" width="10" height="1.2" rx="0.6" fill="currentColor" opacity="0.55" />
    <rect x="14" y="21.2" width="6" height="1.2" rx="0.6" fill="currentColor" opacity="0.35" />
  </svg>
);

export const BoletoMark = ({ className }: BrandMarkProps) => (
  <svg viewBox="0 0 32 32" fill="none" className={className}>
    <rect
      x="4" y="8" width="24" height="16" rx="1.5"
      stroke="currentColor" strokeWidth="1.75"
      fill="currentColor" fillOpacity="0.06"
    />
    {[
      [7, 1], [9, 2.5], [12.5, 1], [14.5, 2],
      [17, 1], [19, 3], [22.5, 1.5], [25, 2],
    ].map(([x, w], i) => (
      <rect
        key={i} x={x} y="11" width={w} height="10"
        fill="currentColor"
        opacity={0.55 + (i % 2) * 0.3}
      />
    ))}
  </svg>
);

export const TransferenciaMark = ({ className }: BrandMarkProps) => (
  <svg viewBox="0 0 32 32" fill="none" className={className}>
    <path
      d="M8 14 H22 M18 10 L22 14 L18 18"
      stroke="currentColor" strokeWidth="1.75"
      strokeLinecap="round" strokeLinejoin="round" fill="none"
    />
    <path
      d="M24 20 H10 M14 24 L10 20 L14 16"
      stroke="currentColor" strokeWidth="1.75"
      strokeLinecap="round" strokeLinejoin="round" fill="none"
    />
  </svg>
);

export type MethodMeta = {
  mark: React.ComponentType<BrandMarkProps>;
  text: string;
  bg: string;
  ring: string;
  dot: string;
  tone: string;
  hex: string;
  short: string;
};

export const METHOD_META: Record<PaymentMethod, MethodMeta> = {
  pix: {
    mark: PixMark,
    text: "text-teal-300",
    bg: "bg-teal-500/10",
    ring: "ring-teal-500/20",
    dot: "bg-teal-400",
    tone: "text-teal-300",
    hex: "#2dd4bf",
    short: "PIX",
  },
  dinheiro: {
    mark: DinheiroMark,
    text: "text-emerald-300",
    bg: "bg-emerald-500/10",
    ring: "ring-emerald-500/20",
    dot: "bg-emerald-400",
    tone: "text-emerald-300",
    hex: "#34d399",
    short: "Dinheiro",
  },
  debito: {
    mark: DebitoMark,
    text: "text-sky-300",
    bg: "bg-sky-500/10",
    ring: "ring-sky-500/20",
    dot: "bg-sky-400",
    tone: "text-sky-300",
    hex: "#38bdf8",
    short: "Débito",
  },
  credito: {
    mark: CreditoMark,
    text: "text-indigo-300",
    bg: "bg-indigo-500/10",
    ring: "ring-indigo-500/20",
    dot: "bg-indigo-400",
    tone: "text-indigo-300",
    hex: "#818cf8",
    short: "Crédito",
  },
  boleto: {
    mark: BoletoMark,
    text: "text-amber-300",
    bg: "bg-amber-500/10",
    ring: "ring-amber-500/20",
    dot: "bg-amber-400",
    tone: "text-amber-300",
    hex: "#fbbf24",
    short: "Boleto",
  },
  transferencia: {
    mark: TransferenciaMark,
    text: "text-rose-300",
    bg: "bg-rose-500/10",
    ring: "ring-rose-500/20",
    dot: "bg-rose-400",
    tone: "text-rose-300",
    hex: "#fb7185",
    short: "TED/DOC",
  },
};

export function MethodPill({
  methodKey,
  size = "sm",
  className,
}: {
  methodKey: PaymentMethod;
  size?: "sm" | "md";
  className?: string;
}) {
  const meta = METHOD_META[methodKey];
  const Mark = meta.mark;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-md ring-1 ring-inset",
        meta.bg,
        meta.ring,
        size === "sm" ? "pl-1 pr-2 py-0.5" : "pl-1.5 pr-2.5 py-1",
        className,
      )}
    >
      <Mark
        className={cn(meta.text, size === "sm" ? "h-3.5 w-3.5" : "h-4 w-4")}
      />
      <span
        className={cn(
          "font-medium",
          meta.text,
          size === "sm" ? "text-[11px]" : "text-[12px]",
        )}
      >
        {meta.short}
      </span>
    </span>
  );
}

export { PAYMENT_METHOD_LABEL };
