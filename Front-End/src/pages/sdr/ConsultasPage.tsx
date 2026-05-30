import { useMemo, useState } from "react";
import { CheckCircle2, Search, XCircle } from "@/components/icons";
import { PageHeader } from "@/components/layout/PageHeader";
import {
  SourceCell,
  SourceColumnHeader,
  SourceLegendBanner,
} from "@/components/sdr/SourceField";
import { useSdrStore, useIsClient } from "@/lib/sdr/sdr-store";
import { cn, formatCurrency, formatDate, formatNumber } from "@/lib/utils";

export default function ConsultasPage() {
  const ready = useIsClient();
  const { consultas, leads } = useSdrStore();
  const [search, setSearch] = useState("");

  const rows = useMemo(() => {
    return consultas
      .map((c) => {
        const lead = leads.find((l) => l.id === c.leadId);
        return { consulta: c, lead };
      })
      .filter(({ lead }) => {
        if (!search.trim()) return true;
        const q = search.toLowerCase();
        return (
          (lead?.nome ?? "").toLowerCase().includes(q) ||
          (lead?.telefone ?? "").toLowerCase().includes(q)
        );
      });
  }, [consultas, leads, search]);

  const totalRecebido = consultas.reduce(
    (sum, c) => sum + (c.recebimento1?.valor ?? 0) + (c.recebimento2?.valor ?? 0),
    0,
  );
  const totalConsultas = consultas.reduce((s, c) => s + c.valorConsulta, 0);

  return (
    <div>
      <PageHeader
        badge="Seção 2 · Consultas Realizadas"
        title="Consultas"
        description="Consultas que aconteceram, valor cobrado, recebimentos, indicação de tratamento."
        actions={
          <div className="flex gap-3 text-[11px]">
            <Stat label="Total cobrado" value={formatCurrency(totalConsultas)} tone="slate" />
            <Stat label="Total recebido" value={formatCurrency(totalRecebido)} tone="emerald" />
          </div>
        }
      />

      <SourceLegendBanner className="mb-5" />

      <div className="mb-4">
        <div className="relative max-w-xs">
          <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-500" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por paciente…"
            className="h-9 w-full rounded-md border border-white/[0.06] bg-white/[0.02] pl-8 pr-3 text-[12px] text-slate-200 placeholder:text-slate-500 focus:border-emerald-400/30 focus:outline-none"
          />
        </div>
      </div>

      {ready && (
        <div className="overflow-hidden rounded-xl border border-white/[0.06] bg-white/[0.015]">
          <div className="overflow-x-auto">
            <table className="w-full text-[12px]">
              <thead className="bg-white/[0.025] text-left">
                <tr>
                  <Th><SourceColumnHeader label="Paciente" origin="crm" /></Th>
                  <Th><SourceColumnHeader label="Telefone" origin="crm" /></Th>
                  <Th><SourceColumnHeader label="Origem" origin="crm" /></Th>
                  <Th><SourceColumnHeader label="Data consulta" origin="manual" /></Th>
                  <Th className="text-right"><SourceColumnHeader label="Valor consulta" origin="manual" /></Th>
                  <Th><SourceColumnHeader label="Pago?" origin="manual" /></Th>
                  <Th className="text-right"><SourceColumnHeader label="1º recebimento" origin="manual" /></Th>
                  <Th><SourceColumnHeader label="Forma 1º" origin="manual" /></Th>
                  <Th className="text-right"><SourceColumnHeader label="2º recebimento" origin="manual" /></Th>
                  <Th><SourceColumnHeader label="Forma 2º" origin="manual" /></Th>
                  <Th className="text-right"><SourceColumnHeader label="Total recebido" origin="calculado" /></Th>
                  <Th className="text-right"><SourceColumnHeader label="Falta receber" origin="calculado" /></Th>
                  <Th><SourceColumnHeader label="Status" origin="manual" /></Th>
                  <Th><SourceColumnHeader label="Tratamento indicado" origin="manual" /></Th>
                  <Th><SourceColumnHeader label="Fechou?" origin="manual" /></Th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.04]">
                {rows.length === 0 && (
                  <tr>
                    <td colSpan={15} className="px-4 py-12 text-center text-[12px] text-slate-500">
                      Nenhuma consulta registrada.
                    </td>
                  </tr>
                )}
                {rows.map(({ consulta: c, lead }) => {
                  const totalRec = (c.recebimento1?.valor ?? 0) + (c.recebimento2?.valor ?? 0);
                  const falta = c.valorConsulta - totalRec;
                  return (
                    <tr key={c.id} className="hover:bg-white/[0.025]">
                      <Td><SourceCell origin="crm">{lead?.nome ?? "—"}</SourceCell></Td>
                      <Td>
                        <SourceCell origin="crm" className="font-mono text-[11.5px]">
                          {lead?.telefone ?? "—"}
                        </SourceCell>
                      </Td>
                      <Td>
                        {lead?.origem ? (
                          <SourceCell origin="crm" className="text-[11.5px]">
                            {lead.origem}
                          </SourceCell>
                        ) : (
                          <span className="text-slate-500">—</span>
                        )}
                      </Td>
                      <Td className="tabular-nums text-slate-300">{formatDate(c.dataConsulta)}</Td>
                      <Td className="text-right tabular-nums text-slate-200">{formatCurrency(c.valorConsulta)}</Td>
                      <Td>
                        <BoolChip value={c.pago} />
                      </Td>
                      <Td className="text-right tabular-nums">
                        {c.recebimento1 ? formatCurrency(c.recebimento1.valor) : <span className="text-slate-500">—</span>}
                      </Td>
                      <Td className="text-slate-400">{c.recebimento1?.formaPagamento ?? "—"}</Td>
                      <Td className="text-right tabular-nums">
                        {c.recebimento2 ? formatCurrency(c.recebimento2.valor) : <span className="text-slate-500">—</span>}
                      </Td>
                      <Td className="text-slate-400">{c.recebimento2?.formaPagamento ?? "—"}</Td>
                      <Td className="text-right tabular-nums text-emerald-200">{formatCurrency(totalRec)}</Td>
                      <Td className={cn("text-right tabular-nums", falta > 0 ? "text-rose-300" : "text-slate-400")}>
                        {falta > 0 ? formatCurrency(falta) : "—"}
                      </Td>
                      <Td><StatusChip status={c.status} /></Td>
                      <Td>
                        {c.tipoTratamentoIndicado ? (
                          <span className="text-slate-200">
                            {c.tipoTratamentoIndicado}
                            {c.valorTratamento && (
                              <span className="ml-1 text-slate-500">· {formatCurrency(c.valorTratamento)}</span>
                            )}
                          </span>
                        ) : (
                          <span className="text-slate-500">—</span>
                        )}
                      </Td>
                      <Td>
                        {c.fechouTratamento === undefined ? (
                          <span className="text-slate-500">—</span>
                        ) : c.fechouTratamento ? (
                          <span className="inline-flex items-center gap-1 rounded-md bg-emerald-400/10 px-1.5 py-0.5 text-[10.5px] font-medium text-emerald-200 ring-1 ring-inset ring-emerald-400/20">
                            <CheckCircle2 className="h-3 w-3" />
                            Sim
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 rounded-md bg-rose-400/10 px-1.5 py-0.5 text-[10.5px] font-medium text-rose-200 ring-1 ring-inset ring-rose-400/20">
                            <XCircle className="h-3 w-3" />
                            {c.motivoNaoFechamento ?? "Não"}
                          </span>
                        )}
                      </Td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="border-t border-white/[0.04] bg-white/[0.015] px-4 py-2.5 text-[11px] text-slate-500">
            {formatNumber(rows.length)} consulta(s)
          </div>
        </div>
      )}
    </div>
  );
}

function Th({ children, className }: { children: React.ReactNode; className?: string }) {
  return <th className={cn("px-3 py-2.5 align-bottom font-medium", className)}>{children}</th>;
}
function Td({ children, className }: { children: React.ReactNode; className?: string }) {
  return <td className={cn("px-3 py-2.5", className)}>{children}</td>;
}

function BoolChip({ value }: { value: boolean }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10.5px] font-medium",
        value
          ? "bg-emerald-400/10 text-emerald-200 ring-1 ring-inset ring-emerald-400/20"
          : "bg-rose-400/10 text-rose-200 ring-1 ring-inset ring-rose-400/20",
      )}
    >
      {value ? "Sim" : "Não"}
    </span>
  );
}

function StatusChip({ status }: { status?: "compareceu" | "faltou" | "remarcou" }) {
  if (!status) return <span className="text-slate-500">—</span>;
  const map = {
    compareceu: { label: "Compareceu", cls: "bg-emerald-400/10 text-emerald-200 ring-emerald-400/20" },
    faltou: { label: "Faltou", cls: "bg-rose-400/10 text-rose-200 ring-rose-400/20" },
    remarcou: { label: "Remarcou", cls: "bg-amber-400/10 text-amber-200 ring-amber-400/20" },
  } as const;
  const m = map[status];
  return (
    <span className={cn("inline-flex rounded-md px-1.5 py-0.5 text-[10.5px] font-medium ring-1 ring-inset", m.cls)}>
      {m.label}
    </span>
  );
}

function Stat({ label, value, tone }: { label: string; value: string; tone: "slate" | "emerald" }) {
  return (
    <div className="rounded-md border border-white/[0.06] bg-white/[0.015] px-3 py-1.5">
      <p className="text-[9.5px] uppercase tracking-wider text-slate-500">{label}</p>
      <p
        className={cn(
          "mt-0.5 text-[13px] font-semibold tabular-nums",
          tone === "emerald" ? "text-emerald-200" : "text-slate-200",
        )}
      >
        {value}
      </p>
    </div>
  );
}
