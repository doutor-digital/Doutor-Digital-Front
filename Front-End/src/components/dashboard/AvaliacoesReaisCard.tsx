import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { AlertTriangle } from "@/components/icons";
import { spineService } from "@/services/spine";

interface AvaliacoesReaisCardProps {
  unitId?: number;
  /** yyyy-MM-dd — período herdado do filtro da página. */
  de?: string;
  ate?: string;
  className?: string;
}

/** Limite duro da API do Doutor Hérnia: nenhuma consulta pode passar de 100 dias. */
const MAX_DIAS = 100;

type Preset = "filtro" | "7" | "30" | "90" | "custom";

const PRESETS: { key: Preset; label: string }[] = [
  { key: "filtro", label: "Período" },
  { key: "7", label: "7d" },
  { key: "30", label: "30d" },
  { key: "90", label: "90d" },
  { key: "custom", label: "Datas" },
];

function hoje(): string {
  return new Date().toISOString().slice(0, 10);
}

function diasAtras(n: number): string {
  return new Date(Date.now() - n * 86_400_000).toISOString().slice(0, 10);
}

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

function Linha({ rotulo, valor, tom }: { rotulo: string; valor: number; tom?: string }) {
  return (
    <div className="flex items-baseline justify-between py-1.5">
      <span className="text-sm text-white/50">{rotulo}</span>
      <span className={`text-sm font-medium tabular-nums ${tom ?? "text-white/80"}`}>{valor}</span>
    </div>
  );
}

/**
 * Avaliações — comparecimento real, vindo da agenda do Doutor Hérnia.
 *
 * Diferente dos demais cards do dashboard, o dado aqui não passa pela Kommo:
 * é o status da agenda da clínica. Serve de contraprova do campo "Compareceu"
 * preenchido pela recepção no CRM.
 *
 * Tem seleção de período própria porque a pergunta que ele responde raramente é
 * a mesma do filtro da página: "quantos compareceram nos últimos 90 dias" não
 * depende do recorte de leads que está sendo analisado em cima.
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

  return (
    <div className={`rounded-2xl border border-white/10 bg-white/[0.03] p-5 backdrop-blur ${className ?? ""}`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-white/60">
            Avaliações
          </p>
          <p className="mt-0.5 text-[11px] text-white/40">
            Agenda do Doutor Hérnia
            {janela.cortada && ` · cortado em ${MAX_DIAS} dias`}
          </p>
        </div>

        {q.data && (
          <div className="text-right">
            <div className="text-4xl font-semibold tabular-nums text-sky-400">
              {q.data.taxaComparecimento.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%
            </div>
            <div className="text-[11px] text-white/40">comparecimento</div>
          </div>
        )}
      </div>

      {/* Seletor de período próprio do card */}
      <div className="mt-3 flex flex-wrap items-center gap-1">
        {PRESETS.map((p) => (
          <button
            key={p.key}
            type="button"
            onClick={() => setPreset(p.key)}
            className={`rounded-full px-2.5 py-1 text-[11px] transition ${
              preset === p.key
                ? "bg-sky-400/20 text-sky-300"
                : "text-white/50 hover:bg-white/5 hover:text-white/70"
            }`}
          >
            {p.label}
          </button>
        ))}
      </div>

      {preset === "custom" && (
        <div className="mt-2 flex flex-wrap items-center gap-2">
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

      <div className="mt-3">
        {q.isLoading && <div className="h-28 animate-pulse rounded-lg bg-white/5" />}

        {q.isError && (
          <p className="text-[11px] text-white/40">
            Integração indisponível. Confira o token da unidade.
          </p>
        )}

        {q.data && (
          <>
            <div className="divide-y divide-white/5">
              <Linha rotulo="Agendadas" valor={q.data.agendadas} />
              <Linha rotulo="Compareceram" valor={q.data.compareceram} tom="text-emerald-400" />
              <Linha rotulo="Não compareceram" valor={q.data.naoCompareceram} tom="text-amber-400" />
              <Linha rotulo="Desmarcadas" valor={q.data.desmarcadas} />
              {q.data.aguardandoAtendimento > 0 && (
                <Linha rotulo="Ainda por atender" valor={q.data.aguardandoAtendimento} tom="text-sky-400" />
              )}
            </div>

            {q.data.alertaQualidadeDados && (
              <div className="mt-3 flex gap-2 rounded-lg border border-amber-400/20 bg-amber-400/[0.06] p-2.5">
                <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-400" />
                <p className="text-[10.5px] leading-relaxed text-amber-200/70">
                  {q.data.desmarcadas} desmarques contra {q.data.naoCompareceram} falta
                  {q.data.naoCompareceram === 1 ? "" : "s"} registrada
                  {q.data.naoCompareceram === 1 ? "" : "s"} — a recepção provavelmente marca como
                  “desmarcado” quem faltou. A taxa real de falta pode ser maior.
                </p>
              </div>
            )}

            {q.data.porProfissional.length > 0 && (
              <div className="mt-3 border-t border-white/5 pt-2">
                <p className="mb-1 text-[10px] uppercase tracking-wide text-white/35">
                  Por profissional
                </p>
                {q.data.porProfissional.map((p) => (
                  <Linha key={p.profissional} rotulo={p.profissional} valor={p.atendimentos} />
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
