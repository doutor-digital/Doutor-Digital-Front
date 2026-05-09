import { useMemo, useState } from "react";
import {
  CheckCircle2,
  Eye,
  Filter,
  Search,
  Sparkles,
  XCircle,
} from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import {
  CloudiaCell,
  CloudiaColumnHeader,
  CloudiaLegendBanner,
} from "@/components/sdr/CloudiaField";
import { LeadReviewSheet } from "@/components/sdr/LeadReviewSheet";
import { useSdrStore, useIsClient } from "@/lib/sdr/sdr-store";
import type { SdrLead, SdrCloudiaFieldKey } from "@/types/sdr";
import { cn, formatDate, formatNumber } from "@/lib/utils";

type FilterTipo = "todos" | "Cadastro" | "Resgate";
type FilterOrigem = "todas" | "cloudia" | "manual";

export default function CadastroGeralPage() {
  const ready = useIsClient();
  const { leads } = useSdrStore();
  const [search, setSearch] = useState("");
  const [filterTipo, setFilterTipo] = useState<FilterTipo>("todos");
  const [filterOrigem, setFilterOrigem] = useState<FilterOrigem>("todas");
  const [reviewLeadId, setReviewLeadId] = useState<string | null>(null);

  const filtered = useMemo(() => {
    let r = leads;
    if (search.trim()) {
      const q = search.toLowerCase();
      r = r.filter(
        (l) =>
          l.nome.toLowerCase().includes(q) ||
          l.telefone.toLowerCase().includes(q) ||
          (l.observacao ?? "").toLowerCase().includes(q),
      );
    }
    if (filterTipo !== "todos") r = r.filter((l) => l.tipo === filterTipo);
    if (filterOrigem === "cloudia") r = r.filter((l) => l.cloudiaFields.length > 0);
    if (filterOrigem === "manual") r = r.filter((l) => l.cloudiaFields.length === 0);
    return r;
  }, [leads, search, filterTipo, filterOrigem]);

  const totalCloudia = leads.filter((l) => l.cloudiaFields.length > 0).length;
  const reviewLead = reviewLeadId ? leads.find((l) => l.id === reviewLeadId) : null;

  return (
    <div>
      <PageHeader
        badge="Seção 1 · Cadastro Geral"
        title="Leads"
        description="Cada linha é um lead que chegou na sua unidade. Os campos com badge verde foram preenchidos automaticamente pela Cloudia."
        actions={
          <div className="flex items-center gap-2 text-[11px] text-slate-400">
            <Sparkles className="h-3.5 w-3.5 text-emerald-300" />
            <span>{formatNumber(totalCloudia)} de {formatNumber(leads.length)} via Cloudia</span>
          </div>
        }
      />

      <CloudiaLegendBanner className="mb-5" />

      {/* Filtros */}
      <div className="mb-4 flex flex-col gap-2 md:flex-row md:items-center">
        <div className="relative flex-1 md:max-w-xs">
          <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-500" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por nome, telefone, observação…"
            className="h-9 w-full rounded-md border border-white/[0.06] bg-white/[0.02] pl-8 pr-3 text-[12px] text-slate-200 placeholder:text-slate-500 focus:border-emerald-400/30 focus:outline-none"
          />
        </div>
        <FilterChips
          label="Tipo"
          options={[
            { value: "todos", label: "Todos" },
            { value: "Cadastro", label: "Cadastro" },
            { value: "Resgate", label: "Resgate" },
          ]}
          value={filterTipo}
          onChange={(v) => setFilterTipo(v as FilterTipo)}
        />
        <FilterChips
          label="Origem"
          options={[
            { value: "todas", label: "Todas" },
            { value: "cloudia", label: "Auto · Cloudia" },
            { value: "manual", label: "Manual" },
          ]}
          value={filterOrigem}
          onChange={(v) => setFilterOrigem(v as FilterOrigem)}
        />
      </div>

      {/* Tabela */}
      {ready && (
        <div className="overflow-hidden rounded-xl border border-white/[0.06] bg-white/[0.015]">
          <div className="overflow-x-auto">
            <table className="w-full text-[12px]">
              <thead className="bg-white/[0.025] text-left">
                <tr>
                  <Th><CloudiaColumnHeader label="Nome do cliente" origin="cloudia" /></Th>
                  <Th><CloudiaColumnHeader label="Telefone" origin="cloudia" /></Th>
                  <Th><CloudiaColumnHeader label="Tipo" origin="cloudia" /></Th>
                  <Th><CloudiaColumnHeader label="Origem" origin="cloudia" /></Th>
                  <Th><CloudiaColumnHeader label="Interação" origin="cloudia" /></Th>
                  <Th><CloudiaColumnHeader label="Agendou?" origin="manual" /></Th>
                  <Th><CloudiaColumnHeader label="Data agendamento" origin="manual" /></Th>
                  <Th><CloudiaColumnHeader label="Responsável" origin="cloudia" /></Th>
                  <Th><CloudiaColumnHeader label="Situação" origin="cloudia" /></Th>
                  <Th><CloudiaColumnHeader label="Clínica" origin="cloudia" /></Th>
                  <Th><CloudiaColumnHeader label="Data origem" origin="cloudia" /></Th>
                  <Th className="text-right pr-3"><span className="text-[11px] text-slate-500">Ação</span></Th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.04]">
                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={12} className="px-4 py-12 text-center text-[12px] text-slate-500">
                      Nenhum lead encontrado com esses filtros.
                    </td>
                  </tr>
                )}
                {filtered.map((lead) => (
                  <Row key={lead.id} lead={lead} onReview={() => setReviewLeadId(lead.id)} />
                ))}
              </tbody>
            </table>
          </div>
          <div className="border-t border-white/[0.04] bg-white/[0.015] px-4 py-2.5 text-[11px] text-slate-500">
            Mostrando {formatNumber(filtered.length)} de {formatNumber(leads.length)} leads
          </div>
        </div>
      )}

      {/* Sheet lateral de revisão */}
      {reviewLead && (
        <LeadReviewSheet
          lead={reviewLead}
          onClose={() => setReviewLeadId(null)}
        />
      )}
    </div>
  );
}

function Th({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <th className={cn("px-3 py-2.5 align-bottom font-medium", className)}>{children}</th>
  );
}

function Row({ lead, onReview }: { lead: SdrLead; onReview: () => void }) {
  const isFromCloudia = (k: SdrCloudiaFieldKey): "cloudia" | "manual" =>
    lead.cloudiaFields.includes(k) ? "cloudia" : "manual";
  return (
    <tr className="transition-colors hover:bg-white/[0.025]">
      <Td>
        <CloudiaCell origin={isFromCloudia("nome")}>{lead.nome}</CloudiaCell>
      </Td>
      <Td>
        <CloudiaCell origin={isFromCloudia("telefone")}>
          <span className="font-mono text-[11.5px]">{lead.telefone}</span>
        </CloudiaCell>
      </Td>
      <Td>
        <span
          className={cn(
            "inline-flex rounded-md px-1.5 py-0.5 text-[10.5px] font-medium",
            lead.tipo === "Resgate"
              ? "bg-amber-400/10 text-amber-200 ring-1 ring-inset ring-amber-400/20"
              : "bg-sky-400/10 text-sky-200 ring-1 ring-inset ring-sky-400/20",
          )}
        >
          {lead.tipo}
          {lead.tipo === "Resgate" && lead.tipoResgate && (
            <span className="ml-1 text-slate-400">· {lead.tipoResgate}</span>
          )}
        </span>
      </Td>
      <Td>
        <CloudiaCell origin={isFromCloudia("origem")} className="text-[11.5px]">
          {lead.origem}
        </CloudiaCell>
      </Td>
      <Td>
        <BoolPill value={lead.interacao} cloudia={isFromCloudia("interacao") === "cloudia"} />
      </Td>
      <Td>
        <BoolPill value={lead.agendouConsulta} cloudia={false} />
      </Td>
      <Td>
        {lead.dataAgendamento ? (
          <CloudiaCell origin={isFromCloudia("dataAgendamento")} className="text-[11.5px]">
            {formatDate(lead.dataAgendamento)}
          </CloudiaCell>
        ) : (
          <span className="text-slate-500">—</span>
        )}
      </Td>
      <Td>
        <CloudiaCell origin={isFromCloudia("nomeResponsavel")}>{lead.nomeResponsavel}</CloudiaCell>
      </Td>
      <Td>
        {lead.situacao ? (
          <CloudiaCell origin={isFromCloudia("situacao")} className="text-[11.5px]">
            {lead.situacao}
          </CloudiaCell>
        ) : (
          <span className="text-slate-500">—</span>
        )}
      </Td>
      <Td>
        {lead.clinica ? (
          <CloudiaCell origin={isFromCloudia("clinica")} className="text-[11.5px]">
            {lead.clinica}
          </CloudiaCell>
        ) : (
          <span className="text-slate-500">—</span>
        )}
      </Td>
      <Td className="text-slate-400 tabular-nums">{formatDate(lead.dataOrigem)}</Td>
      <Td className="text-right">
        <button
          type="button"
          onClick={onReview}
          className="inline-flex items-center gap-1 rounded-md border border-emerald-400/25 bg-emerald-400/10 px-2 py-1 text-[11px] font-medium text-emerald-200 transition-colors hover:border-emerald-400/40 hover:bg-emerald-400/15"
        >
          <Eye className="h-3 w-3" />
          Revisar
        </button>
      </Td>
    </tr>
  );
}

function Td({ children, className }: { children: React.ReactNode; className?: string }) {
  return <td className={cn("px-3 py-2.5", className)}>{children}</td>;
}

function BoolPill({ value, cloudia }: { value: boolean; cloudia: boolean }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10.5px] font-medium",
        value
          ? "bg-emerald-400/10 text-emerald-200 ring-1 ring-inset ring-emerald-400/20"
          : "bg-slate-500/10 text-slate-400 ring-1 ring-inset ring-slate-500/20",
      )}
    >
      {value ? <CheckCircle2 className="h-3 w-3" /> : <XCircle className="h-3 w-3" />}
      {value ? "Sim" : "Não"}
      {cloudia && <Sparkles className="h-2.5 w-2.5 text-emerald-300" />}
    </span>
  );
}

function FilterChips({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: { value: string; label: string }[];
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="flex items-center gap-1.5 rounded-md border border-white/[0.06] bg-white/[0.02] px-1 py-1">
      <span className="px-1.5 text-[10px] font-medium uppercase tracking-wider text-slate-500">
        <Filter className="-mt-px mr-1 inline h-3 w-3" />
        {label}
      </span>
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          onClick={() => onChange(o.value)}
          className={cn(
            "rounded px-2 py-1 text-[11px] font-medium transition-colors",
            value === o.value
              ? "bg-emerald-400/15 text-emerald-200 ring-1 ring-inset ring-emerald-400/30"
              : "text-slate-400 hover:bg-white/[0.04] hover:text-slate-200",
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
