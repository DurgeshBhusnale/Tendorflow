import axios from "axios";
import { ApiError } from "@/types/api";

export const apiClient = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL,
});

// Auth token attachment + refresh-on-expiry are wired up in Phase 1 once
// token storage (src/auth/tokenStore.ts) exists.
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    const code = error.response?.data?.error?.code ?? "NETWORK_ERROR";
    const message = error.response?.data?.error?.message ?? "Something went wrong.";
    return Promise.reject(new ApiError(code, message));
  },
);
