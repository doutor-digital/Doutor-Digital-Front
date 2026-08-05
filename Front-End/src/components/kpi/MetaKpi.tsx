import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, X } from "@/components/icons";
import { useKpiOverrides } from "@/hooks/useKpiOverrides";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";

interface Meta {
  kpiKey: string;
  metaMensal: number;
  definidaPor?: string | null;
  atualizadaEm?: string | null;
}

interface MetasResposta {
  unitId: number;
  metas: Meta[];
  podeEditar: boolean;
}

/**
 * Metas da unidade. Uma consulta só, compartilhada por todos os cards.
 */
export function useMetas(unitId?: number | null) {
  return useQuery({
    queryKey: ["kpi-metas", unitId],
    queryFn: async () => {
      const { data } = await api.get<MetasResposta>("/api/config/kpi-goals", {
        params: { unitId },
      });
      return data;
    },
    enabled: !!unitId,
    staleTime: 5 * 60_000,
  });
}

/**
 * Quanto do mês já passou, contando o dia de hoje.
 *
 * É a régua do ritmo: no dia 5 de um mês de 31, 16% do mês passou, então 16% da meta é o
 * que estaria "em dia". Sem isso a meta só serve no dia 31 — e no dia 31 não dá mais para
 * reagir, que é justamente quando ela precisaria ter servido.
 */
function fracaoDoMesDecorrida(hoje = new Date()): number {
  const diasNoMes = new Date(hoje.getFullYear(), hoje.getMonth() + 1, 0).getDate();
  return Math.min(1, hoje.getDate() / diasNoMes);
}

/**
 * Meta ao lado do número.
 *
 * O dashboard mostrava 22 leads sem dizer se 22 é bom. Quem lê preenche esse vazio com
 * impressão — e impressão de gerente e de SDR raramente coincidem. A meta transforma o
 * número em pergunta respondível.
 *
 * MOSTRA RITMO, NÃO SÓ ALVO
 * -------------------------
 * "22 de 200" no dia 5 parece fracasso e está adiantado. Ao lado do total vai o que já
 * deveria estar feito a esta altura do mês, e a cor sai daí — não do quanto falta.
 *
 * SÓ APARECE NO MÊS CORRENTE
 * --------------------------
 * Meta mensal embaixo de um número filtrado por dia, semana ou por um mês passado seria
 * comparação errada com cara de certa. Nesses filtros o bloco some inteiro.
 */
export function MetaKpi({
  unitId,
  kpiKey,
  okey,
  valor,
  ativo,
  formato = (n) => new Intl.NumberFormat("pt-BR").format(n),
}: {
  unitId?: number | null;
  /** Mesma chave do KPI no back (ex.: "agendados"). */
  kpiKey: string;
  /**
   * Chave do override manual do card. A meta compara contra o número que a pessoa
   * está VENDO — se o admin corrigiu o valor à mão, comparar com o automático mostraria
   * uma barra que não bate com o número logo acima dela.
   */
  okey?: string;
  /** Valor corrente do card (automático). */
  valor: number;
  /** Falso quando o filtro não é o mês corrente — aí não há meta comparável. */
  ativo: boolean;
  formato?: (n: number) => string;
}) {
  const qc = useQueryClient();
  const { data } = useMetas(unitId);
  const override = useKpiOverrides((s) => (okey ? s.overrides[okey] : undefined));
  const [editando, setEditando] = useState(false);
  const [rascunho, setRascunho] = useState("");

  const salvar = useMutation({
    mutationFn: async (metaMensal: number) => {
      await api.put(`/api/config/kpi-goals?unitId=${unitId}`, { kpiKey, metaMensal });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["kpi-metas", unitId] });
      setEditando(false);
    },
  });

  if (!ativo || !data) return null;

  const meta = data.metas.find((m) => m.kpiKey === kpiKey)?.metaMensal ?? 0;

  if (editando) {
    return (
      <div className="mt-3 flex items-center gap-1.5">
        <input
          type="number"
          autoFocus
          value={rascunho}
          placeholder="Meta do mês"
          onChange={(e) => setRascunho(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") salvar.mutate(Number(rascunho) || 0);
            if (e.key === "Escape") setEditando(false);
          }}
          className="w-full rounded-lg border border-white/10 bg-white/5 px-2.5 py-1 text-[12px] text-white outline-none focus:border-emerald-400/50"
        />
        <button
          type="button"
          onClick={() => salvar.mutate(Number(rascunho) || 0)}
          title="Salvar meta (0 remove)"
          className="shrink-0 rounded-lg bg-emerald-500/80 p-1.5 text-white hover:bg-emerald-500"
        >
          <Check className="h-3.5 w-3.5" />
        </button>
        <button
          type="button"
          onClick={() => setEditando(false)}
          className="shrink-0 rounded-lg border border-white/10 bg-white/5 p-1.5 text-white/70 hover:bg-white/10"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
    );
  }

  if (meta <= 0) {
    // Sem meta: só quem pode definir vê o convite. Para os outros seria um botão morto.
    if (!data.podeEditar) return null;
    return (
      <button
        type="button"
        onClick={() => {
          setRascunho("");
          setEditando(true);
        }}
        className="mt-3 text-[10.5px] text-white/30 underline decoration-dotted underline-offset-2 transition hover:text-white/70"
      >
        definir meta do mês
      </button>
    );
  }

  const atual = override ?? valor;
  const progresso = Math.min(1, atual / meta);
  const esperado = meta * fracaoDoMesDecorrida();
  // A cor sai do ritmo, não do quanto falta: no dia 5 faltar 90% da meta é normal.
  const emDia = atual >= esperado;
  const quaseLa = !emDia && atual >= esperado * 0.8;

  const cor = emDia
    ? "bg-emerald-400"
    : quaseLa
      ? "bg-amber-400"
      : "bg-rose-400";

  return (
    <div className="mt-3">
      <div className="h-1 w-full overflow-hidden rounded-full bg-white/[0.07]">
        <div
          className={cn("h-full rounded-full transition-[width]", cor)}
          style={{ width: `${Math.max(2, progresso * 100)}%` }}
        />
      </div>

      <div className="mt-1.5 flex items-baseline justify-between gap-2 text-[10.5px]">
        <span className="text-white/45 tabular-nums">
          meta {formato(meta)}
          <span className="mx-1 text-white/20">·</span>
          {/* O número que faz a barra ter sentido no dia 5. */}
          esperado {formato(Math.round(esperado))}
        </span>
        <span
          className={cn(
            "shrink-0 font-medium tabular-nums",
            emDia ? "text-emerald-300/90" : quaseLa ? "text-amber-300/90" : "text-rose-300/90",
          )}
        >
          {Math.round(progresso * 100)}%
        </span>
      </div>

      {data.podeEditar && (
        <button
          type="button"
          onClick={() => {
            setRascunho(String(meta));
            setEditando(true);
          }}
          className="mt-1 text-[10px] text-white/25 transition hover:text-white/60"
        >
          alterar
        </button>
      )}
    </div>
  );
}
