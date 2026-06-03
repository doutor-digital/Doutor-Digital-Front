import { fmtInt, fmtPct, type MotivoPerda } from "@/services/desempenho";

/**
 * Bloco de motivos de perda em barras rankeadas (maior → menor), com quantidade e
 * participação (%) sobre o total do bloco.
 */
export function MotivosPerda({
  titulo,
  motivos,
  cor = "rose",
}: {
  titulo: string;
  motivos: MotivoPerda[];
  cor?: "rose" | "amber";
}) {
  const ordenados = [...motivos].sort((a, b) => b.quantidade - a.quantidade);
  const total = ordenados.reduce((s, m) => s + m.quantidade, 0);
  const max = ordenados[0]?.quantidade ?? 0;

  const barra =
    cor === "amber"
      ? "bg-gradient-to-r from-amber-500/40 to-amber-400/20"
      : "bg-gradient-to-r from-rose-500/40 to-rose-400/20";

  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
      <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-white/55">
        {titulo}
      </p>

      {ordenados.length === 0 ? (
        <p className="mt-4 text-[12px] text-white/40">Sem registros no período.</p>
      ) : (
        <ul className="mt-4 space-y-3">
          {ordenados.map((m, i) => {
            const largura = max > 0 ? (m.quantidade / max) * 100 : 0;
            const share = total > 0 ? m.quantidade / total : null;
            return (
              <li key={m.motivo}>
                <div className="flex items-center justify-between text-[12px]">
                  <span className="flex min-w-0 items-center gap-2 text-white/80">
                    <span className="text-[10px] tabular-nums text-white/30">{i + 1}.</span>
                    <span className="truncate">{m.motivo}</span>
                  </span>
                  <span className="shrink-0 tabular-nums text-white/60">
                    {fmtInt(m.quantidade)}
                    <span className="ml-1.5 text-white/35">({fmtPct(share)})</span>
                  </span>
                </div>
                <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-white/[0.04]">
                  <div
                    className={`h-full rounded-full ${barra}`}
                    style={{ width: `${Math.max(3, largura)}%` }}
                  />
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
