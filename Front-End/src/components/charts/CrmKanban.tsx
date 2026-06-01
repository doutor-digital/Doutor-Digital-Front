import { Phone } from "@/components/icons";

/**
 * Board de funil de vendas estilo CRM (amoCRM/Kommo "FUNIL").
 *
 * Colunas por etapa do pipeline, cada uma com cabeçalho (nome + nº de negócios)
 * e uma lista vertical de cards de negócio. Tema claro, fiel ao layout do CRM.
 */

export type KanbanTone = "green" | "yellow" | "red";

export interface KanbanCard {
  id: number | string;
  name: string;
  subtitle?: string;
  meta?: string;
  tone: KanbanTone;
}

export interface KanbanColumn {
  id: string;
  title: string;
  /** Cor de acento da etapa (hex), ex.: vinda do status da Kommo. */
  color?: string | null;
  cards: KanbanCard[];
}

const dotClass: Record<KanbanTone, string> = {
  green: "bg-emerald-500",
  yellow: "bg-amber-400",
  red: "bg-rose-500",
};

export function CrmKanban({ columns }: { columns: KanbanColumn[] }) {
  const totalDeals = columns.reduce((s, c) => s + c.cards.length, 0);

  if (columns.length === 0) {
    return <p className="py-8 text-center text-sm text-slate-400">Sem negócios no período.</p>;
  }

  return (
    <div>
      {/* Cabeçalho do board */}
      <div className="mb-4 flex items-baseline gap-3">
        <span className="text-4xl font-bold leading-none text-slate-800">{totalDeals}</span>
        <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
          Negócios
        </span>
      </div>

      {/* Colunas (scroll horizontal) */}
      <div className="flex gap-3 overflow-x-auto pb-3">
        {columns.map((col) => (
          <div key={col.id} className="flex w-[250px] shrink-0 flex-col">
            {/* Topo colorido da etapa */}
            <div
              className="h-1 rounded-t-md"
              style={{ background: col.color || "#cbd5e1" }}
            />
            {/* Header da coluna */}
            <div className="px-1 pb-2 pt-2 text-center">
              <p className="truncate text-[15px] font-bold text-slate-700" title={col.title}>
                {col.title}
              </p>
              <p className="text-[11px] text-slate-400">({col.cards.length} negócios)</p>
            </div>

            {/* Track de cards */}
            <div className="flex-1 space-y-2 rounded-lg bg-slate-100/80 p-2">
              {col.cards.length === 0 && (
                <p className="py-6 text-center text-[11px] text-slate-300">—</p>
              )}
              {col.cards.map((card) => (
                <div
                  key={card.id}
                  className="flex items-center gap-2.5 rounded-md bg-white p-2.5 shadow-sm ring-1 ring-slate-200/70 transition hover:shadow"
                >
                  <span
                    className={`mt-0.5 h-2.5 w-2.5 shrink-0 self-start rounded-full ${dotClass[card.tone]}`}
                  />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[13px] font-semibold text-slate-800">
                      {card.name}
                    </p>
                    {card.subtitle && (
                      <p className="truncate text-[12px] text-slate-500">{card.subtitle}</p>
                    )}
                    {card.meta && (
                      <p className="truncate text-[12px] font-medium text-slate-400">
                        {card.meta}
                      </p>
                    )}
                  </div>
                  <Phone className="h-4 w-4 shrink-0 self-center text-amber-400" />
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
