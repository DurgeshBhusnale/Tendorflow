import { apiClient } from "@/api/client";
import type { ApiSuccess } from "@/types/api";
import type { TenderName, TenderNameCreate, TenderNameUpdate } from "@/types/tender-name";

export const tenderNamesApi = {
  /** Master lists are small dropdown sources — the API returns a plain array, not a page. */
  list: async (params: { active_only?: boolean } = {}) => {
    const { data } = await apiClient.get<ApiSuccess<TenderName[]>>("/api/tender-names", {
      params,
    });
    return data.data;
  },
  create: async (payload: TenderNameCreate) => {
    const { data } = await apiClient.post<ApiSuccess<TenderName>>("/api/tender-names", payload);
    return data.data;
  },
  update: async (id: string, payload: TenderNameUpdate) => {
    const { data } = await apiClient.patch<ApiSuccess<TenderName>>(
      `/api/tender-names/${id}`,
      payload,
    );
    return data.data;
  },
};
