import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import {
  Ban, CalendarCheck, CalendarX, ChevronRight, Clock3, FileText, FileUp,
  MessageSquare, Phone, Plus, Search, Upload, UserPlus, X,
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

  const [origem, setOrigem] = useState<Origem>("all");
  const [status, setStatus] = useState<StatusFilter>("all");
  const [etapa, setEtapa] = useState<string>("");
  const [tag, setTag] = useState<string>("");
  const [onlyBlocked, setOnlyBlocked] = useState(false);
  const [searchInput, setSearchInput] = useState("");
  const [page, setPage] = useState(1);

  const [createOpen, setCreateOpen] = useState(false);

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
              onClick={() => setCreateOpen(true)}
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
            className="accent-brand-500"
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
                  pending={actionMutation.isPending && actionMutation.variables?.id === c.id}
                />
              ))}
            </ul>
          )}
        </CardBody>
      </Card>

      {totalPages > 1 && (
        <Pagination page={page} totalPages={totalPages} onChange={setPage} />
      )}

      {createOpen && (
        <CreateContactModal
          tenantId={tenantId!}
          onClose={() => setCreateOpen(false)}
          onCreated={() => {
            setCreateOpen(false);
            queryClient.invalidateQueries({ queryKey: ["contacts"] });
          }}
        />
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
    default: "ring-brand-500/40 bg-brand-500/15 text-brand-100",
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
  pending,
}: {
  contact: Contact;
  onAction: (action: AttendanceStatus) => void;
  pending: boolean;
}) {
  const isImported = contact.origem === "import_csv";
  const isManual = contact.origem === "manual";
  const status = contact.attendance_status ?? null;

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
 *  MODAL: Novo contato
 * ═══════════════════════════════════════════════════════════════ */

function CreateContactModal({
  tenantId,
  onClose,
  onCreated,
}: {
  tenantId: number;
  onClose: () => void;
  onCreated: () => void;
}) {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [etapa, setEtapa] = useState("");
  const [tagsInput, setTagsInput] = useState("");
  const [observacoes, setObservacoes] = useState("");
  const [attendanceStatus, setAttendanceStatus] = useState<AttendanceStatus | "">("");

  const createMutation = useMutation({
    mutationFn: () =>
      contactsService.create({
        clinicId: tenantId,
        name: name.trim(),
        phone: phone.trim(),
        etapa: etapa.trim() || undefined,
        tags: tagsInput
          .split(",")
          .map((t) => t.trim())
          .filter(Boolean),
        observacoes: observacoes.trim() || undefined,
        attendanceStatus: attendanceStatus || undefined,
      }),
    onSuccess: () => {
      toast.success("Contato criado com sucesso");
      onCreated();
    },
    onError: (err: unknown) => {
      const e = err as { response?: { data?: { error?: string } }; message?: string };
      toast.error(e?.response?.data?.error ?? e?.message ?? "Falha ao criar contato");
    },
  });

  const canSubmit = name.trim().length > 0 && phone.trim().length > 0 && !createMutation.isPending;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-4"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md rounded-2xl border border-white/10 bg-slate-950 p-5 shadow-2xl"
      >
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-base font-semibold text-slate-100">Novo contato</h3>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-500 hover:text-slate-200"
            aria-label="Fechar"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-3">
          <Field label="Nome *">
            <Input
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Nome completo"
            />
          </Field>
          <Field label="Telefone *">
            <Input
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="+55 11 91234-5678"
            />
          </Field>
          <Field label="Etapa">
            <Input
              value={etapa}
              onChange={(e) => setEtapa(e.target.value)}
              placeholder="Ex: 01_ENTRADA_LEAD_SEQUENCIA_24H"
            />
          </Field>
          <Field label="Tags (separadas por vírgula)">
            <Input
              value={tagsInput}
              onChange={(e) => setTagsInput(e.target.value)}
              placeholder="vip, indicacao"
            />
          </Field>
          <Field label="Status de comparecimento">
            <div className="flex gap-2">
              <StatusToggle
                label="Nenhum"
                active={attendanceStatus === ""}
                onClick={() => setAttendanceStatus("")}
              />
              <StatusToggle
                label="Aguardando"
                color="amber"
                active={attendanceStatus === "aguardando"}
                onClick={() => setAttendanceStatus("aguardando")}
              />
              <StatusToggle
                label="Compareceu"
                color="emerald"
                active={attendanceStatus === "compareceu"}
                onClick={() => setAttendanceStatus("compareceu")}
              />
              <StatusToggle
                label="Faltou"
                color="rose"
                active={attendanceStatus === "faltou"}
                onClick={() => setAttendanceStatus("faltou")}
              />
            </div>
          </Field>
          <Field label="Observações">
            <textarea
              value={observacoes}
              onChange={(e) => setObservacoes(e.target.value)}
              rows={3}
              className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:border-brand-500/60 focus:outline-none focus:ring-2 focus:ring-brand-500/60"
              placeholder="Contexto adicional sobre o contato"
            />
          </Field>
        </div>

        <div className="mt-5 flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>
            Cancelar
          </Button>
          <Button
            loading={createMutation.isPending}
            disabled={!canSubmit}
            onClick={() => createMutation.mutate()}
          >
            <Plus className="mr-2 h-4 w-4" />
            Criar contato
          </Button>
        </div>
      </div>
    </div>
  );
}

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
}: {
  label: string;
  active: boolean;
  color?: "emerald" | "rose" | "amber";
  onClick: () => void;
}) {
  const palette = {
    emerald: "bg-emerald-500/15 text-emerald-200 ring-emerald-500/40",
    rose: "bg-rose-500/15 text-rose-200 ring-rose-500/40",
    amber: "bg-amber-500/15 text-amber-200 ring-amber-500/40",
    default: "bg-brand-500/15 text-brand-100 ring-brand-500/40",
  }[color ?? "default"];

  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex-1 rounded-md px-2 py-1.5 text-xs ring-1 transition",
        active ? palette : "bg-white/[0.02] text-slate-400 ring-white/10 hover:bg-white/[0.05]"
      )}
    >
      {label}
    </button>
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
