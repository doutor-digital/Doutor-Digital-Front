import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { Search } from "@/components/icons";
import { webhooksService } from "@/services/webhooks";
import { ChevronDown } from "@/components/icons";
import { cn } from "@/lib/utils";
import type { LeadDetail, LeadCustomFieldDto, LeadMetrics } from "@/types";

/**
 * O cartão do lead com a cara do CRM, em três colunas.
 *
 * POR QUE ESTE FORMATO
 * --------------------
 * A tela antiga era uma pilha de abas: para ver a ficha, o histórico e os tempos era preciso
 * clicar três vezes e guardar o resto de cabeça. As SDRs passam o dia entre a Kommo e o
 * WhatsApp — então a ficha fica à esquerda como no cartão da Kommo, o que aconteceu vira um
 * feed no meio como numa conversa, e os tempos ficam à direita, sempre à vista.
 *
 * A BARRA DE ETAPAS NÃO É ENFEITE
 * -------------------------------
 * É o mesmo trilho de status do topo do cartão da Kommo: mostra onde o lead está no funil sem
 * ninguém precisar traduzir "TRATAMENTO_CANCELADO" mentalmente.
 *
 * DATA CONFIÁVEL É MARCADA
 * ------------------------
 * Metade do histórico desta base veio do sync, que grava a data da leitura e não a da mudança
 * de etapa. Essas linhas aparecem apagadas e sem hora — mostrar "mudou de etapa às 3h da
 * manhã" com a mesma cara de um dado real é pior do que não mostrar.
 */

// A ordem do funil comercial. Etapa fora desta lista aparece na barra mesmo assim,
// no fim — funil de unidade muda, e sumir com a etapa seria pior que desalinhar.
const TRILHO = [
  { chave: "QUALIFICACAO", rotulo: "Qualificação" },
  { chave: "NEGOCIACAO", rotulo: "Negociação" },
  { chave: "AGENDADO", rotulo: "Agendado" },
  { chave: "TRATAMENTO", rotulo: "Tratamento" },
  { chave: "PERDIDO", rotulo: "Perdido" },
];

/** Agrupa a ficha do jeito que o cartão da Kommo agrupa: por assunto, não por ordem alfabética. */
const GRUPOS: { titulo: string; casa: (nome: string) => boolean }[] = [
  {
    titulo: "Atendimento",
    casa: (n) =>
      /qualifica|tipo|intera|motivo|respons|agendamento|consulta|retorno/.test(n),
  },
  { titulo: "Origem", casa: (n) => /origem|campanha|an[uú]ncio|utm|plataforma|cria/.test(n) },
  { titulo: "Tratamento e valores", casa: (n) => /valor|tratamento|pagamento|parcela|desconto/.test(n) },
  { titulo: "Inteligência artificial", casa: (n) => /\bia\b|sofia|handoff|resposta/.test(n) },
];

const norm = (s: string) =>
  s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();

/** 6 min, 2h14, 3d — a unidade muda porque "4 320 min" ninguém lê. */
function duracao(min: number): string {
  if (min < 1) return "menos de 1 min";
  if (min < 60) return `${Math.round(min)} min`;
  if (min < 1440) {
    const h = Math.floor(min / 60);
    const m = Math.round(min % 60);
    return m === 0 ? `${h}h` : `${h}h${String(m).padStart(2, "0")}`;
  }
  const d = Math.floor(min / 1440);
  return `${d}d`;
}

const horaBR = (iso: string) =>
  new Date(iso).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });

const diaBR = (iso: string) =>
  new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "long" });

/**
 * Etapa em texto legível.
 *
 * Id numérico cru significa status apagado na Kommo — os funis antigos foram removidos e o
 * nome se perdeu na origem, não aqui. Mostrar "106037707" na linha do tempo faz a tela
 * parecer defeituosa; dizer que a etapa foi removida é a informação verdadeira.
 */
function rotuloEtapa(etapa?: string | null): string {
  const e = (etapa ?? "").trim();
  if (!e) return "—";
  if (e.length >= 6 && /^\d+$/.test(e)) return "Etapa removida do funil";
  return e.replace(/_/g, " ").replace(/^\d+\s+/, "");
}

function iniciais(nome?: string | null): string {
  const n = (nome ?? "").trim();
  if (!n) return "?";
  const partes = n.split(/\s+/).filter((p) => p.length > 1);
  return ((partes[0]?.[0] ?? n[0]) + (partes[1]?.[0] ?? "")).toUpperCase();
}

interface EventoFeed {
  quando: string;
  tipo: "etapa" | "atribuicao" | "mensagem" | "pagamento";
  texto: string;
  detalhe?: string;
  /** Falso = data do sync, não da transição. */
  confiavel: boolean;
  entrada?: boolean;
  /** Minutos até o próximo evento; no último, minutos até agora. */
  minutosAte?: number;
  ultimo?: boolean;
}

export function LeadCardKommo({
  lead,
  metricas,
}: {
  lead: LeadDetail;
  /** Tempo por estado da conversa. Vem de outra rota, então pode faltar. */
  metricas?: LeadMetrics | null;
}) {
  const [filtro, setFiltro] = useState("");

  // A coluna da esquerda é a lista de leads, como a lista de conversas do WhatsApp Web:
  // dá para pular de lead em lead sem voltar para a listagem e perder o contexto.
  // /webhooks/recent exige clinicId — sem ele a rota responde "clinicId inválido".
  // O tenant do próprio lead é a resposta certa: a lista tem que ser da clínica dele.
  const vizinhos = useQuery({
    queryKey: ["card-vizinhos", lead.tenantId, lead.unitId],
    queryFn: () =>
      webhooksService.recentLeads({
        clinicId: lead.tenantId,
        unitId: lead.unitId ?? undefined,
        hours: 168,
        limit: 40,
      }),
    enabled: !!lead.tenantId,
    staleTime: 60_000,
    // Lista de vizinhos é conveniência: se falhar, o cartão do lead continua de pé.
    retry: false,
  });

  const listaFiltrada = useMemo(() => {
    const itens = vizinhos.data?.items ?? [];
    const q = norm(filtro.trim());
    if (!q) return itens;
    return itens.filter(
      (i) => norm(i.name ?? "").includes(q) || (i.phone ?? "").includes(filtro.trim()),
    );
  }, [vizinhos.data, filtro]);

  const [gruposAbertos, setGruposAbertos] = useState<Set<string>>(
    () => new Set(["Atendimento", "Origem"]),
  );
  const [mostrarVazios, setMostrarVazios] = useState(false);

  // ─── Feed: tudo que aconteceu, em ordem ───────────────────────────────
  const feed = useMemo<EventoFeed[]>(() => {
    const ev: EventoFeed[] = [];

    ev.push({
      quando: lead.createdAt,
      tipo: "etapa",
      texto: `Lead criado${lead.source && lead.source !== "Kommo" ? ` por ${lead.source}` : ""}`,
      confiavel: true,
    });

    (lead.stageHistory ?? []).forEach((h) =>
      ev.push({
        quando: h.changedAt,
        tipo: "etapa",
        texto: rotuloEtapa(h.stageLabel),
        confiavel: h.dataConfiavel !== false,
      }),
    );

    (lead.assignments ?? []).forEach((a) =>
      ev.push({
        quando: a.assignedAt,
        tipo: "atribuicao",
        texto: `Passou para ${a.attendantName ?? "outra pessoa"}`,
        confiavel: true,
      }),
    );

    (lead.conversations ?? []).forEach((c) =>
      (c.interactions ?? []).forEach((i) =>
        ev.push({
          quando: i.createdAt,
          tipo: "mensagem",
          texto: i.content ?? i.type,
          detalhe: c.attendantName ?? undefined,
          confiavel: true,
          entrada: i.type?.includes("RECEIVED"),
        }),
      ),
    );

    (lead.payments ?? []).forEach((p) =>
      ev.push({
        quando: p.paidAt,
        tipo: "pagamento",
        texto: `Pagamento de R$ ${p.amount}`,
        confiavel: true,
      }),
    );

    const ordenado = ev.sort((a, b) => +new Date(a.quando) - +new Date(b.quando));

    // A duração de cada passo só existe depois da ordenação: é a distância até o
    // evento seguinte, e no último até agora.
    const agora = Date.now();
    ordenado.forEach((e, i) => {
      const prox = i + 1 < ordenado.length ? +new Date(ordenado[i + 1].quando) : agora;
      e.minutosAte = (prox - +new Date(e.quando)) / 60000;
      e.ultimo = i === ordenado.length - 1;
    });

    return ordenado;
  }, [lead]);

  // ─── Ficha agrupada ───────────────────────────────────────────────────
  const { grupos, vazios, cheios } = useMemo(() => {
    const campos = lead.camposKommo ?? [];
    const cheios = campos.filter((c) => c.preenchido);
    const vazios = campos.filter((c) => !c.preenchido);

    const grupos: { titulo: string; itens: LeadCustomFieldDto[] }[] = GRUPOS.map((g) => ({
      titulo: g.titulo,
      itens: [],
    }));
    const outros: LeadCustomFieldDto[] = [];

    cheios.forEach((c) => {
      const n = norm(c.nome);
      const i = GRUPOS.findIndex((g) => g.casa(n));
      if (i >= 0) grupos[i].itens.push(c);
      else outros.push(c);
    });

    if (outros.length) grupos.push({ titulo: "Outros", itens: outros });
    return { grupos: grupos.filter((g) => g.itens.length > 0), vazios, cheios };
  }, [lead.camposKommo]);

  const etapaAtual = (lead.currentStage ?? "").toUpperCase();
  const perdido = etapaAtual.includes("PERDIDO") || etapaAtual.includes("CANCELAD");

  const minutosParado = useMemo(() => {
    const ultimo = feed.filter((e) => e.confiavel).at(-1)?.quando ?? lead.createdAt;
    return (Date.now() - +new Date(ultimo)) / 60000;
  }, [feed, lead.createdAt]);

  const alcancou = (chave: string) =>
    (lead.stageHistory ?? []).some((h) => (h.stageLabel ?? "").toUpperCase().includes(chave)) ||
    etapaAtual.includes(chave);

  return (
    <div className="overflow-hidden rounded-xl border border-white/[0.07] bg-[#0d1626]">
      {/* ─── Barra de etapas, como no topo do cartão da Kommo ─────────── */}
      <div className="flex items-stretch gap-[3px] border-b border-white/[0.06] bg-black/20 p-2">
        {TRILHO.map((t) => {
          const aqui = etapaAtual.includes(t.chave);
          const passou = alcancou(t.chave);
          const ruim = t.chave === "PERDIDO";
          return (
            <div
              key={t.chave}
              className={cn(
                "relative flex-1 px-3 py-1.5 text-center text-[11px] font-medium",
                "first:rounded-l-[4px] last:rounded-r-[4px]",
                aqui
                  ? ruim
                    ? "bg-rose-500/85 text-white"
                    : "bg-emerald-500/80 text-white"
                  : passou
                    ? "bg-white/[0.09] text-slate-300"
                    : "bg-white/[0.03] text-slate-600",
              )}
            >
              {t.rotulo}
            </div>
          );
        })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[248px_minmax(0,1fr)_286px]">
        {/* ═══ Coluna 1 — a lista, como a de conversas do WhatsApp Web ═══ */}
        <aside className="flex max-h-[560px] flex-col border-white/[0.06] lg:border-r">
          <div className="border-b border-white/[0.06] p-2.5">
            <div className="relative">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-600" />
              <input
                value={filtro}
                onChange={(e) => setFiltro(e.target.value)}
                placeholder="Buscar nome ou telefone"
                className="w-full rounded-lg border border-white/[0.06] bg-white/[0.03] py-1.5 pl-8 pr-2.5 text-[12px] text-slate-200 placeholder:text-slate-600 focus:border-emerald-400/40 focus:outline-none"
              />
            </div>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto">
            {listaFiltrada.length === 0 ? (
              <p className="px-3 py-3 text-[11.5px] text-slate-600">
                {vizinhos.isLoading
                  ? "carregando…"
                  : vizinhos.isError
                    ? "Não deu para carregar a lista."
                    : "Nenhum lead nos últimos 7 dias."}
              </p>
            ) : (
              <ul>
                {listaFiltrada.map((v) => {
                  const aqui = v.id === lead.id;
                  return (
                    <li key={v.id}>
                      <Link
                        to={`/leads/${v.id}`}
                        className={cn(
                          "flex items-center gap-2.5 border-b border-white/[0.04] px-3 py-2 transition",
                          aqui ? "bg-white/[0.06]" : "hover:bg-white/[0.03]",
                        )}
                      >
                        <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-slate-700 text-[11px] font-semibold text-slate-300">
                          {iniciais(v.name)}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-[12.5px] text-slate-200">
                            {v.name?.trim() || "Sem nome"}
                          </span>
                          <span className="block truncate text-[11px] text-slate-600">
                            {(v.current_stage ?? "").replace(/_/g, " ") || "sem etapa"}
                          </span>
                        </span>
                        <span className="shrink-0 text-[10.5px] tabular-nums text-slate-600">
                          {new Date(v.created_at).toLocaleDateString("pt-BR", {
                            day: "2-digit",
                            month: "2-digit",
                          })}
                        </span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </aside>

        {/* ═══ Coluna 2 — a conversa ════════════════════════════════ */}
        <div className="flex max-h-[560px] min-w-0 flex-col">
          {/* Cabeçalho do contato, como o topo de uma conversa. */}
          {/* Etiquetas no topo da conversa, não escondidas na terceira coluna.
              É por elas que se sabe de relance se a Sofia atendeu ("IA atração
              Sofia") e de que anúncio o lead veio. */}
          <div className="flex items-center gap-3 border-b border-white/[0.06] bg-white/[0.02] px-4 py-2.5">
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-slate-700 text-[12px] font-semibold text-slate-200">
              {iniciais(lead.name)}
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-[13.5px] text-slate-100">{lead.name}</p>
              <p
                className={cn(
                  "truncate text-[11.5px] tabular-nums",
                  lead.phone ? "text-slate-500" : "text-amber-400/80",
                )}
              >
                {lead.phone || "sem telefone gravado"}
                <span className="mx-1.5 text-slate-700">·</span>
                lead {lead.id} · Kommo {lead.externalId}
              </p>
            </div>
          </div>

          {lead.tags?.length > 0 && (
            <div className="flex flex-wrap gap-1.5 border-b border-white/[0.06] px-4 py-2">
              {lead.tags.map((t) => {
                const ia = /\bia\b|sofia|atra[cç]/i.test(t);
                const anuncio = /an[uú]ncio|campanha|meta|instagram|facebook|pago|org/i.test(t);
                return (
                  <span
                    key={t}
                    className={cn(
                      "rounded px-1.5 py-0.5 text-[10.5px]",
                      ia
                        ? "bg-violet-400/15 text-violet-200 ring-1 ring-inset ring-violet-400/25"
                        : anuncio
                          ? "bg-sky-400/12 text-sky-200 ring-1 ring-inset ring-sky-400/25"
                          : "bg-white/[0.05] text-slate-400",
                    )}
                  >
                    {t}
                  </span>
                );
              })}
            </div>
          )}

        <div
          className="min-h-0 flex-1 overflow-y-auto px-4 py-4"
          style={{
            backgroundImage:
              "radial-gradient(circle at 12px 10px, rgba(255,255,255,.016) 1.4px, transparent 1.5px)",
            backgroundSize: "56px 48px",
          }}
        >
          {feed.length === 0 ? (
            <p className="text-[12.5px] text-slate-600">Nada registrado neste lead.</p>
          ) : (
            <ul className="flex flex-col gap-1.5">
              {feed.map((e, i) => {
                const diaAnterior = i > 0 ? new Date(feed[i - 1].quando).toDateString() : null;
                const novoDia = new Date(e.quando).toDateString() !== diaAnterior;

                return (
                  <li key={`${e.quando}-${i}`} className="contents">
                    {novoDia && (
                      <span className="mx-auto my-2 rounded-md bg-white/[0.05] px-3 py-1 text-[10.5px] text-slate-500">
                        {diaBR(e.quando)}
                      </span>
                    )}

                    {e.tipo === "mensagem" ? (
                      /* Mensagem em balão, como numa conversa: quem manda fica à direita. */
                      <div
                        className={cn(
                          "max-w-[76%] rounded-lg px-2.5 py-1.5",
                          e.entrada
                            ? "self-start rounded-tl-sm bg-[#1c2a3d]"
                            : "self-end rounded-tr-sm bg-[#0d4f43]",
                        )}
                      >
                        <p className="text-[12.5px] leading-snug text-slate-200">{e.texto}</p>
                        <p className="mt-0.5 text-right text-[10px] tabular-nums text-slate-500">
                          {horaBR(e.quando)}
                        </p>
                      </div>
                    ) : (
                      /* Evento do sistema no meio, como o aviso de "entrou no grupo". */
                      <div
                        className={cn(
                          "mx-auto max-w-[92%] rounded-md px-3 py-2 text-center text-[11.5px]",
                          e.confiavel
                            ? "bg-white/[0.045] text-slate-400"
                            : "bg-transparent text-slate-700",
                        )}
                      >
                        <span className={cn(e.confiavel && "text-slate-200")}>{e.texto}</span>
                        {e.confiavel ? (
                          <span className="ml-2 tabular-nums text-slate-600">
                            {horaBR(e.quando)}
                          </span>
                        ) : (
                          <span className="ml-2 text-slate-700">
                            data do sync, não da mudança
                          </span>
                        )}
                        {/* Quanto tempo ficou aqui. É a pergunta que a linha do tempo
                            existe para responder — sem ela são só carimbos soltos. */}
                        {e.confiavel && e.minutosAte != null && (
                          <span className="mt-0.5 block text-[10.5px] text-slate-500">
                            {e.ultimo
                              ? `há ${duracao(e.minutosAte)} nesta etapa`
                              : `${duracao(e.minutosAte)} até o próximo passo`}
                          </span>
                        )}
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </div>
        </div>

        {/* ═══ Coluna 3 — a ficha e os tempos ══════════════════════ */}
        <aside className="flex max-h-[560px] flex-col overflow-y-auto border-white/[0.06] lg:border-l">
          <div className="border-b border-white/[0.06] px-4 py-3">
            <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-600">
              Tempos
            </p>
            <div className="mt-1.5 flex flex-col gap-1">
              <Linha k="Parado há" v={duracao(minutosParado)} alerta={minutosParado > 120} />
              <Linha
                k="Passos com data"
                v={String((lead.stageHistory ?? []).filter((h) => h.dataConfiavel !== false).length)}
              />
              <Linha k="Responsável" v={lead.attendantName ?? "não atribuído"} />
              <Linha k="Qualificação" v={lead.qualification ?? "—"} />
              <Linha k="Tipo" v={lead.leadType ?? "—"} />
              {lead.appointmentScheduledAt && (
                <Linha
                  k="Consulta"
                  v={new Date(lead.appointmentScheduledAt).toLocaleDateString("pt-BR")}
                />
              )}
              {metricas && (metricas.totalTime ?? 0) > 0 && (
                <Linha k="Total no funil" v={duracao(metricas.totalTime!)} />
              )}
            </div>
          </div>

          {grupos.map((g) => {
            const aberto = gruposAbertos.has(g.titulo);
            return (
              <div key={g.titulo} className="border-t border-white/[0.05]">
                <button
                  onClick={() =>
                    setGruposAbertos((s) => {
                      const n = new Set(s);
                      n.has(g.titulo) ? n.delete(g.titulo) : n.add(g.titulo);
                      return n;
                    })
                  }
                  className="flex w-full items-center gap-2 px-4 py-2 text-left transition hover:bg-white/[0.03]"
                  aria-expanded={aberto}
                >
                  <ChevronDown
                    className={cn(
                      "h-3.5 w-3.5 text-slate-600 transition-transform",
                      !aberto && "-rotate-90",
                    )}
                  />
                  <span className="flex-1 text-[11px] font-semibold uppercase tracking-[0.1em] text-slate-500">
                    {g.titulo}
                  </span>
                  <span className="text-[11px] tabular-nums text-slate-700">{g.itens.length}</span>
                </button>

                {aberto && (
                  <dl className="px-4 pb-2.5">
                    {g.itens.map((c) => (
                      <div key={`${c.fieldId}-${c.nome}`} className="py-1.5">
                        <dt className="text-[10.5px] text-slate-600">{c.nome}</dt>
                        <dd
                          className={cn(
                            "text-[12.5px] text-slate-200",
                            c.ehData && "tabular-nums",
                          )}
                        >
                          {c.valor}
                        </dd>
                      </div>
                    ))}
                  </dl>
                )}
              </div>
            );
          })}

          {vazios.length > 0 && (
            <div className="border-t border-white/[0.05] px-4 py-2.5">
              <button
                onClick={() => setMostrarVazios((v) => !v)}
                className="text-[11px] text-slate-600 transition hover:text-slate-400"
                aria-expanded={mostrarVazios}
              >
                {cheios.length} de {cheios.length + vazios.length} preenchidos ·{" "}
                {mostrarVazios ? "ocultar" : "ver"} os em branco
              </button>
              {mostrarVazios && (
                <ul className="mt-1.5 flex flex-wrap gap-x-3 gap-y-0.5">
                  {vazios.map((c) => (
                    <li key={`${c.fieldId}-${c.nome}`} className="text-[11px] text-slate-700">
                      {c.nome}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}

          {lead.tags?.length > 0 && (
            <div className="border-t border-white/[0.05] px-4 py-3">
              <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-600">
                Etiquetas
              </p>
              <div className="flex flex-wrap gap-1.5">
                {lead.tags.map((t) => (
                  <span
                    key={t}
                    className="rounded border border-white/[0.09] px-1.5 py-0.5 text-[10.5px] text-slate-400"
                  >
                    {t}
                  </span>
                ))}
              </div>
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}

function Linha({ k, v, alerta }: { k: string; v: string; alerta?: boolean }) {
  return (
    <p className="flex items-baseline justify-between gap-2 text-[12px]">
      <span className="shrink-0 text-slate-600">{k}</span>
      <span
        className={cn(
          "truncate text-right",
          alerta ? "text-amber-400/90" : "text-slate-200",
        )}
      >
        {v}
      </span>
    </p>
  );
}
