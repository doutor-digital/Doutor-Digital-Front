import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Bar, BarChart, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { AlertTriangle } from "@/components/icons";
import {
  spineService,
  type GrupoSituacao,
  type SpineAvaliacoes,
} from "@/services/spine";

interface AvaliacoesReaisCardProps {
  unitId?: number;
  /** yyyy-MM-dd — período herdado do filtro da página. */
  de?: string;
  ate?: string;
  className?: string;
}

/** Janela máxima da API do Doutor Hérnia (99 porque o backend pede 1 dia a mais). */
const MAX_DIAS = 99;

/** Cor da superfície do card — usada como respiro de 2px entre segmentos empilhados. */
const SUPERFICIE = "#0d1526";

/**
 * Paleta por desfecho, não por situação: seis status colapsam em quatro cores.
 * Cada faixa leva nome e contagem ao lado — status nunca é comunicado só por cor.
 */
const COR: Record<GrupoSituacao, string> = {
  realizado: "#34d399",
  falta: "#fbbf24",
  cancelado: "#94a3b8",
  pendente: "#60a5fa",
  desconhecido: "#f472b6",
};

type Preset = "filtro" | "7" | "30" | "90" | "custom";

const PRESETS: { key: Preset; label: string }[] = [
  { key: "filtro", label: "Período" },
  { key: "7", label: "7d" },
  { key: "30", label: "30d" },
  { key: "90", label: "90d" },
  { key: "custom", label: "Datas" },
];

const hoje = () => new Date().toISOString().slice(0, 10);
const diasAtras = (n: number) => new Date(Date.now() - n * 86_400_000).toISOString().slice(0, 10);
const ddmm = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`;

/**
 * O número-herói não pode ser sempre verde: verde afirma "bom", e 45% de
 * comparecimento não é bom. Abaixo de 60% a agenda está sendo desperdiçada.
 */
function corDaTaxa(taxa: number): string {
  if (taxa >= 80) return "text-emerald-400";
  if (taxa >= 60) return "text-amber-400";
  return "text-red-400";
}

function limitarJanela(de?: string, ate?: string): { de?: string; ate?: string; cortada: boolean } {
  if (!de || !ate) return { de, ate, cortada: false };
  const dias = (Date.parse(ate) - Date.parse(de)) / 86_400_000;
  if (dias <= MAX_DIAS) return { de, ate, cortada: false };
  const inicio = new Date(Date.parse(ate) - MAX_DIAS * 86_400_000);
  return { de: inicio.toISOString().slice(0, 10), ate, cortada: true };
}

function DicaGrafico({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  const p = payload[0].payload;
  return (
    <div className="rounded-lg border border-white/10 bg-[#0b1220] px-2.5 py-1.5 text-[11px] shadow-xl">
      <p className="text-white/50">{label}</p>
      <p className="text-white/85">
        <span className="tabular-nums">{p.realizadas}</span> de{" "}
        <span className="tabular-nums">{p.total}</span> atendidas
      </p>
    </div>
  );
}

/**
 * Avaliações — o desfecho real de cada horário, vindo da agenda do Doutor Hérnia.
 *
 * Diferente dos demais cards, o dado não passa pela Kommo: é o status que a
 * recepção deu à agenda. Serve de contraprova do campo "Compareceu" do CRM.
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

  const d: SpineAvaliacoes | undefined = q.data;
  const serie = (d?.porDia ?? []).map((p) => ({
    dia: ddmm(p.dia),
    total: p.total,
    realizadas: p.realizadas,
    resto: p.total - p.realizadas,
  }));

  return (
    <div
      className={`rounded-2xl border border-white/10 bg-white/[0.03] p-5 backdrop-blur ${className ?? ""}`}
    >
      {/* ── Cabeçalho ── */}
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
          <div className="flex items-end gap-5">
            <div className="text-right">
              <div className="text-4xl font-semibold leading-none tabular-nums text-white/90">
                {d.realizadas}
              </div>
              <p className="mt-1 text-[11px] text-white/40">atendidas</p>
            </div>
            <div className="text-right">
              <div
                className={`text-4xl font-semibold leading-none tabular-nums ${corDaTaxa(d.taxaComparecimento)}`}
              >
                {d.taxaComparecimento.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}
                <span className="text-xl opacity-60">%</span>
              </div>
              <p className="mt-1 text-[11px] text-white/40">comparecimento</p>
            </div>
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

      {q.isLoading && <div className="mt-4 h-48 animate-pulse rounded-xl bg-white/5" />}

      {q.isError && (
        <p className="mt-4 text-[11px] text-white/40">
          Integração indisponível. Confira o token da unidade.
        </p>
      )}

      {d && (
        <>
          {/* ── Composição: uma barra, um segmento por situação ── */}
          <div className="mt-4 flex h-2.5 gap-[2px] overflow-hidden rounded-full">
            {d.porSituacao.map((s) => (
              <div
                key={s.idStatus}
                className="h-full first:rounded-l-full last:rounded-r-full"
                style={{ width: `${(s.total / (d.total || 1)) * 100}%`, background: COR[s.grupo] }}
                title={`${s.nome}: ${s.total}`}
              />
            ))}
          </div>

          {/* ── Todas as situações, nominais ── */}
          <div className="mt-3 space-y-0.5">
            {d.porSituacao.map((s) => (
              <div key={s.idStatus} className="flex items-center gap-2 py-[3px]">
                <span
                  className="h-2 w-2 shrink-0 rounded-full"
                  style={{ background: COR[s.grupo] }}
                />
                <span className="text-[11.5px] text-white/60">{s.nome}</span>
                <span className="ml-auto text-[11.5px] font-medium tabular-nums text-white/85">
                  {s.total}
                </span>
                <span className="w-11 shrink-0 text-right text-[11px] tabular-nums text-white/35">
                  {((s.total / (d.total || 1)) * 100).toFixed(0)}%
                </span>
              </div>
            ))}
            <div className="flex items-center gap-2 border-t border-white/5 pt-1.5">
              <span className="text-[11.5px] text-white/45">Total de horários</span>
              <span className="ml-auto text-[11.5px] font-medium tabular-nums text-white/70">
                {d.total}
              </span>
              <span className="w-11 shrink-0" />
            </div>
          </div>

          <p className="mt-2 text-[10.5px] leading-relaxed text-white/35">
            Comparecimento = {d.realizadas} atendidas ÷ {d.resolvidas} com desfecho.
            {d.total !== d.resolvidas &&
              ` ${d.total - d.resolvidas} ainda não aconteceram e ficam fora da conta.`}
          </p>

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
                    <Bar dataKey="realizadas" stackId="a">
                      {serie.map((_, i) => (
                        <Cell key={i} fill={COR.realizado} />
                      ))}
                    </Bar>
                    {/* stroke na cor da superfície = respiro de 2px entre os segmentos */}
                    <Bar
                      dataKey="resto"
                      stackId="a"
                      radius={[4, 4, 0, 0]}
                      stroke={SUPERFICIE}
                      strokeWidth={2}
                    >
                      {serie.map((_, i) => (
                        <Cell key={i} fill={COR.cancelado} fillOpacity={0.45} />
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
                Muito mais desmarques do que faltas registradas — a recepção provavelmente marca
                como “desmarcado” quem faltou. A taxa real de falta pode ser maior.
              </p>
            </div>
          )}
        </>
      )}
    </div>
  );
}
