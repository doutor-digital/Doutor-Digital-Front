import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { PageHeader } from "@/components/layout/PageHeader";
import { unitsService } from "@/services/units";
import {
  auditoriaService,
  type AuditoriaAchado,
  type AuditoriaProntuario,
  type Severidade,
} from "@/services/auditoria";

/**
 * Auditoria de prontuários — Imperatriz.
 *
 * Não procura erro clínico: procura registro que não sustenta auditoria. O achado mais
 * pesado é o questionário de incapacidade criado depois do fato — a métrica que justifica
 * a alta sendo reconstruída de memória no dia da alta.
 *
 * Fixa em Imperatriz porque é a única unidade com credencial do CRM web cadastrada. A
 * unidade é resolvida pelo nome, não por id fixo, para não quebrar se o cadastro mudar.
 */

const UNIDADE = "IMPERATRIZ";

/**
 * Severidade nunca é comunicada só por cor: cada uma leva glifo + rótulo. As cores são a
 * paleta de status (crítico/alerta), e "info" fica neutro de propósito — é nota, não
 * estado, e com o laranja de status o par alerta↔info fica indistinguível.
 */
const SEV: Record<Severidade, { glifo: string; nome: string; cor: string; borda: string }> = {
  critico: { glifo: "◆", nome: "crítico", cor: "#d03b3b", borda: "border-l-[#d03b3b]" },
  alerta: { glifo: "▲", nome: "alerta", cor: "#fab219", borda: "border-l-[#fab219]" },
  info: { glifo: "●", nome: "info", cor: "#898781", borda: "border-l-[#898781]" },
};

const conta = (achados: AuditoriaAchado[], s: Severidade) =>
  achados.filter((a) => a.severidade === s).length;

function Selo({ sev, valor }: { sev: Severidade; valor: number | string }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-white/10 px-2 py-0.5 text-[12px] font-semibold text-white/90">
      <span style={{ color: SEV[sev].cor }} className="text-[10px]">
        {SEV[sev].glifo}
      </span>
      {valor}
    </span>
  );
}

function Tile({ rotulo, valor, nota, cor }: { rotulo: string; valor: string; nota: string; cor?: string }) {
  return (
    <div className="rounded-xl border border-white/[0.07] bg-white/[0.02] px-4 py-3.5">
      <p className="text-[11px] uppercase tracking-[0.08em] text-white/40">{rotulo}</p>
      <p className="mt-1 text-[30px] font-semibold leading-none" style={cor ? { color: cor } : undefined}>
        {valor}
      </p>
      <p className="mt-1.5 text-[12px] text-white/45">{nota}</p>
    </div>
  );
}

/** EVA ao longo das sessões: uma série só, então sem legenda — o título nomeia o dado. */
function GraficoEva({ p }: { p: AuditoriaProntuario }) {
  const pontos = p.evolucoes
    .map((e) => ({ data: e.data, dia: e.diaRotulo, ini: e.evaInicial, fim: e.evaFinal }))
    .filter((x) => x.ini !== null || x.fim !== null);

  if (pontos.length < 2) return null;

  const L = 720, A = 180, padE = 30, padD = 12, padT = 12, padB = 26;
  const plotW = L - padE - padD;
  const plotH = A - padT - padB;
  const x = (i: number) => padE + (i / (pontos.length - 1)) * plotW;
  const y = (v: number) => padT + plotH - (v / 10) * plotH;
  const vals = pontos.map((pt) => pt.ini ?? pt.fim ?? 0);

  return (
    <div className="mt-4">
      <h3 className="text-[13px] font-semibold text-white/85">EVA por sessão registrada</h3>
      <p className="mt-0.5 text-[12px] text-white/45">
        Escala visual analógica de dor no início de cada sessão.
      </p>
      <svg viewBox={`0 0 ${L} ${A}`} className="mt-2 w-full overflow-visible" role="img">
        {[0, 2, 4, 6, 8, 10].map((v) => (
          <g key={v}>
            <line x1={padE} y1={y(v)} x2={L - padD} y2={y(v)} stroke="rgba(255,255,255,0.07)" />
            <text x={padE - 7} y={y(v) + 4} textAnchor="end" className="fill-white/35 text-[10px]">
              {v}
            </text>
          </g>
        ))}
        <path
          d={vals.map((v, i) => `${i === 0 ? "M" : "L"}${x(i)},${y(v)}`).join(" ")}
          fill="none"
          stroke="#3987e5"
          strokeWidth={2}
          strokeLinejoin="round"
        />
        {vals.map((v, i) => (
          <circle key={i} cx={x(i)} cy={y(v)} r={4} fill="#3987e5" stroke="#0b0f16" strokeWidth={2}>
            <title>
              {pontos[i].data}
              {pontos[i].dia !== null ? ` · DIA ${pontos[i].dia}` : ""} — EVA inicial{" "}
              {pontos[i].ini ?? "—"}, final {pontos[i].fim ?? "—"}
            </title>
          </circle>
        ))}
        <text x={padE} y={A - 8} className="fill-white/35 text-[10px]">
          {pontos[0].data}
        </text>
        <text x={L - padD} y={A - 8} textAnchor="end" className="fill-white/35 text-[10px]">
          {pontos[pontos.length - 1].data}
        </text>
      </svg>
    </div>
  );
}

export default function AuditoriaPage() {
  const [selecionada, setSelecionada] = useState<string | null>(null);
  const [busca, setBusca] = useState("");
  const [fSev, setFSev] = useState("");
  const [fRegra, setFRegra] = useState("");

  const qUnidades = useQuery({
    queryKey: ["units"],
    queryFn: () => unitsService.list(),
    staleTime: 5 * 60_000,
  });

  const unidade = useMemo(() => {
    const u = qUnidades.data?.find((x) => x.name?.toUpperCase().includes(UNIDADE));

    // Unit.id vem como number | string do cadastro; o endpoint exige numérico.
    return u ? { id: Number(u.id), name: u.name ?? UNIDADE } : null;
  }, [qUnidades.data]);

  const q = useQuery({
    queryKey: ["auditoria-prontuarios", unidade?.id],
    queryFn: () => auditoriaService.get(unidade!.id),
    enabled: Boolean(unidade?.id),
    // A varredura leva minutos e o backend já cacheia 30 min; refetch automático só custa.
    staleTime: 30 * 60_000,
    refetchOnWindowFocus: false,
  });

  const fichas = useMemo(() => {
    const todas = q.data?.prontuarios ?? [];
    const termo = busca.trim().toLowerCase();

    return todas.filter((p) => {
      if (fRegra && !p.achados.some((a) => a.regra === fRegra)) return false;
      if (fSev === "limpo" && p.achados.length > 0) return false;
      if (fSev === "critico" && conta(p.achados, "critico") === 0) return false;
      if (fSev === "alerta" && conta(p.achados, "alerta") === 0) return false;
      if (termo) {
        const alvo = `${p.nomePaciente} ${p.principal.fisioterapeuta} ${p.atendimentos
          .map((a) => a.id)
          .join(" ")}`.toLowerCase();
        if (!alvo.includes(termo)) return false;
      }
      return true;
    });
  }, [q.data, busca, fSev, fRegra]);

  const atual = useMemo(
    () => fichas.find((p) => p.chave === selecionada) ?? fichas[0] ?? null,
    [fichas, selecionada],
  );

  if (qUnidades.isLoading) return <p className="mt-6 text-[13px] text-white/50">Carregando unidades…</p>;

  if (!unidade) {
    return (
      <div className="pb-10">
        <PageHeader title="Auditoria de Prontuários" />
        <p className="mt-4 text-[13px] text-amber-300/80">
          Unidade {UNIDADE} não encontrada no cadastro.
        </p>
      </div>
    );
  }

  return (
    <div className="pb-12">
      <PageHeader
        badge={q.data?.periodo}
        title="Auditoria de Prontuários"
        description={`${unidade.name} — consistência de registro na evolução, questionário de incapacidade, CBDF e prognóstico`}
      />

      {q.isLoading && (
        <p className="mt-4 text-[13px] text-white/50">
          Varrendo prontuários no CRM da franquia. A primeira carga leva alguns minutos — depois
          fica em cache por 30 minutos.
        </p>
      )}

      {q.isError && (
        <p className="mt-4 text-[13px] text-red-300/80">
          Não foi possível carregar. Verifique se as credenciais do CRM web estão cadastradas para
          esta unidade.
        </p>
      )}

      {q.data && (
        <>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Tile
              rotulo="Fichas auditadas"
              valor={String(q.data.total)}
              nota={`${q.data.atendimentos} atendimentos · ${q.data.avaliacoes} avaliações`}
            />
            <Tile
              rotulo="Com achados"
              valor={String(q.data.comAchados)}
              nota={`${Math.round((q.data.comAchados / Math.max(q.data.total, 1)) * 100)}% das fichas`}
            />
            <Tile
              rotulo="Críticos"
              valor={String(q.data.criticos)}
              nota="invalidam a auditabilidade"
              cor={SEV.critico.cor}
            />
            <Tile
              rotulo="Alertas"
              valor={String(q.data.alertas)}
              nota="inconsistências de registro"
              cor={SEV.alerta.cor}
            />
          </div>

          <section className="mt-5 rounded-xl border border-white/[0.07] bg-white/[0.02] p-5">
            <h2 className="text-[14px] font-semibold text-white/90">Achados por regra</h2>
            <p className="mt-0.5 text-[12px] text-white/45">
              Quantas fichas dispararam cada regra. Severidade indicada por cor, glifo e rótulo.
            </p>
            <div className="mt-4 space-y-2">
              {q.data.porRegra.map((r) => {
                const max = Math.max(...q.data!.porRegra.map((x) => x.total));
                return (
                  <button
                    key={r.regra}
                    type="button"
                    onClick={() => setFRegra(fRegra === r.regra ? "" : r.regra)}
                    className="flex w-full items-center gap-3 rounded-lg px-1 py-0.5 text-left hover:bg-white/[0.03]"
                    title={`${SEV[r.severidade].nome} · ${r.total} ficha(s)`}
                  >
                    <span className="w-[280px] shrink-0 truncate text-[12px] text-white/60">
                      {r.titulo}
                    </span>
                    <span className="h-4 flex-1 overflow-hidden rounded">
                      <span
                        className="block h-full rounded"
                        style={{
                          width: `${Math.max((r.total / max) * 100, 1.5)}%`,
                          background: SEV[r.severidade].cor,
                        }}
                      />
                    </span>
                    <span className="w-14 shrink-0 text-right text-[12px] tabular-nums text-white/60">
                      <span style={{ color: SEV[r.severidade].cor }}>{SEV[r.severidade].glifo}</span>{" "}
                      {r.total}
                    </span>
                  </button>
                );
              })}
            </div>
          </section>

          <div className="mt-5 flex flex-wrap items-center gap-2">
            <input
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Buscar paciente, fisioterapeuta ou nº do atendimento"
              className="min-w-[280px] flex-1 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-[13px] text-white/90 placeholder:text-white/30 focus:border-emerald-400/40 focus:outline-none"
            />
            <select
              value={fSev}
              onChange={(e) => setFSev(e.target.value)}
              className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-[13px] text-white/80 focus:outline-none"
            >
              <option value="">Todas as severidades</option>
              <option value="critico">Somente com crítico</option>
              <option value="alerta">Somente com alerta</option>
              <option value="limpo">Sem achados</option>
            </select>
            <select
              value={fRegra}
              onChange={(e) => setFRegra(e.target.value)}
              className="max-w-[320px] rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-[13px] text-white/80 focus:outline-none"
            >
              <option value="">Todas as regras</option>
              {q.data.porRegra.map((r) => (
                <option key={r.regra} value={r.regra}>
                  {r.titulo} ({r.total})
                </option>
              ))}
            </select>
            <span className="ml-auto text-[12px] text-white/35">
              {fichas.length} de {q.data.total} fichas
            </span>
          </div>

          <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(300px,380px)_1fr]">
            <div className="max-h-[70vh] space-y-2 overflow-y-auto pr-1">
              {fichas.length === 0 && (
                <p className="py-10 text-center text-[13px] text-white/35">
                  Nada corresponde ao filtro.
                </p>
              )}
              {fichas.map((p) => {
                const c = conta(p.achados, "critico");
                const al = conta(p.achados, "alerta");
                const ativo = atual?.chave === p.chave;
                return (
                  <button
                    key={p.chave}
                    type="button"
                    onClick={() => setSelecionada(p.chave)}
                    className={`flex w-full items-center gap-3 rounded-xl border px-3.5 py-3 text-left transition ${
                      ativo
                        ? "border-emerald-400/40 bg-emerald-400/[0.06]"
                        : "border-white/[0.07] bg-white/[0.02] hover:bg-white/[0.04]"
                    }`}
                  >
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[13px] font-medium text-white/90">
                        {p.nomePaciente}
                      </span>
                      <span className="block truncate text-[12px] text-white/40">
                        #{p.principal.id} ·{" "}
                        {p.tipo === "avaliacao" ? "avaliação" : `${p.evolucoes.length} sessões`} ·{" "}
                        {p.principal.fisioterapeuta}
                      </span>
                    </span>
                    <span className="flex shrink-0 gap-1.5">
                      {c > 0 && <Selo sev="critico" valor={c} />}
                      {al > 0 && <Selo sev="alerta" valor={al} />}
                      {c === 0 && al === 0 && <Selo sev="info" valor="ok" />}
                    </span>
                  </button>
                );
              })}
            </div>

            <div className="rounded-xl border border-white/[0.07] bg-white/[0.02] p-5">
              {!atual ? (
                <p className="py-12 text-center text-[13px] text-white/35">
                  Selecione uma ficha à esquerda.
                </p>
              ) : (
                <FichaDetalhe p={atual} />
              )}
            </div>
          </div>

          <section className="mt-5 rounded-xl border border-white/[0.07] bg-white/[0.02] p-5">
            <h2 className="text-[14px] font-semibold text-white/90">Por fisioterapeuta</h2>
            <table className="mt-3 w-full text-[13px]">
              <thead>
                <tr className="text-[11px] uppercase tracking-[0.06em] text-white/35">
                  <th className="border-b border-white/[0.07] px-2 py-1.5 text-left">Fisioterapeuta</th>
                  <th className="border-b border-white/[0.07] px-2 py-1.5 text-right">Atendimentos</th>
                  <th className="border-b border-white/[0.07] px-2 py-1.5 text-right">Críticos</th>
                  <th className="border-b border-white/[0.07] px-2 py-1.5 text-right">Alertas</th>
                </tr>
              </thead>
              <tbody>
                {q.data.porProfissional.map((x) => (
                  <tr key={x.nome} className="text-white/70">
                    <td className="border-b border-white/[0.05] px-2 py-2">{x.nome}</td>
                    <td className="border-b border-white/[0.05] px-2 py-2 text-right tabular-nums">
                      {x.atendimentos}
                    </td>
                    <td className="border-b border-white/[0.05] px-2 py-2 text-right tabular-nums">
                      {x.criticos > 0 && <span style={{ color: SEV.critico.cor }}>◆ </span>}
                      {x.criticos}
                    </td>
                    <td className="border-b border-white/[0.05] px-2 py-2 text-right tabular-nums">
                      {x.alertas > 0 && <span style={{ color: SEV.alerta.cor }}>▲ </span>}
                      {x.alertas}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        </>
      )}
    </div>
  );
}

function Campo({ k, v }: { k: string; v: string }) {
  return (
    <div>
      <p className="text-[10px] uppercase tracking-[0.06em] text-white/35">{k}</p>
      <p className="text-[13px] font-medium text-white/85">{v}</p>
    </div>
  );
}

function FichaDetalhe({ p }: { p: AuditoriaProntuario }) {
  const q = p.questionario;

  // Datas citadas pelos achados: destacam a sessão correspondente na timeline.
  const marcadas = useMemo(
    () => new Set(p.achados.flatMap((a) => a.detalhe.match(/\d{2}\/\d{2}\/\d{4}/g) ?? [])),
    [p.achados],
  );

  return (
    <>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-[17px] font-semibold text-white/95">{p.nomePaciente}</h2>
          <p className="text-[12px] text-white/45">
            {p.idade !== null ? `${p.idade} anos · ` : ""}
            {p.plano || "sem plano registrado"}
          </p>
        </div>
        <div className="flex gap-1.5">
          <Selo sev="critico" valor={`${conta(p.achados, "critico")} crítico`} />
          <Selo sev="alerta" valor={`${conta(p.achados, "alerta")} alerta`} />
        </div>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3 border-t border-white/[0.07] pt-4 sm:grid-cols-4">
        <Campo k="Atendimentos" v={`${p.atendimentos.length} nesta janela`} />
        <Campo k="Evoluções" v={String(p.evolucoes.length)} />
        <Campo k="1ª consulta" v={p.primeiraConsulta ?? "—"} />
        <Campo
          k="Contador"
          v={p.realizados !== null ? `${p.realizados} de ${p.previstos ?? "?"}` : "—"}
        />
        <Campo k="Prognóstico" v={p.prognostico?.replace(/^Progn[óo]stico\s*/i, "") ?? "—"} />
        <Campo
          k="Roland-Morris"
          v={q ? `${q.escoreInicial ?? "—"} → ${q.escoreFinal ?? "—"}` : "não aplicado"}
        />
        <Campo k="Questionário criado" v={q?.criadoEm ?? "—"} />
        <Campo k="Fisioterapeuta" v={p.principal.fisioterapeuta} />
      </div>

      {p.cbdf.length > 0 && (
        <p className="mt-3 text-[12px] text-white/45">
          <span className="font-semibold text-white/60">CBDF:</span>{" "}
          {p.cbdf[0].split(" - ").slice(0, 2).join(" — ")}
        </p>
      )}

      <h3 className="mt-5 text-[13px] font-semibold text-white/85">
        Achados ({p.achados.length}) · escore {p.escore}
      </h3>
      <p className="mt-0.5 text-[12px] text-white/40">Crítico pesa 10, alerta 3, info 1.</p>

      {p.achados.length === 0 ? (
        <p className="py-6 text-center text-[13px] text-white/35">
          Nenhuma regra disparou nesta ficha.
        </p>
      ) : (
        <div className="mt-3 space-y-2.5">
          {p.achados.map((a, i) => (
            <div key={i} className={`border-l-[3px] pl-3 ${SEV[a.severidade].borda}`}>
              <p className="flex items-center gap-1.5 text-[13px] font-semibold text-white/90">
                <span style={{ color: SEV[a.severidade].cor }}>{SEV[a.severidade].glifo}</span>
                {a.titulo}
              </p>
              <p className="mt-0.5 text-[13px] text-white/55">{a.detalhe}</p>
            </div>
          ))}
        </div>
      )}

      <GraficoEva p={p} />

      {p.evolucoes.length > 0 && (
        <>
          <h3 className="mt-6 text-[13px] font-semibold text-white/85">
            Evolução ({p.evolucoes.length} registros)
          </h3>
          <p className="mt-0.5 text-[12px] text-white/40">
            Em ordem cronológica. Sessões citadas por algum achado aparecem destacadas.
          </p>
          <div className="mt-3 max-h-[420px] overflow-y-auto border-l-2 border-white/[0.07] pl-4">
            {p.evolucoes.map((e, i) => (
              <div
                key={i}
                className={`border-b border-white/[0.05] py-2.5 last:border-b-0 ${
                  marcadas.has(e.data) ? "-ml-2 rounded bg-[#fab219]/[0.07] pl-2" : ""
                }`}
              >
                <div className="flex flex-wrap items-baseline gap-2.5">
                  <span className="text-[13px] font-semibold tabular-nums text-white/85">
                    {e.data}
                  </span>
                  <span className="text-[12px] text-white/35">
                    {e.diaRotulo !== null ? `DIA ${e.diaRotulo}` : "sem rótulo de dia"}
                    {e.diaCorpo !== null && e.diaCorpo !== e.diaRotulo
                      ? ` · corpo cita DIA ${e.diaCorpo}`
                      : ""}
                  </span>
                  <span className="ml-auto text-[12px] tabular-nums text-white/45">
                    EVA {e.evaInicial ?? "—"} → {e.evaFinal ?? "—"}
                  </span>
                </div>
                <p className="mt-1 whitespace-pre-wrap text-[12.5px] leading-relaxed text-white/55">
                  {e.texto}
                </p>
              </div>
            ))}
          </div>
        </>
      )}
    </>
  );
}
