import { apiClient } from "@/api/client";
import type { ApiSuccess, PaginatedResponse } from "@/types/api";
import type {
  DscKey,
  DscKeyCreate,
  DscKeyEvent,
  DscKeyStatus,
  DscKeyUpdate,
} from "@/types/dsc";

export const dscApi = {
  list: async (params: {
    page?: number;
    page_size?: number;
    client_id?: string;
    status?: DscKeyStatus;
    search?: string;
  }) => {
    const { data } = await apiClient.get<ApiSuccess<PaginatedResponse<DscKey>>>("/api/dsc", {
      params,
    });
    return data.data;
  },
  /** Creation, issuances and returns for one key, newest first. */
  history: async (id: string) => {
    const { data } = await apiClient.get<ApiSuccess<DscKeyEvent[]>>(`/api/dsc/${id}/history`);
    return data.data;
  },
  create: async (payload: DscKeyCreate) => {
    const { data } = await apiClient.post<ApiSuccess<DscKey>>("/api/dsc", payload);
    return data.data;
  },
  update: async (id: string, payload: DscKeyUpdate) => {
    const { data } = await apiClient.patch<ApiSuccess<DscKey>>(`/api/dsc/${id}`, payload);
    return data.data;
  },
  remove: async (id: string) => {
    const { data } = await apiClient.delete<ApiSuccess<{ id: string; deleted: boolean }>>(
      `/api/dsc/${id}`,
    );
    return data.data;
  },
};
