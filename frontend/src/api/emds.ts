import { apiClient } from "@/api/client";
import type { ApiSuccess, PaginatedResponse } from "@/types/api";
import type { Emd, EmdCreate, EmdStatus, EmdSummary, EmdUpdate } from "@/types/emd";

export interface EmdFilters {
  client_id?: string;
  status?: EmdStatus;
  /** Matches the client's contact person, company, or the deposit's number. */
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
};
