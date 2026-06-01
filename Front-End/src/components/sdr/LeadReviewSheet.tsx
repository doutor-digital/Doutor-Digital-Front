import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { CheckCircle2, Loader2, Save, ShieldCheck, Sparkles, ThumbsDown, ThumbsUp, X } from "@/components/icons";
import { SourceFieldShell } from "@/components/sdr/SourceField";
import { reviewSdrLead, upsertSdrLead } from "@/lib/sdr/sdr-store";
import type { SdrSourceFieldKey, SdrLead } from "@/types/sdr";
import { LEAD_ORIGENS, LEAD_MOTIVOS_NAO_AGENDAMENTO } from "@/lib/cadastra/lead-mapping";
import { cn, formatDate } from "@/lib/utils";

type Props = {
  lead: SdrLead;
  onClose: () => void;
  /** Quem está executando a revisão. Se null, registra audit log sem userId. */
  actor?: { id?: string; name?: string; email?: string };
  /**
   * "sheet" (default) renderiza como painel lateral com overlay.
   * "page" renderiza inline (sem fixed/overlay) — pra uso dentro de uma rota dedicada.
   */
  mode?: "sheet" | "page";
};

type ReviewPhase =
  | "idle"
  | "confirming-approve"
  | "confirming-reject"
  | "loading"
  | "success-approve"
  | "success-reject";

/**
 * Sheet lateral de revisão de lead.
 * Mostra todos os 19 campos da Seção 1 da planilha, com indicador visual claro
 * de quais vieram do Kommo e quais são manuais.
 *
 * A SDR pode editar qualquer campo (mesmo os auto-preenchidos), e ao salvar
 * o flag "vindo do Kommo" é mantido — apenas registramos que ela revisou.
 */
export function LeadReviewSheet({ lead, onClose, actor, mode = "sheet" }: Props) {
  const [draft, setDraft] = useState<SdrLead>(lead);
  const [phase, setPhase] = useState<ReviewPhase>("idle");
  const [rejectionReason, setRejectionReason] = useState("");

  useEffect(() => {
    setDraft(lead);
    setPhase("idle");
  }, [lead]);

  // ESC fecha (a menos que esteja em loading)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && phase !== "loading") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose, phase]);

  const isFromSource = (k: SdrSourceFieldKey): "crm" | "manual" =>
    draft.sourceFields.includes(k) ? "cloudia" : "manual";

  const update = <K extends keyof SdrLead>(k: K, v: SdrLead[K]) =>
    setDraft((d) => ({ ...d, [k]: v }));

  const handleSaveDraft = () => {
    upsertSdrLead(
      { ...draft, dataModificacao: new Date().toISOString() },
      actor,
    );
    onClose();
  };

  /**
   * Fluxo CRM: idle → confirming-* → loading → success-* → onClose.
   * Loading dura ~900ms (animação + persistência local). No backend de verdade
   * essa duração casa com o roundtrip do POST /api/sdr/leads/{id}/review.
   */
  const handleConfirmDecision = async (decision: "approve" | "reject") => {
    setPhase("loading");
    // Simula latência da requisição (no backend real aqui é um await fetch)
    await new Promise((r) => setTimeout(r, 900));
    reviewSdrLead(draft.id, decision, {
      actor,
      rejectionReason: decision === "reject" ? rejectionReason || undefined : undefined,
      patch: {
        nome: draft.nome,
        telefone: draft.telefone,
        tipo: draft.tipo,
        origem: draft.origem,
        tipoResgate: draft.tipoResgate,
        interacao: draft.interacao,
        agendouConsulta: draft.agendouConsulta,
        dataAgendamento: draft.dataAgendamento,
        motivoNaoAgendamento: draft.motivoNaoAgendamento,
        nomeResponsavel: draft.nomeResponsavel,
        login: draft.login,
        observacao: draft.observacao,
        situacao: draft.situacao,
        clinica: draft.clinica,
      },
    });
    setPhase(decision === "approve" ? "success-approve" : "success-reject");
    // Fecha após mostrar o sucesso por 1.4s
    setTimeout(() => onClose(), 1400);
  };

  const isAlreadyReviewed = lead.status === "aprovado" || lead.status === "rejeitado";

  const isPage = mode === "page";

  return (
    <div className={isPage ? "" : "fixed inset-0 z-40"}>
      {!isPage && (
        <div
          className="absolute inset-0 bg-black/60 backdrop-blur-sm"
          onClick={onClose}
        />
      )}
      <aside
        className={cn(
          isPage
            ? "mx-auto flex w-full max-w-3xl flex-col rounded-xl border border-white/[0.08] bg-[#0a0a0d] shadow-2xl"
            : "absolute right-0 top-0 flex h-full w-full max-w-2xl flex-col border-l border-white/[0.08] bg-[#0a0a0d] shadow-2xl",
        )}
      >
        <header className="flex items-start justify-between border-b border-white/[0.06] px-5 py-4">
          <div className="min-w-0">
            <p className="text-[10px] font-medium uppercase tracking-[0.18em] text-slate-500">
              Revisar lead
            </p>
            <h2 className="mt-1 truncate text-[16px] font-semibold text-slate-100">
              {draft.nome || "Sem nome"}
            </h2>
            <p className="mt-1 flex items-center gap-2 text-[11px] text-slate-400">
              {draft.sourceProvenance && (
                <span className="inline-flex items-center gap-1 rounded-full border border-emerald-400/30 bg-emerald-400/10 px-1.5 py-[1px] text-[9px] font-semibold uppercase tracking-wider text-emerald-300">
                  <Sparkles className="h-2.5 w-2.5" />
                  {draft.sourceProvenance.webhookEvent ?? "Cloudia"}
                </span>
              )}
              {draft.sourceProvenance?.receivedAt && (
                <span>Recebido em {formatDate(draft.sourceProvenance.receivedAt)}</span>
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
          {/* Bloco: Dados do lead (vêm do Kommo) */}
          <SectionHeader
            title="Dados do lead"
            subtitle="Estes campos vêm direto do Kommo. Confira e ajuste se necessário."
            cloudia
          />
          <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2">
            <SourceFieldShell label="Nome do cliente" origin={isFromSource("nome")} required>
              <Input value={draft.nome} onChange={(v) => update("nome", v)} />
            </SourceFieldShell>
            <SourceFieldShell label="Telefone" origin={isFromSource("telefone")} required>
              <Input value={draft.telefone} onChange={(v) => update("telefone", v)} mono />
            </SourceFieldShell>
            <SourceFieldShell label="Tipo (Cadastro / Resgate)" origin={isFromSource("tipo")}>
              <Select
                value={draft.tipo}
                onChange={(v) => update("tipo", v as SdrLead["tipo"])}
                options={[
                  { value: "Cadastro", label: "Cadastro" },
                  { value: "Resgate", label: "Resgate" },
                ]}
              />
            </SourceFieldShell>
            <SourceFieldShell label="Origem do cadastro" origin={isFromSource("origem")}>
              <Select
                value={draft.origem}
                onChange={(v) => update("origem", v)}
                options={LEAD_ORIGENS.map((o) => ({ value: o, label: o }))}
              />
            </SourceFieldShell>
            {draft.tipo === "Resgate" && (
              <SourceFieldShell label="Tipo de resgate" origin={isFromSource("tipoResgate")}>
                <Input
                  value={draft.tipoResgate ?? ""}
                  onChange={(v) => update("tipoResgate", v || undefined)}
                />
              </SourceFieldShell>
            )}
            <SourceFieldShell label="Interação (cliente respondeu?)" origin={isFromSource("interacao")}>
              <Toggle value={draft.interacao} onChange={(v) => update("interacao", v)} />
            </SourceFieldShell>
            <SourceFieldShell label="Situação (estágio Kommo)" origin={isFromSource("situacao")}>
              <Input
                value={draft.situacao ?? ""}
                onChange={(v) => update("situacao", v || undefined)}
              />
            </SourceFieldShell>
            <SourceFieldShell label="Clínica" origin={isFromSource("clinica")}>
              <Input
                value={draft.clinica ?? ""}
                onChange={(v) => update("clinica", v || undefined)}
              />
            </SourceFieldShell>
            <SourceFieldShell label="Observação" origin={isFromSource("observacao")} className="md:col-span-2">
              <Textarea
                value={draft.observacao ?? ""}
                onChange={(v) => update("observacao", v || undefined)}
              />
            </SourceFieldShell>
          </div>

          {/* Bloco: Agendamento (manual) */}
          <SectionHeader
            title="Agendamento"
            subtitle="Confirme com o cliente e preencha aqui."
            className="mt-7"
          />
          <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2">
            <SourceFieldShell label="Cliente agendou?" origin="manual">
              <Toggle value={draft.agendouConsulta} onChange={(v) => update("agendouConsulta", v)} />
            </SourceFieldShell>
            {draft.agendouConsulta ? (
              <SourceFieldShell label="Data do agendamento" origin={isFromSource("dataAgendamento")}>
                <Input
                  type="datetime-local"
                  value={toLocalInput(draft.dataAgendamento)}
                  onChange={(v) => update("dataAgendamento", fromLocalInput(v) || undefined)}
                />
              </SourceFieldShell>
            ) : (
              <SourceFieldShell label="Motivo para não agendamento" origin="manual">
                <Select
                  value={draft.motivoNaoAgendamento ?? ""}
                  onChange={(v) => update("motivoNaoAgendamento", v || undefined)}
                  options={[
                    { value: "", label: "Selecionar…" },
                    ...LEAD_MOTIVOS_NAO_AGENDAMENTO.map((m) => ({ value: m, label: m })),
                  ]}
                />
              </SourceFieldShell>
            )}
          </div>

          {/* Bloco: Responsável (vem do Kommo) */}
          <SectionHeader
            title="Responsável & datas"
            subtitle="Atribuído pelo Kommo via assigned_user_*."
            className="mt-7"
            cloudia
          />
          <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2">
            <SourceFieldShell label="Nome responsável" origin={isFromSource("nomeResponsavel")}>
              <Input
                value={draft.nomeResponsavel}
                onChange={(v) => update("nomeResponsavel", v)}
              />
            </SourceFieldShell>
            <SourceFieldShell label="Login (e-mail)" origin={isFromSource("login")}>
              <Input
                value={draft.login ?? ""}
                onChange={(v) => update("login", v || undefined)}
              />
            </SourceFieldShell>
            <SourceFieldShell label="Data origem" origin={isFromSource("dataOrigem")}>
              <ReadOnlyValue value={formatDate(draft.dataOrigem)} />
            </SourceFieldShell>
            <SourceFieldShell label="Data modificação" origin={isFromSource("dataModificacao")}>
              <ReadOnlyValue value={draft.dataModificacao ? formatDate(draft.dataModificacao) : "—"} />
            </SourceFieldShell>
          </div>

          {/* Resumo de provenance */}
          <div className="mt-6 rounded-lg border border-white/[0.05] bg-white/[0.015] p-3">
            <p className="text-[10.5px] uppercase tracking-wider text-slate-500">Resumo</p>
            <p className="mt-1 text-[12px] text-slate-300">
              <strong className="text-emerald-200">{draft.sourceFields?.length ?? 0}</strong> campo(s)
              vieram do Kommo.{" "}
              <strong className="text-slate-200">
                {15 - (draft.sourceFields?.length ?? 0)}
              </strong>{" "}
              precisa(m) de revisão/preenchimento manual.
            </p>
          </div>
        </div>

        <footer className="flex items-center justify-between gap-3 border-t border-white/[0.06] bg-white/[0.015] px-5 py-3">
          <p className="flex items-center gap-1.5 text-[11px] text-slate-400">
            <ShieldCheck className="h-3.5 w-3.5 text-emerald-300" />
            {isAlreadyReviewed
              ? `Já revisado em ${formatDate(lead.reviewedAt)}.`
              : "Toda decisão fica registrada na auditoria."}
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
              onClick={handleSaveDraft}
              className="inline-flex items-center gap-1.5 rounded-md border border-white/[0.08] bg-white/[0.02] px-3 py-1.5 text-[12px] font-medium text-slate-300 transition-colors hover:border-white/[0.20] hover:bg-white/[0.05]"
              title="Apenas salva edições sem aprovar/rejeitar"
            >
              <Save className="h-3.5 w-3.5" />
              Salvar rascunho
            </button>
            {!isAlreadyReviewed && (
              <>
                <button
                  type="button"
                  onClick={() => setPhase("confirming-reject")}
                  className="inline-flex items-center gap-1.5 rounded-md border border-rose-400/30 bg-rose-400/10 px-3 py-1.5 text-[12px] font-semibold text-rose-200 transition-colors hover:border-rose-400/50 hover:bg-rose-400/20"
                >
                  <ThumbsDown className="h-3.5 w-3.5" />
                  Rejeitar
                </button>
                <button
                  type="button"
                  onClick={() => setPhase("confirming-approve")}
                  className="inline-flex items-center gap-1.5 rounded-md border border-emerald-400/30 bg-emerald-400/15 px-3 py-1.5 text-[12px] font-semibold text-emerald-200 transition-colors hover:border-emerald-400/50 hover:bg-emerald-400/25"
                >
                  <ThumbsUp className="h-3.5 w-3.5" />
                  Aprovar e promover
                </button>
              </>
            )}
          </div>
        </footer>
      </aside>

      {/* Overlay de confirmação / loading / sucesso */}
      <AnimatePresence>
        {phase !== "idle" && (
          <motion.div
            key="overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-md"
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0, y: 8 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0 }}
              transition={{ type: "spring", duration: 0.4 }}
              className="relative w-[400px] max-w-[92vw] overflow-hidden rounded-2xl border border-white/[0.08] bg-[#0d0e12] p-6 shadow-2xl"
            >
              {phase === "confirming-approve" && (
                <ConfirmApprovePanel
                  leadName={draft.nome}
                  onCancel={() => setPhase("idle")}
                  onConfirm={() => handleConfirmDecision("approve")}
                />
              )}
              {phase === "confirming-reject" && (
                <ConfirmRejectPanel
                  leadName={draft.nome}
                  reason={rejectionReason}
                  setReason={setRejectionReason}
                  onCancel={() => setPhase("idle")}
                  onConfirm={() => handleConfirmDecision("reject")}
                />
              )}
              {phase === "loading" && <LoadingPanel />}
              {phase === "success-approve" && <SuccessPanel kind="approve" />}
              {phase === "success-reject" && <SuccessPanel kind="reject" />}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ───────────────────────────────────────────────────────────────────────────
// Painéis do overlay (confirmar / loading / sucesso)
// ───────────────────────────────────────────────────────────────────────────

function ConfirmApprovePanel({
  leadName,
  onCancel,
  onConfirm,
}: {
  leadName: string;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <>
      <div className="pointer-events-none absolute -right-12 -top-12 h-32 w-32 rounded-full bg-emerald-400/20 blur-3xl" />
      <div className="relative">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-emerald-400/15 ring-1 ring-inset ring-emerald-400/30">
          <ThumbsUp className="h-5 w-5 text-emerald-300" />
        </div>
        <h3 className="mt-3 text-[15px] font-semibold text-slate-100">
          Você aprova essa revisão?
        </h3>
        <p className="mt-1 text-[12.5px] leading-relaxed text-slate-400">
          O lead <span className="font-semibold text-slate-200">{leadName}</span>{" "}
          vai sair da etapa de revisão e entrar em <span className="font-semibold text-emerald-200">Leads Aprovados</span>.
          Esta ação fica registrada na auditoria com seu nome e data.
        </p>
        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-md border border-white/[0.06] bg-white/[0.02] px-3 py-2 text-[12px] font-medium text-slate-300 hover:border-white/[0.15]"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="inline-flex items-center gap-1.5 rounded-md border border-emerald-400/30 bg-emerald-400/20 px-3 py-2 text-[12px] font-semibold text-emerald-100 hover:border-emerald-400/50 hover:bg-emerald-400/30"
          >
            <ShieldCheck className="h-3.5 w-3.5" />
            Sim, aprovar e promover
          </button>
        </div>
      </div>
    </>
  );
}

function ConfirmRejectPanel({
  leadName,
  reason,
  setReason,
  onCancel,
  onConfirm,
}: {
  leadName: string;
  reason: string;
  setReason: (v: string) => void;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <>
      <div className="pointer-events-none absolute -right-12 -top-12 h-32 w-32 rounded-full bg-rose-400/15 blur-3xl" />
      <div className="relative">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-rose-400/15 ring-1 ring-inset ring-rose-400/30">
          <ThumbsDown className="h-5 w-5 text-rose-300" />
        </div>
        <h3 className="mt-3 text-[15px] font-semibold text-slate-100">
          Rejeitar revisão?
        </h3>
        <p className="mt-1 text-[12.5px] leading-relaxed text-slate-400">
          {leadName} não vai entrar no pipeline. Diga o motivo (a chefe vai ver na auditoria).
        </p>
        <textarea
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          rows={3}
          placeholder="Ex.: Duplicado · Telefone inválido · Lead falso"
          className="mt-3 w-full resize-none rounded-md border border-white/[0.08] bg-white/[0.025] px-3 py-2 text-[12px] text-slate-100 placeholder:text-slate-500 focus:border-rose-400/40 focus:outline-none"
        />
        <div className="mt-4 flex justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-md border border-white/[0.06] bg-white/[0.02] px-3 py-2 text-[12px] font-medium text-slate-300 hover:border-white/[0.15]"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={!reason.trim()}
            className="rounded-md border border-rose-400/30 bg-rose-400/15 px-3 py-2 text-[12px] font-semibold text-rose-200 hover:border-rose-400/50 hover:bg-rose-400/25 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Rejeitar
          </button>
        </div>
      </div>
    </>
  );
}

function LoadingPanel() {
  return (
    <div className="flex flex-col items-center gap-4 py-4">
      <motion.div
        animate={{ rotate: 360 }}
        transition={{ duration: 1.2, repeat: Infinity, ease: "linear" }}
        className="flex h-14 w-14 items-center justify-center"
      >
        <Loader2 className="h-12 w-12 text-emerald-300" />
      </motion.div>
      <div className="text-center">
        <p className="text-[14px] font-semibold text-slate-100">Carregando solicitação…</p>
        <p className="mt-1 text-[11.5px] text-slate-500">
          Sincronizando com o servidor e gravando auditoria
        </p>
      </div>
      <div className="h-1 w-48 overflow-hidden rounded-full bg-white/[0.05]">
        <motion.div
          initial={{ x: "-100%" }}
          animate={{ x: "100%" }}
          transition={{ duration: 1.0, repeat: Infinity, ease: "easeInOut" }}
          className="h-full w-1/2 rounded-full bg-gradient-to-r from-transparent via-emerald-400/60 to-transparent"
        />
      </div>
    </div>
  );
}

function SuccessPanel({ kind }: { kind: "approve" | "reject" }) {
  const isApprove = kind === "approve";
  return (
    <div className="flex flex-col items-center gap-4 py-4 text-center">
      <motion.div
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        transition={{ type: "spring", stiffness: 220, damping: 14 }}
        className={cn(
          "flex h-14 w-14 items-center justify-center rounded-full ring-2 ring-inset",
          isApprove
            ? "bg-emerald-400/20 ring-emerald-400/40"
            : "bg-rose-400/15 ring-rose-400/40",
        )}
      >
        {isApprove ? (
          <CheckCircle2 className="h-7 w-7 text-emerald-300" />
        ) : (
          <ThumbsDown className="h-6 w-6 text-rose-300" />
        )}
      </motion.div>
      <div>
        <p className="text-[15px] font-semibold text-slate-100">
          {isApprove ? "Aprovada!" : "Revisão rejeitada"}
        </p>
        <p className="mt-1 text-[11.5px] text-slate-500">
          {isApprove ? (
            <>
              Lead promovido para{" "}
              <span className="font-semibold text-emerald-200">Leads Aprovados</span>.
            </>
          ) : (
            <>Registro arquivado. Auditoria atualizada.</>
          )}
        </p>
      </div>
      <span className="inline-flex items-center gap-1 rounded-full border border-emerald-400/30 bg-emerald-400/10 px-2 py-[1px] text-[9px] font-semibold uppercase tracking-wider text-emerald-300">
        <Sparkles className="h-2.5 w-2.5" />
        Auditoria registrada
      </span>
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
