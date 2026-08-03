import { Lock } from "@/components/icons";

interface Props {
  /** Nome do dado que ficou indisponível — aparece na linha de apoio. */
  recurso?: string;
  /** "card" ocupa o corpo de um card; "pagina" centraliza numa área maior. */
  variante?: "card" | "pagina";
  className?: string;
}

/**
 * Estado de unidade SEM autorização da franquia — sem token da API do Doutor Hérnia
 * ou sem credencial do CRM web. Não é erro: é o estado normal de toda unidade até a
 * franquia liberar o acesso, e por isso aparece grande e explícito em vez de virar
 * um card vazio ou uma mensagem de falha que faz o usuário achar que quebrou.
 */
export function SemAutorizacaoFranquia({ recurso, variante = "card", className = "" }: Props) {
  const pagina = variante === "pagina";

  return (
    <div
      className={`flex flex-col items-center justify-center rounded-2xl border border-dashed border-amber-500/30 bg-amber-500/[0.04] text-center ${
        pagina ? "min-h-[420px] px-6 py-16" : "min-h-[180px] px-4 py-10"
      } ${className}`}
      role="status"
    >
      <Lock
        className={`mb-4 text-amber-400/70 ${pagina ? "h-10 w-10" : "h-7 w-7"}`}
        strokeWidth={1.5}
        aria-hidden
      />
      <p
        className={`font-semibold uppercase leading-tight tracking-tight text-amber-300 ${
          pagina ? "text-4xl sm:text-5xl" : "text-2xl sm:text-3xl"
        }`}
      >
        Sem autorização
        <br />
        da franquia
      </p>
      <p className={`mt-3 max-w-md text-slate-400 ${pagina ? "text-sm" : "text-xs"}`}>
        {recurso
          ? `${recurso} depende do acesso ao sistema da franquia, que ainda não foi liberado para esta unidade.`
          : "Esta unidade ainda não recebeu o acesso ao sistema da franquia."}
      </p>
      <p className={`mt-1 text-slate-500 ${pagina ? "text-xs" : "text-[11px]"}`}>
        Assim que a franquia liberar o token, os números aparecem aqui automaticamente.
      </p>
    </div>
  );
}
