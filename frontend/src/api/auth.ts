import { apiClient } from "@/api/client";
import type { ApiSuccess } from "@/types/api";
import type { AuthUser } from "@/types/user";

export interface LoginPayload {
  /** Username, not email — see CH-02 and API_CONTRACT.md section 1. */
  username: string;
  password: string;
}

interface LoginData {
  access_token: string;
  refresh_token: string;
  user: AuthUser;
}

interface MeData extends AuthUser {
  is_active: boolean;
}

export const authApi = {
  login: async (payload: LoginPayload) => {
    const { data } = await apiClient.post<ApiSuccess<LoginData>>("/api/auth/login", payload);
    return data.data;
  },
  refresh: async (refreshToken: string) => {
    const { data } = await apiClient.post<ApiSuccess<{ access_token: string }>>(
      "/api/auth/refresh",
      { refresh_token: refreshToken },
    );
    return data.data;
  },
  logout: async () => {
    const { data } =
      await apiClient.post<ApiSuccess<{ logged_out: boolean }>>("/api/auth/logout");
    return data.data;
  },
  me: async () => {
    const { data } = await apiClient.get<ApiSuccess<MeData>>("/api/auth/me");
    return data.data;
  },
};
