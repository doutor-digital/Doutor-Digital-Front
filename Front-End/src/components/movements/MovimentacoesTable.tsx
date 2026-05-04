import { ExternalLink, Pencil, Trash2 } from "lucide-react";
import {
  CategoryBadge,
  PaymentMethodPill,
  StatusBadge,
  TypePill,
} from "@/components/movements/MovimentacaoBadges";
import {
  TBody,
  THead,
  Table,
  Td,
  Th,
  Tr,
} from "@/components/ui/Table";
import { Skeleton } from "@/components/ui/Skeleton";
import { EmptyState } from "@/components/ui/EmptyState";
import { Button } from "@/components/ui/Button";
import { cn, formatCurrency, formatDate } from "@/lib/utils";
import type { CashMovement } from "@/services/cashMovements";

interface Props {
  items: CashMovement[];
  loading?: boolean;
  onEdit: (m: CashMovement) => void;
  onDelete: (m: CashMovement) => void;
}

export function MovimentacoesTable({ items, loading, onEdit, onDelete }: Props) {
  if (loading && items.length === 0) {
    return (
      <Table>
        <THead>
          <Tr>
            <Th>Data</Th>
            <Th>Tipo</Th>
            <Th>Categoria</Th>
            <Th>Descrição</Th>
            <Th>Contato</Th>
            <Th>Pagamento</Th>
            <Th className="text-right">Valor</Th>
            <Th>Status</Th>
            <Th aria-label="Ações" />
          </Tr>
        </THead>
        <TBody>
          {Array.from({ length: 6 }).map((_, i) => (
            <Tr key={i}>
              {Array.from({ length: 9 }).map((__, j) => (
                <Td key={j}>
                  <Skeleton className="h-3 w-16" />
                </Td>
              ))}
            </Tr>
          ))}
        </TBody>
      </Table>
    );
  }

  if (items.length === 0) {
    return (
      <div className="rounded-xl border border-white/[0.07] bg-white/[0.01] py-10">
        <EmptyState
          title="Nenhuma movimentação encontrada"
          description="Ajuste os filtros, mude o período ou registre uma nova movimentação."
        />
      </div>
    );
  }

  return (
    <Table>
      <THead>
        <Tr>
          <Th>Data</Th>
          <Th>Tipo</Th>
          <Th>Categoria</Th>
          <Th>Descrição</Th>
          <Th>Contato</Th>
          <Th>Pagamento</Th>
          <Th className="text-right">Valor</Th>
          <Th>Status</Th>
          <Th aria-label="Ações" />
        </Tr>
      </THead>
      <TBody>
        {items.map((m) => (
          <Tr key={m.id} className="hover:bg-white/[0.02]">
            <Td className="text-slate-300 tabular-nums">
              <div className="flex flex-col">
                <span>{formatDate(m.date)}</span>
                {m.referenceCode && (
                  <span className="text-[10.5px] text-slate-500">
                    Ref · {m.referenceCode}
                  </span>
                )}
              </div>
            </Td>
            <Td>
              <TypePill type={m.type} />
            </Td>
            <Td>
              <CategoryBadge category={m.category} />
            </Td>
            <Td>
              <div className="max-w-[26ch] truncate text-slate-200" title={m.description}>
                {m.description}
              </div>
              {m.notes && (
                <p
                  className="max-w-[28ch] truncate text-[10.5px] text-slate-500"
                  title={m.notes}
                >
                  {m.notes}
                </p>
              )}
            </Td>
            <Td>
              {m.counterpartyName ? (
                <div className="flex flex-col">
                  <span className="text-slate-200">{m.counterpartyName}</span>
                  {m.counterpartyDocument && (
                    <span className="text-[10.5px] text-slate-500 tabular-nums">
                      {m.counterpartyDocument}
                    </span>
                  )}
                </div>
              ) : (
                <span className="text-slate-600">—</span>
              )}
            </Td>
            <Td>
              <PaymentMethodPill method={m.typePayment} />
            </Td>
            <Td className="text-right tabular-nums font-medium">
              <span
                className={cn(
                  m.type === "ENTRY" ? "text-emerald-300" : "text-rose-300",
                )}
              >
                {m.type === "EXIT" ? "− " : "+ "}
                {formatCurrency(Number(m.value))}
              </span>
              {m.dueDate && m.status !== "COMPLETED" && (
                <p className="text-[10.5px] text-slate-500">
                  Vence {formatDate(m.dueDate)}
                </p>
              )}
            </Td>
            <Td>
              <StatusBadge status={m.status} />
            </Td>
            <Td>
              <div className="flex items-center justify-end gap-1 opacity-70 group-hover:opacity-100 transition">
                {m.attachmentUrl && (
                  <a
                    href={m.attachmentUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="h-7 w-7 grid place-items-center rounded-md text-slate-400 hover:text-slate-100 hover:bg-white/[0.05] transition"
                    title="Abrir comprovante"
                  >
                    <ExternalLink className="h-3.5 w-3.5" />
                  </a>
                )}
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => onEdit(m)}
                  className="h-7 w-7 px-0 grid place-items-center"
                  title="Editar"
                >
                  <Pencil className="h-3.5 w-3.5" />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => onDelete(m)}
                  className="h-7 w-7 px-0 grid place-items-center hover:text-rose-300"
                  title="Excluir"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            </Td>
          </Tr>
        ))}
      </TBody>
    </Table>
  );
}
