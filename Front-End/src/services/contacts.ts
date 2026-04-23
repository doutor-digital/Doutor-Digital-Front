import { api } from "@/lib/api";
import { cleanParams, toInt } from "@/lib/http";
import type {
  AttendanceStatus,
  Contact,
  ContactDetail,
  ContactImportResult,
  ContactsListResponse,
  DuplicateContactsDeleteSummary,
  DuplicateContactsReport,
  FilterCriterion,
  FilterOptionsResponse,
} from "@/types";

export interface ListContactsParams {
  clinicId?: number | string;
  origem?: "all" | "webhook_cloudia" | "import_csv" | "manual";
  search?: string;
  page?: number;
  pageSize?: number;
  orderBy?: "name" | "last_message_at" | "created_at" | "attendance_status_at";
  orderDir?: "asc" | "desc";
  status?: AttendanceStatus | "none" | null;
  etapa?: string | null;
  tag?: string | null;
  blocked?: boolean | null;
  hasConsultation?: boolean | null;
  dateFrom?: string | null;
  dateTo?: string | null;
}

export interface ImportCsvParams {
  clinicId?: number | string;
  file: File;
  onDuplicate?: "skip" | "update" | "fail";
}

export interface CreateContactParams {
  clinicId?: number | string;
  name: string;
  phone: string;
  conexao?: string;
  observacoes?: string;
  etapa?: string;
  tags?: string[];
  consultationAt?: string;
  birthday?: string;
  attendanceStatus?: AttendanceStatus;
}

export interface UpdateContactParams {
  clinicId?: number | string;
  id: string;
  name?: string;
  phone?: string;
  conexao?: string | null;
  observacoes?: string | null;
  etapa?: string | null;
  tags?: string[];
  consultationAt?: string;
  birthday?: string;
  blocked?: boolean;
  attendanceStatus?: AttendanceStatus | "none";
}

export interface SetActionParams {
  clinicId?: number | string;
  id: string;
  action: AttendanceStatus;
  consultationAt?: string;
  observacoes?: string;
}

export interface SearchContactsParams {
  clinicId?: number | string;
  filters: FilterCriterion[];
  origem?: "all" | "webhook_cloudia" | "import_csv" | "manual";
  search?: string;
  page?: number;
  pageSize?: number;
  orderBy?: string;
  orderDir?: "asc" | "desc";
}

export const contactsService = {
  async list(params: ListContactsParams): Promise<ContactsListResponse> {
    const { data } = await api.get<ContactsListResponse>("/contacts", {
      params: cleanParams({
        clinicId: toInt(params.clinicId),
        origem: params.origem ?? "all",
        search: params.search,
        page: params.page ?? 1,
        pageSize: params.pageSize ?? 50,
        orderBy: params.orderBy,
        orderDir: params.orderDir,
        status: params.status,
        etapa: params.etapa,
        tag: params.tag,
        blocked: params.blocked,
        hasConsultation: params.hasConsultation,
        dateFrom: params.dateFrom,
        dateTo: params.dateTo,
      }),
    });

    return (
      data ?? {
        data: [],
        pagination: { page: 1, page_size: 50, total: 0, total_pages: 1 },
        counts: { all: 0, webhook_cloudia: 0, import_csv: 0 },
      }
    );
  },

  async search(params: SearchContactsParams): Promise<ContactsListResponse> {
    const { data } = await api.post<ContactsListResponse>(
      "/contacts/search",
      {
        filters: params.filters,
        origem: params.origem ?? "all",
        search: params.search,
        page: params.page ?? 1,
        page_size: params.pageSize ?? 50,
        order_by: params.orderBy ?? "last_message_at",
        order_dir: params.orderDir ?? "desc",
      },
      {
        params: cleanParams({ clinicId: toInt(params.clinicId) }),
      }
    );
    return data;
  },

  async getById(id: string | number, clinicId?: number | string): Promise<ContactDetail> {
    const { data } = await api.get<ContactDetail>(`/contacts/${encodeURIComponent(String(id))}`, {
      params: cleanParams({ clinicId: toInt(clinicId) }),
    });
    return data;
  },

  async create(params: CreateContactParams): Promise<ContactDetail> {
    const { data } = await api.post<ContactDetail>("/contacts", {
      clinic_id: toInt(params.clinicId),
      name: params.name,
      phone: params.phone,
      conexao: params.conexao,
      observacoes: params.observacoes,
      etapa: params.etapa,
      tags: params.tags,
      consultation_at: params.consultationAt,
      birthday: params.birthday,
      attendance_status: params.attendanceStatus,
    });
    return data;
  },

  async update(params: UpdateContactParams): Promise<ContactDetail> {
    const { data } = await api.put<ContactDetail>(
      `/contacts/${encodeURIComponent(params.id)}`,
      {
        name: params.name,
        phone: params.phone,
        conexao: params.conexao,
        observacoes: params.observacoes,
        etapa: params.etapa,
        tags: params.tags,
        consultation_at: params.consultationAt,
        birthday: params.birthday,
        blocked: params.blocked,
        attendance_status: params.attendanceStatus,
      },
      {
        params: cleanParams({ clinicId: toInt(params.clinicId) }),
      }
    );
    return data;
  },

  async remove(id: string, clinicId?: number | string): Promise<void> {
    await api.delete(`/contacts/${encodeURIComponent(id)}`, {
      params: cleanParams({ clinicId: toInt(clinicId) }),
    });
  },

  async setAction(params: SetActionParams): Promise<ContactDetail> {
    const { data } = await api.patch<ContactDetail>(
      `/contacts/${encodeURIComponent(params.id)}/action`,
      {
        action: params.action,
        consultation_at: params.consultationAt,
        observacoes: params.observacoes,
      },
      {
        params: cleanParams({ clinicId: toInt(params.clinicId) }),
      }
    );
    return data;
  },

  async filterOptions(
    key: string,
    clinicId?: number | string,
    search?: string,
    limit = 50
  ): Promise<FilterOptionsResponse> {
    const { data } = await api.get<FilterOptionsResponse>(
      `/contacts/filter-options/${encodeURIComponent(key)}`,
      {
        params: cleanParams({
          clinicId: toInt(clinicId),
          search,
          limit,
        }),
      }
    );
    return data ?? { key, options: [] };
  },

  async listDuplicates(params: {
    clinicId?: number | string;
    ignoreTenant?: boolean;
  } = {}): Promise<DuplicateContactsReport> {
    const { data } = await api.get<DuplicateContactsReport>(
      "/contacts/admin/duplicates",
      {
        params: cleanParams({
          tenantId: toInt(params.clinicId),
          ignoreTenant: params.ignoreTenant ? true : undefined,
        }),
      },
    );
    return data;
  },

  async deleteDuplicates(params: {
    clinicId?: number | string;
    dryRun?: boolean;
    ignoreTenant?: boolean;
  }): Promise<DuplicateContactsReport | DuplicateContactsDeleteSummary> {
    const dryRun = params.dryRun ?? true;
    const { data } = await api.delete<
      DuplicateContactsReport | DuplicateContactsDeleteSummary
    >("/contacts/admin/duplicates", {
      params: cleanParams({
        tenantId: toInt(params.clinicId),
        dryRun,
        ignoreTenant: params.ignoreTenant ? true : undefined,
      }),
      timeout: 180_000,
    });
    return data;
  },

  async importCsv(params: ImportCsvParams): Promise<ContactImportResult> {
    const form = new FormData();
    form.append("file", params.file);
    form.append("clinicId", String(toInt(params.clinicId) ?? 0));
    form.append("onDuplicate", params.onDuplicate ?? "skip");

    const { data } = await api.post<ContactImportResult>("/contacts/import", form, {
      headers: { "Content-Type": "multipart/form-data" },
      timeout: 120_000,
    });

    return data;
  },
};

export type { Contact, ContactImportResult, ContactsListResponse };
