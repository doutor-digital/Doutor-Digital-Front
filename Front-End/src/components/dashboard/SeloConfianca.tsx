import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";

interface FonteSaude {
  id: string;
  nome: string;
  /** ok · atrasado · desconectado */
  status: string;
  atualizadoEm?: string | null;
  minutosAtras?: number | null;
  limiteMinutos: number;
  detalhe?: string | null;
}

interface SaudeDto {
  temAlerta: boolean;
  fontes: FonteSaude[];
}

/**
 * Selo de confiança: quão fresco está o dado de cada fonte.
 *
 * Em 05/08/2026 o sync da Kommo estava parado havia 13 dias, em todas as unidades, e o
 * dashboard seguiu mostrando os números de 22/07 com a mesma cara de sempre. A falha só
 * apareceu porque alguém desconfiou de um card.
 *
 * Número velho com aparência de novo é pior que tela de erro: leva a decisão errada com
 * confiança. Este selo existe para o dashboard conseguir dizer que não está confiável.
 */
export function SeloConfianca({ unitId }: { unitId?: number | null }) {
  const { data } = useQuery({
    queryKey: ["saude-fontes", unitId],
    queryFn: async () => {
      const { data } = await api.get<SaudeDto>("/api/saude/fontes", {
        params: unitId ? { unitId } : {},
      });
      return data;
    },
    enabled: !!unitId,
    // Frescor é justamente o que não pode ficar velho em cache.
    staleTime: 60_000,
    refetchInterval: 5 * 60_000,
  });

  if (!data) return null;

  const alertas = data.fontes.filter((f) => f.status !== "ok");

  return (
    <div
      className={cn(
        "mb-4 flex flex-wrap items-center gap-x-5 gap-y-2 rounded-xl border px-4 py-2.5",
        data.temAlerta
          ? "border-rose-400/25 bg-rose-400/[0.06]"
          : "border-slate-200 bg-slate-50",
      )}
    >
      {data.fontes.map((f) => (
        <span key={f.id} className="flex items-center gap-2" title={f.detalhe ?? undefined}>
          <span
            className={cn(
              "h-1.5 w-1.5 shrink-0 rounded-full",
              f.status === "ok"
                ? "bg-emerald-400"
                : f.status === "atrasado"
                  ? "bg-rose-400"
                  : "bg-slate-500",
            )}
          />
          <span className="text-[12px] text-slate-300">{f.nome}</span>
          <span
            className={cn(
              "text-[11.5px] tabular-nums",
              f.status === "ok" ? "text-slate-500" : "text-rose-300",
            )}
          >
            {rotulo(f)}
          </span>
        </span>
      ))}

      {/* A explicação do que fazer fica ao lado, não escondida no title: quem lê
          "Kommo há 13 dias" precisa saber que é o sync, não a clínica parada. */}
      {alertas.length > 0 && alertas[0].detalhe && (
        <span className="w-full text-[11.5px] text-rose-200/80 sm:ml-auto sm:w-auto">
          {alertas[0].detalhe}
        </span>
      )}
    </div>
  );
}

function rotulo(f: FonteSaude) {
  if (f.status === "desconectado") return "não conectado";
  const m = f.minutosAtras ?? 0;
  if (m < 60) return `há ${m} min`;
  const h = Math.floor(m / 60);
  if (h < 48) return `há ${h} h`;
  return `há ${Math.floor(h / 24)} dias`;
}
