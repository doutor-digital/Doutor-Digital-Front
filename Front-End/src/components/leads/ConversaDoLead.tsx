import { useMemo, useRef, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";

/**
 * A conversa do lead com a atendente virtual, e a leitura dela por uma I.A.
 * no papel de supervisora de SDR.
 *
 * A ANÁLISE APONTA PARA A MENSAGEM, NÃO PARA UMA CITAÇÃO
 * ------------------------------------------------------
 * Toda afirmação da I.A. carrega o número de uma mensagem real. Clicar rola até
 * ela e a acende. É isso que separa "a I.A. disse" de "está aqui, olha": quem
 * lê confere em um clique, e uma conclusão sem mensagem que a sustente não
 * chega a aparecer — o back derruba antes.
 *
 * O SILÊNCIO É DESENHADO
 * ----------------------
 * Hora parada entre uma mensagem e outra vira uma linha no meio da conversa. Num
 * atendimento, o intervalo costuma explicar o desfecho melhor que as palavras.
 */

interface Mensagem {
  numero: number;
  deQuem: "paciente" | "atendente";
  texto: string;
  em: string;
}

interface Conversa {
  conversaId: number;
  agente?: string | null;
  canal?: string | null;
  status?: string | null;
  passouPraHumano: boolean;
  contato?: string | null;
  inicio: string;
  ultimaMensagem?: string | null;
  mensagens: Mensagem[];
}

interface Ponto {
  msg?: number | null;
  oQue: string;
  emVezDisso?: string | null;
}

interface ItemChecklist {
  item: string;
  feito: boolean;
  msg?: number | null;
}

interface Analise {
  nota?: number | null;
  leitura: string;
  desfecho: "agendou" | "nao_agendou" | "em_aberto";
  viradaMsg?: number | null;
  viradaPorque?: string | null;
  acertos: Ponto[];
  falhas: Ponto[];
  checklist: ItemChecklist[];
  analisadaEm: string;
  mensagensAnalisadas: number;
  doCache: boolean;
}

const relogio = (iso: string) =>
  new Date(iso).toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });

function intervalo(min: number): string {
  if (min < 60) return `${Math.round(min)} min`;
  if (min < 1440) return `${Math.round(min / 60)}h`;
  return `${Math.round(min / 1440)} dia${min >= 2880 ? "s" : ""}`;
}

export function ConversaDoLead({ leadId }: { leadId: number }) {
  const [aceso, setAceso] = useState<number | null>(null);
  const balões = useRef<Record<number, HTMLLIElement | null>>({});

  const { data: conversa, isLoading, error } = useQuery<Conversa>({
    queryKey: ["conversa-lead", leadId],
    queryFn: async () => (await api.get(`/api/leads/${leadId}/conversa`)).data,
    retry: false,
  });

  const analise = useMutation<Analise, Error, boolean>({
    mutationFn: async (forcar) =>
      (await api.post(`/api/leads/${leadId}/conversa/analise`, null, { params: { forcar } })).data,
  });

  function irPara(n?: number | null) {
    if (!n) return;
    setAceso(n);
    balões.current[n]?.scrollIntoView({ behavior: "smooth", block: "center" });
  }

  const comIntervalo = useMemo(() => {
    const msgs = conversa?.mensagens ?? [];
    return msgs.map((m, i) => {
      const antes = i > 0 ? msgs[i - 1] : null;
      const gap = antes ? (+new Date(m.em) - +new Date(antes.em)) / 60000 : 0;
      return { ...m, silencio: gap >= 60 ? gap : 0 };
    });
  }, [conversa]);

  if (isLoading) {
    return <p className="text-[12.5px] text-white/40">carregando a conversa…</p>;
  }

  if (error || !conversa) {
    return (
      <p className="max-w-[62ch] text-[12.5px] leading-relaxed text-white/45">
        Sem conversa registrada para este lead. A atendente virtual grava a conversa quando
        atende pelo WhatsApp — leads que entraram por outro caminho, ou antes de ela assumir a
        unidade, não têm histórico aqui.
      </p>
    );
  }

  const r = analise.data;

  return (
    <div className="flex flex-col gap-4">
      {/* ─── Cabeçalho + gatilho ────────────────────────────────────── */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-[11px] text-white/40">
          {conversa.mensagens.length} mensagens · {conversa.canal ?? "whatsapp"} ·{" "}
          {relogio(conversa.inicio)}
          {conversa.passouPraHumano && (
            <span className="ml-2 rounded bg-amber-400/15 px-1.5 py-0.5 text-[10px] text-amber-200">
              passou para atendente humano
            </span>
          )}
        </p>

        <button
          onClick={() => analise.mutate(!!r)}
          disabled={analise.isPending}
          className={cn(
            "rounded-md border px-3 py-1.5 text-[12px] transition",
            analise.isPending
              ? "border-white/10 text-white/35"
              : "border-violet-400/30 bg-violet-400/10 text-violet-100 hover:bg-violet-400/[0.18]",
          )}
        >
          {analise.isPending
            ? "lendo a conversa…"
            : r
              ? "Analisar de novo"
              : "I.A. analisar a conversa"}
        </button>
      </div>

      {analise.isError && (
        <p className="text-[12px] text-rose-300/80">
          {(analise.error as { response?: { data?: { message?: string } } })?.response?.data
            ?.message ?? "Não deu para analisar agora."}
        </p>
      )}

      {/* ─── Veredito ───────────────────────────────────────────────── */}
      {r && (
        <section className="rounded-lg border border-violet-400/20 bg-violet-400/[0.05] p-4">
          <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
            {r.nota != null && (
              <span
                className={cn(
                  "font-mono text-[26px] leading-none tabular-nums",
                  r.nota >= 7 ? "text-emerald-300" : r.nota >= 5 ? "text-amber-300" : "text-rose-300",
                )}
              >
                {r.nota.toFixed(1).replace(".", ",")}
              </span>
            )}
            <span className="text-[10px] uppercase tracking-[0.14em] text-white/40">
              {r.desfecho === "agendou"
                ? "agendou"
                : r.desfecho === "nao_agendou"
                  ? "não agendou"
                  : "em aberto"}
            </span>
          </div>

          <p className="mt-2.5 max-w-[70ch] text-[13px] leading-relaxed text-white/85">
            {r.leitura}
          </p>

          {r.viradaMsg && (
            <button
              onClick={() => irPara(r.viradaMsg)}
              className="mt-3 block w-full rounded-md border border-white/10 bg-white/[0.03] p-3 text-left transition hover:bg-white/[0.06]"
            >
              <span className="block text-[10px] uppercase tracking-[0.12em] text-white/40">
                onde virou · mensagem {r.viradaMsg}
              </span>
              <span className="mt-1 block text-[12.5px] leading-relaxed text-white/75">
                {r.viradaPorque}
              </span>
            </button>
          )}

          {/* Checklist: o que um SDR precisa fazer, e se foi feito. */}
          {r.checklist.length > 0 && (
            <ul className="mt-4 flex flex-col gap-1">
              {r.checklist.map((c) => (
                <li key={c.item} className="flex items-baseline gap-2.5 text-[12.5px]">
                  <span
                    className={cn(
                      "font-mono text-[13px]",
                      c.feito ? "text-emerald-400/80" : "text-rose-400/70",
                    )}
                  >
                    {c.feito ? "✓" : "✗"}
                  </span>
                  <span className={c.feito ? "text-white/75" : "text-white/45"}>{c.item}</span>
                  {c.msg && (
                    <button
                      onClick={() => irPara(c.msg)}
                      className="text-[10.5px] tabular-nums text-white/30 underline decoration-dotted underline-offset-2 hover:text-white/60"
                    >
                      msg {c.msg}
                    </button>
                  )}
                </li>
              ))}
            </ul>
          )}

          {(r.acertos.length > 0 || r.falhas.length > 0) && (
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <Coluna titulo="Funcionou" tom="ok" pontos={r.acertos} onIr={irPara} />
              <Coluna titulo="Custou o lead" tom="ruim" pontos={r.falhas} onIr={irPara} />
            </div>
          )}

          <p className="mt-4 border-t border-white/[0.06] pt-2.5 text-[10.5px] text-white/30">
            Leitura de I.A. sobre as {r.mensagensAnalisadas} mensagens desta conversa
            {r.doCache ? ", guardada da última vez" : ""} · {relogio(r.analisadaEm)}. Cada
            afirmação aponta uma mensagem real — clique para conferir.
          </p>
        </section>
      )}

      {/* ─── A conversa ─────────────────────────────────────────────── */}
      <ul className="flex flex-col gap-1.5">
        {comIntervalo.map((m) => (
          <li
            key={m.numero}
            ref={(el) => {
              balões.current[m.numero] = el;
            }}
            className={cn("flex flex-col", m.deQuem === "atendente" ? "items-end" : "items-start")}
          >
            {m.silencio > 0 && (
              <span className="my-2 self-center text-[10px] uppercase tracking-[0.12em] text-white/25">
                {intervalo(m.silencio)} sem mensagem
              </span>
            )}

            <div
              className={cn(
                "max-w-[78%] rounded-lg px-3 py-2 text-[12.5px] leading-relaxed transition",
                m.deQuem === "atendente"
                  ? "bg-emerald-500/[0.10] text-emerald-50"
                  : "bg-white/[0.05] text-white/85",
                aceso === m.numero && "ring-2 ring-violet-400/70",
              )}
            >
              <p className="whitespace-pre-wrap">{m.texto}</p>
              <span className="mt-1 flex items-baseline justify-end gap-2 text-[9.5px] tabular-nums text-white/30">
                <span>{m.numero}</span>
                <span>{relogio(m.em)}</span>
              </span>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

function Coluna({
  titulo,
  tom,
  pontos,
  onIr,
}: {
  titulo: string;
  tom: "ok" | "ruim";
  pontos: Ponto[];
  onIr: (n?: number | null) => void;
}) {
  if (pontos.length === 0) return null;
  return (
    <div>
      <h4
        className={cn(
          "text-[10px] font-semibold uppercase tracking-[0.14em]",
          tom === "ok" ? "text-emerald-300/70" : "text-rose-300/70",
        )}
      >
        {titulo}
      </h4>
      <ul className="mt-2 flex flex-col gap-2.5">
        {pontos.map((p, i) => (
          <li key={i} className="text-[12.5px] leading-relaxed">
            <p className="text-white/80">{p.oQue}</p>
            {p.emVezDisso && (
              <p className="mt-0.5 text-white/45">
                <span className="text-white/30">em vez disso: </span>
                {p.emVezDisso}
              </p>
            )}
            {p.msg && (
              <button
                onClick={() => onIr(p.msg)}
                className="mt-0.5 text-[10.5px] tabular-nums text-white/30 underline decoration-dotted underline-offset-2 hover:text-white/60"
              >
                msg {p.msg}
              </button>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
