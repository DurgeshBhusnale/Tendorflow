import { apiClient } from "@/api/client";
import type { ApiSuccess, PaginatedResponse } from "@/types/api";
import type { Emd, EmdCreate, EmdStatus, EmdSummary, EmdUpdate } from "@/types/emd";

export interface EmdFilters {
  status?: EmdStatus;
  /** Matches the typed client name, company or contact number. */
  search?: string;
  /** Inclusive calendar days, as YYYY-MM-DD. */
  start_date?: string;
  end_date?: string;
}

export const emdsApi = {
  list: async (params: EmdFilters & { page?: number; page_size?: number }) => {
    const { data } = await apiClient.get<ApiSuccess<PaginatedResponse<Emd>>>("/api/emds", {
      params,
    });
    return data.data;
  },
  /** Totals for the same filters as `list` — backs the KPI strip. */
  summary: async (params: EmdFilters) => {
    const { data } = await apiClient.get<ApiSuccess<EmdSummary>>("/api/emds/summary", { params });
    return data.data;
  },
  create: async (payload: EmdCreate) => {
    const { data } = await apiClient.post<ApiSuccess<Emd>>("/api/emds", payload);
    return data.data;
  },
  update: async (id: string, payload: EmdUpdate) => {
    const { data } = await apiClient.patch<ApiSuccess<Emd>>(`/api/emds/${id}`, payload);
    return data.data;
  },
  /** Admin-only, like every other deletion. */
  remove: async (id: string) => {
    const { data } = await apiClient.delete<ApiSuccess<{ id: string; deleted: boolean }>>(
      `/api/emds/${id}`,
    );
    return data.data;
  },
  /** Deletes several deposits in one call (CH-34). Admin-only, capped at 100. */
  bulkRemove: async (ids: string[]) => {
    const { data } = await apiClient.post<ApiSuccess<{ deleted: number; requested: number }>>(
      "/api/emds/bulk-delete",
      { ids },
    );
    return data.data;
  },
  /** Every id matching a filter, for the "select all N matching" affordance. */
  listIds: async (filters: EmdFilters, cap = 1000) => {
    const pageSize = 100;
    const ids: string[] = [];
    for (let page = 1; ids.length < cap; page += 1) {
      const { data } = await apiClient.get<ApiSuccess<PaginatedResponse<Emd>>>("/api/emds", {
        params: { ...filters, page, page_size: pageSize },
      });
      ids.push(...data.data.items.map((e) => e.id));
      if (data.data.items.length < pageSize || ids.length >= data.data.total_count) break;
    }
    return ids.slice(0, cap);
  },
};
