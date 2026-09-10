import { apiClient } from "@/api/client";
import type { ApiSuccess } from "@/types/api";
import type {
  TenderDepartment,
  TenderDepartmentCreate,
  TenderDepartmentUpdate,
} from "@/types/tender-department";

export const tenderDepartmentsApi = {
  /** Master lists are small dropdown sources — the API returns a plain array, not a page. */
  list: async (params: { active_only?: boolean } = {}) => {
    const { data } = await apiClient.get<ApiSuccess<TenderDepartment[]>>(
      "/api/tender-departments",
      { params },
    );
    return data.data;
  },
  create: async (payload: TenderDepartmentCreate) => {
    const { data } = await apiClient.post<ApiSuccess<TenderDepartment>>(
      "/api/tender-departments",
      payload,
    );
    return data.data;
  },
  update: async (id: string, payload: TenderDepartmentUpdate) => {
    const { data } = await apiClient.patch<ApiSuccess<TenderDepartment>>(
      `/api/tender-departments/${id}`,
      payload,
    );
    return data.data;
  },
};
