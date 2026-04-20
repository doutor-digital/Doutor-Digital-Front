import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Save, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { contactsService } from "@/services/contacts";
import { useClinic } from "@/hooks/useClinic";
import { cn } from "@/lib/utils";
import type { AttendanceStatus, ContactDetail } from "@/types";

export default function ContactFormPage() {
  const { id } = useParams<{ id?: string }>();
  const { tenantId } = useClinic();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const isEdit = Boolean(id);

  const detailQuery = useQuery({
    queryKey: ["contact", id, tenantId],
    queryFn: () => contactsService.getById(id!, tenantId ?? undefined),
    enabled: isEdit && !!tenantId,
  });

  // Contatos importados pelo webhook (l_*) não podem ser editados por este endpoint.
  const isLeadSource =
    isEdit && (id?.startsWith("l_") || detailQuery.data?.source === "lead");

  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [etapa, setEtapa] = useState("");
  const [tagsInput, setTagsInput] = useState("");
  const [conexao, setConexao] = useState("");
  const [observacoes, setObservacoes] = useState("");
  const [birthday, setBirthday] = useState("");
  const [consultationAt, setConsultationAt] = useState("");
  const [blocked, setBlocked] = useState(false);
  const [attendanceStatus, setAttendanceStatus] = useState<AttendanceStatus | "">("");

  useEffect(() => {
    if (!detailQuery.data) return;
    const c = detailQuery.data;
    setName(c.name ?? "");
    setPhone(c.phone_raw ?? c.phone_normalized ?? "");
    setEtapa(c.etapa ?? "");
    setTagsInput((c.tags ?? []).join(", "));
    setConexao((c as ContactDetail & { conexao?: string }).conexao ?? "");
    setObservacoes((c as ContactDetail & { observacoes?: string }).observacoes ?? c.notes ?? "");
    const bd = (c as ContactDetail & { birthday?: string | null }).birthday;
    setBirthday(toDateInput(bd));
    const ca = (c as ContactDetail & { consultation_at?: string | null }).consultation_at;
    setConsultationAt(toDateTimeInput(ca));
    setBlocked(!!c.blocked);
    const a = (c as ContactDetail & { attendance_status?: AttendanceStatus | null }).attendance_status;
    setAttendanceStatus(a ?? "");
  }, [detailQuery.data]);

  const createMutation = useMutation({
    mutationFn: () =>
      contactsService.create({
        clinicId: tenantId ?? undefined,
        name: name.trim(),
        phone: phone.trim(),
        etapa: etapa.trim() || undefined,
        tags: splitTags(tagsInput),
        conexao: conexao.trim() || undefined,
        observacoes: observacoes.trim() || undefined,
        birthday: birthday || undefined,
        consultationAt: consultationAt ? new Date(consultationAt).toISOString() : undefined,
        attendanceStatus: attendanceStatus || undefined,
      }),
    onSuccess: (data) => {
      toast.success("Contato criado com sucesso");
      queryClient.invalidateQueries({ queryKey: ["contacts"] });
      navigate(`/contacts/${encodeURIComponent(data.id)}`);
    },
    onError: (err: unknown) => toast.error(apiError(err, "Falha ao criar contato")),
  });

  const updateMutation = useMutation({
    mutationFn: () =>
      contactsService.update({
        clinicId: tenantId ?? undefined,
        id: id!,
        name: name.trim(),
        phone: phone.trim() || undefined,
        etapa: etapa.trim(),
        tags: splitTags(tagsInput),
        conexao: conexao.trim(),
        observacoes: observacoes.trim(),
        birthday: birthday || undefined,
        consultationAt: consultationAt ? new Date(consultationAt).toISOString() : undefined,
        blocked,
        attendanceStatus: attendanceStatus || "none",
      }),
    onSuccess: (data) => {
      toast.success("Contato atualizado");
      queryClient.invalidateQueries({ queryKey: ["contacts"] });
      queryClient.invalidateQueries({ queryKey: ["contact", data.id] });
      navigate(`/contacts/${encodeURIComponent(data.id)}`);
    },
    onError: (err: unknown) => toast.error(apiError(err, "Falha ao salvar contato")),
  });

  const deleteMutation = useMutation({
    mutationFn: () => contactsService.remove(id!, tenantId ?? undefined),
    onSuccess: () => {
      toast.success("Contato removido");
      queryClient.invalidateQueries({ queryKey: ["contacts"] });
      navigate("/contacts");
    },
    onError: (err: unknown) => toast.error(apiError(err, "Falha ao remover contato")),
  });

  const canSubmit =
    name.trim().length > 0 &&
    (isEdit || phone.trim().length > 0) &&
    !createMutation.isPending &&
    !updateMutation.isPending;

  const handleDelete = () => {
    if (!id) return;
    if (!window.confirm("Remover este contato permanentemente? Essa ação não pode ser desfeita."))
      return;
    deleteMutation.mutate();
  };

  const title = isEdit ? "Editar contato" : "Novo contato";
  const description = useMemo(() => {
    if (!isEdit) return "Cadastre manualmente um contato que ainda não veio pela integração.";
    if (isLeadSource) return "Este contato é um lead da Cloudia e é somente leitura por aqui.";
    return "Atualize os campos abaixo. Só o que for alterado é salvo.";
  }, [isEdit, isLeadSource]);

  return (
    <>
      <PageHeader
        title={title}
        description={description}
        actions={
          <Link to={isEdit ? `/contacts/${encodeURIComponent(id!)}` : "/contacts"}>
            <Button variant="outline" size="sm">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Voltar
            </Button>
          </Link>
        }
      />

      {detailQuery.isLoading ? (
        <div className="space-y-3">
          <div className="skeleton h-56 w-full rounded-2xl" />
          <div className="skeleton h-40 w-full rounded-2xl" />
        </div>
      ) : (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (isLeadSource) return;
            if (isEdit) updateMutation.mutate();
            else createMutation.mutate();
          }}
          className="space-y-4"
        >
          <Card>
            <CardHeader title="Identificação" subtitle="Nome e telefone são obrigatórios na criação." />
            <CardBody>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <Field label="Nome *">
                  <Input
                    autoFocus
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Nome completo"
                    disabled={isLeadSource}
                  />
                </Field>
                <Field label="Telefone *">
                  <Input
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="+55 11 91234-5678"
                    disabled={isLeadSource}
                  />
                </Field>
                <Field label="Data de nascimento">
                  <Input
                    type="date"
                    value={birthday}
                    onChange={(e) => setBirthday(e.target.value)}
                    disabled={isLeadSource}
                  />
                </Field>
                <Field label="Conexão">
                  <Input
                    value={conexao}
                    onChange={(e) => setConexao(e.target.value)}
                    placeholder="Ex: WhatsApp, Instagram"
                    disabled={isLeadSource}
                  />
                </Field>
              </div>
            </CardBody>
          </Card>

          <Card>
            <CardHeader title="Organização" subtitle="Como esse contato se encaixa no funil." />
            <CardBody>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <Field label="Etapa">
                  <Input
                    value={etapa}
                    onChange={(e) => setEtapa(e.target.value)}
                    placeholder="01_ENTRADA_LEAD_SEQUENCIA_24H"
                    disabled={isLeadSource}
                  />
                </Field>
                <Field label="Tags (separadas por vírgula)">
                  <Input
                    value={tagsInput}
                    onChange={(e) => setTagsInput(e.target.value)}
                    placeholder="vip, indicacao, retorno"
                    disabled={isLeadSource}
                  />
                </Field>
                <Field label="Consulta agendada">
                  <Input
                    type="datetime-local"
                    value={consultationAt}
                    onChange={(e) => setConsultationAt(e.target.value)}
                    disabled={isLeadSource}
                  />
                </Field>
                <Field label="Status de comparecimento">
                  <div className="flex flex-wrap gap-2">
                    <StatusToggle label="Nenhum" active={attendanceStatus === ""} onClick={() => setAttendanceStatus("")} disabled={isLeadSource} />
                    <StatusToggle label="Aguardando" color="amber" active={attendanceStatus === "aguardando"} onClick={() => setAttendanceStatus("aguardando")} disabled={isLeadSource} />
                    <StatusToggle label="Compareceu" color="emerald" active={attendanceStatus === "compareceu"} onClick={() => setAttendanceStatus("compareceu")} disabled={isLeadSource} />
                    <StatusToggle label="Faltou" color="rose" active={attendanceStatus === "faltou"} onClick={() => setAttendanceStatus("faltou")} disabled={isLeadSource} />
                  </div>
                </Field>
              </div>

              <div className="mt-4">
                <Field label="Observações">
                  <textarea
                    value={observacoes}
                    onChange={(e) => setObservacoes(e.target.value)}
                    rows={4}
                    disabled={isLeadSource}
                    className="w-full rounded-md border border-white/[0.08] bg-white/[0.02] px-3 py-2 text-[13px] text-slate-100 placeholder:text-slate-600 focus:border-white/[0.18] focus:bg-white/[0.03] focus:outline-none transition disabled:opacity-60"
                    placeholder="Contexto adicional sobre o contato"
                  />
                </Field>
              </div>

              {isEdit && (
                <div className="mt-4">
                  <label className="inline-flex cursor-pointer items-center gap-2 text-sm text-slate-300">
                    <input
                      type="checkbox"
                      checked={blocked}
                      onChange={(e) => setBlocked(e.target.checked)}
                      disabled={isLeadSource}
                      className="accent-rose-500"
                    />
                    Bloquear este contato (não receberá mensagens automáticas)
                  </label>
                </div>
              )}
            </CardBody>
          </Card>

          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              {isEdit && !isLeadSource && (
                <Button
                  type="button"
                  variant="danger"
                  onClick={handleDelete}
                  loading={deleteMutation.isPending}
                >
                  <Trash2 className="mr-2 h-4 w-4" />
                  Excluir contato
                </Button>
              )}
            </div>
            <div className="flex gap-2">
              <Link to={isEdit ? `/contacts/${encodeURIComponent(id!)}` : "/contacts"}>
                <Button variant="ghost" type="button">Cancelar</Button>
              </Link>
              <Button
                type="submit"
                disabled={!canSubmit || isLeadSource}
                loading={createMutation.isPending || updateMutation.isPending}
              >
                <Save className="mr-2 h-4 w-4" />
                {isEdit ? "Salvar alterações" : "Criar contato"}
              </Button>
            </div>
          </div>
        </form>
      )}
    </>
  );
}

/* ─── Bits ─────────────────────────────────────────────────────── */

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-[11px] font-medium uppercase tracking-wide text-slate-500">
        {label}
      </span>
      {children}
    </label>
  );
}

function StatusToggle({
  label,
  active,
  color,
  onClick,
  disabled,
}: {
  label: string;
  active: boolean;
  color?: "emerald" | "rose" | "amber";
  onClick: () => void;
  disabled?: boolean;
}) {
  const palette = {
    emerald: "bg-emerald-500/15 text-emerald-200 ring-emerald-500/40",
    rose: "bg-rose-500/15 text-rose-200 ring-rose-500/40",
    amber: "bg-amber-500/15 text-amber-200 ring-amber-500/40",
    default: "bg-sky-500/10 text-sky-200 ring-sky-500/20",
  }[color ?? "default"];

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "rounded-md px-3 py-1.5 text-xs ring-1 transition",
        "disabled:opacity-50 disabled:cursor-not-allowed",
        active ? palette : "bg-white/[0.02] text-slate-400 ring-white/10 hover:bg-white/[0.05]"
      )}
    >
      {label}
    </button>
  );
}

/* ─── Helpers ──────────────────────────────────────────────────── */

function splitTags(raw: string): string[] {
  return raw.split(",").map((t) => t.trim()).filter(Boolean);
}

function toDateInput(iso?: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toISOString().slice(0, 10);
}

function toDateTimeInput(iso?: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function apiError(err: unknown, fallback: string): string {
  const e = err as { response?: { data?: { error?: string } }; message?: string };
  return e?.response?.data?.error ?? e?.message ?? fallback;
}
