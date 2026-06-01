import { Clock, MapPin, Phone } from "@/components/icons";

/**
 * Board de funil de vendas estilo CRM (amoCRM/Kommo "FUNIL").
 *
 * Colunas por etapa do pipeline, cada uma com cabeçalho (nome + soma R$ + nº de
 * negócios) e uma lista vertical de cards de negócio. Tema claro, fiel ao layout
 * do CRM da imagem de referência.
 */

export type KanbanTone = "green" | "yellow" | "red";

export interface KanbanCard {
  id: number | string;
  name: string;
  subtitle?: string;
  /** Valor do negócio em R$. null = "Valor indefinido". */
  value?: number | null;
  tone: KanbanTone;
}

export interface KanbanColumn {
  id: string;
  title: string;
  cards: KanbanCard[];
}

const dotClass: Record<KanbanTone, string> = {
  green: "bg-emerald-500",
  yellow: "bg-amber-400",
  red: "bg-rose-500",
};

// Ícone à direita do card varia conforme o "estado da tarefa" (igual amoCRM).
const trailingIcon: Record<KanbanTone, React.ReactNode> = {
  green: <MapPin className="h-4 w-4 text-emerald-500" />,
  yellow: <Phone className="h-4 w-4 text-amber-400" />,
  red: <Clock className="h-4 w-4 text-rose-400" />,
};

const brl = (n: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(n);

const sumValue = (cards: KanbanCard[]) =>
  cards.reduce((s, c) => s + (c.value ?? 0), 0);

export function CrmKanban({ columns }: { columns: KanbanColumn[] }) {
  const totalDeals = columns.reduce((s, c) => s + c.cards.length, 0);
  const totalValue = columns.reduce((s, c) => s + sumValue(c.cards), 0);

  if (columns.length === 0) {
    return <p className="py-8 text-center text-sm text-slate-400">Sem negócios no período.</p>;
  }

  return (
    <div>
      {/* Cabeçalho do board: total de negócios + soma R$ */}
      <div className="mb-4 flex items-center gap-4 border-b border-slate-200 pb-4">
        <span className="text-5xl font-bold leading-none text-slate-800">{totalDeals}</span>
        <div className="leading-tight">
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
            Negócios
          </p>
          <p className="text-xl font-semibold tabular-nums text-slate-700">{brl(totalValue)}</p>
        </div>
      </div>

      {/* Colunas (scroll horizontal) */}
      <div className="flex gap-px overflow-x-auto bg-slate-200/60 pb-2">
        {columns.map((col) => (
          <div key={col.id} className="flex w-[250px] shrink-0 flex-col bg-white">
            {/* Header da coluna: etapa + R$ + (N negócios) */}
            <div className="px-2 pb-3 pt-3 text-center">
              <p className="truncate text-[16px] font-bold text-slate-700" title={col.title}>
                {col.title}
              </p>
              <p className="text-[12px] font-medium tabular-nums text-slate-500">
                {brl(sumValue(col.cards))}
              </p>
              <p className="text-[11px] text-slate-400">({col.cards.length} negócios)</p>
            </div>

            {/* Track de cards */}
            <div className="flex-1 space-y-2 bg-slate-50 px-2 py-2">
              {col.cards.length === 0 && (
                <div className="h-24 rounded-md bg-slate-100/70" />
              )}
              {col.cards.map((card) => (
                <div
                  key={card.id}
                  className="flex items-center gap-2.5 rounded-md bg-white p-3 shadow-[0_1px_2px_rgba(0,0,0,0.06)] ring-1 ring-slate-200/70 transition hover:shadow-md"
                >
                  <span
                    className={`mt-1 h-2.5 w-2.5 shrink-0 self-start rounded-full ${dotClass[card.tone]}`}
                  />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[13.5px] font-semibold text-slate-800">
                      {card.name}
                    </p>
                    {card.subtitle && (
                      <p className="truncate text-[12.5px] text-slate-500">{card.subtitle}</p>
                    )}
                    <p
                      className={`truncate text-[12.5px] tabular-nums ${
                        card.value != null ? "font-semibold text-slate-600" : "text-slate-400"
                      }`}
                    >
                      {card.value != null ? brl(card.value) : "Valor indefinido"}
                    </p>
                  </div>
                  <span className="shrink-0 self-center">{trailingIcon[card.tone]}</span>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Legenda */}
      <div className="mt-4 flex flex-wrap items-center gap-x-6 gap-y-2">
        <Legend tone="green" label="Com tarefa agendada" />
        <Legend tone="yellow" label="Tarefa atrasada" />
        <Legend tone="red" label="Sem tarefa agendada" />
      </div>
    </div>
  );
}

function Legend({ tone, label }: { tone: KanbanTone; label: string }) {
  return (
    <span className="flex items-center gap-2 text-[12px] text-slate-500">
      <span className={`h-3 w-3 rounded-sm ${dotClass[tone]}`} />
      {label}
    </span>
  );
}
