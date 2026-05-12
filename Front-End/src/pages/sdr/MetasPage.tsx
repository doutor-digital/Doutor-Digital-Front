import { useMemo } from "react";
import { Award, Sparkles, Target, TrendingUp } from "@/components/icons";
import { PageHeader } from "@/components/layout/PageHeader";
import { CloudiaLegendBanner, CloudiaInlineBadge } from "@/components/sdr/CloudiaField";
import { useIsClient, useSdrStore } from "@/lib/sdr/sdr-store";
import { cn, formatCurrency, formatNumber } from "@/lib/utils";

export default function MetasPage() {
  const ready = useIsClient();
  const { metas, leads } = useSdrStore();

  const mesAtual = new Date().toISOString().slice(0, 7);
  const metasMes = useMemo(() => metas.filter((m) => m.mes === mesAtual), [metas, mesAtual]);

  // Quantos leads cada login recebeu (auto-contagem da Cloudia)
  const leadsPorLogin = useMemo(() => {
    const m = new Map<string, { cadastro: number; resgate: number }>();
    for (const l of leads) {
      if (!l.login) continue;
      const cur = m.get(l.login) ?? { cadastro: 0, resgate: 0 };
      if (l.tipo === "Resgate") cur.resgate++;
      else cur.cadastro++;
      m.set(l.login, cur);
    }
    return m;
  }, [leads]);

  return (
    <div>
      <PageHeader
        badge="Seção 6 · Metas das Secretárias"
        title="Metas do mês"
        description={`Performance individual das secretárias — referência ${mesAtual}.`}
      />

      <CloudiaLegendBanner className="mb-5" />

      {ready && metasMes.length === 0 && (
        <div className="rounded-xl border border-dashed border-white/[0.06] bg-white/[0.01] py-16 text-center">
          <Target className="mx-auto h-8 w-8 text-slate-600" />
          <p className="mt-2 text-[12px] text-slate-500">Nenhuma meta cadastrada para este mês.</p>
        </div>
      )}

      {ready && metasMes.length > 0 && (
        <>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
            {metasMes.map((m) => {
              const auto = leadsPorLogin.get(m.login) ?? { cadastro: 0, resgate: 0 };
              const realCadastro = Math.max(m.realCadastro, auto.cadastro);
              const realResgate = Math.max(m.realResgate, auto.resgate);
              const total = realCadastro + realResgate;
              const pctMeta = (m.qtdTotal / Math.max(1, m.metaValor / 1000)) * 100; // proxy simples
              return (
                <article
                  key={m.id}
                  className="overflow-hidden rounded-xl border border-white/[0.06] bg-white/[0.015] p-4"
                >
                  <header className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-[10px] font-medium uppercase tracking-wider text-slate-500">
                        {m.unidade}
                      </p>
                      <h3 className="mt-1 truncate text-[14px] font-semibold text-slate-100">
                        {m.secretaria}
                      </h3>
                      <p className="mt-0.5 truncate font-mono text-[10.5px] text-slate-500">
                        {m.login}
                      </p>
                    </div>
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ring-1 ring-inset ring-emerald-400/25 bg-emerald-400/[0.05]">
                      <Award className="h-4 w-4 text-emerald-300" />
                    </div>
                  </header>

                  <div className="mt-3 grid grid-cols-2 gap-2">
                    <Cell label="Meta" value={formatCurrency(m.metaValor)} />
                    <Cell label="Total" value={formatNumber(total)} highlight />
                  </div>

                  <div className="mt-3">
                    <div className="flex items-center justify-between text-[10.5px]">
                      <span className="text-slate-500">Progresso</span>
                      <span className="tabular-nums text-emerald-200">
                        {pctMeta.toFixed(0)}%
                      </span>
                    </div>
                    <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-white/[0.05]">
                      <div
                        className={cn(
                          "h-full rounded-full transition-all",
                          pctMeta >= 100 ? "bg-emerald-400" : pctMeta >= 60 ? "bg-amber-400" : "bg-rose-400",
                        )}
                        style={{ width: `${Math.min(100, Math.max(0, pctMeta))}%` }}
                      />
                    </div>
                  </div>

                  <div className="mt-3 flex flex-wrap items-center gap-2 text-[11px]">
                    <Pill tone="sky">
                      <span>Cadastro</span>
                      <span className="font-semibold tabular-nums">{realCadastro}</span>
                      {auto.cadastro > 0 && <CloudiaInlineBadge />}
                    </Pill>
                    <Pill tone="amber">
                      <span>Resgate</span>
                      <span className="font-semibold tabular-nums">{realResgate}</span>
                      {auto.resgate > 0 && <CloudiaInlineBadge />}
                    </Pill>
                  </div>

                  <p className="mt-3 flex items-center gap-1.5 text-[10px] text-slate-500">
                    <Sparkles className="h-2.5 w-2.5 text-emerald-300" />
                    Real cadastro/resgate atualizado automaticamente conforme leads chegam pela Cloudia
                  </p>
                </article>
              );
            })}
          </div>

          {/* Resumo agregado */}
          <div className="mt-6 rounded-xl border border-white/[0.06] bg-white/[0.015] p-4">
            <div className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-emerald-300" />
              <h3 className="text-[13px] font-semibold text-slate-100">Resumo do mês</h3>
            </div>
            <div className="mt-3 grid grid-cols-2 gap-3 md:grid-cols-4">
              <Cell label="Total de secretárias" value={formatNumber(metasMes.length)} />
              <Cell
                label="Meta consolidada"
                value={formatCurrency(metasMes.reduce((s, m) => s + m.metaValor, 0))}
              />
              <Cell
                label="Cadastros (real)"
                value={formatNumber(metasMes.reduce((s, m) => s + m.realCadastro, 0))}
              />
              <Cell
                label="Resgates (real)"
                value={formatNumber(metasMes.reduce((s, m) => s + m.realResgate, 0))}
              />
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function Cell({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className="rounded-md border border-white/[0.05] bg-white/[0.015] p-2.5">
      <p className="text-[9.5px] uppercase tracking-wider text-slate-500">{label}</p>
      <p
        className={cn(
          "mt-0.5 text-[13px] font-semibold tabular-nums",
          highlight ? "text-emerald-200" : "text-slate-100",
        )}
      >
        {value}
      </p>
    </div>
  );
}

function Pill({ children, tone }: { children: React.ReactNode; tone: "sky" | "amber" }) {
  const cls =
    tone === "sky"
      ? "bg-sky-400/10 text-sky-200 ring-sky-400/20"
      : "bg-amber-400/10 text-amber-200 ring-amber-400/20";
  return (
    <span className={cn("inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 ring-1 ring-inset", cls)}>
      {children}
    </span>
  );
}
