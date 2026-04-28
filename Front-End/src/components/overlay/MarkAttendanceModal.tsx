import { useState } from "react";
import { CheckCircle2, X, XCircle } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/utils";
import type { AttendanceOutcome, MarkAttendancePayload } from "@/types";

interface Props {
  open: boolean;
  leadName?: string;
  loading?: boolean;
  onClose: () => void;
  onConfirm: (payload: MarkAttendancePayload) => void;
}

type Choice = "attended" | "no_show" | null;

export function MarkAttendanceModal({ open, leadName, loading, onClose, onConfirm }: Props) {
  const [choice, setChoice] = useState<Choice>(null);
  const [outcome, setOutcome] = useState<AttendanceOutcome | null>(null);
  const [notes, setNotes] = useState("");

  if (!open) return null;

  const reset = () => {
    setChoice(null);
    setOutcome(null);
    setNotes("");
  };
  const close = () => {
    if (loading) return;
    reset();
    onClose();
  };
  const canConfirm =
    (choice === "no_show") || (choice === "attended" && outcome !== null);

  const submit = () => {
    if (!canConfirm) return;
    if (choice === "no_show") {
      onConfirm({ attended: false, notes: notes.trim() || undefined });
    } else {
      onConfirm({ attended: true, outcome: outcome!, notes: notes.trim() || undefined });
    }
  };

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-4 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-xl border border-white/[0.08] bg-[#0d0d12] shadow-2xl">
        <div className="flex items-center justify-between border-b border-white/[0.06] px-5 py-3.5">
          <div>
            <h3 className="text-[14px] font-semibold text-slate-100">Marcar comparecimento</h3>
            {leadName && (
              <p className="mt-0.5 text-[11px] text-slate-500">{leadName}</p>
            )}
          </div>
          <button
            onClick={close}
            disabled={loading}
            className="text-slate-500 transition hover:text-slate-200 disabled:opacity-40"
            aria-label="Fechar"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-4 px-5 py-4">
          <div className="grid grid-cols-2 gap-2">
            <ChoiceCard
              active={choice === "attended"}
              tone="emerald"
              icon={<CheckCircle2 className="h-4 w-4" />}
              title="Compareceu"
              description="Paciente esteve na consulta"
              onClick={() => { setChoice("attended"); }}
            />
            <ChoiceCard
              active={choice === "no_show"}
              tone="rose"
              icon={<XCircle className="h-4 w-4" />}
              title="Faltou"
              description="Paciente não compareceu"
              onClick={() => { setChoice("no_show"); setOutcome(null); }}
            />
          </div>

          {choice === "attended" && (
            <div className="space-y-2">
              <p className="text-[11.5px] font-medium uppercase tracking-wider text-slate-400">
                Resultado da consulta
              </p>
              <div className="grid grid-cols-2 gap-2">
                <OutcomeOption
                  active={outcome === "fechou"}
                  tone="emerald"
                  label="Fechou tratamento"
                  hint="→ 09_FECHOU_TRATAMENTO"
                  onClick={() => setOutcome("fechou")}
                />
                <OutcomeOption
                  active={outcome === "nao_fechou"}
                  tone="amber"
                  label="Não fechou"
                  hint="→ 08_NAO_FECHOU_TRATAMENTO"
                  onClick={() => setOutcome("nao_fechou")}
                />
              </div>
            </div>
          )}

          <div>
            <label className="block text-[11.5px] font-medium uppercase tracking-wider text-slate-400">
              Observações (opcional)
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              placeholder="Anotações sobre a consulta…"
              className="mt-1.5 w-full resize-none rounded-md border border-white/[0.08] bg-white/[0.02] px-2.5 py-2 text-[13px] text-slate-100 outline-none transition focus:border-emerald-500/40 focus:bg-white/[0.04]"
            />
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-white/[0.06] px-5 py-3">
          <Button variant="ghost" size="sm" onClick={close} disabled={loading}>
            Cancelar
          </Button>
          <Button
            variant="primary"
            size="sm"
            onClick={submit}
            loading={loading}
            disabled={!canConfirm || loading}
          >
            Confirmar
          </Button>
        </div>
      </div>
    </div>
  );
}

interface ChoiceCardProps {
  active: boolean;
  tone: "emerald" | "rose";
  icon: React.ReactNode;
  title: string;
  description: string;
  onClick: () => void;
}

function ChoiceCard({ active, tone, icon, title, description, onClick }: ChoiceCardProps) {
  const ring =
    tone === "emerald"
      ? "ring-emerald-500/40 bg-emerald-500/[0.08]"
      : "ring-rose-500/40 bg-rose-500/[0.08]";
  const text =
    tone === "emerald" ? "text-emerald-300" : "text-rose-300";
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "rounded-lg border border-white/[0.06] bg-white/[0.02] p-3 text-left transition",
        "hover:bg-white/[0.04]",
        active && `ring-2 ring-inset ${ring}`,
      )}
    >
      <div className={cn("mb-1.5 flex items-center gap-1.5 text-[12px] font-semibold", active ? text : "text-slate-200")}>
        {icon}
        {title}
      </div>
      <p className="text-[11px] text-slate-500">{description}</p>
    </button>
  );
}

interface OutcomeOptionProps {
  active: boolean;
  tone: "emerald" | "amber";
  label: string;
  hint: string;
  onClick: () => void;
}

function OutcomeOption({ active, tone, label, hint, onClick }: OutcomeOptionProps) {
  const ring =
    tone === "emerald"
      ? "ring-emerald-500/40 bg-emerald-500/[0.08]"
      : "ring-amber-500/40 bg-amber-500/[0.08]";
  const text =
    tone === "emerald" ? "text-emerald-300" : "text-amber-300";
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "rounded-lg border border-white/[0.06] bg-white/[0.02] p-3 text-left transition",
        "hover:bg-white/[0.04]",
        active && `ring-2 ring-inset ${ring}`,
      )}
    >
      <div className={cn("text-[12px] font-semibold", active ? text : "text-slate-200")}>{label}</div>
      <p className="mt-0.5 font-mono text-[10.5px] text-slate-600">{hint}</p>
    </button>
  );
}
