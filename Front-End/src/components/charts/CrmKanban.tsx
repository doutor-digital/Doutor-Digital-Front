import { useState } from "react";
import { Clock, MapPin, Phone } from "@/components/icons";

/**
 * Board de funil de vendas estilo CRM (amoCRM/Kommo "FUNIL"), tema escuro.
 *
 * Colunas por etapa do pipeline, cada uma com cabeçalho (nome + soma R$ + nº de
 * negócios) e uma lista de cards de negócio. No mobile cada coluna mostra poucos
 * cards e expande sob demanda (evita scroll infinito).
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

const INITIAL_VISIBLE = 5;

const dotClass: Record<KanbanTone, string> = {
  green: "bg-emerald-400",
  yellow: "bg-amber-400",
  red: "bg-rose-500",
};

const trailingIcon: Record<KanbanTone, React.ReactNode> = {
  green: <MapPin className="h-4 w-4 text-emerald-400" />,
  yellow: <Phone className="h-4 w-4 text-amber-400" />,
  red: <Clock className="h-4 w-4 text-rose-400" />,
};

const brl = (n: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(n);

const sumValue = (cards: KanbanCard[]) =>
  cards.reduce((s, c) => s + (c.value ?? 0), 0);

function Card({ card }: { card: KanbanCard }) {
  return (
    <div className="flex items-center gap-2.5 rounded-lg bg-[#0f1f3a]/90 p-3 ring-1 ring-white/10 transition hover:ring-emerald-400/30">
      <span className={`mt-1 h-2.5 w-2.5 shrink-0 self-start rounded-full ${dotClass[card.tone]}`} />
      <div className="min-w-0 flex-1">
        <p className="truncate text-[13.5px] font-semibold text-white">{card.name}</p>
        {card.subtitle && (
          <p className="truncate text-[12.5px] text-white/50">{card.subtitle}</p>
        )}
        <p
          className={`truncate text-[12.5px] tabular-nums ${
            card.value != null ? "font-semibold text-emerald-300/90" : "text-white/30"
          }`}
        >
          {card.value != null ? brl(card.value) : "Valor indefinido"}
        </p>
      </div>
      <span className="shrink-0 self-center">{trailingIcon[card.tone]}</span>
    </div>
  );
}

function Column({ col }: { col: KanbanColumn }) {
  const [expanded, setExpanded] = useState(false);
  const visible = expanded ? col.cards : col.cards.slice(0, INITIAL_VISIBLE);
  const hidden = col.cards.length - visible.length;

  return (
    <div className="flex w-[260px] shrink-0 flex-col sm:w-[250px]">
      {/* Header da coluna */}
      <div className="px-2 pb-3 pt-1 text-center">
        <p className="truncate text-[15px] font-bold text-white" title={col.title}>
          {col.title}
        </p>
        <p className="text-[12px] font-medium tabular-nums text-emerald-300/80">
          {brl(sumValue(col.cards))}
        </p>
        <p className="text-[11px] text-white/40">({col.cards.length} negócios)</p>
      </div>

      {/* Track de cards */}
      <div className="flex-1 space-y-2 rounded-xl bg-white/[0.03] p-2 ring-1 ring-white/5">
        {col.cards.length === 0 && (
          <div className="h-24 rounded-lg border border-dashed border-white/5" />
        )}
        {visible.map((card) => (
          <Card key={card.id} card={card} />
        ))}
        {col.cards.length > INITIAL_VISIBLE && (
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            className="w-full rounded-lg border border-white/10 bg-white/[0.02] py-2 text-[12px] font-medium text-white/60 transition hover:bg-white/[0.05] hover:text-white"
          >
            {expanded ? "Ver menos" : `Ver mais ${hidden} negócio${hidden > 1 ? "s" : ""}`}
          </button>
        )}
      </div>
    </div>
  );
}

export function CrmKanban({ columns }: { columns: KanbanColumn[] }) {
  const totalDeals = columns.reduce((s, c) => s + c.cards.length, 0);
  const totalValue = columns.reduce((s, c) => s + sumValue(c.cards), 0);

  if (columns.length === 0) {
    return <p className="py-8 text-center text-sm text-white/40">Sem negócios no período.</p>;
  }

  return (
    <div>
      {/* Cabeçalho do board */}
      <div className="mb-4 flex items-center gap-4 border-b border-white/10 pb-4">
        <span className="text-4xl font-bold leading-none text-white sm:text-5xl">{totalDeals}</span>
        <div className="leading-tight">
          <p className="text-xs font-semibold uppercase tracking-wider text-white/50">Negócios</p>
          <p className="text-lg font-semibold tabular-nums text-emerald-300 sm:text-xl">
            {brl(totalValue)}
          </p>
        </div>
      </div>

      {/* Colunas (scroll horizontal) */}
      <div className="-mx-1 flex gap-3 overflow-x-auto px-1 pb-3 [scrollbar-width:thin]">
        {columns.map((col) => (
          <Column key={col.id} col={col} />
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
    <span className="flex items-center gap-2 text-[12px] text-white/60">
      <span className={`h-3 w-3 rounded-sm ${dotClass[tone]}`} />
      {label}
    </span>
  );
}
