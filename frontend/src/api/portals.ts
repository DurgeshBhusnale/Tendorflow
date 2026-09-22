import { apiClient } from "@/api/client";
import type { ApiSuccess } from "@/types/api";
import type { Portal, PortalCreate, PortalUpdate } from "@/types/portal";

export const portalsApi = {
  /** Master lists are small dropdown sources — the API returns a plain array, not a page. */
  list: async (params: { active_only?: boolean } = {}) => {
    const { data } = await apiClient.get<ApiSuccess<Portal[]>>("/api/portals", { params });
    return data.data;
  },
  create: async (payload: PortalCreate) => {
    const { data } = await apiClient.post<ApiSuccess<Portal>>("/api/portals", payload);
    return data.data;
  },
  update: async (id: string, payload: PortalUpdate) => {
    const { data } = await apiClient.patch<ApiSuccess<Portal>>(`/api/portals/${id}`, payload);
    return data.data;
  },
  /** Refused with 409 PORTAL_IN_USE while any credential references the portal. */
  remove: async (id: string) => {
    const { data } = await apiClient.delete<ApiSuccess<{ id: string; deleted: boolean }>>(
      `/api/portals/${id}`,
    );
    return data.data;
  },
};
