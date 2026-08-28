import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { redeComparativo } from "@/services/spine";
import { cn } from "@/lib/utils";

const nf = new Intl.NumberFormat("pt-BR");

/**
 * A Rede: as 20 clínicas numa tela só, com quatro números cada.
 *
 * POR QUE ELA EXISTE
 * ------------------
 * O dashboard tem 55 páginas. Nenhuma respondia "como está a rede hoje" sem abrir
 * unidade por unidade — que é justamente o trabalho manual que não escala para 20
 * clínicas, muito menos para 60. Esta página é uma chamada de API e uma tabela.
 *
 * POR QUE SÓ QUATRO NÚMEROS
 * -------------------------
 * Agendados, consultas, faltas e tratamentos. Os quatro vêm do CRM da franquia —
 * do sistema onde o fato acontece — e nenhum depende de alguém arrastar card ou
 * preencher campo. É por isso que dá para publicar este número para a equipe sem
 * medo: ele não muda porque a SDR esqueceu de mover algo.
 *
 * O QUE FOI DEIXADO DE FORA, DE PROPÓSITO
 * ---------------------------------------
 * Sem gráfico, sem sparkline, sem tendência, sem meta. Tudo isso já existe nas
 * outras telas para quem quiser investigar. Aqui a pergunta é uma só — "quem está
 * bem e quem não está" — e a resposta tem que caber num relance.
 *
 * UNIDADE SEM TOKEN NÃO VIRA ZERO
 * -------------------------------
 * Ela sai da tabela e aparece embaixo, nomeada, como pendência de conexão. Zero
 * mentiria: diria que a clínica não agendou nada, quando na verdade nós é que não
 * estamos enxergando. Mesma regra para unidade cujo token falhou.
 */
export default function RedePage() {
  const [dias, setDias] = useState(30);

  const { de, ate } = useMemo(() => {
    const iso = (d: Date) => d.toISOString().slice(0, 10);
    const fim = new Date();
    const ini = new Date(fim.getTime() - dias * 24 * 3600_000);
    return { de: iso(ini), ate: iso(fim) };
  }, [dias]);

  const { data, isLoading, isError } = useQuery({
    queryKey: ["rede-comparativo", de, ate],
    queryFn: () => redeComparativo(de, ate),
  });

  const totais = data?.totais;
  const linhas = data?.unidades ?? [];
  const comErro = linhas.filter((u) => u.erro);
  const ok = linhas.filter((u) => !u.erro);

  // O teto do gráfico de barras é a maior unidade — comparação é entre elas,
  // não contra um alvo que ninguém definiu.
  const maiorAgenda = Math.max(1, ...ok.map((u) => u.agendadas));

  return (
    <div className="mx-auto max-w-5xl px-5 py-8">
      <header className="border-b border-white/[0.08] pb-5">
        <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-600">
          A rede
        </p>
        <h1 className="mt-2 text-[22px] font-medium tracking-tight text-slate-100">
          Como estão as clínicas
        </h1>
        <p className="mt-1.5 max-w-[62ch] text-[13px] leading-relaxed text-slate-500">
          Tudo nesta tela vem do CRM da franquia — da agenda onde a consulta
          acontece. Nenhum número aqui depende de card movido à mão.
        </p>

        <div className="mt-4 flex gap-1">
          {[7, 30, 90].map((d) => (
            <button
              key={d}
              onClick={() => setDias(d)}
              className={cn(
                "border-b-2 px-2 pb-1 text-[12px] transition",
                dias === d
                  ? "border-slate-400 text-slate-200"
                  : "border-transparent text-slate-600 hover:text-slate-400",
              )}
            >
              {d} dias
            </button>
          ))}
        </div>
      </header>

      {/* ─── Os quatro totais da rede ─────────────────────────────────────── */}
      <section className="grid grid-cols-2 gap-px border-b border-white/[0.08] bg-white/[0.06] sm:grid-cols-4">
        {[
          { rotulo: "Agendados", valor: totais?.agendadas, pe: "horários marcados" },
          { rotulo: "Consultas", valor: totais?.compareceram, pe: "pacientes que vieram" },
          {
            rotulo: "Tratamentos",
            valor: totais?.tratamentos,
            pe: "lançados no período",
          },
          {
            rotulo: "Comparecimento",
            valor: totais?.taxaComparecimento,
            pe: `média de ${totais?.unidades ?? 0} unidades`,
            pct: true,
          },
        ].map((t) => (
          <div key={t.rotulo} className="bg-[#0b0f16] px-4 py-5">
            <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-600">
              {t.rotulo}
            </p>
            <p className="mt-2 font-mono text-[26px] leading-none tabular-nums text-slate-200">
              {isLoading || t.valor == null
                ? "—"
                : t.pct
                  ? `${nf.format(t.valor)}%`
                  : nf.format(t.valor)}
            </p>
            <p className="mt-1.5 text-[11px] text-slate-600">{t.pe}</p>
          </div>
        ))}
      </section>

      {isError && (
        <p className="py-10 text-center text-[13px] text-rose-400">
          Não consegui falar com a franquia agora. Tente de novo em instantes.
        </p>
      )}

      {/* ─── Uma linha por clínica ────────────────────────────────────────── */}
      <table className="w-full border-collapse text-[13px]">
        <thead>
          <tr className="text-[10px] uppercase tracking-[0.14em] text-slate-600">
            <th className="py-3 pr-3 text-left font-semibold">Unidade</th>
            <th className="px-3 py-3 text-right font-semibold">Agendados</th>
            <th className="px-3 py-3 text-right font-semibold">Consultas</th>
            <th className="px-3 py-3 text-right font-semibold">Faltas</th>
            <th className="px-3 py-3 text-right font-semibold">Tratam.</th>
            <th className="py-3 pl-3 text-right font-semibold">Comparec.</th>
          </tr>
        </thead>
        <tbody>
          {isLoading && (
            <tr>
              <td colSpan={6} className="py-10 text-center text-[13px] text-slate-600">
                carregando a rede…
              </td>
            </tr>
          )}

          {ok.map((u) => (
            <tr key={u.unitId} className="border-t border-white/[0.05]">
              <td className="py-3 pr-3">
                <span className="text-slate-300">{u.unidade}</span>
                {/* A barra mede o tamanho da agenda: sem ela, uma clínica de 20
                    horários e outra de 200 parecem do mesmo porte na tabela. */}
                <span className="mt-1.5 block h-[2px] w-full max-w-[180px] bg-white/[0.05]">
                  <span
                    className="block h-full bg-slate-600"
                    style={{ width: `${(u.agendadas / maiorAgenda) * 100}%` }}
                  />
                </span>
              </td>
              <td className="px-3 text-right font-mono tabular-nums text-slate-300">
                {nf.format(u.agendadas)}
              </td>
              <td className="px-3 text-right font-mono tabular-nums text-slate-300">
                {nf.format(u.compareceram)}
              </td>
              <td className="px-3 text-right font-mono tabular-nums text-slate-500">
                {nf.format(u.naoCompareceram)}
              </td>
              {/* `?? 0` porque o campo é novo: se o front subir antes da API, a
                  célula mostra 0 em vez de NaN até o rollout do back terminar. */}
              <td className="px-3 text-right font-mono tabular-nums text-slate-300">
                {nf.format(u.tratamentos ?? 0)}
              </td>
              {/* Abaixo de 60% de comparecimento a agenda está sendo desperdiçada;
                  é o único lugar da tela com cor, para o olho cair nele. */}
              <td
                className={cn(
                  "pl-3 text-right font-mono tabular-nums",
                  u.taxaComparecimento < 60 ? "text-amber-400" : "text-slate-300",
                )}
              >
                {nf.format(u.taxaComparecimento)}%
              </td>
            </tr>
          ))}

          {comErro.map((u) => (
            <tr key={u.unitId} className="border-t border-white/[0.05]">
              <td className="py-3 pr-3 text-slate-500">{u.unidade}</td>
              <td colSpan={5} className="pl-3 text-right text-[12px] text-slate-600">
                {u.erro}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* ─── Quem ainda não conectou ──────────────────────────────────────── */}
      {!!data?.semToken.length && (
        <footer className="mt-8 border-t border-white/[0.08] pt-5">
          <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-600">
            Ainda não conectaram a franquia
          </p>
          <p className="mt-2 text-[13px] leading-relaxed text-slate-500">
            {data.semToken.map((u) => u.unidade).join(" · ")}
          </p>
          <p className="mt-2 text-[12px] text-slate-600">
            Estas {data.semToken.length === 1 ? "não aparece" : "não aparecem"} acima
            porque falta o token do Doutor Hérnia — cada unidade cola o seu na Central
            de Integrações.
          </p>
        </footer>
      )}
    </div>
  );
}
