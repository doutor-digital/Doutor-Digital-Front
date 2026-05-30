import { ReactNode } from "react";
import { Bot, Sparkles, UserPen } from "@/components/icons";
import { cn } from "@/lib/utils";

type SourceProvenance = {
  receivedAt: string;
  webhookEvent?: string;
};

type FieldShellProps = {
  label: string;
  hint?: string;
  origin: "crm" | "manual";
  provenance?: SourceProvenance;
  required?: boolean;
  htmlFor?: string;
  children: ReactNode;
  className?: string;
};

function formatProvenanceTooltip(p?: SourceProvenance): string {
  if (!p) return "Preenchido automaticamente via webhook Kommo. Revise antes de salvar.";
  try {
    const dt = new Date(p.receivedAt);
    const fmt = dt.toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
    const evt = p.webhookEvent ? ` (${p.webhookEvent})` : "";
    return `Preenchido automaticamente em ${fmt}${evt} via webhook Kommo. Revise antes de salvar.`;
  } catch {
    return "Preenchido automaticamente via webhook Kommo. Revise antes de salvar.";
  }
}

/**
 * Shell de campo com indicador visual de origem (Cloudia vs manual).
 * Cloudia: borda/halo emerald + badge sparkle; manual: cinza neutro.
 */
export function SourceFieldShell({
  label,
  hint,
  origin,
  provenance,
  required,
  htmlFor,
  children,
  className,
}: FieldShellProps) {
  const isCloudia = origin === "crm";
  return (
    <div
      className={cn(
        "group relative rounded-lg border p-3 transition-colors",
        isCloudia
          ? "border-emerald-400/30 bg-emerald-400/[0.04] hover:border-emerald-400/50"
          : "border-white/[0.06] bg-white/[0.015] hover:border-white/[0.10]",
        className,
      )}
      title={isCloudia ? formatProvenanceTooltip(provenance) : undefined}
    >
      <div className="mb-1.5 flex items-center justify-between gap-2">
        <label
          htmlFor={htmlFor}
          className={cn(
            "flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wider",
            isCloudia ? "text-emerald-200/90" : "text-slate-400",
          )}
        >
          <span className="truncate">{label}</span>
          {required && <span className="text-rose-400">*</span>}
        </label>

        {isCloudia ? (
          <span className="inline-flex items-center gap-1 rounded-full border border-emerald-400/30 bg-emerald-400/10 px-1.5 py-[1px] text-[9px] font-semibold uppercase tracking-wider text-emerald-300">
            <Sparkles className="h-2.5 w-2.5" />
            Auto · CRM
          </span>
        ) : (
          <span className="inline-flex items-center gap-1 rounded-full border border-white/[0.06] bg-white/[0.03] px-1.5 py-[1px] text-[9px] font-semibold uppercase tracking-wider text-slate-500">
            <UserPen className="h-2.5 w-2.5" />
            Manual
          </span>
        )}
      </div>

      <div className="text-slate-100">{children}</div>

      {hint && (
        <p className={cn("mt-1.5 text-[10.5px] leading-snug", isCloudia ? "text-emerald-300/70" : "text-slate-500")}>
          {hint}
        </p>
      )}
    </div>
  );
}

/**
 * Versão compacta para células de tabela: pinta a célula com tom emerald se Cloudia.
 */
export function SourceCell({
  origin,
  children,
  className,
}: {
  origin: "crm" | "manual";
  children: ReactNode;
  className?: string;
}) {
  const isCloudia = origin === "crm";
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-md px-1.5 py-0.5",
        isCloudia
          ? "bg-emerald-400/[0.08] text-emerald-100 ring-1 ring-inset ring-emerald-400/20"
          : "text-slate-200",
        className,
      )}
    >
      {isCloudia && <Sparkles className="h-3 w-3 shrink-0 text-emerald-300" />}
      <span className="truncate">{children}</span>
    </span>
  );
}

/**
 * Cabeçalho de coluna com indicador "Auto · CRM" / "Manual · SDR" para tabelas.
 */
export function SourceColumnHeader({
  label,
  origin,
}: {
  label: string;
  origin: "crm" | "manual" | "calculado";
}) {
  if (origin === "crm") {
    return (
      <div className="flex flex-col gap-0.5">
        <span className="inline-flex items-center gap-1 text-[9px] font-semibold uppercase tracking-wider text-emerald-300/80">
          <Sparkles className="h-2.5 w-2.5" />
          Auto · CRM
        </span>
        <span className="text-[11px] font-medium text-slate-300">{label}</span>
      </div>
    );
  }
  if (origin === "calculado") {
    return (
      <div className="flex flex-col gap-0.5">
        <span className="inline-flex items-center gap-1 text-[9px] font-semibold uppercase tracking-wider text-sky-300/80">
          <Bot className="h-2.5 w-2.5" />
          Calculado
        </span>
        <span className="text-[11px] font-medium text-slate-300">{label}</span>
      </div>
    );
  }
  return (
    <div className="flex flex-col gap-0.5">
      <span className="inline-flex items-center gap-1 text-[9px] font-semibold uppercase tracking-wider text-slate-500">
        <UserPen className="h-2.5 w-2.5" />
        Manual · SDR
      </span>
      <span className="text-[11px] font-medium text-slate-300">{label}</span>
    </div>
  );
}

/**
 * Banner informativo no topo de cada página explicando como ler os indicadores.
 * Compacto, dispensável (tem botão fechar via prop opcional).
 */
export function SourceLegendBanner({
  className,
  onDismiss,
}: {
  className?: string;
  onDismiss?: () => void;
}) {
  return (
    <div
      className={cn(
        "relative flex flex-col gap-3 overflow-hidden rounded-xl border border-emerald-400/20 bg-gradient-to-br from-emerald-400/[0.06] via-emerald-400/[0.02] to-transparent p-4 md:flex-row md:items-center md:gap-6",
        className,
      )}
    >
      <div className="pointer-events-none absolute -right-12 -top-12 h-32 w-32 rounded-full bg-emerald-400/10 blur-3xl" />
      <div className="relative flex items-start gap-3 md:flex-1">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-emerald-400/30 bg-emerald-400/10">
          <Sparkles className="h-4 w-4 text-emerald-300" />
        </div>
        <div className="min-w-0">
          <h3 className="text-[13px] font-semibold text-slate-100">
            Como ler esta página
          </h3>
          <p className="mt-1 text-[12px] leading-relaxed text-slate-400">
            Os campos com{" "}
            <span className="inline-flex items-center gap-1 rounded-full border border-emerald-400/30 bg-emerald-400/10 px-1.5 py-[1px] align-middle text-[9px] font-semibold uppercase tracking-wider text-emerald-300">
              <Sparkles className="h-2.5 w-2.5" />
              Auto · CRM
            </span>{" "}
            foram preenchidos automaticamente pelo webhook do Kommo quando o lead chegou.
            Você só precisa{" "}
            <span className="font-semibold text-emerald-200">conferir</span> e salvar.
            Os demais campos (
            <span className="inline-flex items-center gap-1 rounded-full border border-white/[0.06] bg-white/[0.03] px-1.5 py-[1px] align-middle text-[9px] font-semibold uppercase tracking-wider text-slate-400">
              <UserPen className="h-2.5 w-2.5" />
              Manual
            </span>
            ) você precisa preencher.
          </p>
        </div>
      </div>
      {onDismiss && (
        <button
          type="button"
          onClick={onDismiss}
          className="relative shrink-0 rounded-md border border-white/[0.08] bg-white/[0.02] px-3 py-1.5 text-[11px] font-medium text-slate-300 transition-colors hover:border-white/[0.15] hover:bg-white/[0.05]"
        >
          Entendi, esconder
        </button>
      )}
    </div>
  );
}

/**
 * Pequeno chip inline para mostrar que um valor específico veio do Kommo.
 * Use dentro de tabelas, modais, listas — onde não há espaço para a SourceFieldShell completa.
 */
export function SourceInlineBadge({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full border border-emerald-400/30 bg-emerald-400/10 px-1.5 py-[1px] text-[9px] font-semibold uppercase tracking-wider text-emerald-300",
        className,
      )}
      title="Preenchido automaticamente via webhook Kommo"
    >
      <Sparkles className="h-2.5 w-2.5" />
      Cloudia
    </span>
  );
}
