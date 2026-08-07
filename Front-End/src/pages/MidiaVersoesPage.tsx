import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";
import { useClinic } from "@/hooks/useClinic";

/**
 * Cinco jeitos de olhar o mesmo gasto, para escolher um.
 *
 * Todas as cinco leem a MESMA fonte real (`/api/integrations/ads/spend/daily`):
 * uma linha por dia e por campanha. Nenhuma tem número de exemplo — comparar
 * layouts com dado inventado esconde justamente o que decide a escolha, que é
 * como cada um se comporta quando o dado é irregular.
 *
 * O que o gasto NÃO tem, nenhuma versão finge ter: lead, receita e ROAS por
 * campanha dependem de atribuição CTWA, que não existe. Onde isso aparece, é
 * como ausência declarada.
 */

interface Dia {
  date: string;
  provider: string;
  campaign_id: string;
  campaign_name?: string | null;
  spend: number;
  impressions: number;
  clicks: number;
  conversations: number;
}

const moeda = (v: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 }).format(v);
const moedaC = (v: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: 2 }).format(v);
const num = (v: number) => new Intl.NumberFormat("pt-BR").format(v);
const dia = (iso: string) => iso.slice(8, 10) + "/" + iso.slice(5, 7);

const VERSOES = [
  { id: 1, nome: "Linha do tempo", pitch: "o eixo é o dia; o mês tem formato" },
  { id: 2, nome: "Extrato", pitch: "uma linha por dia, com saldo acumulado" },
  { id: 3, nome: "Corrida", pitch: "campanhas como pistas, largura = gasto" },
  { id: 4, nome: "Mesa de leitura", pitch: "o que se sabe e o que falta, lado a lado" },
  { id: 5, nome: "Cartazes", pitch: "para projetar numa reunião" },
] as const;

export default function MidiaVersoesPage() {
  const { tenantId: clinicId } = useClinic();
  const [versao, setVersao] = useState(2);
  const [dias, setDias] = useState(60);

  const { from, to } = useMemo(() => {
    const fim = new Date();
    const ini = new Date(fim.getTime() - dias * 86400_000);
    const iso = (d: Date) => d.toISOString().slice(0, 10);
    return { from: iso(ini), to: iso(fim) };
  }, [dias]);

  const { data, isLoading } = useQuery<Dia[]>({
    queryKey: ["spend-daily", clinicId, from, to],
    queryFn: async () =>
      (await api.get("/api/integrations/ads/spend/daily", { params: { clinicId, from, to } })).data
        ?.items ?? [],
    enabled: !!clinicId,
  });

  const linhas = data ?? [];

  return (
    <div className="mx-auto max-w-5xl px-5 py-8">
      <header className="border-b border-white/[0.08] pb-4">
        <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-600">
          Desempenho de mídia · versões
        </p>
        <h1 className="mt-2 text-[22px] font-medium tracking-tight text-slate-100">
          Escolha um formato
        </h1>
        <p className="mt-1.5 max-w-[70ch] text-[12px] leading-relaxed text-slate-500">
          As cinco leem o mesmo dado real do período. Gasto, impressões e cliques vêm da Meta,
          por dia e por campanha. Lead, receita e ROAS não existem por campanha — nenhuma versão
          finge que existem.
        </p>

        <div className="mt-4 flex flex-wrap items-center gap-1">
          {VERSOES.map((v) => (
            <button
              key={v.id}
              onClick={() => setVersao(v.id)}
              className={cn(
                "rounded-md border px-3 py-1.5 text-left text-[12px] transition",
                versao === v.id
                  ? "border-sky-400/40 bg-sky-400/10 text-sky-100"
                  : "border-white/[0.07] text-slate-500 hover:border-white/15 hover:text-slate-300",
              )}
            >
              <span className="font-mono text-[10px] text-slate-600">{v.id}</span> {v.nome}
            </button>
          ))}
          <span className="ml-auto flex gap-1">
            {[30, 60, 90].map((d) => (
              <button
                key={d}
                onClick={() => setDias(d)}
                className={cn(
                  "border-b-2 px-2 pb-1 text-[11.5px] transition",
                  dias === d
                    ? "border-slate-400 text-slate-200"
                    : "border-transparent text-slate-600 hover:text-slate-400",
                )}
              >
                {d}d
              </button>
            ))}
          </span>
        </div>
        <p className="mt-2 text-[11px] text-slate-600">
          {VERSOES.find((v) => v.id === versao)?.pitch}
        </p>
      </header>

      {isLoading && <p className="mt-8 text-[13px] text-slate-600">carregando o gasto…</p>}
      {!isLoading && linhas.length === 0 && (
        <p className="mt-8 max-w-[60ch] text-[13px] leading-relaxed text-slate-500">
          Nenhum gasto gravado neste período. A Central de Integrações grava o que o n8n puxa
          da Meta; se a conta acabou de ser ligada, o primeiro sync ainda não rodou.
        </p>
      )}

      {linhas.length > 0 && (
        <div className="mt-7">
          {versao === 1 && <V1Timeline linhas={linhas} />}
          {versao === 2 && <V2Extrato linhas={linhas} />}
          {versao === 3 && <V3Corrida linhas={linhas} />}
          {versao === 4 && <V4Mesa linhas={linhas} />}
          {versao === 5 && <V5Cartazes linhas={linhas} />}
        </div>
      )}
    </div>
  );
}

// ─── Agregações compartilhadas ──────────────────────────────────────────────

function porDia(linhas: Dia[]) {
  const m = new Map<string, { gasto: number; impr: number; cliques: number; itens: Dia[] }>();
  for (const l of linhas) {
    const e = m.get(l.date) ?? { gasto: 0, impr: 0, cliques: 0, itens: [] };
    e.gasto += l.spend;
    e.impr += l.impressions;
    e.cliques += l.clicks;
    e.itens.push(l);
    m.set(l.date, e);
  }
  return [...m.entries()].sort((a, b) => a[0].localeCompare(b[0]));
}

function porCampanha(linhas: Dia[]) {
  const m = new Map<string, { nome: string; gasto: number; impr: number; cliques: number }>();
  for (const l of linhas) {
    const k = l.campaign_id;
    const e = m.get(k) ?? { nome: l.campaign_name?.trim() || `Campanha ${k}`, gasto: 0, impr: 0, cliques: 0 };
    e.gasto += l.spend;
    e.impr += l.impressions;
    e.cliques += l.clicks;
    m.set(k, e);
  }
  return [...m.entries()].map(([id, c]) => ({ id, ...c })).sort((a, b) => b.gasto - a.gasto);
}

// ─── 1 · Linha do tempo ─────────────────────────────────────────────────────

function V1Timeline({ linhas }: { linhas: Dia[] }) {
  const dias = porDia(linhas);
  const [aberto, setAberto] = useState<string | null>(null);
  const maior = Math.max(1, ...dias.map((d) => d[1].gasto));
  const total = dias.reduce((s, d) => s + d[1].gasto, 0);

  return (
    <div>
      <div className="flex items-baseline justify-between">
        <p className="font-mono text-[24px] tabular-nums text-slate-100">{moedaC(total)}</p>
        <p className="text-[11px] text-slate-600">
          {dias.length} dias com entrega · clique numa barra
        </p>
      </div>

      {/* A altura é o gasto; a cor é o CPM. Dia caro fica claro sem legenda. */}
      <div className="mt-5 flex h-[120px] items-end gap-[3px]">
        {dias.map(([d, v]) => {
          const cpm = v.impr > 0 ? (v.gasto / v.impr) * 1000 : 0;
          return (
            <button
              key={d}
              onClick={() => setAberto(aberto === d ? null : d)}
              title={`${dia(d)} · ${moedaC(v.gasto)}`}
              className="group relative flex-1"
              style={{ height: `${Math.max(4, (v.gasto / maior) * 100)}%` }}
            >
              <span
                className={cn(
                  "block h-full w-full rounded-sm transition",
                  aberto === d
                    ? "bg-sky-300"
                    : cpm > 12
                      ? "bg-amber-400/55 group-hover:bg-amber-300/80"
                      : "bg-sky-400/40 group-hover:bg-sky-300/70",
                )}
              />
            </button>
          );
        })}
      </div>
      <div className="mt-1.5 flex justify-between text-[10px] tabular-nums text-slate-600">
        <span>{dia(dias[0][0])}</span>
        <span className="text-slate-700">barra âmbar = CPM acima de R$ 12</span>
        <span>{dia(dias[dias.length - 1][0])}</span>
      </div>

      {aberto && (
        <div className="mt-5 rounded-lg border border-white/[0.07] bg-white/[0.02] p-4">
          <p className="text-[12px] text-slate-300">
            {dia(aberto)} ·{" "}
            <span className="font-mono tabular-nums">
              {moedaC(dias.find((d) => d[0] === aberto)![1].gasto)}
            </span>
          </p>
          <ul className="mt-2.5 flex flex-col gap-1.5">
            {dias
              .find((d) => d[0] === aberto)![1]
              .itens.sort((a, b) => b.spend - a.spend)
              .map((i) => (
                <li key={i.campaign_id} className="flex items-baseline justify-between gap-4 text-[12px]">
                  <span className="min-w-0 truncate text-slate-400">
                    {i.campaign_name?.trim() || i.campaign_id}
                  </span>
                  <span className="shrink-0 font-mono tabular-nums text-slate-200">
                    {moedaC(i.spend)}
                  </span>
                </li>
              ))}
          </ul>
        </div>
      )}
    </div>
  );
}

// ─── 2 · Extrato ────────────────────────────────────────────────────────────

function V2Extrato({ linhas }: { linhas: Dia[] }) {
  const [busca, setBusca] = useState("");

  // Acumulado é calculado do mais antigo pro mais novo, e a tabela é exibida ao
  // contrário — senão o saldo cresceria de baixo pra cima e não faria sentido.
  const comAcumulado = useMemo(() => {
    const cres = [...linhas].sort((a, b) => a.date.localeCompare(b.date));
    let acum = 0;
    return cres
      .map((l) => {
        acum += l.spend;
        return { ...l, acum };
      })
      .reverse();
  }, [linhas]);

  const filtradas = useMemo(() => {
    const q = busca.trim().toLowerCase();
    if (!q) return comAcumulado;
    // Aceita "06/08", "2026-08-06" ou pedaço do nome da campanha.
    const comoData = q.replace(/[^\d]/g, "");
    return comAcumulado.filter((l) => {
      const nome = (l.campaign_name ?? "").toLowerCase();
      const dmy = l.date.slice(8, 10) + l.date.slice(5, 7) + l.date.slice(0, 4);
      return nome.includes(q) || l.date.includes(q) || (comoData.length >= 2 && dmy.startsWith(comoData));
    });
  }, [comAcumulado, busca]);

  const soma = filtradas.reduce((s, l) => s + l.spend, 0);

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <input
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          placeholder="buscar por data (06/08) ou campanha (RMKT)"
          className="w-full max-w-[340px] rounded-md border border-white/[0.09] bg-white/[0.02] px-3 py-1.5 font-mono text-[12px] text-slate-200 outline-none placeholder:text-slate-600 focus:border-white/20"
        />
        <p className="font-mono text-[13px] tabular-nums text-slate-300">
          {moedaC(soma)}
          <span className="ml-2 font-sans text-[11px] text-slate-600">
            em {filtradas.length} linha{filtradas.length === 1 ? "" : "s"}
          </span>
        </p>
      </div>

      <div className="mt-4 overflow-x-auto">
        <table className="w-full text-[12px]">
          <thead>
            <tr className="border-b border-white/[0.08] text-[10px] uppercase tracking-[0.1em] text-slate-600">
              <th className="py-2 pr-3 text-left font-medium">Data</th>
              <th className="py-2 pr-3 text-left font-medium">Campanha</th>
              <th className="py-2 pr-3 text-right font-medium">Gasto</th>
              <th className="py-2 pr-3 text-right font-medium">Impr.</th>
              <th className="py-2 pr-3 text-right font-medium">Cliques</th>
              <th className="py-2 pr-3 text-right font-medium">CPC</th>
              <th className="py-2 text-right font-medium">Acum.</th>
            </tr>
          </thead>
          <tbody className="font-mono tabular-nums">
            {filtradas.slice(0, 120).map((l, i) => (
              <tr
                key={`${l.date}-${l.campaign_id}-${i}`}
                className="border-b border-white/[0.03] hover:bg-white/[0.02]"
              >
                <td className="py-1.5 pr-3 text-slate-400">{dia(l.date)}</td>
                <td className="max-w-[240px] truncate py-1.5 pr-3 font-sans text-slate-300">
                  {l.campaign_name?.trim() || l.campaign_id}
                </td>
                <td className="py-1.5 pr-3 text-right text-slate-100">{moedaC(l.spend)}</td>
                <td className="py-1.5 pr-3 text-right text-slate-500">{num(l.impressions)}</td>
                <td className="py-1.5 pr-3 text-right text-slate-500">{num(l.clicks)}</td>
                <td className="py-1.5 pr-3 text-right text-slate-400">
                  {l.clicks > 0 ? moedaC(l.spend / l.clicks) : "—"}
                </td>
                <td className="py-1.5 text-right text-slate-600">{moeda(l.acum)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {filtradas.length > 120 && (
          <p className="mt-2 text-[11px] text-slate-600">
            mostrando as 120 primeiras de {filtradas.length} — refine a busca.
          </p>
        )}
      </div>
    </div>
  );
}

// ─── 3 · Corrida ────────────────────────────────────────────────────────────

function V3Corrida({ linhas }: { linhas: Dia[] }) {
  const camps = porCampanha(linhas);
  const maior = Math.max(1, ...camps.map((c) => c.gasto));

  return (
    <ul className="flex flex-col gap-4">
      {camps.map((c) => {
        const cpc = c.cliques > 0 ? c.gasto / c.cliques : null;
        const ctr = c.impr > 0 ? (c.cliques / c.impr) * 100 : 0;
        return (
          <li key={c.id}>
            <div className="flex items-baseline justify-between gap-4">
              <span className="min-w-0 truncate text-[12.5px] text-slate-200">{c.nome}</span>
              <span className="shrink-0 font-mono text-[13px] tabular-nums text-slate-100">
                {moeda(c.gasto)}
              </span>
            </div>
            <div className="relative mt-1.5 h-[7px] rounded-full bg-white/[0.05]">
              <span
                className="absolute inset-y-0 left-0 rounded-full bg-sky-400/45"
                style={{ width: `${(c.gasto / maior) * 100}%` }}
              />
              {/* O losango é o CPC: posição relativa ao mais caro da lista. */}
              {cpc != null && (
                <span
                  className="absolute top-1/2 h-2 w-2 -translate-x-1/2 -translate-y-1/2 rotate-45 bg-amber-300"
                  style={{ left: `${Math.min(100, (c.gasto / maior) * 100)}%` }}
                />
              )}
            </div>
            <p className="mt-1 flex gap-4 font-mono text-[10.5px] tabular-nums text-slate-600">
              <span>CPC {cpc != null ? moedaC(cpc) : "—"}</span>
              <span>CTR {ctr.toFixed(2)}%</span>
              <span>{num(c.cliques)} cliques</span>
            </p>
          </li>
        );
      })}
    </ul>
  );
}

// ─── 4 · Mesa de leitura ────────────────────────────────────────────────────

function V4Mesa({ linhas }: { linhas: Dia[] }) {
  const camps = porCampanha(linhas);
  const gasto = camps.reduce((s, c) => s + c.gasto, 0);
  const impr = camps.reduce((s, c) => s + c.impr, 0);
  const cliques = camps.reduce((s, c) => s + c.cliques, 0);
  const conversas = linhas.reduce((s, l) => s + l.conversations, 0);

  return (
    <div className="grid gap-5 md:grid-cols-2">
      <section className="rounded-lg border border-white/[0.07] bg-white/[0.02] p-5">
        <h3 className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500">
          O que se sabe
        </h3>
        <dl className="mt-4 flex flex-col gap-3.5">
          <Fato n={moedaC(gasto)} r="investidos no período" />
          <Fato n={num(impr)} r="impressões" />
          <Fato n={`${num(cliques)} · CTR ${impr > 0 ? ((cliques / impr) * 100).toFixed(2) : "0"}%`} r="cliques" />
          <Fato n={cliques > 0 ? moedaC(gasto / cliques) : "—"} r="custo por clique" />
          <Fato n={String(camps.length)} r="campanhas com entrega" />
        </dl>
      </section>

      <section className="rounded-lg border border-amber-400/[0.18] bg-amber-400/[0.03] p-5">
        <h3 className="text-[10px] font-semibold uppercase tracking-[0.14em] text-amber-300/70">
          O que falta
        </h3>
        <ul className="mt-4 flex flex-col gap-4 text-[12.5px] leading-relaxed">
          {conversas === 0 && (
            <li>
              <p className="text-slate-200">Conversas por campanha</p>
              <p className="mt-0.5 text-slate-500">
                A Meta tem o número e a página Mídia o mostra ao vivo. O sync que grava aqui
                escreve zero — é conserto no sync, não falta de dado.
              </p>
            </li>
          )}
          <li>
            <p className="text-slate-200">Leads por campanha</p>
            <p className="mt-0.5 text-slate-500">
              Depende de gravar o referral da CTWA no cartão quando a mensagem chega. Nenhum
              lead da unidade carrega id de anúncio hoje.
            </p>
          </li>
          <li>
            <p className="text-slate-200">Receita e ROAS</p>
            <p className="mt-0.5 text-slate-500">
              Dependem do item acima: sem lead ligado à campanha, não há venda para atribuir.
            </p>
          </li>
        </ul>
      </section>
    </div>
  );
}

function Fato({ n, r }: { n: string; r: string }) {
  return (
    <div>
      <dt className="font-mono text-[19px] leading-none tabular-nums text-slate-100">{n}</dt>
      <dd className="mt-1 text-[11px] text-slate-600">{r}</dd>
    </div>
  );
}

// ─── 5 · Cartazes ───────────────────────────────────────────────────────────

function V5Cartazes({ linhas }: { linhas: Dia[] }) {
  const camps = porCampanha(linhas);
  const total = camps.reduce((s, c) => s + c.gasto, 0);

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {camps.map((c) => {
        const fatia = total > 0 ? Math.round((c.gasto / total) * 100) : 0;
        return (
          <article
            key={c.id}
            className="flex flex-col overflow-hidden rounded-lg border border-white/[0.07] bg-white/[0.02]"
          >
            {/* Sem criativo por campanha nesta fonte: o lugar da imagem mostra a
                fatia do orçamento, que é o que a campanha "é" aqui. */}
            <div className="relative grid h-[92px] place-items-center bg-white/[0.03]">
              <span className="font-mono text-[30px] leading-none tabular-nums text-slate-200">
                {fatia}
                <span className="text-[15px] text-slate-500">%</span>
              </span>
              <span className="absolute inset-x-0 bottom-0 h-[3px] bg-white/[0.06]">
                <span className="block h-full bg-sky-400/50" style={{ width: `${fatia}%` }} />
              </span>
            </div>
            <div className="flex flex-1 flex-col justify-between p-3.5">
              <p className="text-[12px] leading-snug text-slate-200">{c.nome}</p>
              <div className="mt-3">
                <p className="font-mono text-[20px] leading-none tabular-nums text-slate-100">
                  {moeda(c.gasto)}
                </p>
                <p className="mt-1.5 font-mono text-[10.5px] tabular-nums text-slate-600">
                  {num(c.cliques)} cliques · CPC{" "}
                  {c.cliques > 0 ? moedaC(c.gasto / c.cliques) : "—"}
                </p>
              </div>
            </div>
          </article>
        );
      })}
    </div>
  );
}
