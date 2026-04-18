import { api } from "@/lib/api";
import { cleanParams, toInt } from "@/lib/http";
import type { Contact, ContactImportResult, ContactsListResponse } from "@/types";

export interface ListContactsParams {
  clinicId?: number | string;
  origem?: "all" | "webhook_cloudia" | "import_csv";
  search?: string;
  page?: number;
  pageSize?: number;
  orderBy?: "name" | "last_message_at" | "created_at";
  orderDir?: "asc" | "desc";
}

export interface ImportCsvParams {
  clinicId?: number | string;
  file: File;
  onDuplicate?: "skip" | "update" | "fail";
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
