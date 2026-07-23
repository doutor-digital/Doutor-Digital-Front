import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ChevronLeft, ChevronRight, Check, X } from "@/components/icons";
import { PageHeader } from "@/components/layout/PageHeader";
import { useClinic } from "@/hooks/useClinic";
import { agendaFranquia, type SpineAgendaItem } from "@/services/spine";
import { PacienteDrawer } from "@/components/dashboard/PacienteDrawer";

/**
 * Calendário (franquia) — a agenda da clínica como a recepção a vê no sistema
 * do Doutor Hérnia: grade semanal, uma coluna por dia, meia em meia hora.
 *
 * A cor vem da CATEGORIA do horário (avaliação, sessão, retorno), que é o que a
 * API expõe. O sistema da franquia colore pelo PROTOCOLO do tratamento
 * ("PROTOCOLO 03 MESES", "DESCOMPRESSÃO"…), informação que só existe no módulo
 * Tratamentos — bloqueado por permissão neste token. Quando liberarem, troca-se
 * a fonte da cor sem mexer no layout.
 *
 * Desfecho nunca depende só de cor: atendido leva ✓, falta leva ✕ e fundo de
 * alerta, desmarcado fica esmaecido e riscado.
 */

const SLOT_PX = 42;
const SLOTS_POR_HORA = 2;
const HORA_MIN_PADRAO = 7;
const HORA_MAX_PADRAO = 19;

/** borda (identidade) · fundo · texto do nome */
const COR_CATEGORIA: Record<number, [string, string, string]> = {
  1: ["#f59e0b", "rgba(245,158,11,0.14)", "#fcd34d"], // Avaliação
  2: ["#3b82f6", "rgba(59,130,246,0.13)", "#93c5fd"], // Sessão
  3: ["#10b981", "rgba(16,185,129,0.13)", "#6ee7b7"], // Retorno
  6: ["#8b5cf6", "rgba(139,92,246,0.13)", "#c4b5fd"], // Retorno com exames
  7: ["#06b6d4", "rgba(6,182,212,0.13)", "#67e8f9"], // Retorno pós-tratamento
};
const COR_PADRAO: [string, string, string] = ["#94a3b8", "rgba(148,163,184,0.12)", "#cbd5e1"];
const COR_FALTA: [string, string, string] = ["#ef4444", "rgba(239,68,68,0.14)", "#fca5a5"];

const DIAS = ["DOM", "SEG", "TER", "QUA", "QUI", "SEX", "SÁB"];
const MESES = [
  "janeiro", "fevereiro", "março", "abril", "maio", "junho",
  "julho", "agosto", "setembro", "outubro", "novembro", "dezembro",
];

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

/**
 * "ALESSANDRO LIMA DA SILVA" → "Alessandro Silva". Nome inteiro não cabe no
 * bloco e truncar no meio ("ALESSANDRO LIMA DA SIL") é pior que abreviar.
 */
function nomeCurto(completo: string): string {
  const p = completo.trim().split(/\s+/).filter(Boolean);
  if (p.length === 0) return "—";
  const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();
  return p.length === 1 ? cap(p[0]) : `${cap(p[0])} ${cap(p[p.length - 1])}`;
}

const hhmm = (d: Date) =>
  `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;

function Bloco({
  item,
  largura,
  offset,
  onClick,
}: {
  item: SpineAgendaItem;
  largura: number;
  offset: number;
  onClick: (nome: string) => void;
}) {
  const cancelado = item.grupo === "cancelado";
  const faltou = item.grupo === "falta";
  const [borda, fundo, texto] = faltou
    ? COR_FALTA
    : COR_CATEGORIA[item.idCategoria] ?? COR_PADRAO;
  const inicio = new Date(item.inicio);

  return (
    <button
      type="button"
      onClick={() => onClick(item.paciente)}
      className="absolute cursor-pointer overflow-hidden rounded-[7px] border-l-[3px] px-1.5 py-[3px] text-left shadow-sm transition hover:z-10 hover:brightness-125 focus:z-10 focus:outline-none focus:ring-1 focus:ring-white/40"
      style={{
        top: 2,
        height: SLOT_PX - 4,
        left: `calc(${offset}% + 3px)`,
        width: `calc(${largura}% - 6px)`,
        background: fundo,
        borderLeftColor: borda,
        opacity: cancelado ? 0.4 : 1,
      }}
      title={`${item.paciente} · ${hhmm(inicio)} · ${item.categoria} · ${item.status}${
        item.profissional ? ` · ${item.profissional}` : ""
      }`}
    >
      <div className="flex items-center gap-1">
        <span
          className="flex-1 truncate text-[11px] font-medium leading-tight"
          style={{ color: texto, textDecoration: cancelado ? "line-through" : undefined }}
        >
          {nomeCurto(item.paciente)}
        </span>
        {item.grupo === "realizado" && <Check className="h-3 w-3 shrink-0 text-emerald-400" />}
        {faltou && <X className="h-3 w-3 shrink-0 text-red-400" />}
      </div>
      <div className="truncate text-[9.5px] leading-[1.3] tabular-nums text-white/35">
        {hhmm(inicio)} · {item.categoria}
      </div>
    </button>
  );
}

export default function CalendarioFranquiaPage() {
  const { unitId } = useClinic();
  const [ancora, setAncora] = useState(() => segundaDe(new Date()));
  const [dias, setDias] = useState<6 | 7>(6); // seg–sáb, como no sistema da franquia
  const [pacienteSel, setPacienteSel] = useState<string | null>(null);

  const fim = useMemo(() => {
    const f = new Date(ancora);
    f.setDate(f.getDate() + dias - 1);
    return f;
  }, [ancora, dias]);

  const q = useQuery({
    queryKey: ["spine-agenda", unitId, iso(ancora), iso(fim)],
    queryFn: () => agendaFranquia(unitId!, iso(ancora), iso(fim)),
    enabled: !!unitId,
    staleTime: 5 * 60_000,
    retry: false,
  });

  const colunas = useMemo(
    () =>
      Array.from({ length: dias }, (_, i) => {
        const d = new Date(ancora);
        d.setDate(d.getDate() + i);
        return d;
      }),
    [ancora, dias],
  );

  /** chave "yyyy-mm-dd|hora|meia" → horários daquele intervalo */
  const porSlot = useMemo(() => {
    const mapa = new Map<string, SpineAgendaItem[]>();
    for (const it of q.data?.itens ?? []) {
      const dt = new Date(it.inicio);
      const chave = `${iso(dt)}|${dt.getHours()}|${dt.getMinutes() >= 30 ? 1 : 0}`;
      const lista = mapa.get(chave);
      if (lista) lista.push(it);
      else mapa.set(chave, [it]);
    }
    return mapa;
  }, [q.data]);

  /**
   * Linhas visíveis: da primeira à última hora com atendimento, COLAPSANDO as
   * horas totalmente vazias no meio numa faixa fina. A clínica para no almoço e
   * tem horários soltos às 21h que esticavam a tela à toa. Nada some — o intervalo
   * colapsado continua rotulado.
   */
  const linhas = useMemo(() => {
    const itens = q.data?.itens ?? [];
    if (itens.length === 0) {
      return Array.from(
        { length: (HORA_MAX_PADRAO - HORA_MIN_PADRAO) * SLOTS_POR_HORA },
        (_, i) => ({
          tipo: "slot" as const,
          hora: HORA_MIN_PADRAO + Math.floor(i / SLOTS_POR_HORA),
          meia: i % SLOTS_POR_HORA === 1,
        }),
      );
    }
    const horas = itens.map((i) => new Date(i.inicio).getHours());
    const min = Math.min(...horas);
    const max = Math.max(...horas);
    const ocupadas = new Set(horas);

    const out: (
      | { tipo: "slot"; hora: number; meia: boolean }
      | { tipo: "gap"; de: number; ate: number }
    )[] = [];
    for (let h = min; h <= max; h++) {
      if (!ocupadas.has(h)) {
        const ultimo = out[out.length - 1];
        if (ultimo?.tipo === "gap") ultimo.ate = h;
        else out.push({ tipo: "gap", de: h, ate: h });
        continue;
      }
      out.push({ tipo: "slot", hora: h, meia: false });
      out.push({ tipo: "slot", hora: h, meia: true });
    }
    return out;
  }, [q.data]);

  const hojeIso = iso(new Date());
  const mesmoMes = ancora.getMonth() === fim.getMonth();
  const periodo = mesmoMes
    ? `${ancora.getDate()} – ${fim.getDate()} de ${MESES[fim.getMonth()]}`
    : `${ancora.getDate()} de ${MESES[ancora.getMonth()]} – ${fim.getDate()} de ${MESES[fim.getMonth()]}`;

  const mover = (semanas: number) => {
    const d = new Date(ancora);
    d.setDate(d.getDate() + semanas * 7);
    setAncora(d);
  };

  const colsStyle = { gridTemplateColumns: `62px repeat(${dias}, minmax(0,1fr))` };

  return (
    <div className="pb-10">
      <PageHeader
        title="Calendário"
        description="Agenda da clínica, direto do sistema do Doutor Hérnia"
      />

      {/* ── Navegação ── */}
      <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => mover(-1)}
            className="rounded-lg border border-white/[0.09] bg-white/[0.04] p-1.5 text-white/70 transition hover:bg-white/10"
            aria-label="Semana anterior"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <button
            onClick={() => mover(1)}
            className="rounded-lg border border-white/[0.09] bg-white/[0.04] p-1.5 text-white/70 transition hover:bg-white/10"
            aria-label="Próxima semana"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
          <button
            onClick={() => setAncora(segundaDe(new Date()))}
            className="rounded-lg border border-white/[0.09] bg-white/[0.04] px-3 py-1.5 text-[11.5px] text-white/70 transition hover:bg-white/10"
          >
            hoje
          </button>
          <span className="ml-2 text-[15px] font-medium text-white/90">{periodo}</span>
        </div>

        <div className="flex items-center gap-0.5 rounded-lg border border-white/[0.09] bg-white/[0.04] p-0.5">
          {([6, 7] as const).map((n) => (
            <button
              key={n}
              onClick={() => setDias(n)}
              className={`rounded-md px-2.5 py-1 text-[11.5px] transition ${
                dias === n ? "bg-white/10 text-white/90" : "text-white/45 hover:text-white/70"
              }`}
            >
              {n === 6 ? "seg–sáb" : "semana"}
            </button>
          ))}
        </div>
      </div>

      {/* ── Legenda ── */}
      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-[11px] text-white/45">
        {[
          [1, "Avaliação"],
          [2, "Sessão"],
          [3, "Retorno"],
          [6, "Retorno c/ exames"],
          [7, "Retorno pós-tratamento"],
        ].map(([id, nome]) => (
          <span key={id as number} className="inline-flex items-center gap-1.5">
            <span
              className="h-2 w-2 rounded-sm"
              style={{ background: (COR_CATEGORIA[id as number] ?? COR_PADRAO)[0] }}
            />
            {nome as string}
          </span>
        ))}
        <span className="ml-auto inline-flex items-center gap-3">
          <span className="inline-flex items-center gap-1">
            <Check className="h-3 w-3 text-emerald-400" /> atendido
          </span>
          <span className="inline-flex items-center gap-1">
            <X className="h-3 w-3 text-red-400" /> faltou
          </span>
          <span className="inline-flex items-center gap-1">
            <span className="line-through opacity-45">riscado</span> desmarcado
          </span>
        </span>
      </div>

      {/* ── Grade ── */}
      <div className="mt-3 overflow-x-auto rounded-2xl border border-white/[0.07] bg-white/[0.015]">
        <div className="min-w-[820px]">
          {/* cabeçalho dos dias */}
          <div className="grid border-b border-white/[0.07] bg-white/[0.025]" style={colsStyle}>
            <div />
            {colunas.map((d) => {
              const hoje = iso(d) === hojeIso;
              return (
                <div
                  key={d.toISOString()}
                  className={`border-l border-white/[0.04] py-2.5 text-center ${
                    hoje ? "bg-sky-500/[0.06] shadow-[inset_0_-2px_0_#3b82f6]" : ""
                  }`}
                >
                  <div
                    className={`text-[9.5px] font-semibold tracking-[0.1em] ${hoje ? "text-sky-400" : "text-white/35"}`}
                  >
                    {DIAS[d.getDay()]}
                  </div>
                  <div
                    className={`text-[17px] font-medium leading-tight ${hoje ? "text-white" : "text-white/75"}`}
                  >
                    {String(d.getDate()).padStart(2, "0")}
                  </div>
                </div>
              );
            })}
          </div>

          {linhas.map((linha, idx) =>
            linha.tipo === "gap" ? (
              <div key={`gap-${idx}`} className="grid" style={colsStyle}>
                <div className="py-1 pr-2.5 text-right text-[9.5px] tabular-nums text-white/20">
                  {String(linha.de).padStart(2, "0")}–{String(linha.ate + 1).padStart(2, "0")}h
                </div>
                <div
                  className="border-l border-t border-white/[0.04] bg-white/[0.012]"
                  style={{ gridColumn: `span ${dias}` }}
                >
                  <div className="py-1 text-center text-[9.5px] text-white/20">sem atendimentos</div>
                </div>
              </div>
            ) : (
              <div key={`${linha.hora}-${linha.meia}`} className="grid" style={colsStyle}>
                <div
                  className="pr-2.5 pt-0.5 text-right text-[10.5px] tabular-nums text-white/30"
                  style={{ height: SLOT_PX }}
                >
                  {linha.meia ? "" : `${String(linha.hora).padStart(2, "0")}:00`}
                </div>
                {colunas.map((d) => {
                  const itens = porSlot.get(`${iso(d)}|${linha.hora}|${linha.meia ? 1 : 0}`) ?? [];
                  const hoje = iso(d) === hojeIso;
                  return (
                    <div
                      key={d.toISOString()}
                      className={`relative border-l border-white/[0.04] ${
                        linha.meia
                          ? "border-t border-dashed border-t-white/[0.028]"
                          : "border-t border-white/[0.055]"
                      } ${hoje ? "bg-sky-500/[0.035]" : ""}`}
                      style={{ height: SLOT_PX }}
                    >
                      {itens.map((it, i) => (
                        <Bloco
                          key={it.idSchedule}
                          item={it}
                          largura={100 / itens.length}
                          offset={(i / itens.length) * 100}
                          onClick={setPacienteSel}
                        />
                      ))}
                    </div>
                  );
                })}
              </div>
            ),
          )}
        </div>
      </div>

      {q.isLoading && <p className="mt-3 text-[11px] text-white/40">Carregando agenda…</p>}
      {q.isError && (
        <p className="mt-3 text-[11px] text-white/40">
          Não foi possível carregar a agenda. Confira o token da unidade.
        </p>
      )}
      {q.data && (
        <p className="mt-3 text-[11px] text-white/35">
          {q.data.total} horários no período · fonte: agenda do Doutor Hérnia
        </p>
      )}

      {unitId != null && (
        <PacienteDrawer unitId={unitId} nome={pacienteSel} onClose={() => setPacienteSel(null)} />
      )}
    </div>
  );
}
