import { useMemo, useState } from "react";
import { Search } from "@/components/icons";
import { PageHeader } from "@/components/layout/PageHeader";
import {
  CloudiaCell,
  CloudiaColumnHeader,
  CloudiaLegendBanner,
} from "@/components/sdr/CloudiaField";
import { useSdrStore, useIsClient } from "@/lib/sdr/sdr-store";
import { SDR_TIPOS_TRATAMENTO } from "@/types/sdr";
import { cn, formatCurrency, formatDate, formatNumber } from "@/lib/utils";

export default function TratamentosPage() {
  const ready = useIsClient();
  const { tratamentos, leads } = useSdrStore();
  const [search, setSearch] = useState("");

  const rows = useMemo(() => {
    return tratamentos
      .map((t) => ({ tratamento: t, lead: leads.find((l) => l.id === t.leadId) }))
      .filter(({ lead }) => {
        if (!search.trim()) return true;
        const q = search.toLowerCase();
        return (lead?.nome ?? "").toLowerCase().includes(q) || (lead?.telefone ?? "").toLowerCase().includes(q);
      });
  }, [tratamentos, leads, search]);

  const totalCobrado = tratamentos.reduce((s, t) => s + t.valor, 0);
  const totalRecebido = tratamentos.reduce(
    (s, t) => s + t.recebimentos.reduce((x, r) => x + r.valor, 0),
    0,
  );
  const tipoLabel = (id?: string) => SDR_TIPOS_TRATAMENTO.find((x) => x.id === id)?.label ?? "—";

  return (
    <div>
      <PageHeader
        badge="Seção 3 · Tratamentos / Recebimentos"
        title="Tratamentos"
        description="Pacotes de tratamento fechados, splits de pagamento e status."
        actions={
          <div className="flex gap-3 text-[11px]">
            <Stat label="Total cobrado" value={formatCurrency(totalCobrado)} tone="slate" />
            <Stat label="Total recebido" value={formatCurrency(totalRecebido)} tone="emerald" />
          </div>
        }
      />

      <CloudiaLegendBanner className="mb-5" />

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
                  <Th><CloudiaColumnHeader label="Paciente" origin="cloudia" /></Th>
                  <Th><CloudiaColumnHeader label="Telefone" origin="cloudia" /></Th>
                  <Th><CloudiaColumnHeader label="Origem" origin="cloudia" /></Th>
                  <Th className="text-right"><CloudiaColumnHeader label="Valor" origin="manual" /></Th>
                  {[1, 2, 3, 4].map((n) => (
                    <Th key={n} className="text-right">
                      <CloudiaColumnHeader label={`${n}º recebimento`} origin="manual" />
                    </Th>
                  ))}
                  <Th className="text-right"><CloudiaColumnHeader label="Total recebido" origin="calculado" /></Th>
                  <Th className="text-right"><CloudiaColumnHeader label="Falta" origin="calculado" /></Th>
                  <Th><CloudiaColumnHeader label="Tipo" origin="manual" /></Th>
                  <Th><CloudiaColumnHeader label="Status" origin="manual" /></Th>
                  <Th><CloudiaColumnHeader label="Descrição" origin="manual" /></Th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.04]">
                {rows.length === 0 && (
                  <tr>
                    <td colSpan={13} className="px-4 py-12 text-center text-[12px] text-slate-500">
                      Nenhum tratamento registrado.
                    </td>
                  </tr>
                )}
                {rows.map(({ tratamento: t, lead }) => {
                  const totalRec = t.recebimentos.reduce((s, r) => s + r.valor, 0);
                  const falta = t.valor - totalRec;
                  return (
                    <tr key={t.id} className="hover:bg-white/[0.025]">
                      <Td><CloudiaCell origin="cloudia">{lead?.nome ?? "—"}</CloudiaCell></Td>
                      <Td>
                        <CloudiaCell origin="cloudia" className="font-mono text-[11.5px]">
                          {lead?.telefone ?? "—"}
                        </CloudiaCell>
                      </Td>
                      <Td>
                        {lead?.origem ? (
                          <CloudiaCell origin="cloudia" className="text-[11.5px]">{lead.origem}</CloudiaCell>
                        ) : (
                          <span className="text-slate-500">—</span>
                        )}
                      </Td>
                      <Td className="text-right tabular-nums text-slate-200">{formatCurrency(t.valor)}</Td>
                      {[0, 1, 2, 3].map((idx) => {
                        const r = t.recebimentos[idx];
                        return (
                          <Td key={idx} className="text-right tabular-nums">
                            {r ? (
                              <div className="flex flex-col items-end gap-0.5">
                                <span className="text-slate-200">{formatCurrency(r.valor)}</span>
                                <span className="text-[10px] text-slate-500">
                                  {r.formaPagamento} · {formatDate(r.data)}
                                </span>
                              </div>
                            ) : (
                              <span className="text-slate-500">—</span>
                            )}
                          </Td>
                        );
                      })}
                      <Td className="text-right tabular-nums text-emerald-200">{formatCurrency(totalRec)}</Td>
                      <Td className={cn("text-right tabular-nums", falta > 0 ? "text-rose-300" : "text-slate-400")}>
                        {falta > 0 ? formatCurrency(falta) : "—"}
                      </Td>
                      <Td className="text-slate-300">{tipoLabel(t.tipoTratamento)}</Td>
                      <Td>
                        {t.status ? (
                          <span className="inline-flex rounded-md bg-sky-400/10 px-1.5 py-0.5 text-[10.5px] font-medium text-sky-200 ring-1 ring-inset ring-sky-400/20">
                            {t.status === "em_andamento"
                              ? "Em andamento"
                              : t.status === "concluido"
                              ? "Concluído"
                              : "Cancelado"}
                          </span>
                        ) : (
                          <span className="text-slate-500">—</span>
                        )}
                      </Td>
                      <Td className="max-w-[20ch] truncate text-slate-400">{t.descricao ?? "—"}</Td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="border-t border-white/[0.04] bg-white/[0.015] px-4 py-2.5 text-[11px] text-slate-500">
            {formatNumber(rows.length)} tratamento(s)
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
