import { apiClient } from "@/api/client";
import type { ApiSuccess, PaginatedResponse } from "@/types/api";
import type { Client, ClientCreate, ClientUpdate } from "@/types/client";

export const clientsApi = {
  list: async (params: { page?: number; page_size?: number; search?: string }) => {
    const { data } = await apiClient.get<ApiSuccess<PaginatedResponse<Client>>>("/api/clients", {
      params,
    });
    return data.data;
  },
  get: async (id: string) => {
    const { data } = await apiClient.get<ApiSuccess<Client>>(`/api/clients/${id}`);
    return data.data;
  },
  create: async (payload: ClientCreate) => {
    const { data } = await apiClient.post<ApiSuccess<Client>>("/api/clients", payload);
    return data.data;
  },
  update: async (id: string, payload: ClientUpdate) => {
    const { data } = await apiClient.patch<ApiSuccess<Client>>(`/api/clients/${id}`, payload);
    return data.data;
  },
  remove: async (id: string) => {
    const { data } = await apiClient.delete<ApiSuccess<{ id: string; deleted: boolean }>>(
      `/api/clients/${id}`,
    );
    return data.data;
  },
};
