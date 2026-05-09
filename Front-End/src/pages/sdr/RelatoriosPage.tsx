import { useMemo, useState } from "react";
import { Calendar, FileBarChart, Sparkles, TrendingUp } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { CloudiaLegendBanner } from "@/components/sdr/CloudiaField";
import { useIsClient, useSdrStore } from "@/lib/sdr/sdr-store";
import { cn, formatCurrency, formatNumber, formatPercent } from "@/lib/utils";

type ViewKind = "mensal-origem" | "diario" | "mensal";

export default function RelatoriosPage() {
  const ready = useIsClient();
  const [view, setView] = useState<ViewKind>("mensal-origem");
  const { leads, consultas, tratamentos } = useSdrStore();

  // ---- Resumo Mensal por Origem ----
  const resumoOrigem = useMemo(() => {
    const m = new Map<string, { total: number; cadastro: number; resgate: number }>();
    for (const l of leads) {
      const cur = m.get(l.origem) ?? { total: 0, cadastro: 0, resgate: 0 };
      cur.total++;
      if (l.tipo === "Resgate") cur.resgate++;
      else cur.cadastro++;
      m.set(l.origem, cur);
    }
    return Array.from(m.entries())
      .map(([origem, v]) => ({ origem, ...v }))
      .sort((a, b) => b.total - a.total);
  }, [leads]);

  const totalLeads = leads.length;

  // ---- Consolidado Diário ----
  const consolDiario = useMemo(() => {
    const m = new Map<string, { leads: number; consultas: number; receita: number }>();
    for (const l of leads) {
      const k = l.dataOrigem.slice(0, 10);
      const cur = m.get(k) ?? { leads: 0, consultas: 0, receita: 0 };
      cur.leads++;
      m.set(k, cur);
    }
    for (const c of consultas) {
      const k = c.dataConsulta.slice(0, 10);
      const cur = m.get(k) ?? { leads: 0, consultas: 0, receita: 0 };
      cur.consultas++;
      cur.receita += (c.recebimento1?.valor ?? 0) + (c.recebimento2?.valor ?? 0);
      m.set(k, cur);
    }
    for (const t of tratamentos) {
      for (const r of t.recebimentos) {
        const k = r.data.slice(0, 10);
        const cur = m.get(k) ?? { leads: 0, consultas: 0, receita: 0 };
        cur.receita += r.valor;
        m.set(k, cur);
      }
    }
    return Array.from(m.entries())
      .map(([data, v]) => ({ data, ...v }))
      .sort((a, b) => b.data.localeCompare(a.data));
  }, [leads, consultas, tratamentos]);

  // ---- Consolidado Mensal ----
  const consolMensal = useMemo(() => {
    const m = new Map<string, { leads: number; consultas: number; receita: number }>();
    for (const l of leads) {
      const k = l.dataOrigem.slice(0, 7);
      const cur = m.get(k) ?? { leads: 0, consultas: 0, receita: 0 };
      cur.leads++;
      m.set(k, cur);
    }
    for (const c of consultas) {
      const k = c.dataConsulta.slice(0, 7);
      const cur = m.get(k) ?? { leads: 0, consultas: 0, receita: 0 };
      cur.consultas++;
      cur.receita += (c.recebimento1?.valor ?? 0) + (c.recebimento2?.valor ?? 0);
      m.set(k, cur);
    }
    for (const t of tratamentos) {
      for (const r of t.recebimentos) {
        const k = r.data.slice(0, 7);
        const cur = m.get(k) ?? { leads: 0, consultas: 0, receita: 0 };
        cur.receita += r.valor;
        m.set(k, cur);
      }
    }
    return Array.from(m.entries())
      .map(([mes, v]) => ({ mes, ...v }))
      .sort((a, b) => b.mes.localeCompare(a.mes));
  }, [leads, consultas, tratamentos]);

  return (
    <div>
      <PageHeader
        badge="Seção 8 · Relatórios"
        title="Relatórios"
        description="Views agregadas geradas automaticamente a partir dos dados Cloudia + manuais. Não há entidade nova: tudo é calculado em tempo real."
      />

      <CloudiaLegendBanner className="mb-5" />

      <div className="mb-4 flex flex-wrap gap-2">
        <ViewTab active={view === "mensal-origem"} onClick={() => setView("mensal-origem")} icon={Sparkles}>
          Resumo mensal por origem
        </ViewTab>
        <ViewTab active={view === "diario"} onClick={() => setView("diario")} icon={Calendar}>
          Consolidado diário
        </ViewTab>
        <ViewTab active={view === "mensal"} onClick={() => setView("mensal")} icon={TrendingUp}>
          Consolidado mensal
        </ViewTab>
      </div>

      {ready && view === "mensal-origem" && (
        <div className="overflow-hidden rounded-xl border border-white/[0.06] bg-white/[0.015]">
          <div className="border-b border-white/[0.04] bg-white/[0.02] px-4 py-2.5">
            <h3 className="text-[12px] font-semibold text-slate-200">Distribuição por origem</h3>
            <p className="mt-0.5 text-[10.5px] text-slate-500">
              Origens vêm da Cloudia (data.origin) — esta tabela é 100% auto-gerada.
            </p>
          </div>
          <table className="w-full text-[12px]">
            <thead className="bg-white/[0.015] text-left">
              <tr>
                <Th>Origem</Th>
                <Th className="text-right">Total</Th>
                <Th className="text-right">% do total</Th>
                <Th className="text-right">Cadastro</Th>
                <Th className="text-right">Resgate</Th>
                <Th className="w-1/3">Distribuição</Th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.04]">
              {resumoOrigem.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-12 text-center text-[12px] text-slate-500">
                    Sem leads.
                  </td>
                </tr>
              )}
              {resumoOrigem.map((r) => {
                const pct = totalLeads > 0 ? (r.total / totalLeads) * 100 : 0;
                return (
                  <tr key={r.origem}>
                    <Td>
                      <span className="inline-flex items-center gap-1.5 text-slate-200">
                        <Sparkles className="h-3 w-3 text-emerald-300" />
                        {r.origem}
                      </span>
                    </Td>
                    <Td className="text-right tabular-nums text-slate-100">{formatNumber(r.total)}</Td>
                    <Td className="text-right tabular-nums text-emerald-200">{formatPercent(pct, 1)}</Td>
                    <Td className="text-right tabular-nums text-sky-200">{formatNumber(r.cadastro)}</Td>
                    <Td className="text-right tabular-nums text-amber-200">{formatNumber(r.resgate)}</Td>
                    <Td>
                      <div className="h-1.5 overflow-hidden rounded-full bg-white/[0.05]">
                        <div className="h-full rounded-full bg-emerald-400/80" style={{ width: `${pct}%` }} />
                      </div>
                    </Td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {ready && view === "diario" && (
        <div className="overflow-hidden rounded-xl border border-white/[0.06] bg-white/[0.015]">
          <div className="border-b border-white/[0.04] bg-white/[0.02] px-4 py-2.5">
            <h3 className="text-[12px] font-semibold text-slate-200">Atividade diária</h3>
          </div>
          <table className="w-full text-[12px]">
            <thead className="bg-white/[0.015] text-left">
              <tr>
                <Th>Data</Th>
                <Th className="text-right">Leads novos</Th>
                <Th className="text-right">Consultas</Th>
                <Th className="text-right">Receita do dia</Th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.04]">
              {consolDiario.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-4 py-12 text-center text-[12px] text-slate-500">
                    Sem dados.
                  </td>
                </tr>
              )}
              {consolDiario.map((d) => (
                <tr key={d.data}>
                  <Td className="font-mono tabular-nums text-slate-300">
                    {new Date(d.data).toLocaleDateString("pt-BR", {
                      day: "2-digit",
                      month: "2-digit",
                      year: "2-digit",
                    })}
                  </Td>
                  <Td className="text-right tabular-nums text-slate-100">{formatNumber(d.leads)}</Td>
                  <Td className="text-right tabular-nums text-sky-200">{formatNumber(d.consultas)}</Td>
                  <Td className="text-right tabular-nums text-emerald-200">{formatCurrency(d.receita)}</Td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {ready && view === "mensal" && (
        <div className="overflow-hidden rounded-xl border border-white/[0.06] bg-white/[0.015]">
          <div className="border-b border-white/[0.04] bg-white/[0.02] px-4 py-2.5">
            <h3 className="text-[12px] font-semibold text-slate-200">Atividade mensal</h3>
          </div>
          <table className="w-full text-[12px]">
            <thead className="bg-white/[0.015] text-left">
              <tr>
                <Th>Mês</Th>
                <Th className="text-right">Leads</Th>
                <Th className="text-right">Consultas</Th>
                <Th className="text-right">Receita total</Th>
                <Th className="text-right">Ticket médio</Th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.04]">
              {consolMensal.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-12 text-center text-[12px] text-slate-500">
                    Sem dados.
                  </td>
                </tr>
              )}
              {consolMensal.map((m) => {
                const ticket = m.consultas > 0 ? m.receita / m.consultas : 0;
                return (
                  <tr key={m.mes}>
                    <Td className="font-mono tabular-nums text-slate-300">{m.mes}</Td>
                    <Td className="text-right tabular-nums text-slate-100">{formatNumber(m.leads)}</Td>
                    <Td className="text-right tabular-nums text-sky-200">{formatNumber(m.consultas)}</Td>
                    <Td className="text-right tabular-nums text-emerald-200">{formatCurrency(m.receita)}</Td>
                    <Td className="text-right tabular-nums text-slate-300">{formatCurrency(ticket)}</Td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <p className="mt-4 flex items-center gap-1.5 px-1 text-[11px] text-slate-500">
        <FileBarChart className="h-3 w-3" />
        Relatórios são views — atualizam automaticamente conforme leads chegam.
      </p>
    </div>
  );
}

function Th({ children, className }: { children: React.ReactNode; className?: string }) {
  return <th className={cn("px-3 py-2.5 align-bottom font-medium", className)}>{children}</th>;
}
function Td({ children, className }: { children: React.ReactNode; className?: string }) {
  return <td className={cn("px-3 py-2.5", className)}>{children}</td>;
}

function ViewTab({
  active,
  onClick,
  icon: Icon,
  children,
}: {
  active: boolean;
  onClick: () => void;
  icon: typeof Calendar;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-[12px] font-medium ring-1 ring-inset transition-colors",
        active
          ? "bg-emerald-400/15 text-emerald-200 ring-emerald-400/30"
          : "bg-transparent text-slate-400 ring-white/[0.06] hover:bg-white/[0.03] hover:text-slate-200",
      )}
    >
      <Icon className="h-3.5 w-3.5" />
      {children}
    </button>
  );
}
