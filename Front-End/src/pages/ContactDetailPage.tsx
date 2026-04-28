import { useMemo } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft, Ban, FileText, MessageSquare, Pencil, Phone, Trash2, User, Webhook,
} from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { Table, TBody, Td, Th, THead, Tr } from "@/components/ui/Table";
import { contactsService } from "@/services/contacts";
import { useClinic } from "@/hooks/useClinic";
import { cn } from "@/lib/utils";
import type { ContactDetail } from "@/types";

const KNOWN_KEYS = new Set([
  "id", "name", "phone_normalized", "phone_raw",
  "origem", "etapa", "tags", "blocked",
  "email", "notes",
  "last_message_at", "imported_at", "created_at", "updated_at",
  "source_file", "batch_id",
  "custom_fields", "raw",
]);

export default function ContactDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { tenantId } = useClinic();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ["contact", id, tenantId],
    queryFn: () => contactsService.getById(id!, tenantId ?? undefined),
    enabled: !!id,
  });

  const contact = query.data;

  const spreadsheetRows = useMemo(() => {
    if (!contact) return [];
    return extractSpreadsheetFields(contact);
  }, [contact]);

  const source = (contact as { source?: string } | undefined)?.source;
  const canEditDelete = !!contact && source !== "lead" && String(contact.id).startsWith("c_");

  const deleteMutation = useMutation({
    mutationFn: () => contactsService.remove(id!, tenantId ?? undefined),
    onSuccess: () => {
      toast.success("Contato removido");
      queryClient.invalidateQueries({ queryKey: ["contacts"] });
      navigate("/contacts");
    },
    onError: (err: unknown) => {
      const e = err as { response?: { data?: { error?: string } }; message?: string };
      toast.error(e?.response?.data?.error ?? e?.message ?? "Falha ao remover contato");
    },
  });

  const handleDelete = () => {
    if (!contact) return;
    if (!window.confirm(`Remover "${contact.name}" permanentemente?`)) return;
    deleteMutation.mutate();
  };

  return (
    <>
      <PageHeader
        title={contact?.name ?? "Contato"}
        description={
          contact
            ? originLabel(contact.origem) +
              (contact.imported_at ? ` · importado em ${formatDateLong(contact.imported_at)}` : "")
            : "Detalhes do contato"
        }
        actions={
          <div className="flex gap-2">
            <Link to="/contacts">
              <Button variant="outline" size="sm">
                <ArrowLeft className="mr-2 h-4 w-4" />
                Voltar
              </Button>
            </Link>
            {canEditDelete && (
              <>
                <Link to={`/contacts/${encodeURIComponent(String(contact!.id))}/edit`}>
                  <Button variant="outline" size="sm">
                    <Pencil className="mr-2 h-4 w-4" />
                    Editar
                  </Button>
                </Link>
                <Button
                  variant="danger"
                  size="sm"
                  onClick={handleDelete}
                  loading={deleteMutation.isPending}
                >
                  <Trash2 className="mr-2 h-4 w-4" />
                  Excluir
                </Button>
              </>
            )}
          </div>
        }
      />

      {query.isLoading ? (
        <div className="space-y-4">
          <div className="skeleton h-32 w-full rounded-2xl" />
          <div className="skeleton h-64 w-full rounded-2xl" />
        </div>
      ) : query.isError || !contact ? (
        <EmptyState
          title="Contato não encontrado"
          description="Pode ter sido removido ou o id não existe para essa clínica."
        />
      ) : (
        <div className="space-y-4">
          <IdentityCard contact={contact} />
          <SpreadsheetCard rows={spreadsheetRows} origem={contact.origem} />
        </div>
      )}
    </>
  );
}

/* ═══════════════════════════════════════════════════════════════
 *  Cards
 * ═══════════════════════════════════════════════════════════════ */

function IdentityCard({ contact }: { contact: ContactDetail }) {
  return (
    <Card>
      <CardBody>
        <div className="flex flex-wrap items-start gap-6">
          <Avatar name={contact.name} />
          <div className="min-w-0 flex-1 space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-lg font-semibold text-slate-100">{contact.name}</h3>
              <OrigemBadge origem={contact.origem} />
              {contact.blocked && <BlockedBadge />}
            </div>

            <div className="grid grid-cols-1 gap-3 text-sm md:grid-cols-2">
              <Field icon={<Phone className="h-3.5 w-3.5" />} label="Telefone">
                {formatPhone(contact.phone_normalized)}
              </Field>
              {contact.email && (
                <Field icon={<User className="h-3.5 w-3.5" />} label="E-mail">
                  {contact.email}
                </Field>
              )}
              {contact.etapa && (
                <Field label="Etapa">{humanizeEtapa(contact.etapa)}</Field>
              )}
              {contact.last_message_at && (
                <Field
                  icon={<MessageSquare className="h-3.5 w-3.5" />}
                  label="Última mensagem"
                >
                  {formatDateLong(contact.last_message_at)}
                </Field>
              )}
              {contact.created_at && (
                <Field label="Criado em">{formatDateLong(contact.created_at)}</Field>
              )}
              {contact.source_file && (
                <Field icon={<FileText className="h-3.5 w-3.5" />} label="Arquivo">
                  {contact.source_file}
                </Field>
              )}
            </div>

            {contact.tags && contact.tags.length > 0 && (
              <div className="flex flex-wrap gap-1.5 pt-1">
                {contact.tags.map((t) => (
                  <span
                    key={t}
                    className="rounded bg-slate-800/60 px-2 py-0.5 text-[11px] text-slate-300 ring-1 ring-slate-700/60"
                  >
                    {t}
                  </span>
                ))}
              </div>
            )}

            {contact.notes && (
              <div className="rounded-lg border border-slate-800/60 bg-slate-900/40 px-3 py-2 text-[13px] text-slate-300">
                {contact.notes}
              </div>
            )}
          </div>
        </div>
      </CardBody>
    </Card>
  );
}

function SpreadsheetCard({
  rows,
  origem,
}: {
  rows: Array<{ key: string; value: string }>;
  origem: ContactDetail["origem"];
}) {
  return (
    <Card>
      <CardHeader
        title="Dados da planilha"
        subtitle={
          origem === "import_csv"
            ? "Tudo que veio no CSV importado, incluindo colunas extras."
            : "Campos adicionais armazenados para esse contato."
        }
      />
      <CardBody className="p-0">
        {rows.length === 0 ? (
          <div className="px-5 py-8">
            <EmptyState
              title="Nenhum campo extra"
              description={
                origem === "import_csv"
                  ? "O backend ainda não está expondo as colunas originais do CSV em /contacts/:id. Assim que expuser (em custom_fields, raw ou colunas soltas), elas aparecem aqui automaticamente."
                  : "Esse contato não tem campos extras cadastrados."
              }
            />
          </div>
        ) : (
          <Table>
            <THead>
              <Tr>
                <Th>Campo</Th>
                <Th>Valor</Th>
              </Tr>
            </THead>
            <TBody>
              {rows.map((r) => (
                <Tr key={r.key}>
                  <Td className="whitespace-nowrap font-medium text-slate-300">
                    {humanizeKey(r.key)}
                  </Td>
                  <Td className="text-slate-200">{r.value}</Td>
                </Tr>
              ))}
            </TBody>
          </Table>
        )}
      </CardBody>
    </Card>
  );
}

/* ═══════════════════════════════════════════════════════════════
 *  Bits
 * ═══════════════════════════════════════════════════════════════ */

function Field({
  label,
  icon,
  children,
}: {
  label: string;
  icon?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="flex items-center gap-1 text-[11px] uppercase tracking-wide text-slate-500">
        {icon}
        {label}
      </div>
      <div className="mt-0.5 text-slate-100">{children}</div>
    </div>
  );
}

function Avatar({ name }: { name: string }) {
  const initials = (name || "?")
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("");
  return (
    <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-md bg-white/[0.04] ring-1 ring-inset ring-white/[0.08] text-[16px] font-semibold text-slate-100">
      {initials || "?"}
    </div>
  );
}

function OrigemBadge({ origem }: { origem: ContactDetail["origem"] }) {
  if (origem === "import_csv") {
    return (
      <span
        className={cn(
          "inline-flex items-center gap-1 rounded px-2 py-0.5",
          "bg-amber-500/10 text-[11px] font-medium text-amber-300",
          "ring-1 ring-amber-500/20"
        )}
      >
        <FileText className="h-3 w-3" />
        Importado (CSV)
      </span>
    );
  }
  if (origem === "webhook_cloudia") {
    return (
      <span className="inline-flex items-center gap-1 rounded bg-violet-500/10 px-2 py-0.5 text-[11px] font-medium text-violet-300 ring-1 ring-violet-500/20">
        <Webhook className="h-3 w-3" />
        Webhook Cloudia
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 rounded bg-slate-500/10 px-2 py-0.5 text-[11px] font-medium text-slate-300 ring-1 ring-slate-500/20">
      Manual
    </span>
  );
}

function BlockedBadge() {
  return (
    <span className="inline-flex items-center gap-1 rounded bg-rose-500/10 px-2 py-0.5 text-[11px] font-medium text-rose-300 ring-1 ring-rose-500/20">
      <Ban className="h-3 w-3" />
      Bloqueado
    </span>
  );
}

/* ═══════════════════════════════════════════════════════════════
 *  Helpers
 * ═══════════════════════════════════════════════════════════════ */

function extractSpreadsheetFields(
  contact: ContactDetail
): Array<{ key: string; value: string }> {
  const out = new Map<string, string>();

  // custom_fields / raw têm prioridade — são onde o backend costuma guardar o CSV original
  const bags: Array<Record<string, unknown> | null | undefined> = [
    contact.custom_fields ?? null,
    contact.raw ?? null,
  ];
  for (const bag of bags) {
    if (!bag || typeof bag !== "object") continue;
    for (const [k, v] of Object.entries(bag)) {
      const str = toDisplay(v);
      if (str) out.set(k, str);
    }
  }

  // Qualquer chave não-conhecida na raiz também é considerada "da planilha"
  for (const [k, v] of Object.entries(contact)) {
    if (KNOWN_KEYS.has(k)) continue;
    const str = toDisplay(v);
    if (str) out.set(k, str);
  }

  return Array.from(out, ([key, value]) => ({ key, value }));
}

function toDisplay(v: unknown): string {
  if (v === null || v === undefined) return "";
  if (typeof v === "string") return v.trim();
  if (typeof v === "number" || typeof v === "boolean") return String(v);
  if (Array.isArray(v)) return v.map(toDisplay).filter(Boolean).join(", ");
  if (typeof v === "object") {
    try {
      return JSON.stringify(v);
    } catch {
      return "";
    }
  }
  return "";
}

function humanizeKey(k: string): string {
  return k
    .replace(/[_\-]+/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase())
    .trim();
}

function originLabel(origem: ContactDetail["origem"]): string {
  if (origem === "import_csv") return "Contato importado via CSV";
  if (origem === "webhook_cloudia") return "Contato vindo do webhook da Cloudia";
  return "Contato cadastrado manualmente";
}

function formatPhone(phone: string): string {
  const digits = (phone ?? "").replace(/\D/g, "");
  if (digits.length === 13 && digits.startsWith("55")) {
    return `+55 (${digits.slice(2, 4)}) ${digits.slice(4, 9)}-${digits.slice(9)}`;
  }
  if (digits.length === 12 && digits.startsWith("55")) {
    return `+55 (${digits.slice(2, 4)}) ${digits.slice(4, 8)}-${digits.slice(8)}`;
  }
  return phone || "—";
}

function humanizeEtapa(etapa: string): string {
  const map: Record<string, string> = {
    "01_ENTRADA_LEAD_SEQUENCIA_24H": "Entrada · 24h",
    "04_AGENDADO_SEM_PAGAMENTO": "Agendado · sem pagamento",
    "05_AGENDADO_COM_PAGAMENTO": "Agendado · pago",
    "07_FALTOU": "Faltou na consulta",
    "08_NAO_FECHOU_TRATAMENTO": "Não fechou (recuperação)",
    "09_FECHOU_TRATAMENTO": "Fechou tratamento",
    "10_EM_TRATAMENTO": "Em tratamento",
    "13_ALTA_SATISFEITO": "Alta · satisfeito",
    "15_NAO_PERTURBAR": "Não perturbar",
  };
  return (
    map[etapa] ?? etapa.replace(/^\d+_/, "").replace(/_/g, " ").toLowerCase()
  );
}

function formatDateLong(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString("pt-BR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}
