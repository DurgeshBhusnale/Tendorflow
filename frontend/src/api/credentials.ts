import { apiClient } from "@/api/client";
import type { ApiSuccess, PaginatedResponse } from "@/types/api";
import type { Credential, CredentialCreate, CredentialUpdate } from "@/types/credential";

export const credentialsApi = {
  list: async (params: {
    page?: number;
    page_size?: number;
    client_id?: string;
    portal_id?: string;
    search?: string;
  }) => {
    const { data } = await apiClient.get<ApiSuccess<PaginatedResponse<Credential>>>(
      "/api/credentials",
      { params },
    );
    return data.data;
  },
  /**
   * Fetches one credential. `reveal` is the only way to get a real password —
   * the list endpoint always masks. Used by the table's click-to-reveal action.
   */
  get: async (id: string, params: { reveal?: boolean } = {}) => {
    const { data } = await apiClient.get<ApiSuccess<Credential>>(`/api/credentials/${id}`, {
      params,
    });
    return data.data;
  },
  create: async (payload: CredentialCreate) => {
    const { data } = await apiClient.post<ApiSuccess<Credential>>("/api/credentials", payload);
    return data.data;
  },
  update: async (id: string, payload: CredentialUpdate) => {
    const { data } = await apiClient.patch<ApiSuccess<Credential>>(
      `/api/credentials/${id}`,
      payload,
    );
    return data.data;
  },
  remove: async (id: string) => {
    const { data } = await apiClient.delete<ApiSuccess<{ id: string; deleted: boolean }>>(
      `/api/credentials/${id}`,
    );
    return data.data;
  },
};
