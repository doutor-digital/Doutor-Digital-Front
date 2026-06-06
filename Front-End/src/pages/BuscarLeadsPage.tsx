import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Loader2 } from "@/components/icons";
import { useClinic } from "@/hooks/useClinic";
import { leadSearchService, type LeadResultDto, type FilterEntry } from "@/services/leadSearch";
import { cn, formatDate } from "@/lib/utils";

const C = {
  bg: "#EEF1FA",
  panel: "#FFFFFF",
  header: "#4F46E5",
  headerDark: "#3730A3",
  primary: "#4F46E5",
  teal: "#10B981",
  rose: "#EC4899",
  amber: "#F59E0B",
  ink: "#1E293B",
  inkSoft: "#64748B",
  rule: "#E5E7EB",
} as const;

const EXAMPLES = [
  "leads que vieram pelo Instagram nos últimos 7 dias",
  "leads com tag lead_quente que ainda não agendaram",
  "pacientes criados este mês na etapa Lead de Entrada",
  "leads sem telefone preenchido",
  "leads de hoje",
];

export default function BuscarLeadsPage() {
  const { unitId, tenantId } = useClinic();
  const [query, setQuery] = useState("");

  const search = useMutation({
    mutationFn: () =>
      leadSearchService.search({
        query: query.trim(),
        unitId: unitId!,
        tenantId,
        limit: 50,
      }),
  });

  function submit() {
    if (!query.trim() || !unitId || search.isPending) return;
    search.mutate();
  }

  return (
    <div className="-mx-4 md:-mx-6 -mt-2" style={{ background: C.bg, minHeight: "calc(100vh - 3rem)" }}>
      {/* Header */}
      <header
        className="flex items-center justify-between px-6 py-3"
        style={{ background: `linear-gradient(90deg, ${C.headerDark} 0%, ${C.header} 100%)` }}
      >
        <div className="flex items-center gap-3">
          <div
            className="h-8 w-8 rounded grid place-items-center text-[11px] font-bold text-white"
            style={{ background: "rgba(255,255,255,0.15)" }}
          >
            🔍
          </div>
          <div>
            <h1 className="font-display text-[16px] font-semibold tracking-wide text-white">
              Buscar Leads
            </h1>
            <p className="text-[10.5px] text-white/70 mt-0.5">
              Linguagem natural → filtros estruturados (GPT-4o-mini)
            </p>
          </div>
        </div>
      </header>

      <div className="px-6 py-5 space-y-4 max-w-6xl mx-auto" style={{ color: C.ink }}>
        {/* Input */}
        <section
          className="rounded-xl p-5 shadow-sm"
          style={{ background: C.panel, border: `1px solid ${C.rule}` }}
        >
          <label className="block text-[12px] font-semibold mb-2" style={{ color: C.ink }}>
            O que você quer buscar?
          </label>
          <div className="flex gap-2">
            <textarea
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
                  e.preventDefault();
                  submit();
                }
              }}
              placeholder="ex.: leads que vieram pelo Instagram nos últimos 7 dias"
              rows={2}
              className="flex-1 resize-none rounded-md px-3 py-2 text-[13px] outline-none"
              style={{ background: "#F9FAFB", border: `1px solid ${C.rule}`, color: C.ink }}
            />
            <button
              onClick={submit}
              disabled={!query.trim() || !unitId || search.isPending}
              className="rounded-md px-4 py-2 text-[13px] font-semibold text-white disabled:opacity-50 inline-flex items-center gap-2 shrink-0"
              style={{ background: C.primary }}
            >
              {search.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
              {search.isPending ? "Buscando…" : "Buscar"}
            </button>
          </div>

          {!unitId && (
            <p className="mt-2 text-[11.5px]" style={{ color: "#92400E" }}>
              Selecione uma unidade no topo do painel.
            </p>
          )}

          <div className="mt-3 flex flex-wrap gap-1.5">
            {EXAMPLES.map((ex) => (
              <button
                key={ex}
                onClick={() => setQuery(ex)}
                className="text-[11px] rounded-full px-2.5 py-1"
                style={{ background: "#F3F4F6", color: C.inkSoft, border: `1px solid ${C.rule}` }}
              >
                {ex}
              </button>
            ))}
          </div>
        </section>

        {search.isError && (
          <div
            className="rounded-md px-4 py-3 text-[12.5px]"
            style={{ background: "#FEE2E2", color: "#991B1B" }}
          >
            Erro: {String((search.error as Error)?.message ?? "falha na busca")}
          </div>
        )}

        {search.data && (
          <>
            {/* Filtros parseados + observação */}
            <section
              className="rounded-xl p-4 shadow-sm"
              style={{ background: C.panel, border: `1px solid ${C.rule}` }}
            >
              <div className="flex items-center justify-between mb-2">
                <h2 className="text-[12px] font-semibold uppercase tracking-widest" style={{ color: C.inkSoft }}>
                  Filtros entendidos · operador {search.data.parsedFilters.operadorLogico}
                </h2>
                <span className="text-[11px]" style={{ color: C.inkSoft }}>
                  {search.data.durationSec.toFixed(1)}s · {search.data.totalMatched} resultados
                  {search.data.totalMatched > search.data.leads.length && (
                    <> · mostrando {search.data.leads.length}</>
                  )}
                </span>
              </div>

              <div className="flex flex-wrap gap-1.5">
                {search.data.parsedFilters.filtros.map((f, i) => (
                  <FilterChip key={i} filter={f} ignored={search.data!.ignoredSlugs.includes(f.campo)} />
                ))}
                {search.data.parsedFilters.filtros.length === 0 && (
                  <span className="text-[12px]" style={{ color: C.inkSoft }}>
                    Nenhum filtro extraído.
                  </span>
                )}
              </div>

              {search.data.ignoredSlugs.length > 0 && (
                <p
                  className="mt-3 rounded-md p-2 text-[11.5px]"
                  style={{ background: "#FEF3C7", color: "#92400E" }}
                >
                  ⚠ Filtros ainda não suportados nesta versão (mostrados riscados acima):{" "}
                  <code>{search.data.ignoredSlugs.join(", ")}</code>. Esses critérios foram ignorados na
                  execução — refine a busca pra usar campos diretos.
                </p>
              )}

              {search.data.observation && (
                <p className="mt-3 text-[11.5px]" style={{ color: C.inkSoft }}>
                  💡 Observação da IA: {search.data.observation}
                </p>
              )}
            </section>

            {/* Tabela de resultados */}
            <section
              className="rounded-xl shadow-sm overflow-hidden"
              style={{ background: C.panel, border: `1px solid ${C.rule}` }}
            >
              <h2
                className="px-4 py-2.5 text-[12.5px] font-semibold border-b"
                style={{ borderColor: C.rule, color: C.ink }}
              >
                Resultados
              </h2>
              {search.data.leads.length === 0 ? (
                <p className="px-4 py-8 text-[12.5px] text-center" style={{ color: C.inkSoft }}>
                  Nenhum lead encontrado pra esses filtros.
                </p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-[12px]">
                    <thead style={{ background: "#F9FAFB" }}>
                      <tr style={{ color: C.inkSoft }}>
                        <th className="text-left px-3 py-2 font-medium">Nome</th>
                        <th className="text-left px-3 py-2 font-medium">Telefone</th>
                        <th className="text-left px-3 py-2 font-medium">Etapa</th>
                        <th className="text-left px-3 py-2 font-medium">Origem</th>
                        <th className="text-left px-3 py-2 font-medium">Criado</th>
                        <th className="text-right px-3 py-2 font-medium"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {search.data.leads.map((l) => (
                        <LeadRow key={l.id} lead={l} />
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          </>
        )}
      </div>
    </div>
  );
}

function FilterChip({ filter, ignored }: { filter: FilterEntry; ignored: boolean }) {
  const valor = String(filter.valor);
  const label = `${filter.campo} ${filter.operador} ${valor.length > 24 ? valor.slice(0, 24) + "…" : valor}`;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[10.5px] font-medium",
        ignored && "line-through",
      )}
      style={{
        background: ignored ? "#FEE2E2" : "#EEF2FF",
        color: ignored ? "#991B1B" : C.primary,
        border: `1px solid ${ignored ? "#FCA5A5" : "#C7D2FE"}`,
      }}
      title={ignored ? "Filtro ignorado (não suportado em v1)" : "Filtro aplicado"}
    >
      {label}
    </span>
  );
}

function LeadRow({ lead }: { lead: LeadResultDto }) {
  return (
    <tr className="border-t hover:bg-slate-50" style={{ borderColor: C.rule, color: C.ink }}>
      <td className="px-3 py-2">
        <a
          href={`/leads/${lead.id}`}
          className="font-medium hover:underline"
          style={{ color: C.primary }}
        >
          {lead.name || "(sem nome)"}
        </a>
      </td>
      <td className="px-3 py-2 tabular-nums">{lead.phone || "—"}</td>
      <td className="px-3 py-2">{lead.currentStage || "—"}</td>
      <td className="px-3 py-2">
        {lead.source}
        {lead.campaign && <span style={{ color: C.inkSoft }}> · {lead.campaign}</span>}
      </td>
      <td className="px-3 py-2 tabular-nums" style={{ color: C.inkSoft }}>
        {formatDate(lead.createdAt)}
      </td>
      <td className="px-3 py-2 text-right">
        <a
          href={`/leads/${lead.id}`}
          className="text-[11px] rounded-md px-2 py-1"
          style={{ background: "#F3F4F6", color: C.inkSoft }}
        >
          Abrir →
        </a>
      </td>
    </tr>
  );
}
