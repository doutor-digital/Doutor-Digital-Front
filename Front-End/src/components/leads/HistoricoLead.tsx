import { useMemo } from "react";
import { cn } from "@/lib/utils";
import type { LeadDetail } from "@/types";

/**
 * Por onde o lead passou, com o tempo desenhado.
 *
 * A DURAÇÃO É A ALTURA, NÃO SÓ UM NÚMERO
 * --------------------------------------
 * A pergunta que se faz desta tela é "onde o tempo foi parar". Lendo números, "1h41" e
 * "0 min" ocupam o mesmo espaço e a resposta some. Aqui cada etapa tem altura proporcional
 * ao tempo que durou: a parada longa vira bloco, o salto de um minuto vira risco.
 *
 * É essa proporção que faz o vaivém aparecer sem ninguém procurar — no lead 77616 dá para
 * ver de relance que ele foi a Tratamento Cancelado e voltou em dez minutos, o que num
 * relatório de linhas iguais passaria batido.
 *
 * O VAZIO EXPLICA O VAZIO
 * -----------------------
 * "0 conversa(s)" não é informação: parece defeito. Onde não há dado, a tela diz por que não
 * há e o que destrava — nesta unidade o Salesbot ainda não chama a Sofia, então não existe
 * mensagem gravada para lead nenhum.
 */

/** Id numérico cru = status apagado na Kommo. O nome se perdeu na origem. */
function rotulo(etapa?: string | null): string {
  const e = (etapa ?? "").trim();
  if (!e) return "—";
  if (e.length >= 6 && /^\d+$/.test(e)) return "Etapa removida do funil";
  return e.replace(/_/g, " ").replace(/^\d+\s+/, "");
}

function duracao(min: number): string {
  if (min < 1) return "menos de 1 min";
  if (min < 60) return `${Math.round(min)} min`;
  if (min < 1440) {
    const h = Math.floor(min / 60);
    const m = Math.round(min % 60);
    return m === 0 ? `${h}h` : `${h}h${String(m).padStart(2, "0")}`;
  }
  const d = Math.floor(min / 1440);
  const h = Math.round((min % 1440) / 60);
  return h === 0 ? `${d}d` : `${d}d ${h}h`;
}

const hora = (iso: string) =>
  new Date(iso).toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });

type Tom = "atual" | "perda" | "ganho" | "neutro";

function tomDa(etapa: string): Tom {
  const e = etapa.toLowerCase();
  if (/perdid|descart|cancelad|não fechou|nao fechou/.test(e)) return "perda";
  if (/ganho|fechad|em tratamento/.test(e)) return "ganho";
  return "neutro";
}

export function HistoricoLead({ lead }: { lead: LeadDetail }) {
  const passos = useMemo(() => {
    const hist = [...(lead.stageHistory ?? [])].sort(
      (a, b) => +new Date(a.changedAt) - +new Date(b.changedAt),
    );
    const agora = Date.now();

    return hist.map((h, i) => {
      const fim = i + 1 < hist.length ? +new Date(hist[i + 1].changedAt) : agora;
      return {
        etapa: rotulo(h.stageLabel),
        cru: h.stageLabel ?? "",
        entrou: h.changedAt,
        saiu: i + 1 < hist.length ? hist[i + 1].changedAt : null,
        minutos: (fim - +new Date(h.changedAt)) / 60000,
        atual: i === hist.length - 1,
        // Linha do sync guarda a data da leitura, não a da mudança.
        confiavel: h.dataConfiavel !== false,
      };
    });
  }, [lead.stageHistory]);

  const maior = Math.max(1, ...passos.map((p) => p.minutos));
  const total = passos.reduce((s, p) => s + p.minutos, 0);
  const semData = passos.filter((p) => !p.confiavel).length;

  const interacoes = (lead.conversations ?? []).flatMap((c) => c.interactions ?? []);

  return (
    <div className="flex flex-col gap-7">
      {/* ─── A passagem ─────────────────────────────────────────────── */}
      <section>
        <div className="flex flex-wrap items-baseline justify-between gap-3">
          <h3 className="text-[10px] font-semibold uppercase tracking-[0.14em] text-white/50">
            Por onde passou
          </h3>
          <p className="text-[11px] tabular-nums text-white/40">
            {passos.length} etapa{passos.length === 1 ? "" : "s"} · {duracao(total)} no total
          </p>
        </div>

        {passos.length === 0 ? (
          <p className="mt-3 text-[12.5px] text-white/45">
            Sem histórico de etapa com data. Este lead só tem registro do sync, que guarda a
            hora da leitura e não a da mudança.
          </p>
        ) : (
          <ol className="mt-4 flex flex-col">
            {passos.map((p, i) => {
              const tom = p.atual ? "atual" : tomDa(p.cru);
              // Altura proporcional ao tempo, com piso: passo de 0 min ainda
              // precisa ser visível para o vaivém aparecer.
              const altura = Math.max(14, Math.round((p.minutos / maior) * 96));

              return (
                <li key={`${p.entrou}-${i}`} className="flex gap-4">
                  {/* A coluna do tempo: é ela que responde "onde o tempo foi". */}
                  <div className="flex w-8 shrink-0 flex-col items-center">
                    <span
                      className={cn(
                        "w-[6px] rounded-full",
                        tom === "atual"
                          ? "bg-sky-400/80"
                          : tom === "perda"
                            ? "bg-rose-400/60"
                            : tom === "ganho"
                              ? "bg-emerald-400/60"
                              : "bg-white/[0.14]",
                        !p.confiavel && "opacity-30",
                      )}
                      style={{ height: `${altura}px` }}
                    />
                    {i < passos.length - 1 && <span className="h-2 w-px bg-white/[0.08]" />}
                  </div>

                  <div className="min-w-0 flex-1 pb-3">
                    <div className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5">
                      <span
                        className={cn(
                          "text-[13.5px]",
                          p.atual ? "text-white" : "text-white/80",
                          /removida/.test(p.etapa) && "italic text-white/45",
                        )}
                      >
                        {p.etapa}
                      </span>
                      {p.atual && (
                        <span className="rounded bg-sky-400/15 px-1.5 py-0.5 text-[10px] uppercase tracking-[0.08em] text-sky-200">
                          agora
                        </span>
                      )}
                      <span
                        className={cn(
                          "font-mono text-[12px] tabular-nums",
                          p.minutos < 2 ? "text-amber-300/80" : "text-white/60",
                        )}
                      >
                        {duracao(p.minutos)}
                      </span>
                    </div>

                    <p className="mt-0.5 text-[10.5px] tabular-nums text-white/35">
                      {p.confiavel ? (
                        <>
                          {hora(p.entrou)}
                          {p.saiu && ` → ${hora(p.saiu)}`}
                        </>
                      ) : (
                        "data do sync, não da mudança de etapa"
                      )}
                    </p>

                    {/* Passagem instantânea quase sempre é reclassificação, não
                        atendimento. Dizer isso evita ler como produtividade. */}
                    {p.confiavel && p.minutos < 2 && !p.atual && (
                      <p className="mt-0.5 text-[10.5px] text-amber-300/60">
                        passou direto — costuma ser correção de etapa, não atendimento
                      </p>
                    )}
                  </div>
                </li>
              );
            })}
          </ol>
        )}

        {semData > 0 && (
          <p className="mt-2 text-[10.5px] text-white/30">
            {semData} mudança(s) com data do sync, desenhadas apagadas.
          </p>
        )}
      </section>

      {/* ─── Mensagens ──────────────────────────────────────────────── */}
      <section className="border-t border-white/[0.06] pt-5">
        <h3 className="text-[10px] font-semibold uppercase tracking-[0.14em] text-white/50">
          Mensagens
        </h3>

        {interacoes.length === 0 ? (
          <p className="mt-2 max-w-[62ch] text-[12.5px] leading-relaxed text-white/45">
            Nenhuma mensagem gravada — e não é deste lead: não existe conversa registrada para
            nenhum lead desta unidade. O Salesbot da Kommo ainda não chama a Sofia, então nada
            chega até aqui. Quando ligar, as mensagens aparecem nesta aba sem mais nenhum ajuste.
          </p>
        ) : (
          <ul className="mt-3 flex flex-col gap-1.5">
            {interacoes.map((i) => (
              <li
                key={i.id}
                className={cn(
                  "max-w-[80%] rounded-lg px-3 py-2 text-[12.5px]",
                  i.type?.includes("RECEIVED")
                    ? "self-start bg-white/[0.05] text-white/85"
                    : "self-end bg-emerald-500/[0.12] text-emerald-50",
                )}
              >
                {i.content ?? i.type}
                <span className="mt-0.5 block text-right text-[10px] tabular-nums text-white/35">
                  {hora(i.createdAt)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* ─── Quem atendeu ───────────────────────────────────────────── */}
      <section className="border-t border-white/[0.06] pt-5">
        <h3 className="text-[10px] font-semibold uppercase tracking-[0.14em] text-white/50">
          Quem atendeu
        </h3>

        {(lead.assignments ?? []).length === 0 ? (
          <p className="mt-2 max-w-[62ch] text-[12.5px] leading-relaxed text-white/45">
            Sem troca de responsável registrada. O atendente do lead é{" "}
            <span className="text-white/75">{lead.attendantName ?? "ninguém ainda"}</span>, e ele
            vem do campo “Responsável agendamento” da Kommo — a passagem entre pessoas só é
            gravada quando acontece dentro do dashboard.
          </p>
        ) : (
          <ul className="mt-3 flex flex-col gap-1.5">
            {lead.assignments.map((a) => (
              <li key={a.id} className="flex items-baseline justify-between gap-3 text-[12.5px]">
                <span className="text-white/80">{a.attendantName ?? "—"}</span>
                <span className="tabular-nums text-white/35">{hora(a.assignedAt)}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
