import { gql } from "@/lib/graphql";

// ─── Enums (espelham Prisma do backend) ──────────────────────────────────────

export const CASH_MOVEMENT_TYPES = ["ENTRY", "EXIT"] as const;
export type CashMovementType = (typeof CASH_MOVEMENT_TYPES)[number];

export const CASH_MOVEMENT_CATEGORIES = [
  "SALE",
  "CHANGE",
  "OTHER_IN",
  "EXPENSE",
  "WITHDRAWAL",
  "PAYMENT",
] as const;
export type CashMovementCategory = (typeof CASH_MOVEMENT_CATEGORIES)[number];

export const MOVEMENT_PAYMENT_METHODS = [
  "CASH",
  "PIX",
  "CREDIT_CARD",
  "DEBIT_CARD",
  "BANK_TRANSFER",
  "BANK_SLIP",
  "CHECK",
  "OTHER",
] as const;
export type MovementTypePayment = (typeof MOVEMENT_PAYMENT_METHODS)[number];

export const CASH_MOVEMENT_STATUSES = [
  "PENDING",
  "COMPLETED",
  "SCHEDULED",
  "CANCELED",
  "OVERDUE",
] as const;
export type CashMovementStatus = (typeof CASH_MOVEMENT_STATUSES)[number];

export const CASH_MOVEMENT_SORT_FIELDS = [
  "DATE",
  "VALUE",
  "CREATED_AT",
  "DUE_DATE",
] as const;
export type CashMovementSortField =
  (typeof CASH_MOVEMENT_SORT_FIELDS)[number];

export type SortDirection = "ASC" | "DESC";

// ─── Labels (pt-BR) para UX ─────────────────────────────────────────────────

export const TYPE_LABEL: Record<CashMovementType, string> = {
  ENTRY: "Entrada",
  EXIT: "Saída",
};

export const CATEGORY_LABEL: Record<CashMovementCategory, string> = {
  SALE: "Venda",
  CHANGE: "Troco",
  OTHER_IN: "Outras entradas",
  EXPENSE: "Despesa",
  WITHDRAWAL: "Saque",
  PAYMENT: "Pagamento",
};

export const PAYMENT_METHOD_LABEL: Record<MovementTypePayment, string> = {
  CASH: "Dinheiro",
  PIX: "PIX",
  CREDIT_CARD: "Cartão de crédito",
  DEBIT_CARD: "Cartão de débito",
  BANK_TRANSFER: "Transferência",
  BANK_SLIP: "Boleto",
  CHECK: "Cheque",
  OTHER: "Outro",
};

export const STATUS_LABEL: Record<CashMovementStatus, string> = {
  PENDING: "Pendente",
  COMPLETED: "Concluída",
  SCHEDULED: "Agendada",
  CANCELED: "Cancelada",
  OVERDUE: "Vencida",
};

// ─── Tipos do domínio ────────────────────────────────────────────────────────

export interface CashMovement {
  id: string;
  type: CashMovementType;
  category: CashMovementCategory;
  typePayment: MovementTypePayment | null;
  status: CashMovementStatus;
  value: number;
  description: string;
  date: string;
  dueDate: string | null;
  paidAt: string | null;
  referenceCode: string | null;
  counterpartyName: string | null;
  counterpartyDocument: string | null;
  notes: string | null;
  attachmentUrl: string | null;
  createdAt: string;
  updatedAt: string;
  user_id: string;
}

export interface CashMovementCategoryBreakdown {
  category: CashMovementCategory;
  total: number;
  count: number;
}

export interface CashMovementSummary {
  totalCount: number;
  totalEntries: number;
  totalExits: number;
  balance: number;
  pendingTotal: number;
  overdueTotal: number;
  byCategory: CashMovementCategoryBreakdown[];
}

export interface CashMovementPage {
  items: CashMovement[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
  summary: CashMovementSummary;
}

export interface DashboardStats {
  todayEntries: number;
  todayExits: number;
  todayBalance: number;
  monthlyTotal: number;
}

// ─── Inputs ──────────────────────────────────────────────────────────────────

export interface CreateCashMovementInput {
  type: CashMovementType;
  category: CashMovementCategory;
  typePayment?: MovementTypePayment | null;
  status?: CashMovementStatus;
  value: number;
  description: string;
  date?: string;
  dueDate?: string | null;
  paidAt?: string | null;
  referenceCode?: string | null;
  counterpartyName?: string | null;
  counterpartyDocument?: string | null;
  notes?: string | null;
  attachmentUrl?: string | null;
}

export type UpdateCashMovementInput = Partial<CreateCashMovementInput>;

export interface FindAllCashMovementInput {
  search?: string | null;
  type?: CashMovementType | null;
  categories?: CashMovementCategory[];
  paymentMethods?: MovementTypePayment[];
  statuses?: CashMovementStatus[];
  startDate?: string | null;
  endDate?: string | null;
  minValue?: number | null;
  maxValue?: number | null;
  referenceCode?: string | null;
  counterparty?: string | null;
  sortBy?: CashMovementSortField;
  sortDirection?: SortDirection;
  page?: number;
  pageSize?: number;
}

// ─── Fragmentos GraphQL ──────────────────────────────────────────────────────

const FIELDS_FRAGMENT = `
  fragment CashMovementFields on CashMovementGraphQL {
    id
    type
    category
    typePayment
    status
    value
    description
    date
    dueDate
    paidAt
    referenceCode
    counterpartyName
    counterpartyDocument
    notes
    attachmentUrl
    createdAt
    updatedAt
    user_id
  }
`;

// ─── Service ─────────────────────────────────────────────────────────────────

export const cashMovementsService = {
  async history(
    input: FindAllCashMovementInput,
  ): Promise<CashMovementPage> {
    const query = `
      ${FIELDS_FRAGMENT}
      query CashMovementsHistory($input: FindAllCashMovementInput) {
        cashMovementsHistory(input: $input) {
          items { ...CashMovementFields }
          total
          page
          pageSize
          totalPages
          summary {
            totalCount
            totalEntries
            totalExits
            balance
            pendingTotal
            overdueTotal
            byCategory { category total count }
          }
        }
      }
    `;
    const data = await gql<{ cashMovementsHistory: CashMovementPage }>(
      query,
      { input: cleanInput(input) },
    );
    return data.cashMovementsHistory;
  },

  async dashboardStats(date?: string | null): Promise<DashboardStats> {
    const query = `
      query DashboardStats($input: DashboardStatsInput) {
        dashboardStats(input: $input) {
          todayEntries
          todayExits
          todayBalance
          monthlyTotal
        }
      }
    `;
    const data = await gql<{ dashboardStats: DashboardStats }>(query, {
      input: date ? { date } : null,
    });
    return data.dashboardStats;
  },

  async create(input: CreateCashMovementInput): Promise<CashMovement> {
    const query = `
      ${FIELDS_FRAGMENT}
      mutation CreateCashMovement($input: CreateCashMovementInput!) {
        createCashMovement(input: $input) {
          ...CashMovementFields
          message
        }
      }
    `;
    const data = await gql<{
      createCashMovement: CashMovement & { message?: string };
    }>(query, { input: cleanInput(input) });
    return data.createCashMovement;
  },

  async update(
    movementId: string,
    input: UpdateCashMovementInput,
  ): Promise<boolean> {
    const query = `
      mutation UpdateCashMovement(
        $movementId: String!
        $movementUpdateCash: UpdateCashMovementInput!
      ) {
        cashMovementUpdate(
          movementId: $movementId
          movementUpdateCash: $movementUpdateCash
        )
      }
    `;
    const data = await gql<{ cashMovementUpdate: boolean }>(query, {
      movementId,
      movementUpdateCash: cleanInput(input),
    });
    return data.cashMovementUpdate;
  },

  async remove(movementId: string): Promise<boolean> {
    const query = `
      mutation DeleteCashMovement($movementId: String!) {
        cashMovementDelete(movementId: $movementId)
      }
    `;
    const data = await gql<{ cashMovementDelete: boolean }>(query, {
      movementId,
    });
    return data.cashMovementDelete;
  },
};

function cleanInput<T extends object>(input: T): Partial<T> {
  const out: Partial<T> = {};
  (Object.keys(input) as Array<keyof T>).forEach((k) => {
    const v = input[k];
    if (v === undefined) return;
    if (typeof v === "string" && v === "") return;
    if (Array.isArray(v) && v.length === 0) return;
    out[k] = v as T[keyof T];
  });
  return out;
}
