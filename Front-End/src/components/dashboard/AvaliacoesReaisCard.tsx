import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Bar, BarChart, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { AlertTriangle } from "@/components/icons";
import { spineService, type SpineAvaliacoes } from "@/services/spine";

interface AvaliacoesReaisCardProps {
  unitId?: number;
  /** yyyy-MM-dd — período herdado do filtro da página. */
  de?: string;
  ate?: string;
  className?: string;
}

/** Limite duro da API do Doutor Hérnia: nenhuma consulta pode passar de 100 dias. */
const MAX_DIAS = 100;

/**
 * Paleta de status (não é categórica): verde = aconteceu, âmbar = falta,
 * cinza = horário devolvido. Cada faixa leva rótulo e contagem ao lado — status
 * nunca é comunicado só por cor.
 */
const COR = {
  compareceu: "#34d399",
  faltou: "#fbbf24",
  desmarcou: "#94a3b8",
} as const;

type Preset = "filtro" | "7" | "30" | "90" | "custom";

const PRESETS: { key: Preset; label: string }[] = [
  { key: "filtro", label: "Período" },
  { key: "7", label: "7d" },
  { key: "30", label: "30d" },
  { key: "90", label: "90d" },
  { key: "custom", label: "Datas" },
];

/** Cor da superfície do card — usada como "respiro" de 2px entre segmentos empilhados. */
const SUPERFICIE = "#0d1526";

/**
 * O número-herói não pode ser sempre verde: verde afirma "bom", e 45% de
 * comparecimento não é bom. A faixa vem da operação — abaixo de 60% a agenda
 * está sendo desperdiçada.
 */
function corDaTaxa(taxa: number): string {
  if (taxa >= 80) return "text-emerald-400";
  if (taxa >= 60) return "text-amber-400";
  return "text-red-400";
}

const hoje = () => new Date().toISOString().slice(0, 10);
const diasAtras = (n: number) => new Date(Date.now() - n * 86_400_000).toISOString().slice(0, 10);
const ddmm = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`;

/**
 * Corta a janela para caber no limite da API, mantendo o fim e recuando o início.
 * Necessário porque o filtro de "ano" da página estoura os 100 dias.
 */
function limitarJanela(de?: string, ate?: string): { de?: string; ate?: string; cortada: boolean } {
  if (!de || !ate) return { de, ate, cortada: false };
  const dias = (Date.parse(ate) - Date.parse(de)) / 86_400_000;
  if (dias <= MAX_DIAS) return { de, ate, cortada: false };
  const inicio = new Date(Date.parse(ate) - MAX_DIAS * 86_400_000);
  return { de: inicio.toISOString().slice(0, 10), ate, cortada: true };
}

/** Faixa de proporção: uma barra, três segmentos, 2px de respiro entre eles. */
function BarraProporcao({ d }: { d: SpineAvaliacoes }) {
  const total = d.agendadas || 1;
  const seg = [
    { v: d.compareceram, cor: COR.compareceu },
    { v: d.naoCompareceram, cor: COR.faltou },
    { v: d.desmarcadas + d.remarcadas, cor: COR.desmarcou },
  ].filter((s) => s.v > 0);

  return (
    <div className="flex h-2.5 gap-[2px] overflow-hidden rounded-full">
      {seg.map((s, i) => (
        <div
          key={i}
          className="h-full first:rounded-l-full last:rounded-r-full"
          style={{ width: `${(s.v / total) * 100}%`, background: s.cor }}
        />
      ))}
    </div>
  );
}

function Chip({ cor, rotulo, valor }: { cor: string; rotulo: string; valor: number }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-[11px] text-white/50">
      <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: cor }} />
      {rotulo}
      <span className="font-medium tabular-nums text-white/85">{valor}</span>
    </span>
  );
}

function DicaGrafico({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  const p = payload[0].payload;
  return (
    <div className="rounded-lg border border-white/10 bg-[#0b1220] px-2.5 py-1.5 text-[11px] shadow-xl">
      <p className="text-white/50">{label}</p>
      <p className="text-white/85">
        <span className="tabular-nums">{p.compareceram}</span> de{" "}
        <span className="tabular-nums">{p.agendadas}</span> compareceram
      </p>
    </div>
  );
}

/**
 * Avaliações — comparecimento real, vindo da agenda do Doutor Hérnia.
 *
 * Diferente dos demais cards, o dado aqui não passa pela Kommo: é o status da
 * agenda da clínica (ATENDIDO / NÃO COMPARECEU / DESMARCADO). Serve de
 * contraprova do campo "Compareceu" que a recepção preenche no CRM.
 *
 * Período próprio porque a pergunta que ele responde raramente é a mesma do
 * filtro da página.
 */
export function AvaliacoesReaisCard({ unitId, de, ate, className }: AvaliacoesReaisCardProps) {
  const [preset, setPreset] = useState<Preset>("filtro");
  const [customDe, setCustomDe] = useState(diasAtras(30));
  const [customAte, setCustomAte] = useState(hoje());

  const bruto =
    preset === "filtro"
      ? { de, ate }
      : preset === "custom"
        ? { de: customDe, ate: customAte }
        : { de: diasAtras(Number(preset)), ate: hoje() };

  const janela = limitarJanela(bruto.de, bruto.ate);

  const q = useQuery({
    queryKey: ["spine-avaliacoes", unitId, janela.de, janela.ate],
    queryFn: () => spineService.avaliacoes(unitId!, janela.de, janela.ate),
    enabled: !!unitId && !!janela.de && !!janela.ate,
    staleTime: 5 * 60_000,
    retry: false,
  });

  if (!unitId) return null;

  const d = q.data;
  const serie = (d?.porDia ?? []).map((p) => ({
    dia: ddmm(p.dia),
    agendadas: p.agendadas,
    compareceram: p.compareceram,
    faltaram: p.agendadas - p.compareceram,
  }));

  return (
    <div
      className={`rounded-2xl border border-white/10 bg-white/[0.03] p-5 backdrop-blur ${className ?? ""}`}
    >
      {/* ── Cabeçalho: identidade à esquerda, número-herói à direita ── */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-white/60">
            Avaliações
          </p>
          <p className="mt-1 text-[11px] text-white/40">
            Agenda do Doutor Hérnia
            {janela.de && janela.ate && ` · ${ddmm(janela.de)} a ${ddmm(janela.ate)}`}
            {janela.cortada && ` · cortado em ${MAX_DIAS}d`}
          </p>
        </div>

        {d && (
          <div className="text-right">
            <div
              className={`text-5xl font-semibold leading-none tabular-nums ${corDaTaxa(d.taxaComparecimento)}`}
            >
              {d.taxaComparecimento.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}
              <span className="text-2xl opacity-60">%</span>
            </div>
            <p className="mt-1 text-[11px] text-white/40">compareceram</p>
          </div>
        )}
      </div>

      {/* ── Período próprio do card ── */}
      <div className="mt-3 flex flex-wrap items-center gap-1">
        {PRESETS.map((p) => (
          <button
            key={p.key}
            type="button"
            onClick={() => setPreset(p.key)}
            className={`rounded-full px-2.5 py-1 text-[11px] transition ${
              preset === p.key
                ? "bg-white/10 text-white/90"
                : "text-white/45 hover:bg-white/5 hover:text-white/70"
            }`}
          >
            {p.label}
          </button>
        ))}
        {preset === "custom" && (
          <div className="ml-1 flex items-center gap-1.5">
            <input
              type="date"
              value={customDe}
              max={customAte}
              onChange={(e) => setCustomDe(e.target.value)}
              className="rounded-lg border border-white/10 bg-white/5 px-2 py-1 text-[11px] text-white/80 [color-scheme:dark]"
            />
            <span className="text-[11px] text-white/30">até</span>
            <input
              type="date"
              value={customAte}
              min={customDe}
              onChange={(e) => setCustomAte(e.target.value)}
              className="rounded-lg border border-white/10 bg-white/5 px-2 py-1 text-[11px] text-white/80 [color-scheme:dark]"
            />
          </div>
        )}
      </div>

      {q.isLoading && <div className="mt-4 h-40 animate-pulse rounded-xl bg-white/5" />}

      {q.isError && (
        <p className="mt-4 text-[11px] text-white/40">
          Integração indisponível. Confira o token da unidade.
        </p>
      )}

      {d && (
        <>
          {/* ── Composição do período: uma barra, rótulo em todo segmento ── */}
          <div className="mt-4">
            <BarraProporcao d={d} />
            <div className="mt-2.5 flex flex-wrap items-center gap-x-4 gap-y-1.5">
              <Chip cor={COR.compareceu} rotulo="Compareceram" valor={d.compareceram} />
              <Chip cor={COR.faltou} rotulo="Faltaram" valor={d.naoCompareceram} />
              <Chip
                cor={COR.desmarcou}
                rotulo="Desmarcadas"
                valor={d.desmarcadas + d.remarcadas}
              />
              <span className="ml-auto text-[11px] text-white/40">
                {d.agendadas} agendadas
                {d.aguardandoAtendimento > 0 && ` · ${d.aguardandoAtendimento} por atender`}
                {/* Só mostra pacientes quando difere do total: se for igual, é ruído;
                    se for menor, significa que alguém remarcou e ocupou 2 horários. */}
                {d.pacientesDistintos !== d.agendadas && ` · ${d.pacientesDistintos} pacientes`}
              </span>
            </div>
          </div>

          {/* ── Distribuição no tempo ── */}
          {serie.length > 1 && (
            <div className="mt-5">
              <p className="mb-1 text-[10px] uppercase tracking-wide text-white/35">Por dia</p>
              <div className="h-28">
                <ResponsiveContainer>
                  <BarChart data={serie} margin={{ top: 4, right: 4, left: -28, bottom: 0 }}>
                    <XAxis
                      dataKey="dia"
                      stroke="rgba(255,255,255,0.25)"
                      tick={{ fontSize: 10, fill: "rgba(255,255,255,0.4)" }}
                      tickLine={false}
                      axisLine={false}
                      interval="preserveStartEnd"
                      minTickGap={14}
                    />
                    <YAxis
                      stroke="rgba(255,255,255,0.25)"
                      tick={{ fontSize: 10, fill: "rgba(255,255,255,0.35)" }}
                      tickLine={false}
                      axisLine={false}
                      allowDecimals={false}
                      width={34}
                    />
                    <Tooltip content={<DicaGrafico />} cursor={{ fill: "rgba(255,255,255,0.04)" }} />
                    <Bar dataKey="compareceram" stackId="a" radius={[0, 0, 0, 0]}>
                      {serie.map((_, i) => (
                        <Cell key={i} fill={COR.compareceu} />
                      ))}
                    </Bar>
                    {/* stroke na cor da superfície = respiro de 2px entre os
                        segmentos empilhados, sem inventar espaçamento no dado */}
                    <Bar
                      dataKey="faltaram"
                      stackId="a"
                      radius={[4, 4, 0, 0]}
                      stroke={SUPERFICIE}
                      strokeWidth={2}
                    >
                      {serie.map((_, i) => (
                        <Cell key={i} fill={COR.desmarcou} fillOpacity={0.45} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          {/* ── Quem atendeu ── */}
          {d.porProfissional.length > 0 && (
            <div className="mt-4 border-t border-white/5 pt-3">
              <p className="mb-1.5 text-[10px] uppercase tracking-wide text-white/35">
                Quem atendeu
              </p>
              {d.porProfissional.map((p) => (
                <div key={p.profissional} className="flex items-baseline justify-between py-0.5">
                  <span className="truncate pr-3 text-[11.5px] text-white/60">
                    {p.profissional}
                  </span>
                  <span className="shrink-0 text-[11.5px] font-medium tabular-nums text-white/85">
                    {p.atendimentos}
                  </span>
                </div>
              ))}
            </div>
          )}

          {d.alertaQualidadeDados && (
            <div className="mt-4 flex gap-2 rounded-lg border border-amber-400/20 bg-amber-400/[0.06] p-2.5">
              <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-400" />
              <p className="text-[10.5px] leading-relaxed text-amber-200/70">
                {d.desmarcadas} desmarques contra {d.naoCompareceram} falta
                {d.naoCompareceram === 1 ? "" : "s"} registrada
                {d.naoCompareceram === 1 ? "" : "s"} — a recepção provavelmente marca como
                “desmarcado” quem faltou. A taxa real de falta pode ser maior.
              </p>
            </div>
          )}
        </>
      )}
    </div>
  );
}
