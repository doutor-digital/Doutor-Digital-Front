import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  ArrowLeft,
  Building2,
  Check,
  FileText,
  Hash,
  Mail,
  Phone,
  Save,
  Tag,
  Target,
  User2,
  UserCog,
  X,
} from "lucide-react";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Button } from "@/components/ui/Button";
import { webhooksService } from "@/services/webhooks";
import { assignmentsService } from "@/services/assignments";
import { unitsService } from "@/services/units";
import { cn } from "@/lib/utils";
import type { LeadDetail } from "@/types";

const STAGE_OPTIONS = [
  { value: "01_NOVO_LEAD", label: "01 — Novo lead" },
  { value: "02_EM_ATENDIMENTO", label: "02 — Em atendimento" },
  { value: "03_AGENDADO_SEM_PAGAMENTO", label: "03 — Agendado (sem pagamento)" },
  { value: "04_AGENDADO_COM_PAGAMENTO", label: "04 — Agendado (com pagamento)" },
  { value: "05_COMPARECEU", label: "05 — Compareceu" },
  { value: "07_FALTOU", label: "07 — Faltou" },
  { value: "08_NAO_FECHOU_TRATAMENTO", label: "08 — Não fechou tratamento" },
  { value: "09_FECHOU_TRATAMENTO", label: "09 — Fechou tratamento" },
  { value: "10_EM_TRATAMENTO", label: "10 — Em tratamento" },
];

interface DraftState {
  name: string;
  phone: string;
  email: string;
  cpf: string;
  gender: string;
  source: string;
  channel: string;
  campaign: string;
  ad: string;
  currentStage: string;
  observations: string;
  tags: string[];
  unitId: string;
  attendantId: string;
  hasAppointment: boolean;
  hasPayment: boolean;
  hasHealthInsurancePlan: boolean;
}

function leadToDraft(l: LeadDetail): DraftState {
  return {
    name: l.name ?? "",
    phone: l.phone ?? "",
    email: l.email ?? "",
    cpf: l.cpf ?? "",
    gender: l.gender ?? "",
    source: l.source ?? "",
    channel: l.channel ?? "",
    campaign: l.campaign ?? "",
    ad: l.ad ?? "",
    currentStage: l.currentStage ?? "",
    observations: l.observations ?? "",
    tags: Array.isArray(l.tags) ? [...l.tags] : [],
    unitId: l.unitId != null ? String(l.unitId) : "",
    attendantId: l.attendantId != null ? String(l.attendantId) : "",
    hasAppointment: !!l.hasAppointment,
    hasPayment: !!l.hasPayment,
    hasHealthInsurancePlan: !!l.hasHealthInsurancePlan,
  };
}

function diffDraft(
  original: DraftState,
  draft: DraftState,
): Record<string, unknown> {
  const patch: Record<string, unknown> = {};
  if (draft.name !== original.name) patch.name = draft.name.trim();
  if (draft.phone !== original.phone) patch.phone = draft.phone.trim() || null;
  if (draft.email !== original.email) patch.email = draft.email.trim() || null;
  if (draft.cpf !== original.cpf) patch.cpf = draft.cpf.trim() || null;
  if (draft.gender !== original.gender) patch.gender = draft.gender || null;
  if (draft.source !== original.source) patch.source = draft.source.trim();
  if (draft.channel !== original.channel) patch.channel = draft.channel.trim();
  if (draft.campaign !== original.campaign) patch.campaign = draft.campaign.trim();
  if (draft.ad !== original.ad) patch.ad = draft.ad.trim() || null;
  if (draft.currentStage !== original.currentStage)
    patch.currentStage = draft.currentStage;
  if (draft.observations !== original.observations)
    patch.observations = draft.observations.trim() || null;
  if (
    draft.tags.length !== original.tags.length ||
    draft.tags.some((t, i) => t !== original.tags[i])
  ) {
    patch.tags = draft.tags;
  }
  if (draft.unitId !== original.unitId)
    patch.unitId = draft.unitId ? Number(draft.unitId) : null;
  if (draft.attendantId !== original.attendantId)
    patch.attendantId = draft.attendantId ? Number(draft.attendantId) : null;
  if (draft.hasAppointment !== original.hasAppointment)
    patch.hasAppointment = draft.hasAppointment;
  if (draft.hasPayment !== original.hasPayment)
    patch.hasPayment = draft.hasPayment;
  if (draft.hasHealthInsurancePlan !== original.hasHealthInsurancePlan)
    patch.hasHealthInsurancePlan = draft.hasHealthInsurancePlan;
  return patch;
}

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
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-[11px] font-medium uppercase tracking-[0.14em] text-slate-400">
        {label}
      </span>
      {children}
      {hint && <span className="mt-1 block text-[11px] text-slate-500">{hint}</span>}
    </label>
  );
}

function CheckboxField({
  checked,
  onChange,
  label,
  description,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
  description?: string;
}) {
  return (
    <label className="flex items-start gap-3 cursor-pointer group">
      <span
        className={cn(
          "mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-md border transition",
          checked
            ? "border-emerald-500/60 bg-emerald-500/20 text-emerald-300"
            : "border-white/[0.1] bg-white/[0.02] group-hover:border-white/[0.18]",
        )}
      >
        {checked && <Check className="h-3 w-3" />}
      </span>
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="sr-only"
      />
      <span className="min-w-0">
        <span className="block text-[13px] font-medium text-slate-200">{label}</span>
        {description && (
          <span className="mt-0.5 block text-[11.5px] text-slate-500">{description}</span>
        )}
      </span>
    </label>
  );
}

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
  const [tagInput, setTagInput] = useState("");

  // Carrega o lead no draft uma vez por id (e quando a query terminar).
  useEffect(() => {
    if (leadQ.data && draft === null) {
      setDraft(leadToDraft(leadQ.data));
    }
  }, [leadQ.data, draft]);

  const original = useMemo(
    () => (leadQ.data ? leadToDraft(leadQ.data) : null),
    [leadQ.data],
  );

  const dirtyPatch = useMemo(
    () => (original && draft ? diffDraft(original, draft) : {}),
    [original, draft],
  );
  const isDirty = Object.keys(dirtyPatch).length > 0;

  const save = useMutation({
    mutationFn: (patch: Record<string, unknown>) =>
      webhooksService.patchLead(id!, patch),
    onSuccess: () => {
      toast.success("Lead atualizado");
      qc.invalidateQueries({ queryKey: ["lead-detail", id] });
      navigate(`/leads/${id}`);
    },
    onError: (err: unknown) => {
      const msg =
        (err as { response?: { data?: { title?: string; error?: string } } })
          ?.response?.data?.title ??
        (err as { response?: { data?: { error?: string } } })?.response?.data
          ?.error ??
        "Não foi possível salvar";
      toast.error(msg);
    },
  });

  function update<K extends keyof DraftState>(key: K, value: DraftState[K]) {
    setDraft((prev) => (prev ? { ...prev, [key]: value } : prev));
  }

  function addTag() {
    const t = tagInput.trim();
    if (!t || !draft) return;
    if (draft.tags.includes(t)) {
      setTagInput("");
      return;
    }
    update("tags", [...draft.tags, t]);
    setTagInput("");
  }

  function removeTag(t: string) {
    if (!draft) return;
    update(
      "tags",
      draft.tags.filter((x) => x !== t),
    );
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!isDirty) {
      toast.info("Nada para salvar");
      return;
    }
    save.mutate(dirtyPatch);
  }

  function handleCancel() {
    if (isDirty && !confirm("Descartar alterações?")) return;
    navigate(`/leads/${id}`);
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
        <p className="mt-1 text-[12px] text-slate-400">
          Verifique o link ou volte para a lista.
        </p>
        <Link
          to="/leads"
          className="mt-4 inline-flex items-center gap-1.5 text-[12px] font-medium text-sky-400 hover:text-sky-300"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> Voltar para leads
        </Link>
      </div>
    );
  }

  const l = leadQ.data;

  return (
    <form onSubmit={handleSubmit} className="mx-auto max-w-3xl space-y-5 pb-24">
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
        <div className="flex items-center gap-2">
          {isDirty && (
            <span className="rounded-md bg-amber-500/10 px-2.5 py-1 text-[11px] font-medium text-amber-300 ring-1 ring-inset ring-amber-500/30">
              {Object.keys(dirtyPatch).length} alteração
              {Object.keys(dirtyPatch).length === 1 ? "" : "es"} pendente
              {Object.keys(dirtyPatch).length === 1 ? "" : "s"}
            </span>
          )}
        </div>
      </div>

      <Section
        title="Identificação"
        description="Dados básicos de contato do lead."
        icon={<User2 className="h-4 w-4" />}
      >
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Nome">
            <Input
              icon={<User2 className="h-3.5 w-3.5" />}
              value={draft.name}
              onChange={(e) => update("name", e.target.value)}
              placeholder="Nome do lead"
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
              placeholder="email@exemplo.com"
            />
          </Field>
          <Field label="CPF">
            <Input
              icon={<Hash className="h-3.5 w-3.5" />}
              value={draft.cpf}
              onChange={(e) => update("cpf", e.target.value)}
              placeholder="000.000.000-00"
            />
          </Field>
          <Field label="Gênero">
            <Select
              value={draft.gender}
              onChange={(e) => update("gender", e.target.value)}
            >
              <option value="">Não informado</option>
              <option value="M">Masculino</option>
              <option value="F">Feminino</option>
              <option value="O">Outro</option>
            </Select>
          </Field>
        </div>
      </Section>

      <Section
        title="Atendimento"
        description="Unidade responsável e atendente atribuído."
        icon={<UserCog className="h-4 w-4" />}
      >
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
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
          <Field label="Atendente">
            <Select
              value={draft.attendantId}
              onChange={(e) => update("attendantId", e.target.value)}
            >
              <option value="">— Sem atendente —</option>
              {(attendantsQ.data ?? []).map((a) => (
                <option key={a.id} value={String(a.id)}>
                  {a.name || a.email || `Atendente ${a.id}`}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Etapa atual" hint="Move o lead para a etapa selecionada.">
            <Select
              value={draft.currentStage}
              onChange={(e) => update("currentStage", e.target.value)}
            >
              {STAGE_OPTIONS.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
              {/* Mostra a etapa atual mesmo que não esteja na lista padrão */}
              {!STAGE_OPTIONS.some((s) => s.value === draft.currentStage) &&
                draft.currentStage && (
                  <option value={draft.currentStage}>{draft.currentStage}</option>
                )}
            </Select>
          </Field>
        </div>

        <div className="grid grid-cols-1 gap-3 rounded-lg border border-white/[0.05] bg-white/[0.015] p-3 sm:grid-cols-3">
          <CheckboxField
            checked={draft.hasAppointment}
            onChange={(v) => update("hasAppointment", v)}
            label="Tem consulta agendada"
          />
          <CheckboxField
            checked={draft.hasPayment}
            onChange={(v) => update("hasPayment", v)}
            label="Pagamento confirmado"
          />
          <CheckboxField
            checked={draft.hasHealthInsurancePlan}
            onChange={(v) => update("hasHealthInsurancePlan", v)}
            label="Possui plano de saúde"
          />
        </div>
      </Section>

      <Section
        title="Origem e atribuição"
        description="De onde o lead chegou: origem, canal e campanha."
        icon={<Target className="h-4 w-4" />}
      >
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Origem (source)">
            <Input
              icon={<Target className="h-3.5 w-3.5" />}
              value={draft.source}
              onChange={(e) => update("source", e.target.value)}
              placeholder="META, GOOGLE, ORGANIC..."
            />
          </Field>
          <Field label="Canal">
            <Input
              icon={<Building2 className="h-3.5 w-3.5" />}
              value={draft.channel}
              onChange={(e) => update("channel", e.target.value)}
              placeholder="whatsapp, instagram..."
            />
          </Field>
          <Field label="Campanha">
            <Input
              value={draft.campaign}
              onChange={(e) => update("campaign", e.target.value)}
              placeholder="nome da campanha"
            />
          </Field>
          <Field label="Anúncio (ad)">
            <Input
              value={draft.ad}
              onChange={(e) => update("ad", e.target.value)}
              placeholder="identificador do criativo"
            />
          </Field>
        </div>
      </Section>

      <Section
        title="Tags e observações"
        description="Anotações livres e marcadores para segmentação."
        icon={<FileText className="h-4 w-4" />}
      >
        <Field label="Tags">
          <div className="flex flex-wrap items-center gap-1.5 rounded-md border border-white/[0.08] bg-white/[0.02] px-2 py-2">
            {draft.tags.length === 0 && (
              <span className="text-[11.5px] text-slate-600 italic px-1">
                Nenhuma tag
              </span>
            )}
            {draft.tags.map((t) => (
              <span
                key={t}
                className="inline-flex items-center gap-1 rounded-md bg-sky-500/10 px-2 py-0.5 text-[11.5px] font-medium text-sky-300 ring-1 ring-inset ring-sky-500/25"
              >
                <Tag className="h-3 w-3" />
                {t}
                <button
                  type="button"
                  onClick={() => removeTag(t)}
                  className="ml-0.5 text-sky-300/70 hover:text-sky-200"
                  aria-label={`Remover tag ${t}`}
                >
                  <X className="h-3 w-3" />
                </button>
              </span>
            ))}
            <input
              value={tagInput}
              onChange={(e) => setTagInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  addTag();
                }
                if (
                  e.key === "Backspace" &&
                  tagInput === "" &&
                  draft.tags.length > 0
                ) {
                  removeTag(draft.tags[draft.tags.length - 1]);
                }
              }}
              placeholder={draft.tags.length === 0 ? "Digite e Enter…" : "+ tag"}
              className="flex-1 min-w-[120px] bg-transparent text-[12.5px] text-slate-100 outline-none placeholder:text-slate-600"
            />
          </div>
        </Field>

        <Field label="Observações">
          <textarea
            value={draft.observations}
            onChange={(e) => update("observations", e.target.value)}
            rows={4}
            placeholder="Notas, contexto, próximo passo…"
            className={cn(
              "w-full rounded-md border border-white/[0.08] bg-white/[0.02] px-3 py-2",
              "text-[13px] text-slate-100 placeholder:text-slate-600 resize-none",
              "focus:outline-none focus:border-white/[0.18] focus:bg-white/[0.03] transition",
            )}
          />
        </Field>
      </Section>

      {/* ---- Barra de ações fixa no rodapé ---- */}
      <div
        className={cn(
          "fixed inset-x-0 bottom-0 z-30 border-t border-white/[0.06]",
          "bg-[#0a0a0d]/95 backdrop-blur supports-[backdrop-filter]:bg-[#0a0a0d]/80",
        )}
      >
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-3 px-5 py-3">
          <span className="text-[11.5px] text-slate-500">
            {isDirty
              ? `${Object.keys(dirtyPatch).length} campo${
                  Object.keys(dirtyPatch).length === 1 ? "" : "s"
                } alterado${Object.keys(dirtyPatch).length === 1 ? "" : "s"}`
              : "Sem alterações"}
          </span>
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleCancel}
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              size="sm"
              disabled={!isDirty || save.isPending}
              className="gap-2"
            >
              <Save className="h-3.5 w-3.5" />
              {save.isPending ? "Salvando…" : "Salvar alterações"}
            </Button>
          </div>
        </div>
      </div>
    </form>
  );
}
