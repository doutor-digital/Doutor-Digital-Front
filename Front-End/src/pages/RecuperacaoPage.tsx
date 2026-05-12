import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  ArrowLeft,
  Building2,
  Calendar,
  ChevronDown,
  ChevronRight,
  CheckCircle2,
  History,
  LifeBuoy,
  MessageCircle,
  Phone as PhoneIcon,
  PhoneCall,
  Plus,
  RefreshCw,
  Target,
  UserCog,
  X,
} from "@/components/icons";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card, CardBody } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { EmptyState } from "@/components/ui/EmptyState";
import { webhooksService } from "@/services/webhooks";
import { assignmentsService } from "@/services/assignments";
import { useClinic } from "@/hooks/useClinic";
import { cn, formatDate, formatNumber } from "@/lib/utils";
import type {
  CreateRecoveryAttempt,
  RecoveryAttempt,
  RecoveryLead,
  RecoveryMethod,
  RecoveryOutcome,
} from "@/types";

// ─── Helpers de telefone & links ─────────────────────────────────────────────

function digitsOnly(p?: string | null) {
  return (p ?? "").replace(/\D/g, "");
}

function whatsappUrl(phone?: string | null, name?: string | null) {
  const d = digitsOnly(phone);
  if (!d) return null;
  const normalized = d.length === 11 || d.length === 10 ? `55${d}` : d;
  const greeting = name?.split(" ")[0]
    ? `Olá ${name.split(" ")[0]}! Tudo bem? Vim retomar nosso contato sobre seu tratamento.`
    : "Olá! Vim retomar nosso contato sobre seu tratamento.";
  return `https://wa.me/${normalized}?text=${encodeURIComponent(greeting)}`;
}

function telUrl(phone?: string | null) {
  const d = digitsOnly(phone);
  return d ? `tel:${d}` : null;
}

// ─── Tradução dos enums ──────────────────────────────────────────────────────

const METHOD_LABELS: Record<string, string> = {
  whatsapp: "WhatsApp",
  call: "Ligação",
  email: "Email",
  visit: "Visita",
  other: "Outro",
};

const OUTCOME_LABELS: Record<string, string> = {
  no_answer: "Sem resposta",
  scheduled: "Reagendado",
  recovered: "Recuperado",
  lost: "Perdido",
  follow_up: "Aguardando retorno",
};

const OUTCOME_TONES: Record<string, string> = {
  no_answer: "bg-slate-500/10 text-slate-300 ring-slate-500/25",
  scheduled: "bg-sky-500/10 text-sky-300 ring-sky-500/25",
  recovered: "bg-emerald-500/10 text-emerald-300 ring-emerald-500/25",
  lost: "bg-rose-500/10 text-rose-300 ring-rose-500/25",
  follow_up: "bg-amber-500/10 text-amber-300 ring-amber-500/25",
};

// ─── Filtros ────────────────────────────────────────────────────────────────

interface RecoveryFilters {
  dateFrom: string;
  dateTo: string;
  attendantId: string;
  attempts: "" | "with" | "without";
}

function defaultRecoveryFilters(): RecoveryFilters {
  return { dateFrom: "", dateTo: "", attendantId: "", attempts: "" };
}

// ─── Modal: registrar tentativa ──────────────────────────────────────────────

function RegisterAttemptModal({
  open,
  leadName,
  busy,
  onClose,
  onSubmit,
}: {
  open: boolean;
  leadName: string;
  busy: boolean;
  onClose: () => void;
  onSubmit: (data: CreateRecoveryAttempt) => void;
}) {
  const [method, setMethod] = useState<RecoveryMethod>("whatsapp");
  const [outcome, setOutcome] = useState<RecoveryOutcome>("no_answer");
  const [notes, setNotes] = useState("");

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/60 px-4">
      <div
        className="w-full max-w-md rounded-xl border border-white/[0.08] bg-[#0a0a0d] shadow-[0_24px_60px_-12px_rgba(0,0,0,0.7)]"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="flex items-start justify-between border-b border-white/[0.05] px-5 py-4">
          <div className="min-w-0">
            <h2 className="text-[15px] font-semibold text-slate-100">
              Registrar tentativa
            </h2>
            <p className="mt-0.5 truncate text-[12px] text-slate-500">
              {leadName}
            </p>
          </div>
          <button
            onClick={onClose}
            className="rounded-md p-1 text-slate-500 hover:bg-white/[0.05] hover:text-slate-300"
            aria-label="Fechar"
          >
            <X className="h-4 w-4" />
          </button>
        </header>

        <div className="space-y-4 px-5 py-4">
          <label className="block">
            <span className="mb-1.5 block text-[11px] font-medium uppercase tracking-[0.14em] text-slate-400">
              Método
            </span>
            <Select
              value={method}
              onChange={(e) => setMethod(e.target.value as RecoveryMethod)}
            >
              <option value="whatsapp">WhatsApp</option>
              <option value="call">Ligação</option>
              <option value="email">Email</option>
              <option value="visit">Visita</option>
              <option value="other">Outro</option>
            </Select>
          </label>

          <label className="block">
            <span className="mb-1.5 block text-[11px] font-medium uppercase tracking-[0.14em] text-slate-400">
              Resultado
            </span>
            <Select
              value={outcome}
              onChange={(e) => setOutcome(e.target.value as RecoveryOutcome)}
            >
              <option value="no_answer">Sem resposta</option>
              <option value="scheduled">Reagendado</option>
              <option value="follow_up">Aguardando retorno</option>
              <option value="recovered">Recuperado</option>
              <option value="lost">Perdido</option>
            </Select>
          </label>

          <label className="block">
            <span className="mb-1.5 block text-[11px] font-medium uppercase tracking-[0.14em] text-slate-400">
              Observações
            </span>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              placeholder="O que foi conversado, próximos passos…"
              className={cn(
                "w-full rounded-md border border-white/[0.08] bg-white/[0.02] px-3 py-2",
                "text-[13px] text-slate-100 placeholder:text-slate-600 resize-none",
                "focus:outline-none focus:border-white/[0.18] focus:bg-white/[0.03] transition",
              )}
            />
          </label>
        </div>

        <footer className="flex items-center justify-end gap-2 border-t border-white/[0.05] px-5 py-3">
          <Button variant="outline" size="sm" onClick={onClose} disabled={busy}>
            Cancelar
          </Button>
          <Button
            size="sm"
            disabled={busy}
            onClick={() => onSubmit({ method, outcome, notes: notes.trim() || undefined })}
          >
            {busy ? "Salvando…" : "Registrar"}
          </Button>
        </footer>
      </div>
    </div>
  );
}

// ─── Bloco de histórico (carregado on-demand) ────────────────────────────────

function AttemptsHistory({ leadId }: { leadId: number }) {
  const q = useQuery({
    queryKey: ["recovery-attempts", leadId],
    queryFn: () => webhooksService.listRecoveryAttempts(leadId),
  });

  if (q.isLoading) {
    return (
      <div className="space-y-2 px-3 py-3">
        {[...Array(2)].map((_, i) => (
          <div key={i} className="h-10 animate-pulse rounded-md bg-white/[0.02]" />
        ))}
      </div>
    );
  }

  const items = q.data ?? [];
  if (items.length === 0) {
    return (
      <p className="px-3 py-3 text-[12px] italic text-slate-500">
        Nenhuma tentativa registrada ainda.
      </p>
    );
  }

  return (
    <ul className="divide-y divide-white/[0.04] px-1 py-1">
      {items.map((a: RecoveryAttempt) => (
        <li key={a.id} className="flex items-start gap-3 px-2 py-2">
          <span
            className={cn(
              "shrink-0 rounded-md px-2 py-0.5 text-[10.5px] font-semibold uppercase tracking-wider ring-1 ring-inset",
              OUTCOME_TONES[a.outcome] ?? OUTCOME_TONES.no_answer,
            )}
          >
            {OUTCOME_LABELS[a.outcome] ?? a.outcome}
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2 text-[12px] text-slate-300">
              <span className="font-medium">{METHOD_LABELS[a.method] ?? a.method}</span>
              {a.attendantName && (
                <span className="text-slate-500">· {a.attendantName}</span>
              )}
              <span className="ml-auto text-[10.5px] tabular-nums text-slate-500">
                {formatDate(a.createdAt)}
              </span>
            </div>
            {a.notes && (
              <p className="mt-1 whitespace-pre-wrap text-[12px] text-slate-400">
                {a.notes}
              </p>
            )}
          </div>
        </li>
      ))}
    </ul>
  );
}

// ─── Item da lista ───────────────────────────────────────────────────────────

function RecoveryRow({
  lead,
  onRegister,
  onRecover,
}: {
  lead: RecoveryLead;
  onRegister: (lead: RecoveryLead) => void;
  onRecover: (lead: RecoveryLead) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const wa = whatsappUrl(lead.phone, lead.name);
  const tel = telUrl(lead.phone);

  return (
    <li className="px-2 py-3 transition hover:bg-white/[0.02]">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <Link
              to={`/leads/${lead.id}/revisar`}
              className="text-[13px] font-semibold text-slate-100 hover:text-emerald-300"
            >
              {lead.name || `Lead #${lead.id}`}
            </Link>
            {lead.attemptsCount > 0 && (
              <span className="inline-flex items-center gap-1 rounded-md bg-amber-500/10 px-1.5 py-0.5 text-[10.5px] font-semibold text-amber-300 ring-1 ring-inset ring-amber-500/25">
                <History className="h-3 w-3" />
                {lead.attemptsCount} tentativa{lead.attemptsCount === 1 ? "" : "s"}
              </span>
            )}
            {lead.lastAttemptOutcome && (
              <span
                className={cn(
                  "rounded-md px-1.5 py-0.5 text-[10.5px] font-semibold ring-1 ring-inset",
                  OUTCOME_TONES[lead.lastAttemptOutcome] ?? OUTCOME_TONES.no_answer,
                )}
              >
                {OUTCOME_LABELS[lead.lastAttemptOutcome] ?? lead.lastAttemptOutcome}
              </span>
            )}
          </div>

          <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-slate-500">
            {lead.phone && (
              <span className="inline-flex items-center gap-1 font-mono tabular-nums">
                <PhoneIcon className="h-3 w-3" />
                {lead.phone}
              </span>
            )}
            {lead.unitName && (
              <span className="inline-flex items-center gap-1">
                <Building2 className="h-3 w-3" />
                {lead.unitName}
              </span>
            )}
            {lead.attendantName && (
              <span className="inline-flex items-center gap-1">
                <UserCog className="h-3 w-3" />
                {lead.attendantName}
              </span>
            )}
            {lead.source && (
              <span className="inline-flex items-center gap-1">
                <Target className="h-3 w-3" />
                {lead.source}
                {lead.campaign ? ` · ${lead.campaign}` : ""}
              </span>
            )}
          </div>

          <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[10.5px] tabular-nums text-slate-500">
            {lead.attendanceStatusAt && (
              <span>Compareceu: {formatDate(lead.attendanceStatusAt)}</span>
            )}
            {lead.lastAttemptAt && (
              <span>Última tentativa: {formatDate(lead.lastAttemptAt)}</span>
            )}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          {wa && (
            <a
              href={wa}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 rounded-md bg-emerald-500/15 px-2.5 py-1 text-[11px] font-semibold text-emerald-300 ring-1 ring-inset ring-emerald-500/25 transition hover:bg-emerald-500/25"
              title="Abrir WhatsApp"
            >
              <MessageCircle className="h-3.5 w-3.5" /> WhatsApp
            </a>
          )}
          {tel && (
            <a
              href={tel}
              className="inline-flex items-center gap-1 rounded-md bg-sky-500/15 px-2.5 py-1 text-[11px] font-semibold text-sky-300 ring-1 ring-inset ring-sky-500/25 transition hover:bg-sky-500/25"
              title="Ligar"
            >
              <PhoneCall className="h-3.5 w-3.5" /> Ligar
            </a>
          )}
          <button
            onClick={() => onRegister(lead)}
            className="inline-flex items-center gap-1 rounded-md bg-white/[0.04] px-2.5 py-1 text-[11px] font-semibold text-slate-300 ring-1 ring-inset ring-white/[0.08] transition hover:bg-white/[0.08] hover:text-slate-100"
            title="Registrar tentativa"
          >
            <Plus className="h-3.5 w-3.5" /> Tentativa
          </button>
          <button
            onClick={() => onRecover(lead)}
            className="inline-flex items-center gap-1 rounded-md bg-emerald-500 px-2.5 py-1 text-[11px] font-semibold text-emerald-950 ring-1 ring-inset ring-emerald-400 transition hover:bg-emerald-400"
            title="Marcar como recuperado"
          >
            <CheckCircle2 className="h-3.5 w-3.5" /> Recuperado
          </button>
        </div>
      </div>

      {lead.attemptsCount > 0 && (
        <button
          onClick={() => setExpanded((v) => !v)}
          className="mt-2 inline-flex items-center gap-1 text-[11px] font-medium text-slate-500 transition hover:text-slate-300"
        >
          {expanded ? (
            <ChevronDown className="h-3 w-3" />
          ) : (
            <ChevronRight className="h-3 w-3" />
          )}
          {expanded ? "Ocultar" : "Ver"} histórico de tentativas
        </button>
      )}

      {expanded && lead.attemptsCount > 0 && (
        <div className="mt-2 rounded-md border border-white/[0.05] bg-white/[0.015]">
          <AttemptsHistory leadId={lead.id} />
        </div>
      )}
    </li>
  );
}

// ─── Página ──────────────────────────────────────────────────────────────────

export default function RecuperacaoPage() {
  const { tenantId, unitId } = useClinic();
  const clinicId = tenantId ?? undefined;
  const qc = useQueryClient();

  const [filters, setFilters] = useState<RecoveryFilters>(defaultRecoveryFilters);
  const [registerLead, setRegisterLead] = useState<RecoveryLead | null>(null);

  const attendantsQ = useQuery({
    queryKey: ["attendants"],
    queryFn: () => assignmentsService.listAttendants(),
    staleTime: 60_000,
  });

  const query = useQuery({
    queryKey: [
      "recovery-queue",
      clinicId,
      unitId,
      filters.dateFrom,
      filters.dateTo,
      filters.attendantId,
      filters.attempts,
    ],
    queryFn: () =>
      webhooksService.recoveryQueue({
        clinicId,
        unitId: unitId ?? undefined,
        dateFrom: filters.dateFrom || undefined,
        dateTo: filters.dateTo || undefined,
        attendantId: filters.attendantId ? Number(filters.attendantId) : undefined,
        attempts: filters.attempts || undefined,
      }),
    enabled: !!clinicId,
    placeholderData: (prev) => prev,
  });

  const items = query.data ?? [];

  const createAttempt = useMutation({
    mutationFn: ({ leadId, payload }: { leadId: number; payload: CreateRecoveryAttempt }) =>
      webhooksService.createRecoveryAttempt(leadId, payload),
    onSuccess: (_data, vars) => {
      toast.success("Tentativa registrada");
      setRegisterLead(null);
      qc.invalidateQueries({ queryKey: ["recovery-queue"] });
      qc.invalidateQueries({ queryKey: ["recovery-attempts", vars.leadId] });
    },
    onError: (err: unknown) => {
      const msg =
        (err as { response?: { data?: { title?: string } } })?.response?.data?.title ??
        "Não foi possível registrar";
      toast.error(msg);
    },
  });

  const markRecovered = useMutation({
    mutationFn: (leadId: number) => webhooksService.markRecovered(leadId),
    onSuccess: (_data, leadId) => {
      toast.success("Lead marcado como recuperado");
      qc.invalidateQueries({ queryKey: ["recovery-queue"] });
      qc.invalidateQueries({ queryKey: ["recovery-attempts", leadId] });
    },
    onError: (err: unknown) => {
      const msg =
        (err as { response?: { data?: { title?: string } } })?.response?.data?.title ??
        "Não foi possível marcar como recuperado";
      toast.error(msg);
    },
  });

  function handleRecover(lead: RecoveryLead) {
    if (!confirm(`Marcar "${lead.name}" como recuperado? O lead será movido para Fechou Tratamento.`))
      return;
    markRecovered.mutate(lead.id);
  }

  const hasActiveFilters = useMemo(
    () =>
      !!filters.dateFrom ||
      !!filters.dateTo ||
      !!filters.attendantId ||
      !!filters.attempts,
    [filters],
  );

  return (
    <>
      <PageHeader
        title="Fila de recuperação"
        description="Leads que compareceram à consulta mas não fecharam tratamento. Ação comercial: resgate."
        actions={
          <div className="flex gap-2">
            <Link to="/">
              <Button variant="outline" size="sm">
                <ArrowLeft className="mr-2 h-4 w-4" />
                Voltar
              </Button>
            </Link>
            <Button
              size="sm"
              variant="outline"
              onClick={() => query.refetch()}
              disabled={query.isFetching}
            >
              <RefreshCw className={cn("mr-2 h-4 w-4", query.isFetching && "animate-spin")} />
              Atualizar
            </Button>
          </div>
        }
      />

      {/* Filtros */}
      <Card className="mt-4">
        <CardBody>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <label className="block">
              <span className="mb-1 block text-[10.5px] font-medium uppercase tracking-[0.14em] text-slate-500">
                De
              </span>
              <Input
                type="date"
                icon={<Calendar className="h-3.5 w-3.5" />}
                value={filters.dateFrom}
                max={filters.dateTo || undefined}
                onChange={(e) =>
                  setFilters((p) => ({ ...p, dateFrom: e.target.value }))
                }
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-[10.5px] font-medium uppercase tracking-[0.14em] text-slate-500">
                Até
              </span>
              <Input
                type="date"
                icon={<Calendar className="h-3.5 w-3.5" />}
                value={filters.dateTo}
                min={filters.dateFrom || undefined}
                onChange={(e) =>
                  setFilters((p) => ({ ...p, dateTo: e.target.value }))
                }
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-[10.5px] font-medium uppercase tracking-[0.14em] text-slate-500">
                Atendente
              </span>
              <Select
                value={filters.attendantId}
                onChange={(e) =>
                  setFilters((p) => ({ ...p, attendantId: e.target.value }))
                }
              >
                <option value="">Todos</option>
                {(attendantsQ.data ?? []).map((a) => (
                  <option key={a.id} value={String(a.id)}>
                    {a.name || a.email || `Atendente ${a.id}`}
                  </option>
                ))}
              </Select>
            </label>
            <label className="block">
              <span className="mb-1 block text-[10.5px] font-medium uppercase tracking-[0.14em] text-slate-500">
                Tentativas
              </span>
              <Select
                value={filters.attempts}
                onChange={(e) =>
                  setFilters((p) => ({
                    ...p,
                    attempts: e.target.value as RecoveryFilters["attempts"],
                  }))
                }
              >
                <option value="">Todos</option>
                <option value="without">Sem tentativa</option>
                <option value="with">Com tentativa</option>
              </Select>
            </label>
          </div>

          {hasActiveFilters && (
            <div className="mt-3 flex items-center justify-end">
              <button
                onClick={() => setFilters(defaultRecoveryFilters())}
                className="inline-flex items-center gap-1 text-[11px] font-medium text-slate-500 transition hover:text-slate-300"
              >
                <X className="h-3 w-3" /> Limpar filtros
              </button>
            </div>
          )}
        </CardBody>
      </Card>

      {/* Lista */}
      <Card className="mt-4">
        <CardBody>
          <div className="mb-3 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-[12px] text-slate-400">
              <LifeBuoy className="h-3.5 w-3.5 text-amber-300" />
              <span className="font-medium text-slate-200">
                {formatNumber(items.length)}
              </span>
              <span>oportunidade(s) de recuperação</span>
            </div>
          </div>

          {query.isLoading ? (
            <div className="space-y-2">
              {[...Array(5)].map((_, i) => (
                <div
                  key={i}
                  className="h-20 animate-pulse rounded-md bg-white/[0.02]"
                />
              ))}
            </div>
          ) : items.length === 0 ? (
            <EmptyState
              title="Sem leads na fila de recuperação"
              description={
                hasActiveFilters
                  ? "Nenhum lead bate com os filtros atuais."
                  : "Nenhum lead em 08_NAO_FECHOU_TRATAMENTO."
              }
            />
          ) : (
            <ul className="divide-y divide-white/[0.05]">
              {items.map((it) => (
                <RecoveryRow
                  key={it.id}
                  lead={it}
                  onRegister={setRegisterLead}
                  onRecover={handleRecover}
                />
              ))}
            </ul>
          )}
        </CardBody>
      </Card>

      <RegisterAttemptModal
        open={!!registerLead}
        leadName={registerLead?.name ?? ""}
        busy={createAttempt.isPending}
        onClose={() => setRegisterLead(null)}
        onSubmit={(payload) =>
          registerLead &&
          createAttempt.mutate({ leadId: registerLead.id, payload })
        }
      />
    </>
  );
}
