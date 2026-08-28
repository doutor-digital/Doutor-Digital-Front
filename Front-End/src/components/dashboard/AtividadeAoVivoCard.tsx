import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";

interface Linha {
  leadId?: number | null;
  quando: string;
  /** lead · etapa · agenda · campo */
  tipo: string;
  /** ok · atencao · ruim · neutro */
  tom: string;
  texto: string;
}

interface Atividade {
  linhas: Linha[];
  naUltimaHora: number;
  entraramNaUltimaHora: number;
  maisRecente?: string | null;
}

const TOM: Record<string, string> = {
  ok: "text-emerald-400",
  atencao: "text-amber-400",
  ruim: "text-rose-400",
  neutro: "text-sky-400",
};

const hora = (iso: string) =>
  new Date(iso).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });

/**
 * O que aconteceu no CRM, na ordem em que aconteceu.
 *
 * POR QUE UM LOG, SE A PÁGINA INTEIRA JÁ SÃO NÚMEROS
 * --------------------------------------------------
 * Contagem esconde a história: "22 leads" não conta que 14 chegaram entre 10h e 11h e
 * depois o dia morreu. Esta é a prova bruta por trás de cada card acima — e a única parte
 * do dashboard que dá para deixar aberta numa tela da clínica o dia inteiro.
 *
 * FICA NO FIM DA PÁGINA
 * ---------------------
 * No topo competiria com as filas, e perderia: fila pede ação, log só informa. Depois dos
 * números, ele é o que sustenta o que veio antes.
 *
 * As linhas novas entram por cima, uma a uma, quando a consulta se atualiza — não é enfeite:
 * é o que faz alguém perceber que algo aconteceu sem estar olhando para a tela.
 */
export function AtividadeAoVivoCard({
  unitId,
  className = "",
}: {
  unitId?: number | null;
  className?: string;
}) {
  const { data, isLoading } = useQuery({
    queryKey: ["atividade", unitId],
    queryFn: async () => {
      const { data } = await api.get<Atividade>("/api/saude/atividade", {
        params: { unitId, limite: 40 },
      });
      return data;
    },
    enabled: !!unitId,
    // Log parado não é log. 30s é o intervalo em que a Kommo entrega o webhook.
    refetchInterval: 30_000,
    staleTime: 20_000,
  });

  // Marca quais linhas são novas desde a última leitura, para animar só essas.
  const vistas = useRef<Set<string>>(new Set());
  const [novas, setNovas] = useState<Set<string>>(new Set());

  const chave = (l: Linha) => `${l.quando}|${l.tipo}|${l.leadId ?? ""}`;

  useEffect(() => {
    if (!data?.linhas) return;
    const primeiraCarga = vistas.current.size === 0;
    const recemChegadas = new Set<string>();

    data.linhas.forEach((l) => {
      const k = chave(l);
      if (!vistas.current.has(k)) {
        vistas.current.add(k);
        if (!primeiraCarga) recemChegadas.add(k);
      }
    });

    if (recemChegadas.size > 0) {
      setNovas(recemChegadas);
      const t = setTimeout(() => setNovas(new Set()), 2600);
      return () => clearTimeout(t);
    }
  }, [data]);

  if (!unitId) return null;

  const linhas = data?.linhas ?? [];

  return (
    <div
      className={cn(
        "overflow-hidden rounded-xl border border-slate-200 bg-white border border-slate-200",
        className,
      )}
    >
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 border-b border-slate-200 px-4 py-2.5">
        <p className="text-[10.5px] font-semibold uppercase tracking-[0.14em] text-slate-500">
          Atividade
        </p>
        <span className="flex items-center gap-2 text-[11px] text-emerald-400/90">
          <i className="relative inline-block h-1.5 w-1.5 rounded-full bg-emerald-400">
            <i className="absolute inset-0 animate-ping rounded-full bg-emerald-400 opacity-70" />
          </i>
          ao vivo
        </span>
        <span className="ml-auto text-[11px] tabular-nums text-slate-500">
          {data?.naUltimaHora ?? 0} na última hora
          {(data?.entraramNaUltimaHora ?? 0) > 0 && (
            <>
              <span className="mx-1.5 text-slate-700">·</span>
              {data!.entraramNaUltimaHora} leads novos
            </>
          )}
        </span>
      </div>

      <div className="max-h-[300px] overflow-y-auto px-4 py-3 font-mono text-[11.5px] leading-[1.85]">
        {isLoading && linhas.length === 0 ? (
          <p className="text-slate-600">carregando…</p>
        ) : linhas.length === 0 ? (
          /* Log vazio é indistinguível de log quebrado — então ele diz qual dos dois é. */
          <p className="text-slate-600">
            Nada registrado nas últimas 24 h. Se houve movimento na Kommo, o webhook parou.
          </p>
        ) : (
          <ul>
            {linhas.map((l) => {
              const k = chave(l);
              return (
                <li
                  key={k}
                  className={cn(
                    "flex gap-2.5 whitespace-nowrap transition-colors duration-700",
                    novas.has(k) && "animate-[fadeIn_.3s_ease] bg-slate-50",
                  )}
                >
                  <span className="shrink-0 tabular-nums text-slate-600">{hora(l.quando)}</span>
                  <span className={cn("w-[52px] shrink-0", TOM[l.tom] ?? TOM.neutro)}>
                    {l.tipo}
                  </span>
                  <span className="truncate text-slate-300">{l.texto}</span>
                </li>
              );
            })}
          </ul>
        )}

        {/* Cursor: o sinal de que a próxima linha ainda pode chegar. */}
        <span className="mt-0.5 inline-block h-3 w-[7px] animate-pulse bg-emerald-400/80 align-[-2px]" />
      </div>
    </div>
  );
}
