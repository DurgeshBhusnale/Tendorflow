import { apiClient } from "@/api/client";
import type { ApiSuccess } from "@/types/api";
import type { DashboardSummary } from "@/types/dashboard";

export const dashboardApi = {
  summary: async () => {
    const { data } = await apiClient.get<ApiSuccess<DashboardSummary>>(
      "/api/dashboard/summary",
    );
    return data.data;
  },
};
