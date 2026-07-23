import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { PageHeader } from "@/components/layout/PageHeader";
import { redeComparativo, type SpineRedeUnidade } from "@/services/spine";

/**
 * Comparativo entre unidades da rede — a tela do franqueador master.
 * Só entram as unidades que conectaram o Doutor Hérnia; as demais aparecem numa
 * faixa "ainda não conectadas", que some conforme os tokens vão sendo colados.
 */

type Preset = "7" | "30" | "90";
const PRESETS: { key: Preset; label: string }[] = [
  { key: "7", label: "7 dias" },
  { key: "30", label: "30 dias" },
  { key: "90", label: "90 dias" },
];

const diasAtras = (n: number) => new Date(Date.now() - n * 86_400_000).toISOString().slice(0, 10);
const hoje = () => new Date().toISOString().slice(0, 10);

function corTaxa(t: number): string {
  if (t >= 80) return "text-emerald-400";
  if (t >= 60) return "text-amber-400";
  return "text-red-400";
}

function BarraMini({ pct, cor }: { pct: number; cor: string }) {
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/5">
      <div className="h-full rounded-full" style={{ width: `${Math.min(pct, 100)}%`, background: cor }} />
    </div>
  );
}

export default function RedeComparativoPage() {
  const [preset, setPreset] = useState<Preset>("30");
  const de = diasAtras(Number(preset));

  const q = useQuery({
    queryKey: ["spine-rede", preset],
    queryFn: () => redeComparativo(de, hoje()),
    staleTime: 5 * 60_000,
    retry: false,
  });

  const unidades = q.data?.unidades ?? [];
  const semToken = q.data?.semToken ?? [];
  const totais = q.data?.totais;
  const maxAgendadas = Math.max(1, ...unidades.map((u) => u.agendadas));

  const barCor = "#5b9bd5";
  const corComp = (t: number) => (t >= 80 ? "#34d399" : t >= 60 ? "#fbbf24" : "#f87171");

  return (
    <div className="pb-10">
      <PageHeader
        title="Rede — comparativo"
        description="Comparecimento em avaliações por unidade, direto do sistema clínico"
      />

      {/* Período */}
      <div className="mt-4 flex items-center gap-1">
        {PRESETS.map((p) => (
          <button
            key={p.key}
            onClick={() => setPreset(p.key)}
            className={`rounded-full px-3 py-1 text-[12px] transition ${
              preset === p.key ? "bg-white/10 text-white/90" : "text-white/45 hover:bg-white/5 hover:text-white/70"
            }`}
          >
            {p.label}
          </button>
        ))}
      </div>

      {/* Consolidado da rede */}
      {totais && (
        <div className="mt-4 grid grid-cols-3 gap-3">
          <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-4">
            <div className="text-2xl font-semibold tabular-nums text-white/90">{totais.unidades}</div>
            <div className="text-[11px] text-white/40">unidades conectadas</div>
          </div>
          <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-4">
            <div className="text-2xl font-semibold tabular-nums text-sky-400">{totais.agendadas}</div>
            <div className="text-[11px] text-white/40">avaliações agendadas</div>
          </div>
          <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-4">
            <div className={`text-2xl font-semibold tabular-nums ${corTaxa(totais.taxaComparecimento)}`}>
              {totais.taxaComparecimento.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%
            </div>
            <div className="text-[11px] text-white/40">comparecimento da rede</div>
          </div>
        </div>
      )}

      {q.isLoading && <div className="mt-4 h-64 animate-pulse rounded-2xl bg-white/5" />}
      {q.isError && (
        <p className="mt-4 text-[12px] text-white/40">
          Não foi possível carregar o comparativo.
        </p>
      )}

      {/* Ranking */}
      {unidades.length > 0 && (
        <div className="mt-4 overflow-hidden rounded-2xl border border-white/[0.06]">
          <table className="w-full text-[13px]">
            <thead className="bg-white/[0.03] text-[11px] uppercase tracking-wide text-white/40">
              <tr>
                <th className="px-4 py-2.5 text-left font-medium">#</th>
                <th className="px-4 py-2.5 text-left font-medium">Unidade</th>
                <th className="px-4 py-2.5 text-right font-medium">Agendadas</th>
                <th className="px-4 py-2.5 text-right font-medium">Compareceram</th>
                <th className="px-4 py-2.5 text-left font-medium">Comparecimento</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.04]">
              {unidades.map((u: SpineRedeUnidade, i) => (
                <tr key={u.unitId} className="hover:bg-white/[0.02]">
                  <td className="px-4 py-3 text-white/30 tabular-nums">{u.erro ? "—" : i + 1}</td>
                  <td className="px-4 py-3 font-medium text-white/85">
                    {u.unidade}
                    {u.erro && (
                      <span className="ml-2 rounded-full bg-red-500/10 px-2 py-0.5 text-[10px] text-red-300">
                        {u.erro}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-2">
                      <span className="tabular-nums text-white/70">{u.agendadas}</span>
                      <div className="w-16">
                        <BarraMini pct={(u.agendadas / maxAgendadas) * 100} cor={barCor} />
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums text-emerald-400">{u.compareceram}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <span className={`w-12 text-right tabular-nums ${corTaxa(u.taxaComparecimento)}`}>
                        {u.erro ? "—" : `${u.taxaComparecimento.toFixed(0)}%`}
                      </span>
                      <div className="flex-1">
                        {!u.erro && <BarraMini pct={u.taxaComparecimento} cor={corComp(u.taxaComparecimento)} />}
                      </div>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Unidades ainda sem token */}
      {semToken.length > 0 && (
        <div className="mt-4 rounded-2xl border border-white/[0.06] bg-white/[0.01] p-4">
          <p className="mb-2 text-[11px] uppercase tracking-wide text-white/35">
            Ainda não conectadas ({semToken.length})
          </p>
          <div className="flex flex-wrap gap-2">
            {semToken.map((u) => (
              <span key={u.unitId} className="rounded-full border border-white/10 px-2.5 py-1 text-[12px] text-white/50">
                {u.unidade}
              </span>
            ))}
          </div>
          <p className="mt-2 text-[11px] text-white/30">
            Cada unidade conecta o Doutor Hérnia em Integrações, colando o próprio token.
          </p>
        </div>
      )}
    </div>
  );
}
