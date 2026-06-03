import { useMemo, useState } from "react";
import { ChevronDown } from "@/components/icons";
import { Badge } from "@/components/ui/Badge";
import { cn } from "@/lib/utils";
import {
  cac,
  cpl,
  fmtBRL,
  fmtInt,
  fmtPct,
  fmtRoas,
  roas,
  roasCorClasse,
  roasFaixa,
  taxaQualificacao,
  type Canal,
  type OrigemDesempenho,
} from "@/services/desempenho";

type ColKey =
  | "nome"
  | "investimento"
  | "leads"
  | "cpl"
  | "qualificacao"
  | "fechados"
  | "cac"
  | "receita"
  | "roas";

interface LinhaCalculada {
  origem: OrigemDesempenho;
  cpl: number | null;
  qualificacao: number | null;
  cac: number | null;
  roas: number | null;
}

const COLS: Array<{ key: ColKey; label: string; alinhar: "left" | "right" }> = [
  { key: "nome", label: "Origem", alinhar: "left" },
  { key: "investimento", label: "Investimento", alinhar: "right" },
  { key: "leads", label: "Leads", alinhar: "right" },
  { key: "cpl", label: "CPL", alinhar: "right" },
  { key: "qualificacao", label: "% Qualif.", alinhar: "right" },
  { key: "fechados", label: "Vendas", alinhar: "right" },
  { key: "cac", label: "CAC", alinhar: "right" },
  { key: "receita", label: "Receita", alinhar: "right" },
  { key: "roas", label: "ROAS", alinhar: "right" },
];

const CANAL_LABEL: Record<Canal, string> = {
  meta: "Meta",
  google: "Google",
  organico: "Orgânico",
  outro: "Outro",
};
const CANAL_TONE: Record<Canal, "sky" | "amber" | "emerald" | "slate"> = {
  meta: "sky",
  google: "amber",
  organico: "emerald",
  outro: "slate",
};

/** Valor numérico comparável de uma coluna (null vai sempre pro fim). */
function valorOrdenacao(l: LinhaCalculada, key: ColKey): number | string | null {
  switch (key) {
    case "nome":
      return l.origem.nome.toLowerCase();
    case "investimento":
      return l.origem.investimento;
    case "leads":
      return l.origem.leads;
    case "fechados":
      return l.origem.fechados;
    case "receita":
      return l.origem.receita;
    case "cpl":
      return l.cpl;
    case "qualificacao":
      return l.qualificacao;
    case "cac":
      return l.cac;
    case "roas":
      return l.roas;
  }
}

export function TabelaOrigens({ origens }: { origens: OrigemDesempenho[] }) {
  const [sortKey, setSortKey] = useState<ColKey>("roas");
  const [asc, setAsc] = useState(false); // default ROAS desc

  const linhas = useMemo<LinhaCalculada[]>(
    () =>
      origens.map((o) => ({
        origem: o,
        cpl: cpl(o.investimento, o.leads),
        qualificacao: taxaQualificacao(o.qualificados, o.leads),
        cac: cac(o.investimento, o.fechados),
        roas: roas(o.receita, o.investimento),
      })),
    [origens],
  );

  const ordenadas = useMemo(() => {
    const arr = [...linhas];
    arr.sort((a, b) => {
      const va = valorOrdenacao(a, sortKey);
      const vb = valorOrdenacao(b, sortKey);
      // null sempre por último, independente da direção
      if (va == null && vb == null) return 0;
      if (va == null) return 1;
      if (vb == null) return -1;
      let cmp = 0;
      if (typeof va === "string" && typeof vb === "string") cmp = va.localeCompare(vb, "pt-BR");
      else cmp = (va as number) - (vb as number);
      return asc ? cmp : -cmp;
    });
    return arr;
  }, [linhas, sortKey, asc]);

  const toggle = (key: ColKey) => {
    if (key === sortKey) {
      setAsc((v) => !v);
    } else {
      setSortKey(key);
      setAsc(key === "nome"); // texto começa A→Z, números começam do maior
    }
  };

  return (
    <div className="overflow-hidden rounded-2xl border border-white/10 bg-white/5">
      <div className="border-b border-white/[0.06] px-5 py-3">
        <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-white/55">
          Desempenho por origem
        </p>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[820px] text-[12.5px]">
          <thead>
            <tr className="border-b border-white/[0.06]">
              {COLS.map((c) => {
                const ativo = c.key === sortKey;
                return (
                  <th
                    key={c.key}
                    className={cn(
                      "px-3 py-2.5 font-medium",
                      c.alinhar === "right" ? "text-right" : "text-left",
                    )}
                  >
                    <button
                      type="button"
                      onClick={() => toggle(c.key)}
                      className={cn(
                        "inline-flex items-center gap-1 transition",
                        c.alinhar === "right" && "flex-row-reverse",
                        ativo ? "text-slate-100" : "text-slate-400 hover:text-slate-200",
                      )}
                    >
                      <span className="uppercase tracking-wider text-[10.5px]">{c.label}</span>
                      <ChevronDown
                        className={cn(
                          "h-3 w-3 transition-transform",
                          ativo ? "opacity-100" : "opacity-0",
                          ativo && asc && "rotate-180",
                        )}
                      />
                    </button>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {ordenadas.map(({ origem: o, cpl: cplV, qualificacao, cac: cacV, roas: roasV }) => {
              const faixa = roasFaixa(roasV);
              return (
                <tr
                  key={o.nome}
                  className="border-b border-white/[0.04] last:border-0 hover:bg-white/[0.02]"
                >
                  <td className="px-3 py-2.5">
                    <div className="flex items-center gap-2">
                      <Badge tone={CANAL_TONE[o.canal]}>{CANAL_LABEL[o.canal]}</Badge>
                      <span className="truncate text-white/85">{o.nome}</span>
                    </div>
                  </td>
                  <td className="px-3 py-2.5 text-right tabular-nums text-white/70">{fmtBRL(o.investimento)}</td>
                  <td className="px-3 py-2.5 text-right tabular-nums text-white/70">{fmtInt(o.leads)}</td>
                  <td className="px-3 py-2.5 text-right tabular-nums text-white/70">{fmtBRL(cplV)}</td>
                  <td className="px-3 py-2.5 text-right tabular-nums text-white/70">{fmtPct(qualificacao)}</td>
                  <td className="px-3 py-2.5 text-right tabular-nums text-white/70">{fmtInt(o.fechados)}</td>
                  <td className="px-3 py-2.5 text-right tabular-nums text-white/70">{fmtBRL(cacV)}</td>
                  <td className="px-3 py-2.5 text-right tabular-nums font-medium text-white/85">{fmtBRL(o.receita)}</td>
                  <td className="px-3 py-2.5 text-right">
                    <span
                      className={cn(
                        "inline-flex min-w-[52px] justify-center rounded-md px-2 py-0.5 text-[12px] font-semibold tabular-nums ring-1 ring-inset",
                        roasCorClasse(faixa),
                      )}
                    >
                      {fmtRoas(roasV)}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
