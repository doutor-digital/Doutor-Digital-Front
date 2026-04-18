import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useRef, useState } from "react";
import {
  Ban, FileText, FileUp, MessageSquare, Phone, Search, Upload,
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
import type { Contact, ContactImportResult } from "@/types";

type Origem = "all" | "webhook_cloudia" | "import_csv";

const PAGE_SIZE = 50;

export default function ContactsPage() {
  const { tenantId } = useClinic();
  const queryClient = useQueryClient();

  const [origem, setOrigem] = useState<Origem>("all");
  const [searchInput, setSearchInput] = useState("");
  const [page, setPage] = useState(1);

  const debouncedSearch = useDebounce(searchInput, 300);

  const { data, isLoading, isFetching } = useQuery({
    queryKey: ["contacts", tenantId, origem, debouncedSearch, page],
    queryFn: () =>
      contactsService.list({
        clinicId: tenantId || undefined,
        origem,
        search: debouncedSearch,
        page,
        pageSize: PAGE_SIZE,
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

  const handleFilePick = () => fileInputRef.current?.click();
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) importMutation.mutate(file);
    e.target.value = "";
  };

  return (
    <>
      <PageHeader
        title="Contatos"
        description="Todos os leads da sua base — do webhook ou importados manualmente."
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
            setPage(1);
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
          ]}
        />
        <div className="relative w-full max-w-xs">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-500" />
          <Input
            placeholder="Buscar por nome ou telefone"
            value={searchInput}
            onChange={(e) => {
              setSearchInput(e.target.value);
              setPage(1);
            }}
            className="pl-8"
          />
        </div>
      </div>

      <Card>
        <CardBody className="p-0">
          {isLoading ? (
            <ContactListSkeleton />
          ) : contacts.length === 0 ? (
            <EmptyState
              title={
                debouncedSearch
                  ? "Nenhum contato encontrado"
                  : "Sem contatos ainda"
              }
              description={
                debouncedSearch
                  ? "Tente ajustar a busca ou mudar de aba."
                  : "Importe um CSV ou aguarde leads chegarem pelo webhook."
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
                <ContactRow key={c.id} contact={c} />
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

function ContactRow({ contact }: { contact: Contact }) {
  const isImported = contact.origem === "import_csv";

  return (
    <li className="flex items-center gap-4 px-5 py-3.5 transition-colors hover:bg-white/[0.02]">
      <Avatar name={contact.name} />

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="truncate text-sm font-medium text-slate-100">
            {contact.name}
          </span>
          {isImported && <OrigemBadge />}
          {contact.blocked && <BlockedBadge />}
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
    </li>
  );
}

function OrigemBadge() {
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center gap-1 rounded px-1.5 py-0.5",
        "bg-amber-500/10 text-[10px] font-medium text-amber-300",
        "ring-1 ring-amber-500/20"
      )}
      title="Contato importado via CSV (não veio pelo webhook da Cloudia)"
    >
      <FileText className="h-2.5 w-2.5" />
      Importado
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
