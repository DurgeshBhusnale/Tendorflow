import { apiClient } from "@/api/client";
import type { ApiSuccess, PaginatedResponse } from "@/types/api";
import type { User, UserCreate, UserUpdate } from "@/types/user";

export const usersApi = {
  list: async (params: {
    page?: number;
    page_size?: number;
    search?: string;
    role?: string;
  }) => {
    const { data } = await apiClient.get<ApiSuccess<PaginatedResponse<User>>>(
      "/api/admin/users",
      { params },
    );
    return data.data;
  },
  create: async (payload: UserCreate) => {
    const { data } = await apiClient.post<ApiSuccess<User>>("/api/admin/users", payload);
    return data.data;
  },
  update: async (id: string, payload: UserUpdate) => {
    const { data } = await apiClient.patch<ApiSuccess<User>>(`/api/admin/users/${id}`, payload);
    return data.data;
  },
};
