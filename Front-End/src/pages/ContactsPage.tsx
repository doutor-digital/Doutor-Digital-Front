import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  Ban, CalendarCheck, CalendarX, ChevronRight, Clock3, FileText, FileUp,
  MessageSquare, Pencil, Phone, Search, Trash2, Upload, UserPlus, X,
} from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card, CardBody } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { Tabs } from "@/components/ui/Tabs";
import { EmptyState } from "@/components/ui/EmptyState";
import { contactsService } from "@/services/contacts";
import { useClinic } from "@/hooks/useClinic";
import { useDebounce } from "@/hooks/useDebounce";
import { cn, formatNumber } from "@/lib/utils";
import type { AttendanceStatus, Contact, ContactImportResult } from "@/types";
import { toast } from "sonner";

type Origem = "all" | "webhook_cloudia" | "import_csv" | "manual";
type StatusFilter = "all" | AttendanceStatus | "none";

const PAGE_SIZE = 50;

const STATUS_META: Record<AttendanceStatus, {
  label: string;
  badgeClass: string;
  icon: React.ComponentType<{ className?: string }>;
}> = {
  compareceu: {
    label: "Compareceu",
    badgeClass: "bg-emerald-500/10 text-emerald-300 ring-emerald-500/20",
    icon: CalendarCheck,
  },
  faltou: {
    label: "Faltou",
    badgeClass: "bg-rose-500/10 text-rose-300 ring-rose-500/20",
    icon: CalendarX,
  },
  aguardando: {
    label: "Aguardando",
    badgeClass: "bg-amber-500/10 text-amber-300 ring-amber-500/20",
    icon: Clock3,
  },
};

export default function ContactsPage() {
  const { tenantId } = useClinic();
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  const [origem, setOrigem] = useState<Origem>("all");
  const [status, setStatus] = useState<StatusFilter>("all");
  const [etapa, setEtapa] = useState<string>("");
  const [tag, setTag] = useState<string>("");
  const [onlyBlocked, setOnlyBlocked] = useState(false);
  const [searchInput, setSearchInput] = useState("");
  const [page, setPage] = useState(1);

  const debouncedSearch = useDebounce(searchInput, 300);
  const debouncedEtapa = useDebounce(etapa, 300);
  const debouncedTag = useDebounce(tag, 300);

  const resetPage = () => setPage(1);

  const { data, isLoading, isFetching } = useQuery({
    queryKey: [
      "contacts", tenantId, origem, debouncedSearch, page,
      status, debouncedEtapa, debouncedTag, onlyBlocked,
    ],
    queryFn: () =>
      contactsService.list({
        clinicId: tenantId || undefined,
        origem,
        search: debouncedSearch,
        page,
        pageSize: PAGE_SIZE,
        status: status === "all" ? undefined : status,
        etapa: debouncedEtapa || undefined,
        tag: debouncedTag || undefined,
        blocked: onlyBlocked ? true : undefined,
      }),
    enabled: !!tenantId,
    placeholderData: (prev) => prev,
  });

  const contacts = data?.data ?? [];
  const counts = data?.counts ?? { all: 0, webhook_cloudia: 0, import_csv: 0 };
  const totalPages = data?.pagination?.total_pages ?? 1;

  const fileInputRef = useRef<HTMLInputElement>(null);

  const importMutation = useMutation({
    mutationFn: (file: File) =>
      contactsService.importCsv({
        clinicId: tenantId || undefined,
        file,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["contacts"] });
    },
  });

  const actionMutation = useMutation({
    mutationFn: (vars: { id: string; action: AttendanceStatus }) =>
      contactsService.setAction({
        clinicId: tenantId || undefined,
        id: vars.id,
        action: vars.action,
      }),
    onSuccess: (_data, vars) => {
      toast.success(`Ação registrada: ${STATUS_META[vars.action].label.toLowerCase()}`);
      queryClient.invalidateQueries({ queryKey: ["contacts"] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => contactsService.remove(id, tenantId ?? undefined),
    onSuccess: () => {
      toast.success("Contato removido");
      queryClient.invalidateQueries({ queryKey: ["contacts"] });
    },
    onError: (err: unknown) => {
      const e = err as { response?: { data?: { error?: string } }; message?: string };
      toast.error(e?.response?.data?.error ?? e?.message ?? "Falha ao remover contato");
    },
  });

  const handleDelete = (id: string, name: string) => {
    if (!window.confirm(`Remover "${name}" permanentemente?`)) return;
    deleteMutation.mutate(id);
  };

  const handleFilePick = () => fileInputRef.current?.click();
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) importMutation.mutate(file);
    e.target.value = "";
  };

  const activeFiltersCount =
    (status !== "all" ? 1 : 0) +
    (debouncedEtapa ? 1 : 0) +
    (debouncedTag ? 1 : 0) +
    (onlyBlocked ? 1 : 0);

  const clearAllFilters = () => {
    setStatus("all");
    setEtapa("");
    setTag("");
    setOnlyBlocked(false);
    resetPage();
  };

  return (
    <>
      <PageHeader
        title="Contatos"
        description="Todos os leads da sua base — do webhook, importados ou criados manualmente."
        actions={
          <>
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,text/csv"
              className="hidden"
              onChange={handleFileChange}
            />
            <Button
              variant="outline"
              onClick={() => navigate("/contacts/new")}
              disabled={!tenantId}
            >
              <UserPlus className="mr-2 h-4 w-4" />
              Novo contato
            </Button>
            <Button
              onClick={handleFilePick}
              disabled={importMutation.isPending || !tenantId}
            >
              <Upload className="mr-2 h-4 w-4" />
              {importMutation.isPending ? "Importando..." : "Importar CSV"}
            </Button>
          </>
        }
      />

      {importMutation.data && (
        <ImportResultCard
          result={importMutation.data}
          onDismiss={() => importMutation.reset()}
        />
      )}

      {importMutation.isError && (
        <div className="mb-4 rounded-xl border border-rose-500/30 bg-rose-500/10 px-5 py-3 text-sm text-rose-200">
          Falha ao importar o arquivo. Verifique o formato e tente novamente.
        </div>
      )}

      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <Tabs
          value={origem}
          onChange={(v) => {
            setOrigem(v as Origem);
            resetPage();
          }}
          tabs={[
            { value: "all", label: `Todos · ${formatNumber(counts.all)}` },
            {
              value: "webhook_cloudia",
              label: `Webhook · ${formatNumber(counts.webhook_cloudia)}`,
            },
            {
              value: "import_csv",
              label: `Importados · ${formatNumber(counts.import_csv)}`,
            },
            {
              value: "manual",
              label: `Manuais · ${formatNumber(counts.manual ?? 0)}`,
            },
          ]}
        />
        <div className="relative w-full max-w-xs">
          <Input
            placeholder="Buscar por nome ou telefone"
            value={searchInput}
            onChange={(e) => {
              setSearchInput(e.target.value);
              resetPage();
            }}
            icon={<Search className="h-3.5 w-3.5" />}
          />
        </div>
      </div>

      {/* ─── Chips de ação (compareceu/faltou/aguardando) ─── */}
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <StatusChip
          label="Todos"
          active={status === "all"}
          count={counts.all}
          onClick={() => { setStatus("all"); resetPage(); }}
        />
        <StatusChip
          label="Compareceu"
          active={status === "compareceu"}
          count={counts.compareceu}
          color="emerald"
          onClick={() => { setStatus("compareceu"); resetPage(); }}
        />
        <StatusChip
          label="Faltou"
          active={status === "faltou"}
          count={counts.faltou}
          color="rose"
          onClick={() => { setStatus("faltou"); resetPage(); }}
        />
        <StatusChip
          label="Aguardando"
          active={status === "aguardando"}
          count={counts.aguardando}
          color="amber"
          onClick={() => { setStatus("aguardando"); resetPage(); }}
        />
        <StatusChip
          label="Sem ação"
          active={status === "none"}
          onClick={() => { setStatus("none"); resetPage(); }}
        />
      </div>

      {/* ─── Filtros avançados (etapa, tag, bloqueado) ─── */}
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Input
          placeholder="Filtrar por etapa"
          value={etapa}
          onChange={(e) => { setEtapa(e.target.value); resetPage(); }}
          className="max-w-[200px]"
        />
        <Input
          placeholder="Filtrar por tag"
          value={tag}
          onChange={(e) => { setTag(e.target.value); resetPage(); }}
          className="max-w-[200px]"
        />
        <label className="flex cursor-pointer items-center gap-2 text-xs text-slate-300">
          <input
            type="checkbox"
            checked={onlyBlocked}
            onChange={(e) => { setOnlyBlocked(e.target.checked); resetPage(); }}
            className="accent-emerald-500"
          />
          Somente bloqueados
        </label>
        {activeFiltersCount > 0 && (
          <button
            type="button"
            onClick={clearAllFilters}
            className="inline-flex items-center gap-1 text-xs text-slate-400 hover:text-slate-200"
          >
            <X className="h-3 w-3" />
            Limpar filtros ({activeFiltersCount})
          </button>
        )}
      </div>

      <Card>
        <CardBody className="p-0">
          {isLoading ? (
            <ContactListSkeleton />
          ) : contacts.length === 0 ? (
            <EmptyState
              title={
                debouncedSearch || activeFiltersCount > 0
                  ? "Nenhum contato encontrado"
                  : "Sem contatos ainda"
              }
              description={
                debouncedSearch || activeFiltersCount > 0
                  ? "Tente ajustar a busca ou remover algum filtro."
                  : "Crie um manualmente, importe um CSV ou aguarde leads chegarem pelo webhook."
              }
            />
          ) : (
            <ul
              className={cn(
                "divide-y divide-slate-800/60",
                isFetching && "opacity-60 transition-opacity"
              )}
            >
              {contacts.map((c) => (
                <ContactRow
                  key={c.id}
                  contact={c}
                  onAction={(action) =>
                    actionMutation.mutate({ id: c.id, action })
                  }
                  onDelete={() => handleDelete(c.id, c.name)}
                  pending={actionMutation.isPending && actionMutation.variables?.id === c.id}
                  deleting={deleteMutation.isPending && deleteMutation.variables === c.id}
                />
              ))}
            </ul>
          )}
        </CardBody>
      </Card>

      {totalPages > 1 && (
        <Pagination page={page} totalPages={totalPages} onChange={setPage} />
      )}
    </>
  );
}

/* ═══════════════════════════════════════════════════════════════
 *  COMPONENTES
 * ═══════════════════════════════════════════════════════════════ */

function StatusChip({
  label,
  active,
  count,
  color,
  onClick,
}: {
  label: string;
  active: boolean;
  count?: number;
  color?: "emerald" | "rose" | "amber";
  onClick: () => void;
}) {
  const activeRing = {
    emerald: "ring-emerald-500/40 bg-emerald-500/15 text-emerald-200",
    rose: "ring-rose-500/40 bg-rose-500/15 text-rose-200",
    amber: "ring-amber-500/40 bg-amber-500/15 text-amber-200",
    default: "ring-sky-500/20 bg-sky-500/10 text-sky-200",
  }[color ?? "default"];

  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs ring-1 transition-colors",
        active
          ? activeRing
          : "bg-white/[0.02] text-slate-300 ring-white/10 hover:bg-white/[0.05]"
      )}
    >
      <span>{label}</span>
      {count !== undefined && (
        <span className="tabular-nums text-[10px] opacity-70">
          {formatNumber(count)}
        </span>
      )}
    </button>
  );
}

function ContactRow({
  contact,
  onAction,
  onDelete,
  pending,
  deleting,
}: {
  contact: Contact;
  onAction: (action: AttendanceStatus) => void;
  onDelete: () => void;
  pending: boolean;
  deleting: boolean;
}) {
  const isImported = contact.origem === "import_csv";
  const isManual = contact.origem === "manual";
  const isLead = contact.origem === "webhook_cloudia";
  const status = contact.attendance_status ?? null;
  // Editar / Excluir só fazem sentido para contatos com prefixo c_ (manuais/importados).
  const canEditDelete = !isLead && contact.id.startsWith("c_");

  return (
    <li className="group flex items-center gap-4 px-5 py-3.5 transition-colors hover:bg-white/[0.04]">
      <Link
        to={`/contacts/${encodeURIComponent(String(contact.id))}`}
        className="flex min-w-0 flex-1 items-center gap-4"
      >
        <Avatar name={contact.name} />

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="truncate text-sm font-medium text-slate-100 group-hover:text-white">
              {contact.name}
            </span>
            {isImported && <OrigemBadge variant="imported" />}
            {isManual && <OrigemBadge variant="manual" />}
            {contact.blocked && <BlockedBadge />}
            {status && <AttendanceBadge status={status} />}
          </div>
          <div className="mt-0.5 flex items-center gap-3 text-[11px] text-slate-500">
            <span className="flex items-center gap-1 tabular-nums">
              <Phone className="h-3 w-3" />
              {formatPhone(contact.phone_normalized)}
            </span>
            {contact.etapa && (
              <span className="truncate">{humanizeEtapa(contact.etapa)}</span>
            )}
          </div>
        </div>

        {contact.last_message_at && (
          <div className="hidden shrink-0 text-right text-[11px] text-slate-500 md:block">
            <div className="flex items-center justify-end gap-1">
              <MessageSquare className="h-3 w-3" />
              última msg
            </div>
            <div className="mt-0.5 tabular-nums text-slate-400">
              {formatDateShort(contact.last_message_at)}
            </div>
          </div>
        )}
      </Link>

      {/* Ações de comparecimento */}
      <div className="flex shrink-0 items-center gap-1">
        <ActionButton
          label="Compareceu"
          icon={CalendarCheck}
          active={status === "compareceu"}
          color="emerald"
          disabled={pending}
          onClick={() => onAction("compareceu")}
        />
        <ActionButton
          label="Faltou"
          icon={CalendarX}
          active={status === "faltou"}
          color="rose"
          disabled={pending}
          onClick={() => onAction("faltou")}
        />
        <ActionButton
          label="Aguardando"
          icon={Clock3}
          active={status === "aguardando"}
          color="amber"
          disabled={pending}
          onClick={() => onAction("aguardando")}
        />
      </div>

      {canEditDelete && (
        <div className="flex shrink-0 items-center gap-1">
          <Link
            to={`/contacts/${encodeURIComponent(String(contact.id))}/edit`}
            title="Editar contato"
            className="inline-flex items-center justify-center rounded-md p-1.5 text-slate-500 ring-1 ring-white/5 transition hover:text-slate-200 hover:ring-white/15"
          >
            <Pencil className="h-3.5 w-3.5" />
          </Link>
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); e.preventDefault(); onDelete(); }}
            disabled={deleting}
            title="Excluir contato"
            className="inline-flex items-center justify-center rounded-md p-1.5 text-slate-500 ring-1 ring-white/5 transition hover:text-rose-300 hover:ring-rose-500/30 disabled:opacity-50"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      <Link
        to={`/contacts/${encodeURIComponent(String(contact.id))}`}
        className="shrink-0 text-slate-600 transition-colors hover:text-slate-300"
      >
        <ChevronRight className="h-4 w-4" />
      </Link>
    </li>
  );
}

function ActionButton({
  label,
  icon: Icon,
  active,
  color,
  disabled,
  onClick,
}: {
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  active: boolean;
  color: "emerald" | "rose" | "amber";
  disabled: boolean;
  onClick: () => void;
}) {
  const palette = {
    emerald: "text-emerald-300 ring-emerald-500/30 bg-emerald-500/10 hover:bg-emerald-500/15",
    rose: "text-rose-300 ring-rose-500/30 bg-rose-500/10 hover:bg-rose-500/15",
    amber: "text-amber-300 ring-amber-500/30 bg-amber-500/10 hover:bg-amber-500/15",
  }[color];

  return (
    <button
      type="button"
      title={label}
      disabled={disabled}
      onClick={(e) => { e.stopPropagation(); e.preventDefault(); onClick(); }}
      className={cn(
        "inline-flex items-center justify-center rounded-md p-1.5 ring-1 transition",
        "disabled:opacity-50 disabled:cursor-not-allowed",
        active
          ? palette + " ring-1"
          : "text-slate-500 ring-white/5 hover:text-slate-200 hover:ring-white/15"
      )}
    >
      <Icon className="h-3.5 w-3.5" />
    </button>
  );
}

function OrigemBadge({ variant }: { variant: "imported" | "manual" }) {
  const config =
    variant === "imported"
      ? {
          label: "Importado",
          title: "Contato importado via CSV",
          cls: "bg-amber-500/10 text-amber-300 ring-amber-500/20",
        }
      : {
          label: "Manual",
          title: "Contato criado manualmente",
          cls: "bg-sky-500/10 text-sky-300 ring-sky-500/20",
        };
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-medium ring-1",
        config.cls
      )}
      title={config.title}
    >
      <FileText className="h-2.5 w-2.5" />
      {config.label}
    </span>
  );
}

function BlockedBadge() {
  return (
    <span
      className="inline-flex shrink-0 items-center gap-1 rounded bg-rose-500/10 px-1.5 py-0.5 text-[10px] font-medium text-rose-300 ring-1 ring-rose-500/20"
      title="Contato bloqueado"
    >
      <Ban className="h-2.5 w-2.5" />
      Bloqueado
    </span>
  );
}

function AttendanceBadge({ status }: { status: AttendanceStatus }) {
  const meta = STATUS_META[status];
  const Icon = meta.icon;
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-medium ring-1",
        meta.badgeClass
      )}
      title={`Status: ${meta.label}`}
    >
      <Icon className="h-2.5 w-2.5" />
      {meta.label}
    </span>
  );
}

function Avatar({ name }: { name: string }) {
  const initials = useMemo(() => {
    const parts = (name || "?").trim().split(/\s+/);
    const first = parts[0]?.[0] ?? "?";
    const last = parts.length > 1 ? parts[parts.length - 1]?.[0] : "";
    return (first + (last ?? "")).toUpperCase();
  }, [name]);

  return (
    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-slate-800 text-[11px] font-semibold text-slate-300">
      {initials}
    </div>
  );
}

function ImportResultCard({
  result,
  onDismiss,
}: {
  result: ContactImportResult;
  onDismiss: () => void;
}) {
  return (
    <div className="mb-4 flex flex-wrap items-center gap-4 rounded-xl border border-emerald-500/20 bg-emerald-500/5 px-5 py-4">
      <FileUp className="h-5 w-5 shrink-0 text-emerald-400" />
      <div className="min-w-0 flex-1">
        <div className="text-sm font-medium text-slate-100">
          Importação concluída
        </div>
        <div className="mt-0.5 flex flex-wrap gap-x-4 gap-y-0.5 text-[11px] text-slate-400">
          <span>
            <span className="font-medium tabular-nums text-emerald-400">
              {formatNumber(result.created)}
            </span>{" "}
            criados
          </span>
          {result.updated > 0 && (
            <span>
              <span className="font-medium tabular-nums text-sky-300">
                {formatNumber(result.updated)}
              </span>{" "}
              atualizados
            </span>
          )}
          <span>
            <span className="font-medium tabular-nums text-slate-300">
              {formatNumber(result.skipped)}
            </span>{" "}
            já existiam
          </span>
          {result.errors > 0 && (
            <span>
              <span className="font-medium tabular-nums text-rose-400">
                {formatNumber(result.errors)}
              </span>{" "}
              com erro
            </span>
          )}
          <span>
            total de{" "}
            <span className="font-medium tabular-nums text-slate-300">
              {formatNumber(result.total_rows)}
            </span>{" "}
            linhas
          </span>
        </div>
      </div>
      <Button variant="ghost" size="sm" onClick={onDismiss}>
        Fechar
      </Button>
    </div>
  );
}

function Pagination({
  page,
  totalPages,
  onChange,
}: {
  page: number;
  totalPages: number;
  onChange: (p: number) => void;
}) {
  return (
    <div className="mt-4 flex items-center justify-between text-xs text-slate-400">
      <span>
        Página{" "}
        <span className="font-medium tabular-nums text-slate-200">{page}</span>{" "}
        de{" "}
        <span className="font-medium tabular-nums text-slate-200">
          {totalPages}
        </span>
      </span>
      <div className="flex gap-2">
        <Button
          variant="outline"
          size="sm"
          disabled={page <= 1}
          onClick={() => onChange(page - 1)}
        >
          Anterior
        </Button>
        <Button
          variant="outline"
          size="sm"
          disabled={page >= totalPages}
          onClick={() => onChange(page + 1)}
        >
          Próxima
        </Button>
      </div>
    </div>
  );
}

function ContactListSkeleton() {
  return (
    <ul className="divide-y divide-slate-800/60">
      {Array.from({ length: 8 }).map((_, i) => (
        <li key={i} className="flex items-center gap-4 px-5 py-3.5">
          <div className="skeleton h-9 w-9 rounded-full" />
          <div className="flex-1 space-y-2">
            <div className="skeleton h-3 w-48 rounded" />
            <div className="skeleton h-2.5 w-32 rounded" />
          </div>
        </li>
      ))}
    </ul>
  );
}

/* ═══════════════════════════════════════════════════════════════
 *  HELPERS
 * ═══════════════════════════════════════════════════════════════ */

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
    "09_FECHOU_TRATAMENTO": "Fechou tratamento",
    "10_EM_TRATAMENTO": "Em tratamento",
    "13_ALTA_SATISFEITO": "Alta · satisfeito",
    "15_NAO_PERTURBAR": "Não perturbar",
  };
  return (
    map[etapa] ??
    etapa.replace(/^\d+_/, "").replace(/_/g, " ").toLowerCase()
  );
}

function formatDateShort(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "short",
    year: "2-digit",
  });
}
