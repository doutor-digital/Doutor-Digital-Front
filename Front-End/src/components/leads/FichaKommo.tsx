import { useState } from "react";
import { ChevronDown } from "@/components/icons";
import { cn } from "@/lib/utils";
import type { LeadCustomFieldDto } from "@/types";

/**
 * A ficha inteira do cartão da Kommo.
 *
 * O detalhe do lead mostrava dez colunas e escondia trinta e três campos: origem, motivo do
 * não agendamento, qualificação, tipo, valores, "Pausar IA" — tudo ficava guardado em
 * CustomFieldsJson e nunca chegava na tela. Era essa a metade que faltava.
 *
 * Os vazios vêm junto, recolhidos. O que a SDR não preencheu é metade do diagnóstico, e é
 * exatamente o que o painel de qualidade cobra em cima — some se a tela só mostrar o cheio.
 */
export function FichaKommo({ campos }: { campos: LeadCustomFieldDto[] }) {
  const [mostrarVazios, setMostrarVazios] = useState(false);

  if (!campos || campos.length === 0) return null;

  const cheios = campos.filter((c) => c.preenchido);
  const vazios = campos.filter((c) => !c.preenchido);

  return (
    <div className="rounded-xl border border-white/[0.07] bg-white/[0.02] px-4 py-3.5">
      <div className="mb-3 flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <p className="text-[10.5px] font-semibold uppercase tracking-[0.14em] text-slate-500">
          Ficha na Kommo
        </p>
        <p className="text-[11.5px] tabular-nums text-slate-600">
          {cheios.length} de {campos.length} preenchidos
        </p>
      </div>

      <dl className="grid grid-cols-1 gap-x-6 gap-y-2 sm:grid-cols-2">
        {cheios.map((c) => (
          <div
            key={`${c.fieldId}-${c.nome}`}
            className="flex items-baseline justify-between gap-3 border-b border-white/[0.04] pb-1.5"
          >
            <dt className="min-w-0 truncate text-[12px] text-slate-500">{c.nome}</dt>
            <dd
              className={cn(
                "shrink-0 text-right text-[12.5px] text-slate-200",
                c.ehData && "tabular-nums",
              )}
            >
              {c.valor}
            </dd>
          </div>
        ))}
      </dl>

      {vazios.length > 0 && (
        <>
          <button
            onClick={() => setMostrarVazios((v) => !v)}
            className="mt-3 flex items-center gap-1.5 text-[11.5px] text-slate-500 transition hover:text-slate-300"
            aria-expanded={mostrarVazios}
          >
            <ChevronDown
              className={cn("h-3.5 w-3.5 transition-transform", mostrarVazios && "rotate-180")}
            />
            {vazios.length} campos em branco neste cartão
          </button>

          {mostrarVazios && (
            <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-1">
              {vazios.map((c) => (
                <li key={`${c.fieldId}-${c.nome}`} className="text-[11.5px] text-slate-600">
                  {c.nome}
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </div>
  );
}
