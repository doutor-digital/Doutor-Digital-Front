import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Search } from "@/components/icons";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";
import { useClinic } from "@/hooks/useClinic";

// ─── Tipos ────────────────────────────────────────────────────────────────
interface BuscaItem {
  leadId: number;
  kommoId?: string | null;
  nome?: string | null;
  telefone?: string | null;
  etapaAtual?: string | null;
  criadoEm: string;
}

interface Passo {
  etapa: string;
  etapaCrua: string;
  entrou: string;
  saiu?: string | null;
  minutosAte: number;
  atual: boolean;
  /** Dividiu o minuto com muitos leads: foi script, não pessoa. */
  emLote: boolean;
  noMesmoMinuto: number;
  /** Etapa virou id numérico — status apagado na Kommo. */
  orfa: boolean;
}

interface Ia {
  pausada: boolean;
  campoMapeado: boolean;
  semRegistro: boolean;
  conversaId?: number | null;
  mensagens: number;
  passouParaHumano: boolean;
  ultimaMensagemEm?: string | null;
  resumo?: string | null;
}

interface Jornada {
  leadId: number;
  kommoId?: string | null;
  nome?: string | null;
  telefone?: string | null;
  origem?: string | null;
  tipo?: string | null;
  etapaAtual?: string | null;
  responsavel?: string | null;
  criadoEm: string;
  dataConsulta?: string | null;
  qualificacao?: string | null;
  passos: Passo[];
  passosDescartados: number;
  minutosParado: number;
  minutosAtePrimeiroMovimento?: number | null;
  minutosAteAgendar?: number | null;
  ia: Ia;
}

interface RankingItem {
  leadId: number;
  nome?: string | null;
  telefone?: string | null;
  origem?: string | null;
  criadoEm: string;
  agendouEm: string;
  minutos: number;
}

// ─── Formatação ───────────────────────────────────────────────────────────

/** 6 min, 2h14, 3d 4h — a unidade muda porque "4 320 min" ninguém lê. */
function duracao(min: number): string {
  if (min < 1) return "menos de 1 min";
  if (min < 60) return `${Math.round(min)} min`;
  if (min < 60 * 24) {
    const h = Math.floor(min / 60);
    const m = Math.round(min % 60);
    return m === 0 ? `${h}h` : `${h}h${String(m).padStart(2, "0")}`;
  }
  const d = Math.floor(min / (60 * 24));
  const h = Math.round((min % (60 * 24)) / 60);
  return h === 0 ? `${d}d` : `${d}d ${h}h`;
}

const dataHora = (iso: string) =>
  new Date(iso).toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });

/**
 * A vida de um lead.
 *
 * O dashboard inteiro é agregado. Quando alguém pergunta "o que aconteceu com ESTE paciente",
 * não havia onde olhar sem abrir a Kommo. Aqui entra o telefone, o nome ou o número e sai a
 * linha do tempo, com o tempo entre cada passo.
 */
export default function JornadaPage() {
  const { unitId } = useClinic();
  const [termo, setTermo] = useState("");
  const [busca, setBusca] = useState("");
  const [leadId, setLeadId] = useState<number | null>(null);

  const resultados = useQuery({
    queryKey: ["jornada-busca", busca, unitId],
    queryFn: async () => {
      const { data } = await api.get<BuscaItem[]>("/api/jornada/busca", {
        params: { termo: busca, unitId },
      });
      return data;
    },
    enabled: busca.trim().length >= 3,
  });

  const jornada = useQuery({
    queryKey: ["jornada", leadId, unitId],
    queryFn: async () => {
      const { data } = await api.get<Jornada>(`/api/jornada/${leadId}`, { params: { unitId } });
      return data;
    },
    enabled: leadId != null,
  });

  const ranking = useQuery({
    queryKey: ["jornada-ranking", unitId],
    queryFn: async () => {
      const ate = new Date();
      const de = new Date(ate.getTime() - 30 * 24 * 3600_000);
      const { data } = await api.get<RankingItem[]>("/api/jornada/ranking", {
        params: { de: de.toISOString(), ate: ate.toISOString(), unitId },
      });
      return data;
    },
    enabled: !!unitId,
  });

  const j = jornada.data;

  return (
    <div className="mx-auto max-w-5xl px-5 py-6">
      <header className="mb-5">
        <h1 className="text-[19px] font-semibold tracking-tight text-slate-100">Jornada do lead</h1>
        <p className="mt-1 text-[13px] text-slate-500">
          Por onde o lead passou, quanto tempo levou em cada passo e se a IA está com ele.
        </p>
      </header>

      {/* ─── Busca ─────────────────────────────────────────────────────── */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          setBusca(termo);
          setLeadId(null);
        }}
        className="flex gap-2"
      >
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-600" />
          <input
            value={termo}
            onChange={(e) => setTermo(e.target.value)}
            placeholder="Telefone, nome, número do lead ou número na Kommo"
            className="w-full rounded-lg border border-white/[0.08] bg-white/[0.03] py-2.5 pl-9 pr-3 text-[13.5px] text-slate-200 placeholder:text-slate-600 focus:border-sky-400/40 focus:outline-none"
          />
        </div>
        <button
          type="submit"
          className="rounded-lg border border-white/[0.1] px-4 text-[13px] text-slate-300 transition hover:bg-white/[0.05]"
        >
          Buscar
        </button>
      </form>

      {/* Resultados: some assim que um lead é escolhido. */}
      {busca.length >= 3 && leadId == null && (
        <div className="mt-3 overflow-hidden rounded-lg border border-white/[0.07]">
          {resultados.isLoading ? (
            <p className="px-4 py-3 text-[12.5px] text-slate-500">procurando…</p>
          ) : (resultados.data?.length ?? 0) === 0 ? (
            <p className="px-4 py-3 text-[12.5px] text-slate-500">
              Nada com “{busca}”. Telefone pode ser digitado com ou sem DDD.
            </p>
          ) : (
            <ul className="divide-y divide-white/[0.05]">
              {resultados.data!.map((r) => (
                <li key={r.leadId}>
                  <button
                    onClick={() => setLeadId(r.leadId)}
                    className="flex w-full items-center gap-3 px-4 py-2.5 text-left transition hover:bg-white/[0.04]"
                  >
                    <span className="min-w-0 flex-1 truncate text-[13px] text-slate-200">
                      {r.nome?.trim() || "Sem nome"}
                    </span>
                    <span className="shrink-0 text-[12px] tabular-nums text-slate-400">
                      {r.telefone}
                    </span>
                    <span className="hidden shrink-0 text-[11.5px] text-slate-600 sm:block">
                      {r.etapaAtual}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {/* ─── Jornada ───────────────────────────────────────────────────── */}
      {j && (
        <section className="mt-5">
          {/* Identificação: telefone e os dois números, porque é o que a SDR usa
              para achar a mesma pessoa na Kommo. */}
          <div className="rounded-xl border border-white/[0.07] bg-white/[0.02] px-4 py-3.5">
            <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
              <h2 className="text-[15px] font-medium text-slate-100">
                {j.nome?.trim() || "Sem nome"}
              </h2>
              <span className="text-[13px] tabular-nums text-slate-300">{j.telefone}</span>
              <span className="text-[11.5px] tabular-nums text-slate-600">
                lead {j.leadId} · Kommo {j.kommoId}
              </span>
              <button
                onClick={() => setLeadId(null)}
                className="ml-auto text-[12px] text-slate-500 transition hover:text-slate-300"
              >
                trocar
              </button>
            </div>

            <dl className="mt-3 flex flex-wrap gap-x-6 gap-y-1.5 text-[12px]">
              <Campo k="Etapa" v={j.etapaAtual} />
              <Campo k="Origem" v={j.origem} />
              <Campo k="Tipo" v={j.tipo} />
              <Campo k="Qualificação" v={j.qualificacao} />
              <Campo k="Responsável" v={j.responsavel} />
              <Campo k="Entrou" v={dataHora(j.criadoEm)} />
              <Campo k="Consulta" v={j.dataConsulta ? dataHora(j.dataConsulta) : null} />
            </dl>
          </div>

          {/* ─── Tempos ──────────────────────────────────────────────── */}
          <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
            <Tempo k="Parado há" v={duracao(j.minutosParado)} destaque={j.minutosParado > 120} />
            <Tempo
              k="Até o 1º movimento"
              v={j.minutosAtePrimeiroMovimento != null ? duracao(j.minutosAtePrimeiroMovimento) : "—"}
            />
            <Tempo
              k="Até agendar"
              v={j.minutosAteAgendar != null ? duracao(j.minutosAteAgendar) : "não agendou"}
            />
            <Tempo k="Passos" v={String(j.passos.length)} />
          </div>

          {/* ─── IA ──────────────────────────────────────────────────── */}
          <div className="mt-3 rounded-xl border border-white/[0.07] bg-white/[0.02] px-4 py-3">
            <p className="mb-2 text-[10.5px] font-semibold uppercase tracking-[0.14em] text-slate-500">
              Sofia
            </p>
            {!j.ia.campoMapeado ? (
              <p className="text-[12.5px] text-amber-400/90">
                O campo “Pausar IA” desta unidade não está mapeado em Configurações Técnicas —
                então não dá para dizer se a IA está com este lead.
              </p>
            ) : j.ia.pausada ? (
              <p className="text-[12.5px] text-amber-400/90">
                IA pausada neste lead. Enquanto o campo “Pausar IA” estiver marcado, a Sofia não
                responde — o atendimento é humano.
              </p>
            ) : (
              <p className="text-[12.5px] text-emerald-400/90">
                IA liberada para responder este lead.
              </p>
            )}

            {j.ia.semRegistro ? (
              <p className="mt-1.5 text-[11.5px] text-slate-500">
                Nenhuma conversa gravada. Em Imperatriz isso vale para a unidade inteira: o
                Salesbot ainda não chama a Sofia, então não há mensagem registrada para nenhum
                lead.
              </p>
            ) : (
              <p className="mt-1.5 text-[11.5px] text-slate-400">
                {j.ia.mensagens} mensagens
                {j.ia.passouParaHumano && " · passou para humano"}
                {j.ia.ultimaMensagemEm && ` · última ${dataHora(j.ia.ultimaMensagemEm)}`}
                {j.ia.resumo && <span className="block text-slate-500">{j.ia.resumo}</span>}
              </p>
            )}
          </div>

          {/* ─── Linha do tempo ──────────────────────────────────────── */}
          <div className="mt-3 rounded-xl border border-white/[0.07] bg-white/[0.02] px-4 py-3.5">
            <div className="mb-3 flex items-baseline justify-between gap-3">
              <p className="text-[10.5px] font-semibold uppercase tracking-[0.14em] text-slate-500">
                Por onde passou
              </p>
              {j.passosDescartados > 0 && (
                /* Não some silenciosamente: linha legada guarda a data do sync, não a da
                   transição, e virar "0 min" na tela seria mentira com cara de dado. */
                <p className="text-[11px] text-slate-600">
                  {j.passosDescartados} sem data confiável, fora da conta
                </p>
              )}
            </div>

            {j.passos.length === 0 ? (
              <p className="text-[12.5px] text-slate-500">
                Nenhum passo com data confiável. Este lead só tem histórico do sync, que guarda a
                data da leitura e não a da mudança de etapa.
              </p>
            ) : (
              <ol className="relative">
                {j.passos.map((p, i) => (
                  <li key={`${p.entrou}-${i}`} className="relative flex gap-3 pb-4 last:pb-0">
                    {/* trilho */}
                    {i < j.passos.length - 1 && (
                      <span className="absolute left-[5px] top-4 h-full w-px bg-white/[0.09]" />
                    )}
                    <span
                      className={cn(
                        "relative mt-1.5 h-[11px] w-[11px] shrink-0 rounded-full border-2",
                        p.atual
                          ? "border-sky-400 bg-sky-400/30"
                          : p.emLote
                            ? "border-slate-700 bg-slate-800"
                            : "border-slate-600 bg-slate-900",
                      )}
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-baseline gap-x-2.5 gap-y-0.5">
                        <span
                          className={cn(
                            "text-[13px]",
                            p.orfa ? "text-slate-500 italic" : "text-slate-200",
                          )}
                        >
                          {p.etapa}
                        </span>
                        <span className="text-[11.5px] tabular-nums text-slate-600">
                          {dataHora(p.entrou)}
                        </span>
                        {!p.emLote && (
                          <span
                            className={cn(
                              "text-[11.5px] tabular-nums",
                              p.atual ? "text-sky-400/80" : "text-slate-500",
                            )}
                          >
                            {p.atual ? `há ${duracao(p.minutosAte)}` : `${duracao(p.minutosAte)} aqui`}
                          </span>
                        )}
                      </div>
                      {p.emLote && (
                        <p className="mt-0.5 text-[11px] text-amber-400/70">
                          Movimentação em lote — {p.noMesmoMinuto} leads foram para esta etapa no
                          mesmo minuto. Não é tempo de atendimento.
                        </p>
                      )}
                    </div>
                  </li>
                ))}
              </ol>
            )}
          </div>
        </section>
      )}

      {/* ─── Conversões mais rápidas ───────────────────────────────────── */}
      {leadId == null && (ranking.data?.length ?? 0) > 0 && (
        <section className="mt-6 rounded-xl border border-white/[0.07] bg-white/[0.02] px-4 py-3.5">
          <p className="mb-1 text-[10.5px] font-semibold uppercase tracking-[0.14em] text-slate-500">
            Foram mais rápido de novo a agendado
          </p>
          <p className="mb-3 text-[11.5px] text-slate-600">
            Últimos 30 dias. Clique para abrir a jornada.
          </p>
          <ul className="divide-y divide-white/[0.05]">
            {ranking.data!.slice(0, 10).map((r, i) => (
              <li key={r.leadId}>
                <button
                  onClick={() => setLeadId(r.leadId)}
                  className="flex w-full items-center gap-3 py-2 text-left transition hover:bg-white/[0.03]"
                >
                  <span className="w-4 shrink-0 text-[11px] tabular-nums text-slate-600">
                    {i + 1}
                  </span>
                  <span className="min-w-0 flex-1 truncate text-[12.5px] text-slate-300">
                    {r.nome?.trim() || "Sem nome"}
                  </span>
                  <span className="hidden shrink-0 text-[11.5px] text-slate-600 sm:block">
                    {r.origem}
                  </span>
                  <span className="w-[74px] shrink-0 text-right text-[12.5px] tabular-nums text-emerald-400/90">
                    {duracao(r.minutos)}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

function Campo({ k, v }: { k: string; v?: string | null }) {
  if (!v) return null;
  return (
    <div className="flex gap-1.5">
      <dt className="text-slate-600">{k}</dt>
      <dd className="text-slate-300">{v}</dd>
    </div>
  );
}

function Tempo({ k, v, destaque }: { k: string; v: string; destaque?: boolean }) {
  return (
    <div className="rounded-lg border border-white/[0.06] bg-white/[0.02] px-3 py-2.5">
      <p className="text-[10.5px] uppercase tracking-[0.1em] text-slate-600">{k}</p>
      <p
        className={cn(
          "mt-1 text-[16px] font-medium tabular-nums",
          destaque ? "text-amber-400" : "text-slate-200",
        )}
      >
        {v}
      </p>
    </div>
  );
}
