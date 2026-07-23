import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ChevronLeft, ChevronRight, Check, X } from "@/components/icons";
import { PageHeader } from "@/components/layout/PageHeader";
import { useClinic } from "@/hooks/useClinic";
import { agendaFranquia, type SpineAgendaItem } from "@/services/spine";

/**
 * Calendário (franquia) — a agenda da clínica como ela é vista no sistema do
 * Doutor Hérnia: grade semanal, uma coluna por dia, meia em meia hora.
 *
 * A cor vem da CATEGORIA do horário (avaliação, sessão, retorno), que é o que a
 * API expõe. O sistema da franquia colore pelo PROTOCOLO do tratamento
 * ("PROTOCOLO 03 MESES", "DESCOMPRESSÃO"...), informação que só existe no módulo
 * Tratamentos — bloqueado por permissão neste token. Quando liberarem, é trocar
 * a fonte da cor sem mexer no layout.
 *
 * Horário que não aconteceu é grafado: faltou ganha ícone e cor de alerta,
 * desmarcado fica esmaecido e riscado. Assim o desfecho não depende só da cor.
 */

/**
 * A faixa de horas não é fixa: a clínica abre 07h em alguns dias e vai até 18h
 * em outros. Grade fixa 06–21 deixava um terço da tela vazio. Aqui ela se ajusta
 * ao que existe na semana, com uma folga de meia hora de cada lado.
 */
const HORA_MIN_PADRAO = 7;
const HORA_MAX_PADRAO = 19;
const SLOTS_POR_HORA = 2;
const ALTURA_SLOT = 34; // px por 30 min

const COR_CATEGORIA: Record<number, { fundo: string; borda: string; texto: string }> = {
  1: { fundo: "rgba(251,191,36,0.20)", borda: "#fbbf24", texto: "#fde68a" }, // Avaliação
  2: { fundo: "rgba(96,165,250,0.18)", borda: "#60a5fa", texto: "#bfdbfe" }, // Sessão
  3: { fundo: "rgba(52,211,153,0.18)", borda: "#34d399", texto: "#a7f3d0" }, // Retorno
  6: { fundo: "rgba(167,139,250,0.18)", borda: "#a78bfa", texto: "#ddd6fe" }, // Retorno c/ exames
  7: { fundo: "rgba(34,211,238,0.18)", borda: "#22d3ee", texto: "#a5f3fc" }, // Retorno pós-trat.
};
const COR_PADRAO = { fundo: "rgba(148,163,184,0.15)", borda: "#94a3b8", texto: "#cbd5e1" };

const DIAS = ["dom.", "seg.", "ter.", "qua.", "qui.", "sex.", "sáb."];
const MESES = ["jan.", "fev.", "mar.", "abr.", "mai.", "jun.", "jul.", "ago.", "set.", "out.", "nov.", "dez."];

const iso = (d: Date) => {
  const t = new Date(d.getTime() - d.getTimezoneOffset() * 60_000);
  return t.toISOString().slice(0, 10);
};

/** Segunda-feira da semana que contém a data. */
function segundaDe(d: Date): Date {
  const x = new Date(d);
  const dow = x.getDay();
  x.setDate(x.getDate() - (dow === 0 ? 6 : dow - 1));
  x.setHours(0, 0, 0, 0);
  return x;
}

function Bloco({ item }: { item: SpineAgendaItem }) {
  const c = COR_CATEGORIA[item.idCategoria] ?? COR_PADRAO;
  const cancelado = item.grupo === "cancelado";
  const faltou = item.grupo === "falta";

  return (
    <div
      className="absolute inset-x-0.5 overflow-hidden rounded-md border-l-[3px] px-1.5 py-0.5"
      style={{
        top: 1,
        height: ALTURA_SLOT - 2,
        background: faltou ? "rgba(248,113,113,0.18)" : c.fundo,
        borderLeftColor: faltou ? "#f87171" : c.borda,
        opacity: cancelado ? 0.42 : 1,
      }}
      title={`${item.paciente} · ${item.categoria} · ${item.status}${item.profissional ? ` · ${item.profissional}` : ""}`}
    >
      <div className="flex items-start gap-1">
        <span
          className={`flex-1 truncate text-[10.5px] font-medium leading-tight ${cancelado ? "line-through" : ""}`}
          style={{ color: faltou ? "#fecaca" : c.texto }}
        >
          {item.paciente}
        </span>
        {item.grupo === "realizado" && <Check className="mt-px h-3 w-3 shrink-0 text-emerald-400" />}
        {faltou && <X className="mt-px h-3 w-3 shrink-0 text-red-400" />}
      </div>
      <span className="block truncate text-[9.5px] leading-tight text-white/40">
        {item.categoria}
        {item.profissional && ` · ${item.profissional.replace(/^DRA?\.\s*/i, "")}`}
      </span>
    </div>
  );
}

export default function CalendarioFranquiaPage() {
  const { unitId } = useClinic();
  const [ancora, setAncora] = useState(() => segundaDe(new Date()));
  const [dias, setDias] = useState<6 | 7>(6); // seg–sáb, como no sistema da franquia

  const inicio = ancora;
  const fim = useMemo(() => {
    const f = new Date(ancora);
    f.setDate(f.getDate() + dias - 1);
    return f;
  }, [ancora, dias]);

  const q = useQuery({
    queryKey: ["spine-agenda", unitId, iso(inicio), iso(fim)],
    queryFn: () => agendaFranquia(unitId!, iso(inicio), iso(fim)),
    enabled: !!unitId,
    staleTime: 5 * 60_000,
    retry: false,
  });

  const colunas = useMemo(
    () =>
      Array.from({ length: dias }, (_, i) => {
        const d = new Date(inicio);
        d.setDate(d.getDate() + i);
        return d;
      }),
    [inicio, dias],
  );

  /** Faixa de horas efetivamente ocupada na semana (com folga). */
  const [horaInicio, horaFim] = useMemo(() => {
    const horas = (q.data?.itens ?? []).map((i) => new Date(i.inicio).getHours());
    if (horas.length === 0) return [HORA_MIN_PADRAO, HORA_MAX_PADRAO];
    return [Math.min(...horas), Math.min(23, Math.max(...horas) + 1)];
  }, [q.data]);

  /** item -> índice do slot de 30 min a partir de horaInicio */
  const porDiaSlot = useMemo(() => {
    const mapa = new Map<string, SpineAgendaItem[]>();
    for (const it of q.data?.itens ?? []) {
      const dt = new Date(it.inicio);
      const slot = (dt.getHours() - horaInicio) * SLOTS_POR_HORA + (dt.getMinutes() >= 30 ? 1 : 0);
      if (slot < 0) continue;
      const chave = `${iso(dt)}|${slot}`;
      (mapa.get(chave) ?? mapa.set(chave, []).get(chave)!).push(it);
    }
    return mapa;
  }, [q.data, horaInicio]);

  const slots = (horaFim - horaInicio) * SLOTS_POR_HORA;
  const titulo = `${inicio.getDate()} – ${fim.getDate()} de ${MESES[fim.getMonth()]} de ${fim.getFullYear()}`;
  const hojeIso = iso(new Date());

  const mover = (semanas: number) => {
    const d = new Date(ancora);
    d.setDate(d.getDate() + semanas * 7);
    setAncora(d);
  };

  return (
    <div className="pb-10">
      <PageHeader
        title="Calendário (franquia)"
        description="Agenda da clínica, direto do sistema do Doutor Hérnia"
      />

      {/* ── Legenda ── */}
      <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3">
        <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-white/45">
          Legenda
        </span>
        {[
          [1, "Avaliação"],
          [2, "Sessão"],
          [3, "Retorno"],
          [6, "Retorno c/ exames"],
          [7, "Retorno pós-tratamento"],
        ].map(([id, nome]) => (
          <span key={id as number} className="inline-flex items-center gap-1.5 text-[11px] text-white/55">
            <span
              className="h-2.5 w-2.5 rounded-sm"
              style={{ background: (COR_CATEGORIA[id as number] ?? COR_PADRAO).borda }}
            />
            {nome as string}
          </span>
        ))}
        <span className="ml-auto inline-flex items-center gap-3 text-[11px] text-white/45">
          <span className="inline-flex items-center gap-1">
            <Check className="h-3 w-3 text-emerald-400" /> atendido
          </span>
          <span className="inline-flex items-center gap-1">
            <X className="h-3 w-3 text-red-400" /> faltou
          </span>
          <span className="inline-flex items-center gap-1">
            <span className="line-through opacity-50">nome</span> desmarcado
          </span>
        </span>
      </div>

      {/* ── Controles ── */}
      <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-1">
          <button
            onClick={() => mover(-1)}
            className="rounded-lg border border-white/10 bg-white/5 p-1.5 text-white/70 hover:bg-white/10"
            aria-label="Semana anterior"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <button
            onClick={() => mover(1)}
            className="rounded-lg border border-white/10 bg-white/5 p-1.5 text-white/70 hover:bg-white/10"
            aria-label="Próxima semana"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
          <button
            onClick={() => setAncora(segundaDe(new Date()))}
            className="ml-1 rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-[11px] text-white/70 hover:bg-white/10"
          >
            hoje
          </button>
        </div>

        <h2 className="text-lg font-medium text-white/85">{titulo}</h2>

        <div className="flex items-center gap-1 rounded-lg border border-white/10 bg-white/5 p-0.5">
          {([6, 7] as const).map((n) => (
            <button
              key={n}
              onClick={() => setDias(n)}
              className={`rounded-md px-2.5 py-1 text-[11px] ${
                dias === n ? "bg-white/10 text-white/90" : "text-white/45 hover:text-white/70"
              }`}
            >
              {n === 6 ? "seg–sáb" : "semana"}
            </button>
          ))}
        </div>
      </div>

      {/* ── Grade ── */}
      <div className="mt-4 overflow-x-auto rounded-xl border border-white/10 bg-white/[0.02]">
        <div className="min-w-[760px]">
          {/* cabeçalho */}
          <div
            className="grid border-b border-white/10"
            style={{ gridTemplateColumns: `56px repeat(${dias}, minmax(0,1fr))` }}
          >
            <div />
            {colunas.map((d) => (
              <div
                key={d.toISOString()}
                className={`border-l border-white/5 py-2 text-center text-[11.5px] ${
                  iso(d) === hojeIso ? "bg-white/[0.04] font-medium text-white/90" : "text-white/55"
                }`}
              >
                {DIAS[d.getDay()]} {String(d.getDate()).padStart(2, "0")}/
                {String(d.getMonth() + 1).padStart(2, "0")}
              </div>
            ))}
          </div>

          {/* linhas de 30 min */}
          {Array.from({ length: slots }, (_, s) => {
            const hora = horaInicio + Math.floor(s / SLOTS_POR_HORA);
            const meia = s % SLOTS_POR_HORA === 1;
            return (
              <div
                key={s}
                className="grid"
                style={{ gridTemplateColumns: `56px repeat(${dias}, minmax(0,1fr))` }}
              >
                <div
                  className={`pr-2 pt-0.5 text-right text-[10px] tabular-nums ${meia ? "text-white/25" : "text-white/45"}`}
                  style={{ height: ALTURA_SLOT }}
                >
                  {meia ? `${hora}:30` : `${String(hora).padStart(2, "0")}`}
                </div>
                {colunas.map((d) => {
                  const itens = porDiaSlot.get(`${iso(d)}|${s}`) ?? [];
                  return (
                    <div
                      key={d.toISOString() + s}
                      className={`relative border-l border-t border-white/5 ${
                        iso(d) === hojeIso ? "bg-white/[0.02]" : ""
                      } ${meia ? "border-t-white/[0.03]" : ""}`}
                      style={{ height: ALTURA_SLOT }}
                    >
                      {itens.map((it, i) => (
                        <div
                          key={it.idSchedule}
                          className="absolute inset-y-0"
                          style={{
                            left: `${(i / itens.length) * 100}%`,
                            width: `${100 / itens.length}%`,
                          }}
                        >
                          <Bloco item={it} />
                        </div>
                      ))}
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>

      {q.isLoading && <p className="mt-3 text-[11px] text-white/40">Carregando agenda…</p>}
      {q.isError && (
        <p className="mt-3 text-[11px] text-white/40">
          Não foi possível carregar a agenda. Confira o token da unidade.
        </p>
      )}
      {q.data && (
        <p className="mt-3 text-[11px] text-white/40">
          {q.data.total} horários no período · fonte: agenda do Doutor Hérnia
        </p>
      )}
    </div>
  );
}
