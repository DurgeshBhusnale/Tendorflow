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
  remove: async (id: string) => {
    const { data } = await apiClient.delete<ApiSuccess<{ id: string; deleted: boolean }>>(
      `/api/tenders/${id}`,
    );
    return data.data;
  },
};
