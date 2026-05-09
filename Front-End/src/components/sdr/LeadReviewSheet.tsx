import { useEffect, useState } from "react";
import { CheckCircle2, Save, Sparkles, X } from "lucide-react";
import { CloudiaFieldShell } from "@/components/sdr/CloudiaField";
import { upsertSdrLead } from "@/lib/sdr/sdr-store";
import type { SdrCloudiaFieldKey, SdrLead } from "@/types/sdr";
import { CLOUDIA_ORIGENS, CLOUDIA_MOTIVOS_NAO_AGENDAMENTO } from "@/lib/cadastra/cloudia-mapping";
import { cn, formatDate } from "@/lib/utils";

type Props = {
  lead: SdrLead;
  onClose: () => void;
};

/**
 * Sheet lateral de revisão de lead.
 * Mostra todos os 19 campos da Seção 1 da planilha, com indicador visual claro
 * de quais vieram da Cloudia e quais são manuais.
 *
 * A SDR pode editar qualquer campo (mesmo os auto-preenchidos), e ao salvar
 * o flag "vindo da Cloudia" é mantido — apenas registramos que ela revisou.
 */
export function LeadReviewSheet({ lead, onClose }: Props) {
  const [draft, setDraft] = useState<SdrLead>(lead);

  useEffect(() => {
    setDraft(lead);
  }, [lead]);

  // ESC fecha
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const isFromCloudia = (k: SdrCloudiaFieldKey): "cloudia" | "manual" =>
    draft.cloudiaFields.includes(k) ? "cloudia" : "manual";

  const update = <K extends keyof SdrLead>(k: K, v: SdrLead[K]) =>
    setDraft((d) => ({ ...d, [k]: v }));

  const handleSave = () => {
    upsertSdrLead({ ...draft, dataModificacao: new Date().toISOString() });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-40">
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />
      <aside className="absolute right-0 top-0 flex h-full w-full max-w-2xl flex-col border-l border-white/[0.08] bg-[#0a0a0d] shadow-2xl">
        <header className="flex items-start justify-between border-b border-white/[0.06] px-5 py-4">
          <div className="min-w-0">
            <p className="text-[10px] font-medium uppercase tracking-[0.18em] text-slate-500">
              Revisar lead
            </p>
            <h2 className="mt-1 truncate text-[16px] font-semibold text-slate-100">
              {draft.nome || "Sem nome"}
            </h2>
            <p className="mt-1 flex items-center gap-2 text-[11px] text-slate-400">
              {draft.cloudiaProvenance && (
                <span className="inline-flex items-center gap-1 rounded-full border border-emerald-400/30 bg-emerald-400/10 px-1.5 py-[1px] text-[9px] font-semibold uppercase tracking-wider text-emerald-300">
                  <Sparkles className="h-2.5 w-2.5" />
                  {draft.cloudiaProvenance.webhookEvent ?? "Cloudia"}
                </span>
              )}
              {draft.cloudiaProvenance?.receivedAt && (
                <span>Recebido em {formatDate(draft.cloudiaProvenance.receivedAt)}</span>
              )}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md border border-white/[0.06] bg-white/[0.02] p-1.5 text-slate-400 transition-colors hover:border-white/[0.15] hover:bg-white/[0.05] hover:text-slate-200"
            aria-label="Fechar"
          >
            <X className="h-4 w-4" />
          </button>
        </header>

        <div className="flex-1 overflow-y-auto px-5 py-5">
          {/* Bloco: Dados do lead (vêm da Cloudia) */}
          <SectionHeader
            title="Dados do lead"
            subtitle="Estes campos vêm direto da Cloudia. Confira e ajuste se necessário."
            cloudia
          />
          <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2">
            <CloudiaFieldShell label="Nome do cliente" origin={isFromCloudia("nome")} required>
              <Input value={draft.nome} onChange={(v) => update("nome", v)} />
            </CloudiaFieldShell>
            <CloudiaFieldShell label="Telefone" origin={isFromCloudia("telefone")} required>
              <Input value={draft.telefone} onChange={(v) => update("telefone", v)} mono />
            </CloudiaFieldShell>
            <CloudiaFieldShell label="Tipo (Cadastro / Resgate)" origin={isFromCloudia("tipo")}>
              <Select
                value={draft.tipo}
                onChange={(v) => update("tipo", v as SdrLead["tipo"])}
                options={[
                  { value: "Cadastro", label: "Cadastro" },
                  { value: "Resgate", label: "Resgate" },
                ]}
              />
            </CloudiaFieldShell>
            <CloudiaFieldShell label="Origem do cadastro" origin={isFromCloudia("origem")}>
              <Select
                value={draft.origem}
                onChange={(v) => update("origem", v)}
                options={CLOUDIA_ORIGENS.map((o) => ({ value: o, label: o }))}
              />
            </CloudiaFieldShell>
            {draft.tipo === "Resgate" && (
              <CloudiaFieldShell label="Tipo de resgate" origin={isFromCloudia("tipoResgate")}>
                <Input
                  value={draft.tipoResgate ?? ""}
                  onChange={(v) => update("tipoResgate", v || undefined)}
                />
              </CloudiaFieldShell>
            )}
            <CloudiaFieldShell label="Interação (cliente respondeu?)" origin={isFromCloudia("interacao")}>
              <Toggle value={draft.interacao} onChange={(v) => update("interacao", v)} />
            </CloudiaFieldShell>
            <CloudiaFieldShell label="Situação (estágio Cloudia)" origin={isFromCloudia("situacao")}>
              <Input
                value={draft.situacao ?? ""}
                onChange={(v) => update("situacao", v || undefined)}
              />
            </CloudiaFieldShell>
            <CloudiaFieldShell label="Clínica" origin={isFromCloudia("clinica")}>
              <Input
                value={draft.clinica ?? ""}
                onChange={(v) => update("clinica", v || undefined)}
              />
            </CloudiaFieldShell>
            <CloudiaFieldShell label="Observação" origin={isFromCloudia("observacao")} className="md:col-span-2">
              <Textarea
                value={draft.observacao ?? ""}
                onChange={(v) => update("observacao", v || undefined)}
              />
            </CloudiaFieldShell>
          </div>

          {/* Bloco: Agendamento (manual) */}
          <SectionHeader
            title="Agendamento"
            subtitle="Confirme com o cliente e preencha aqui."
            className="mt-7"
          />
          <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2">
            <CloudiaFieldShell label="Cliente agendou?" origin="manual">
              <Toggle value={draft.agendouConsulta} onChange={(v) => update("agendouConsulta", v)} />
            </CloudiaFieldShell>
            {draft.agendouConsulta ? (
              <CloudiaFieldShell label="Data do agendamento" origin={isFromCloudia("dataAgendamento")}>
                <Input
                  type="datetime-local"
                  value={toLocalInput(draft.dataAgendamento)}
                  onChange={(v) => update("dataAgendamento", fromLocalInput(v) || undefined)}
                />
              </CloudiaFieldShell>
            ) : (
              <CloudiaFieldShell label="Motivo para não agendamento" origin="manual">
                <Select
                  value={draft.motivoNaoAgendamento ?? ""}
                  onChange={(v) => update("motivoNaoAgendamento", v || undefined)}
                  options={[
                    { value: "", label: "Selecionar…" },
                    ...CLOUDIA_MOTIVOS_NAO_AGENDAMENTO.map((m) => ({ value: m, label: m })),
                  ]}
                />
              </CloudiaFieldShell>
            )}
          </div>

          {/* Bloco: Responsável (vem da Cloudia) */}
          <SectionHeader
            title="Responsável & datas"
            subtitle="Atribuído pela Cloudia via assigned_user_*."
            className="mt-7"
            cloudia
          />
          <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2">
            <CloudiaFieldShell label="Nome responsável" origin={isFromCloudia("nomeResponsavel")}>
              <Input
                value={draft.nomeResponsavel}
                onChange={(v) => update("nomeResponsavel", v)}
              />
            </CloudiaFieldShell>
            <CloudiaFieldShell label="Login (e-mail)" origin={isFromCloudia("login")}>
              <Input
                value={draft.login ?? ""}
                onChange={(v) => update("login", v || undefined)}
              />
            </CloudiaFieldShell>
            <CloudiaFieldShell label="Data origem" origin={isFromCloudia("dataOrigem")}>
              <ReadOnlyValue value={formatDate(draft.dataOrigem)} />
            </CloudiaFieldShell>
            <CloudiaFieldShell label="Data modificação" origin={isFromCloudia("dataModificacao")}>
              <ReadOnlyValue value={draft.dataModificacao ? formatDate(draft.dataModificacao) : "—"} />
            </CloudiaFieldShell>
          </div>

          {/* Resumo de provenance */}
          <div className="mt-6 rounded-lg border border-white/[0.05] bg-white/[0.015] p-3">
            <p className="text-[10.5px] uppercase tracking-wider text-slate-500">Resumo</p>
            <p className="mt-1 text-[12px] text-slate-300">
              <strong className="text-emerald-200">{draft.cloudiaFields.length}</strong> campo(s)
              vieram da Cloudia.{" "}
              <strong className="text-slate-200">
                {15 - draft.cloudiaFields.length}
              </strong>{" "}
              precisa(m) de revisão/preenchimento manual.
            </p>
          </div>
        </div>

        <footer className="flex items-center justify-between gap-3 border-t border-white/[0.06] bg-white/[0.015] px-5 py-3">
          <p className="flex items-center gap-1.5 text-[11px] text-slate-400">
            <CheckCircle2 className="h-3.5 w-3.5 text-emerald-300" />
            Salvar mantém o histórico de campos vindos da Cloudia.
          </p>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-md border border-white/[0.06] bg-white/[0.02] px-3 py-1.5 text-[12px] font-medium text-slate-300 transition-colors hover:border-white/[0.15] hover:bg-white/[0.05]"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={handleSave}
              className="inline-flex items-center gap-1.5 rounded-md border border-emerald-400/30 bg-emerald-400/15 px-3 py-1.5 text-[12px] font-semibold text-emerald-200 transition-colors hover:border-emerald-400/50 hover:bg-emerald-400/25"
            >
              <Save className="h-3.5 w-3.5" />
              Salvar revisão
            </button>
          </div>
        </footer>
      </aside>
    </div>
  );
}

function SectionHeader({
  title,
  subtitle,
  cloudia,
  className,
}: {
  title: string;
  subtitle?: string;
  cloudia?: boolean;
  className?: string;
}) {
  return (
    <div className={cn("flex items-end justify-between gap-3", className)}>
      <div>
        <h3 className="text-[13px] font-semibold text-slate-100">{title}</h3>
        {subtitle && <p className="mt-0.5 text-[11px] text-slate-500">{subtitle}</p>}
      </div>
      {cloudia && (
        <span className="inline-flex items-center gap-1 rounded-full border border-emerald-400/30 bg-emerald-400/10 px-1.5 py-[1px] text-[9px] font-semibold uppercase tracking-wider text-emerald-300">
          <Sparkles className="h-2.5 w-2.5" />
          Auto-preenchido
        </span>
      )}
    </div>
  );
}

// ---- Inputs minimalistas (não importei o cadastra-ui pra evitar acoplamento) ----

function Input({
  value,
  onChange,
  type = "text",
  mono,
}: {
  value: string;
  onChange: (v: string) => void;
  type?: string;
  mono?: boolean;
}) {
  return (
    <input
      type={type}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className={cn(
        "h-8 w-full rounded-md border border-white/[0.08] bg-white/[0.025] px-2.5 text-[12px] text-slate-100 placeholder:text-slate-500 focus:border-emerald-400/40 focus:bg-white/[0.04] focus:outline-none",
        mono && "font-mono",
      )}
    />
  );
}

function Textarea({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <textarea
      value={value}
      onChange={(e) => onChange(e.target.value)}
      rows={3}
      className="w-full resize-y rounded-md border border-white/[0.08] bg-white/[0.025] px-2.5 py-1.5 text-[12px] text-slate-100 placeholder:text-slate-500 focus:border-emerald-400/40 focus:bg-white/[0.04] focus:outline-none"
    />
  );
}

function Select({
  value,
  onChange,
  options,
}: {
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="h-8 w-full rounded-md border border-white/[0.08] bg-white/[0.025] px-2 text-[12px] text-slate-100 focus:border-emerald-400/40 focus:outline-none"
    >
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  );
}

function Toggle({ value, onChange }: { value: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="flex gap-1.5">
      <button
        type="button"
        onClick={() => onChange(true)}
        className={cn(
          "flex-1 rounded-md border px-2 py-1.5 text-[12px] font-medium transition-colors",
          value
            ? "border-emerald-400/40 bg-emerald-400/15 text-emerald-200"
            : "border-white/[0.06] bg-white/[0.02] text-slate-400 hover:bg-white/[0.05]",
        )}
      >
        Sim
      </button>
      <button
        type="button"
        onClick={() => onChange(false)}
        className={cn(
          "flex-1 rounded-md border px-2 py-1.5 text-[12px] font-medium transition-colors",
          !value
            ? "border-rose-400/40 bg-rose-400/10 text-rose-200"
            : "border-white/[0.06] bg-white/[0.02] text-slate-400 hover:bg-white/[0.05]",
        )}
      >
        Não
      </button>
    </div>
  );
}

function ReadOnlyValue({ value }: { value: string }) {
  return (
    <div className="flex h-8 w-full items-center rounded-md border border-white/[0.04] bg-white/[0.015] px-2.5 text-[12px] text-slate-300">
      {value}
    </div>
  );
}

function toLocalInput(iso?: string): string {
  if (!iso) return "";
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return "";
    const y = d.getFullYear();
    const mo = String(d.getMonth() + 1).padStart(2, "0");
    const da = String(d.getDate()).padStart(2, "0");
    const hh = String(d.getHours()).padStart(2, "0");
    const mm = String(d.getMinutes()).padStart(2, "0");
    return `${y}-${mo}-${da}T${hh}:${mm}`;
  } catch {
    return "";
  }
}

function fromLocalInput(v: string): string {
  if (!v) return "";
  try {
    return new Date(v).toISOString();
  } catch {
    return "";
  }
}
