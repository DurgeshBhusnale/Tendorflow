import axios, { type AxiosError, type InternalAxiosRequestConfig } from "axios";
import { clearAuth, getAccessToken, getRefreshToken, setAccessToken } from "@/auth/tokenStore";
import { ApiError, type ApiErrorBody, type ApiSuccess } from "@/types/api";

export const apiClient = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL,
});

apiClient.interceptors.request.use((config) => {
  const token = getAccessToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

type RetryableConfig = InternalAxiosRequestConfig & { _retry?: boolean };

let refreshPromise: Promise<string> | null = null;

async function refreshAccessToken(): Promise<string> {
  const refreshToken = getRefreshToken();
  if (!refreshToken) {
    throw new Error("No refresh token available.");
  }
  const { data } = await axios.post<ApiSuccess<{ access_token: string }>>(
    `${import.meta.env.VITE_API_BASE_URL}/api/auth/refresh`,
    { refresh_token: refreshToken },
  );
  const token = data.data.access_token;
  setAccessToken(token);
  return token;
}

apiClient.interceptors.response.use(
  (response) => response,
  async (error: AxiosError<ApiErrorBody>) => {
    const config = error.config as RetryableConfig | undefined;
    const code = error.response?.data?.error?.code;

    if (code === "TOKEN_EXPIRED" && config && !config._retry) {
      config._retry = true;
      try {
        refreshPromise ??= refreshAccessToken().finally(() => {
          refreshPromise = null;
        });
        const token = await refreshPromise;
        config.headers.Authorization = `Bearer ${token}`;
        return apiClient(config);
      } catch {
        clearAuth();
        window.location.href = "/";
        return Promise.reject(new ApiError("UNAUTHENTICATED", "Session expired."));
      }
    }

    const message = error.response?.data?.error?.message ?? "Something went wrong.";
    return Promise.reject(new ApiError(code ?? "NETWORK_ERROR", message));
  },
);
