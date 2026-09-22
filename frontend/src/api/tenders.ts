import { apiClient } from "@/api/client";
import type { ApiSuccess, PaginatedResponse } from "@/types/api";
import type {
  Tender,
  TenderCreate,
  TenderStatus,
  TenderSummary,
  TenderUpdate,
} from "@/types/tender";

export interface TenderFilters {
  client_id?: string;
  status?: TenderStatus;
  search?: string;
  /** Inclusive IST calendar days, as YYYY-MM-DD. */
  start_date?: string;
  end_date?: string;
}

export const tendersApi = {
  list: async (params: TenderFilters & { page?: number; page_size?: number }) => {
    const { data } = await apiClient.get<ApiSuccess<PaginatedResponse<Tender>>>("/api/tenders", {
      params,
    });
    return data.data;
  },
  /** Totals for the same filters as `list` — backs the summary strip. Admin-only. */
  summary: async (params: TenderFilters) => {
    const { data } = await apiClient.get<ApiSuccess<TenderSummary>>("/api/tenders/summary", {
      params,
    });
    return data.data;
  },
  create: async (payload: TenderCreate) => {
    const { data } = await apiClient.post<ApiSuccess<Tender>>("/api/tenders", payload);
    return data.data;
  },
  update: async (id: string, payload: TenderUpdate) => {
    const { data } = await apiClient.patch<ApiSuccess<Tender>>(`/api/tenders/${id}`, payload);
    return data.data;
  },
  /**
   * Deletes several tenders in one call (CH-29). Admin-only, capped at 100
   * ids per request by the API, so callers chunk larger selections.
   */
  bulkRemove: async (ids: string[]) => {
    const { data } = await apiClient.post<ApiSuccess<{ deleted: number; requested: number }>>(
      "/api/tenders/bulk-delete",
      { ids },
    );
    return data.data;
  },
  /**
   * Every id matching a filter, for the "select all N matching" affordance.
   * Walks the list endpoint at its maximum page size and stops at `cap`, so a
   * pathological filter cannot spin here forever.
   */
  listIds: async (filters: TenderFilters, cap = 1000) => {
    const pageSize = 100;
    const ids: string[] = [];
    for (let page = 1; ids.length < cap; page += 1) {
      const { data } = await apiClient.get<ApiSuccess<PaginatedResponse<Tender>>>(
        "/api/tenders",
        { params: { ...filters, page, page_size: pageSize } },
      );
      ids.push(...data.data.items.map((t) => t.id));
      if (data.data.items.length < pageSize || ids.length >= data.data.total_count) break;
    }
    return ids.slice(0, cap);
  },
  remove: async (id: string) => {
    const { data } = await apiClient.delete<ApiSuccess<{ id: string; deleted: boolean }>>(
      `/api/tenders/${id}`,
    );
    return data.data;
  },
};
