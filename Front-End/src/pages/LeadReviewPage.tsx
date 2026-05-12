import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  ArrowLeft,
  Building2,
  Calendar,
  CheckCircle2,
  CreditCard,
  FileText,
  Hash,
  Mail,
  Phone,
  Save,
  Target,
  User2,
  UserCog,
  Wallet,
  X,
} from "@/components/icons";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Button } from "@/components/ui/Button";
import { webhooksService } from "@/services/webhooks";
import { assignmentsService } from "@/services/assignments";
import { unitsService } from "@/services/units";
import { cn } from "@/lib/utils";
import type {
  LeadDetail,
  LeadPaymentReceipt,
  NoAppointmentReason,
  NoCloseReason,
  PaymentMethod,
  TreatmentPlanCategory,
} from "@/types";

// ─── Enums com labels ────────────────────────────────────────────────────────

const LEAD_TYPE_OPTIONS = [
  { value: "cadastro", label: "Cadastro" },
  { value: "resgate", label: "Resgate" },
] as const;

const RESCUE_TYPE_OPTIONS = [
  { value: "mensagem", label: "Mensagem" },
  { value: "ligacao", label: "Ligação" },
  { value: "disparo_massa", label: "Disparo em massa" },
] as const;

const NO_APPOINTMENT_REASONS: { value: NoAppointmentReason; label: string }[] = [
  { value: "sem_interacao", label: "Sem interação" },
  { value: "sem_continuidade", label: "Não deu continuidade ao atendimento" },
  { value: "plano_saude", label: "Atendimento por plano de saúde" },
  { value: "terceiros", label: "Atendimento para terceiros" },
  { value: "sem_condicoes", label: "Sem condições financeiras" },
  { value: "vai_se_organizar", label: "Vai se organizar financeiramente" },
  { value: "busca_laudo", label: "Busca apenas laudo médico" },
  { value: "interesse_pilates", label: "Interesse apenas em pilates" },
  { value: "interesse_liberacao", label: "Interesse apenas em liberação miofascial" },
  { value: "mora_outra_cidade", label: "Mora +50km" },
  { value: "sem_interesse", label: "Sem interesse" },
  { value: "clicou_engano", label: "Clicou por engano" },
  { value: "outro_tratamento", label: "Busca outro tipo de tratamento" },
  { value: "outra_patologia", label: "Outra patologia" },
  { value: "em_viagem", label: "Em viagem no momento" },
];

const NO_CLOSE_REASONS: { value: NoCloseReason; label: string }[] = [
  { value: "fechou_total", label: "Fechou tratamento (total)" },
  { value: "fechou_parcial", label: "Fechou tratamento (parcial)" },
  { value: "assinou_sem_entrada", label: "Assinou contrato, sem entrada" },
  { value: "decide_familia", label: "Vai decidir com familiares" },
  { value: "verifica_pagamento", label: "Vai verificar a melhor forma de pagamento" },
  { value: "exame_imagem", label: "Solicitado exame de imagem" },
  { value: "mora_fora", label: "Mora fora +50km" },
  { value: "outra_patologia", label: "Outra patologia" },
  { value: "sem_condicoes", label: "Sem condições financeiras" },
];

const TREATMENT_PLAN_GROUPS: {
  group: string;
  options: { value: TreatmentPlanCategory; label: string }[];
}[] = [
  {
    group: "Tratamento",
    options: [
      { value: "tratamento_pontual", label: "Tratamento pontual" },
      { value: "clinico_mensal", label: "Clínico — mensal" },
      { value: "clinico_semestral", label: "Clínico — semestral" },
      { value: "essencial_mensal", label: "Essencial — mensal" },
      { value: "essencial_semestral", label: "Essencial — semestral" },
      { value: "essencial_anual", label: "Essencial — anual" },
    ],
  },
  {
    group: "Pilates",
    options: [
      { value: "pilates_mensal", label: "Pilates — mensal" },
      { value: "pilates_semestral", label: "Pilates — semestral" },
      { value: "pilates_anual", label: "Pilates — anual" },
    ],
  },
  {
    group: "Musculação clínica 3x",
    options: [
      { value: "musculacao_clinica_mensal", label: "Musculação clínica — mensal" },
      { value: "musculacao_clinica_semestral", label: "Musculação clínica — semestral" },
      { value: "musculacao_clinica_anual", label: "Musculação clínica — anual" },
    ],
  },
  {
    group: "Procedimentos",
    options: [
      { value: "liberacao_parcial_individual", label: "Liberação parcial individual" },
      { value: "liberacao_total_individual", label: "Liberação total individual" },
      { value: "sessao_fisioterapia", label: "Sessão de fisioterapia" },
    ],
  },
];

const PAYMENT_METHODS: { value: PaymentMethod; label: string }[] = [
  { value: "pix", label: "PIX" },
  { value: "dinheiro", label: "Dinheiro" },
  { value: "cartao_credito", label: "Cartão de crédito" },
  { value: "cartao_debito", label: "Cartão de débito" },
  { value: "boleto", label: "Boleto" },
  { value: "transferencia", label: "Transferência" },
  { value: "outro", label: "Outro" },
];

// ─── Draft state ─────────────────────────────────────────────────────────────

interface DraftState {
  // Identificação
  name: string;
  phone: string;
  email: string;
  cpf: string;

  // Atribuição
  source: string;
  unitId: string;
  attendantId: string;

  // Cadastro geral
  leadType: "" | "cadastro" | "resgate";
  rescueType: "" | "mensagem" | "ligacao" | "disparo_massa";
  hadInteraction: "" | "yes" | "no";
  scheduledConsultation: "" | "yes" | "no";
  hasPayment: "" | "yes" | "no";
  appointmentScheduledAt: string;
  noAppointmentReason: string;
  noAppointmentCity: string;

  // Consulta comparecida
  consultationValue: string;
  consultationReceipts: ReceiptDraft[];
  indicatedTreatment: string;
  treatmentBudget: string;
  closedTreatment: "" | "yes" | "no";
  noCloseReason: string;

  // Tratamentos fechados
  treatmentPlanCategory: string;
  treatmentPlanValue: string;
  treatmentReceipts: ReceiptDraft[];

  observations: string;
}

interface ReceiptDraft {
  amount: string;
  method: string;
  receivedAt: string;
  isAdvance: boolean;
}

const EMPTY_RECEIPT: ReceiptDraft = {
  amount: "",
  method: "",
  receivedAt: "",
  isAdvance: false,
};

function leadToDraft(l: LeadDetail): DraftState {
  // Filtra receipts por kind e slot, preenchendo 2 (consulta) / 6 (tratamento)
  const consultaSlots: ReceiptDraft[] = Array.from({ length: 2 }, (_, i) => {
    const slot = i + 1;
    const r = l.paymentReceipts?.find((x) => x.kind === "consulta" && x.slot === slot);
    return r ? receiptToDraft(r) : { ...EMPTY_RECEIPT };
  });
  const tratamentoSlots: ReceiptDraft[] = Array.from({ length: 6 }, (_, i) => {
    const slot = i + 1;
    const r = l.paymentReceipts?.find((x) => x.kind === "tratamento" && x.slot === slot);
    return r ? receiptToDraft(r) : { ...EMPTY_RECEIPT };
  });

  return {
    name: l.name ?? "",
    phone: l.phone ?? "",
    email: l.email ?? "",
    cpf: l.cpf ?? "",
    source: l.source ?? "",
    unitId: l.unitId != null ? String(l.unitId) : "",
    attendantId: l.attendantId != null ? String(l.attendantId) : "",

    leadType: (l.leadType as DraftState["leadType"]) ?? "",
    rescueType: (l.rescueType as DraftState["rescueType"]) ?? "",
    hadInteraction:
      l.hadInteraction == null ? "" : l.hadInteraction ? "yes" : "no",
    scheduledConsultation:
      l.scheduledConsultation == null ? "" : l.scheduledConsultation ? "yes" : "no",
    hasPayment: l.hasPayment == null ? "" : l.hasPayment ? "yes" : "no",
    appointmentScheduledAt: l.appointmentScheduledAt
      ? l.appointmentScheduledAt.slice(0, 16)
      : "",
    noAppointmentReason: l.noAppointmentReason ?? "",
    noAppointmentCity: l.noAppointmentCity ?? "",

    consultationValue: l.consultationValue != null ? String(l.consultationValue) : "",
    consultationReceipts: consultaSlots,
    indicatedTreatment: l.indicatedTreatment ?? "",
    treatmentBudget: l.treatmentBudget != null ? String(l.treatmentBudget) : "",
    closedTreatment:
      l.closedTreatment == null ? "" : l.closedTreatment ? "yes" : "no",
    noCloseReason: l.noCloseReason ?? "",

    treatmentPlanCategory: l.treatmentPlanCategory ?? "",
    treatmentPlanValue: l.treatmentPlanValue != null ? String(l.treatmentPlanValue) : "",
    treatmentReceipts: tratamentoSlots,

    observations: l.observations ?? "",
  };
}

function receiptToDraft(r: LeadPaymentReceipt): ReceiptDraft {
  return {
    amount: r.amount != null ? String(r.amount) : "",
    method: (r.method as string) ?? "",
    receivedAt: r.receivedAt ? r.receivedAt.slice(0, 10) : "",
    isAdvance: !!r.isAdvance,
  };
}

function ynToBool(v: "" | "yes" | "no"): boolean | null {
  if (v === "yes") return true;
  if (v === "no") return false;
  return null;
}

function buildPayload(draft: DraftState): Record<string, unknown> {
  const payload: Record<string, unknown> = {
    name: draft.name.trim(),
    phone: draft.phone.trim() || null,
    email: draft.email.trim() || null,
    cpf: draft.cpf.trim() || null,
    source: draft.source.trim(),
    unitId: draft.unitId ? Number(draft.unitId) : null,
    attendantId: draft.attendantId ? Number(draft.attendantId) : null,

    leadType: draft.leadType || null,
    rescueType: draft.leadType === "resgate" ? draft.rescueType || null : null,
    hadInteraction: ynToBool(draft.hadInteraction),
    scheduledConsultation: ynToBool(draft.scheduledConsultation),
    hasPayment: ynToBool(draft.hasPayment) ?? undefined,
    appointmentScheduledAt:
      draft.appointmentScheduledAt && draft.scheduledConsultation === "yes"
        ? draft.appointmentScheduledAt
        : null,
    noAppointmentReason:
      draft.scheduledConsultation === "no" ? draft.noAppointmentReason || null : null,
    noAppointmentCity:
      draft.noAppointmentReason === "mora_outra_cidade"
        ? draft.noAppointmentCity.trim() || null
        : null,

    consultationValue: draft.consultationValue ? Number(draft.consultationValue) : null,
    indicatedTreatment: draft.indicatedTreatment.trim() || null,
    treatmentBudget: draft.treatmentBudget ? Number(draft.treatmentBudget) : null,
    closedTreatment: ynToBool(draft.closedTreatment),
    noCloseReason: draft.closedTreatment === "no" ? draft.noCloseReason || null : null,

    treatmentPlanCategory:
      draft.closedTreatment === "yes" ? draft.treatmentPlanCategory || null : null,
    treatmentPlanValue:
      draft.closedTreatment === "yes" && draft.treatmentPlanValue
        ? Number(draft.treatmentPlanValue)
        : null,

    observations: draft.observations.trim() || null,
  };

  // Receipts (envia sempre, back filtra linhas vazias)
  const receipts: Array<{
    kind: "consulta" | "tratamento";
    slot: number;
    amount: number | null;
    method: string | null;
    receivedAt: string | null;
    isAdvance: boolean;
  }> = [];

  draft.consultationReceipts.forEach((r, i) => {
    receipts.push({
      kind: "consulta",
      slot: i + 1,
      amount: r.amount ? Number(r.amount) : null,
      method: r.method || null,
      receivedAt: r.receivedAt || null,
      isAdvance: r.isAdvance,
    });
  });
  if (draft.closedTreatment === "yes") {
    draft.treatmentReceipts.forEach((r, i) => {
      receipts.push({
        kind: "tratamento",
        slot: i + 1,
        amount: r.amount ? Number(r.amount) : null,
        method: r.method || null,
        receivedAt: r.receivedAt || null,
        isAdvance: r.isAdvance,
      });
    });
  }
  payload.paymentReceipts = receipts;

  return payload;
}

// ─── Subcomponentes ──────────────────────────────────────────────────────────

function Section({
  title,
  description,
  icon,
  children,
}: {
  title: string;
  description?: string;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-xl border border-white/[0.06] bg-white/[0.015] p-5">
      <header className="mb-4 flex items-start gap-3 border-b border-white/[0.05] pb-3">
        <div className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-white/[0.04] ring-1 ring-inset ring-white/[0.08] text-slate-300">
          {icon}
        </div>
        <div className="min-w-0">
          <h2 className="text-[14px] font-semibold tracking-tight text-slate-100">
            {title}
          </h2>
          {description && (
            <p className="mt-0.5 text-[12px] text-slate-500">{description}</p>
          )}
        </div>
      </header>
      <div className="space-y-4">{children}</div>
    </section>
  );
}

function Field({
  label,
  hint,
  children,
  required,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
  required?: boolean;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-[11px] font-medium uppercase tracking-[0.14em] text-slate-400">
        {label}
        {required && <span className="ml-0.5 text-rose-400">*</span>}
      </span>
      {children}
      {hint && <span className="mt-1 block text-[11px] text-slate-500">{hint}</span>}
    </label>
  );
}

function YesNoToggle({
  value,
  onChange,
}: {
  value: "" | "yes" | "no";
  onChange: (v: "" | "yes" | "no") => void;
}) {
  return (
    <div className="inline-flex items-center gap-0.5 rounded-lg border border-white/[0.08] bg-white/[0.02] p-0.5">
      {(["yes", "no"] as const).map((v) => (
        <button
          key={v}
          type="button"
          onClick={() => onChange(value === v ? "" : v)}
          className={cn(
            "rounded-md px-3 py-1 text-[12px] font-medium transition",
            value === v
              ? v === "yes"
                ? "bg-emerald-500/15 text-emerald-300 ring-1 ring-inset ring-emerald-500/30"
                : "bg-rose-500/15 text-rose-300 ring-1 ring-inset ring-rose-500/30"
              : "text-slate-400 hover:bg-white/[0.04] hover:text-slate-200",
          )}
        >
          {v === "yes" ? "Sim" : "Não"}
        </button>
      ))}
    </div>
  );
}

function ReceiptRow({
  index,
  receipt,
  onChange,
}: {
  index: number;
  receipt: ReceiptDraft;
  onChange: (r: ReceiptDraft) => void;
}) {
  return (
    <div className="grid grid-cols-1 gap-2 rounded-md border border-white/[0.05] bg-white/[0.01] p-3 sm:grid-cols-[1fr_1fr_1fr_auto]">
      <div className="absolute -mt-2 ml-1 text-[9px] font-bold uppercase tracking-wider text-slate-600">
        #{index + 1}
      </div>
      <div>
        <span className="mb-1 block text-[10px] font-medium uppercase tracking-[0.12em] text-slate-500">
          Valor
        </span>
        <Input
          type="number"
          step="0.01"
          min="0"
          icon={<Wallet className="h-3.5 w-3.5" />}
          value={receipt.amount}
          onChange={(e) => onChange({ ...receipt, amount: e.target.value })}
          placeholder="0,00"
        />
      </div>
      <div>
        <span className="mb-1 block text-[10px] font-medium uppercase tracking-[0.12em] text-slate-500">
          Forma de pagamento
        </span>
        <Select
          value={receipt.method}
          onChange={(e) => onChange({ ...receipt, method: e.target.value })}
        >
          <option value="">—</option>
          {PAYMENT_METHODS.map((m) => (
            <option key={m.value} value={m.value}>
              {m.label}
            </option>
          ))}
        </Select>
      </div>
      <div>
        <span className="mb-1 block text-[10px] font-medium uppercase tracking-[0.12em] text-slate-500">
          Data
        </span>
        <Input
          type="date"
          icon={<Calendar className="h-3.5 w-3.5" />}
          value={receipt.receivedAt}
          onChange={(e) => onChange({ ...receipt, receivedAt: e.target.value })}
        />
      </div>
      <label className="flex items-center gap-2 self-end pb-2 text-[11.5px] text-slate-300">
        <input
          type="checkbox"
          checked={receipt.isAdvance}
          onChange={(e) => onChange({ ...receipt, isAdvance: e.target.checked })}
          className="h-3.5 w-3.5 accent-amber-500"
        />
        Adiantado
      </label>
    </div>
  );
}

// ─── Página ──────────────────────────────────────────────────────────────────

export default function LeadReviewPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const qc = useQueryClient();

  const leadQ = useQuery({
    queryKey: ["lead-detail", id],
    queryFn: () => webhooksService.getLeadById(id!),
    enabled: !!id,
    retry: false,
  });
  const unitsQ = useQuery({
    queryKey: ["units"],
    queryFn: () => unitsService.list(),
    staleTime: 60_000,
  });
  const attendantsQ = useQuery({
    queryKey: ["attendants"],
    queryFn: () => assignmentsService.listAttendants(),
    staleTime: 60_000,
  });

  const [draft, setDraft] = useState<DraftState | null>(null);

  useEffect(() => {
    if (leadQ.data && draft === null) {
      setDraft(leadToDraft(leadQ.data));
    }
  }, [leadQ.data, draft]);

  const save = useMutation({
    mutationFn: (payload: Record<string, unknown>) =>
      webhooksService.patchLead(id!, payload),
    onSuccess: () => {
      toast.success("Lead atualizado");
      qc.invalidateQueries({ queryKey: ["lead-detail", id] });
      navigate(`/leads/${id}`);
    },
    onError: (err: unknown) => {
      const msg =
        (err as { response?: { data?: { title?: string } } })?.response?.data?.title ??
        "Não foi possível salvar";
      toast.error(msg);
    },
  });

  function update<K extends keyof DraftState>(key: K, value: DraftState[K]) {
    setDraft((p) => (p ? { ...p, [key]: value } : p));
  }

  function updateReceipt(
    bucket: "consultationReceipts" | "treatmentReceipts",
    i: number,
    value: ReceiptDraft,
  ) {
    setDraft((p) => {
      if (!p) return p;
      const arr = [...p[bucket]];
      arr[i] = value;
      return { ...p, [bucket]: arr };
    });
  }

  const advanceConsultaCount = useMemo(
    () => draft?.consultationReceipts.filter((r) => r.isAdvance && r.amount).length ?? 0,
    [draft],
  );
  const advanceTratamentoCount = useMemo(
    () => draft?.treatmentReceipts.filter((r) => r.isAdvance && r.amount).length ?? 0,
    [draft],
  );

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!draft) return;
    save.mutate(buildPayload(draft));
  }

  if (leadQ.isLoading || !draft) {
    return (
      <div className="space-y-4">
        <div className="h-8 w-48 rounded bg-white/[0.04] animate-pulse" />
        <div className="h-96 rounded-xl bg-white/[0.02] animate-pulse" />
      </div>
    );
  }

  if (leadQ.isError || !leadQ.data) {
    return (
      <div className="rounded-xl border border-rose-500/30 bg-rose-500/[0.04] p-6">
        <h2 className="text-[14px] font-semibold text-rose-200">Lead não encontrado</h2>
        <Link
          to="/leads"
          className="mt-4 inline-flex items-center gap-1.5 text-[12px] font-medium text-sky-400 hover:text-sky-300"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> Voltar
        </Link>
      </div>
    );
  }

  const l = leadQ.data;

  return (
    <form onSubmit={handleSubmit} className="mx-auto max-w-3xl space-y-5 pb-24">
      {/* Cabeçalho */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <Link
            to={`/leads/${id}`}
            className="inline-flex items-center gap-1 text-[11.5px] font-medium text-slate-500 transition hover:text-slate-300"
          >
            <ArrowLeft className="h-3 w-3" /> Voltar ao detalhe
          </Link>
          <h1 className="mt-1 text-[22px] font-bold leading-tight tracking-tight text-slate-50">
            Revisar lead
          </h1>
          <p className="mt-0.5 text-[12.5px] text-slate-400">
            {l.name || "Sem nome"} · #{l.id}
          </p>
        </div>
      </div>

      {/* ═══════ CADASTRO GERAL ═══════ */}
      <Section
        title="Cadastro geral"
        description="Dados básicos do lead, tipo (cadastro/resgate) e situação do agendamento."
        icon={<User2 className="h-4 w-4" />}
      >
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Nome" required>
            <Input
              icon={<User2 className="h-3.5 w-3.5" />}
              value={draft.name}
              onChange={(e) => update("name", e.target.value)}
              required
            />
          </Field>
          <Field label="Telefone">
            <Input
              icon={<Phone className="h-3.5 w-3.5" />}
              value={draft.phone}
              onChange={(e) => update("phone", e.target.value)}
              placeholder="(11) 99999-9999"
            />
          </Field>
          <Field label="Email">
            <Input
              icon={<Mail className="h-3.5 w-3.5" />}
              type="email"
              value={draft.email}
              onChange={(e) => update("email", e.target.value)}
            />
          </Field>
          <Field label="CPF">
            <Input
              icon={<Hash className="h-3.5 w-3.5" />}
              value={draft.cpf}
              onChange={(e) => update("cpf", e.target.value)}
            />
          </Field>
          <Field label="Origem">
            <Input
              icon={<Target className="h-3.5 w-3.5" />}
              value={draft.source}
              onChange={(e) => update("source", e.target.value)}
              placeholder="META, GOOGLE..."
            />
          </Field>
          <Field label="Unidade">
            <Select
              value={draft.unitId}
              onChange={(e) => update("unitId", e.target.value)}
            >
              <option value="">— Sem unidade —</option>
              {(unitsQ.data ?? []).map((u) => (
                <option key={u.id} value={String(u.id)}>
                  {u.name || `Unidade ${u.id}`}
                </option>
              ))}
            </Select>
          </Field>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Tipo">
            <Select
              value={draft.leadType}
              onChange={(e) =>
                update("leadType", e.target.value as DraftState["leadType"])
              }
            >
              <option value="">—</option>
              {LEAD_TYPE_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </Select>
          </Field>
          {draft.leadType === "resgate" && (
            <Field label="Tipo de resgate">
              <Select
                value={draft.rescueType}
                onChange={(e) =>
                  update("rescueType", e.target.value as DraftState["rescueType"])
                }
              >
                <option value="">—</option>
                {RESCUE_TYPE_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </Select>
            </Field>
          )}
          <Field label="Nome do responsável">
            <Select
              value={draft.attendantId}
              onChange={(e) => update("attendantId", e.target.value)}
            >
              <option value="">— Sem responsável —</option>
              {(attendantsQ.data ?? []).map((a) => (
                <option key={a.id} value={String(a.id)}>
                  {a.name || a.email || `Atendente ${a.id}`}
                </option>
              ))}
            </Select>
          </Field>
        </div>

        <div className="grid grid-cols-1 gap-4 rounded-lg border border-white/[0.05] bg-white/[0.015] p-3 sm:grid-cols-3">
          <Field label="Interação">
            <YesNoToggle
              value={draft.hadInteraction}
              onChange={(v) => update("hadInteraction", v)}
            />
          </Field>
          <Field label="Agendou consulta">
            <YesNoToggle
              value={draft.scheduledConsultation}
              onChange={(v) => update("scheduledConsultation", v)}
            />
          </Field>
          <Field label="Pagamento antecipado">
            <YesNoToggle
              value={draft.hasPayment}
              onChange={(v) => update("hasPayment", v)}
            />
          </Field>
        </div>

        {draft.scheduledConsultation === "yes" && (
          <Field label="Data do agendamento">
            <Input
              type="datetime-local"
              icon={<Calendar className="h-3.5 w-3.5" />}
              value={draft.appointmentScheduledAt}
              onChange={(e) => update("appointmentScheduledAt", e.target.value)}
            />
          </Field>
        )}

        {draft.scheduledConsultation === "no" && (
          <>
            <Field label="Motivo de não agendamento">
              <Select
                value={draft.noAppointmentReason}
                onChange={(e) => update("noAppointmentReason", e.target.value)}
              >
                <option value="">— Selecionar motivo —</option>
                {NO_APPOINTMENT_REASONS.map((r) => (
                  <option key={r.value} value={r.value}>
                    {r.label}
                  </option>
                ))}
              </Select>
            </Field>
            {draft.noAppointmentReason === "mora_outra_cidade" && (
              <Field label="Cidade" hint="Especifique a cidade onde o lead mora">
                <Input
                  icon={<Building2 className="h-3.5 w-3.5" />}
                  value={draft.noAppointmentCity}
                  onChange={(e) => update("noAppointmentCity", e.target.value)}
                  placeholder="Ex: Campinas"
                />
              </Field>
            )}
          </>
        )}
      </Section>

      {/* ═══════ CONSULTA COMPARECIDA ═══════ */}
      <Section
        title="Consulta comparecida"
        description="Valor, recebimentos da consulta, tratamento indicado e desfecho."
        icon={<CheckCircle2 className="h-4 w-4" />}
      >
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Nome do paciente" hint="Geralmente o mesmo do lead">
            <Input value={draft.name} disabled className="opacity-70" />
          </Field>
          <Field label="Valor da consulta">
            <Input
              type="number"
              step="0.01"
              min="0"
              icon={<Wallet className="h-3.5 w-3.5" />}
              value={draft.consultationValue}
              onChange={(e) => update("consultationValue", e.target.value)}
              placeholder="0,00"
            />
          </Field>
        </div>

        <div>
          <p className="mb-2 flex items-center justify-between text-[11px] font-medium uppercase tracking-[0.14em] text-slate-400">
            <span>Recebimentos da consulta (2 linhas)</span>
            {advanceConsultaCount > 0 && (
              <span className="rounded-md bg-amber-500/10 px-2 py-0.5 text-[10px] text-amber-300 ring-1 ring-inset ring-amber-500/25">
                {advanceConsultaCount} adiantado{advanceConsultaCount === 1 ? "" : "s"} → financeiro
              </span>
            )}
          </p>
          <div className="space-y-2">
            {draft.consultationReceipts.map((r, i) => (
              <ReceiptRow
                key={i}
                index={i}
                receipt={r}
                onChange={(nr) => updateReceipt("consultationReceipts", i, nr)}
              />
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Tratamento indicado">
            <Input
              value={draft.indicatedTreatment}
              onChange={(e) => update("indicatedTreatment", e.target.value)}
              placeholder="O que foi indicado pelo profissional"
            />
          </Field>
          <Field label="Orçamento">
            <Input
              type="number"
              step="0.01"
              min="0"
              icon={<Wallet className="h-3.5 w-3.5" />}
              value={draft.treatmentBudget}
              onChange={(e) => update("treatmentBudget", e.target.value)}
              placeholder="0,00"
            />
          </Field>
        </div>

        <Field label="Fechou tratamento">
          <YesNoToggle
            value={draft.closedTreatment}
            onChange={(v) => update("closedTreatment", v)}
          />
        </Field>

        {draft.closedTreatment === "no" && (
          <Field
            label="Motivo de não fechamento (semáforo)"
            hint="Categoria do desfecho pós-consulta"
          >
            <Select
              value={draft.noCloseReason}
              onChange={(e) => update("noCloseReason", e.target.value)}
            >
              <option value="">— Selecionar motivo —</option>
              {NO_CLOSE_REASONS.map((r) => (
                <option key={r.value} value={r.value}>
                  {r.label}
                </option>
              ))}
            </Select>
          </Field>
        )}
      </Section>

      {/* ═══════ TRATAMENTOS FECHADOS ═══════ */}
      {draft.closedTreatment === "yes" && (
        <Section
          title="Tratamento fechado"
          description="Plano contratado, valor e 6 linhas de recebimento."
          icon={<CreditCard className="h-4 w-4" />}
        >
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Nome do paciente">
              <Input value={draft.name} disabled className="opacity-70" />
            </Field>
            <Field label="Valor do plano/atendimento">
              <Input
                type="number"
                step="0.01"
                min="0"
                icon={<Wallet className="h-3.5 w-3.5" />}
                value={draft.treatmentPlanValue}
                onChange={(e) => update("treatmentPlanValue", e.target.value)}
                placeholder="0,00"
              />
            </Field>
          </div>

          <Field label="Plano de tratamento">
            <Select
              value={draft.treatmentPlanCategory}
              onChange={(e) => update("treatmentPlanCategory", e.target.value)}
            >
              <option value="">— Selecionar plano —</option>
              {TREATMENT_PLAN_GROUPS.map((g) => (
                <optgroup key={g.group} label={g.group}>
                  {g.options.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </optgroup>
              ))}
            </Select>
          </Field>

          <div>
            <p className="mb-2 flex items-center justify-between text-[11px] font-medium uppercase tracking-[0.14em] text-slate-400">
              <span>Recebimentos do tratamento (6 linhas)</span>
              {advanceTratamentoCount > 0 && (
                <span className="rounded-md bg-amber-500/10 px-2 py-0.5 text-[10px] text-amber-300 ring-1 ring-inset ring-amber-500/25">
                  {advanceTratamentoCount} adiantado{advanceTratamentoCount === 1 ? "" : "s"} → financeiro
                </span>
              )}
            </p>
            <div className="space-y-2">
              {draft.treatmentReceipts.map((r, i) => (
                <ReceiptRow
                  key={i}
                  index={i}
                  receipt={r}
                  onChange={(nr) => updateReceipt("treatmentReceipts", i, nr)}
                />
              ))}
            </div>
          </div>
        </Section>
      )}

      {/* ═══════ OBSERVAÇÕES ═══════ */}
      <Section
        title="Observações"
        description="Notas livres, contexto extra."
        icon={<FileText className="h-4 w-4" />}
      >
        <textarea
          value={draft.observations}
          onChange={(e) => update("observations", e.target.value)}
          rows={4}
          placeholder="Notas, próximos passos…"
          className={cn(
            "w-full rounded-md border border-white/[0.08] bg-white/[0.02] px-3 py-2",
            "text-[13px] text-slate-100 placeholder:text-slate-600 resize-none",
            "focus:outline-none focus:border-white/[0.18] focus:bg-white/[0.03] transition",
          )}
        />
      </Section>

      {/* ─── Barra de ações ─── */}
      <div
        className={cn(
          "fixed inset-x-0 bottom-0 z-30 border-t border-white/[0.06]",
          "bg-[#0a0a0d]/95 backdrop-blur supports-[backdrop-filter]:bg-[#0a0a0d]/80",
        )}
      >
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-3 px-5 py-3">
          <span className="text-[11.5px] text-slate-500">
            {draft.leadType === "resgate" && (
              <span className="mr-2 inline-flex items-center gap-1 rounded-md bg-violet-500/10 px-2 py-0.5 font-medium text-violet-300 ring-1 ring-inset ring-violet-500/25">
                <UserCog className="h-3 w-3" /> Resgate
              </span>
            )}
            {draft.closedTreatment === "yes" && (
              <span className="inline-flex items-center gap-1 rounded-md bg-emerald-500/10 px-2 py-0.5 font-medium text-emerald-300 ring-1 ring-inset ring-emerald-500/25">
                <CheckCircle2 className="h-3 w-3" /> Tratamento fechado
              </span>
            )}
          </span>
          <div className="flex items-center gap-2">
            <Link to={`/leads/${id}`}>
              <Button type="button" variant="outline" size="sm">
                <X className="mr-1 h-3.5 w-3.5" />
                Cancelar
              </Button>
            </Link>
            <Button type="submit" size="sm" disabled={save.isPending} className="gap-2">
              <Save className="h-3.5 w-3.5" />
              {save.isPending ? "Salvando…" : "Salvar"}
            </Button>
          </div>
        </div>
      </div>
    </form>
  );
}
