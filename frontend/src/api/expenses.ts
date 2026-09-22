import { apiClient } from "@/api/client";
import type { ApiSuccess, PaginatedResponse } from "@/types/api";
import type {
  Expense,
  ExpenseCreate,
  ExpenseStatus,
  ExpenseSummary,
  ExpenseUpdate,
} from "@/types/expense";

export interface ExpenseFilters {
  status?: ExpenseStatus;
  /** Matches the details text. */
  search?: string;
  /** Inclusive calendar days, as YYYY-MM-DD. */
  start_date?: string;
  end_date?: string;
}

/** Every one of these is admin-only at the API, not just in the UI (CH-27). */
export const expensesApi = {
  list: async (params: ExpenseFilters & { page?: number; page_size?: number }) => {
    const { data } = await apiClient.get<ApiSuccess<PaginatedResponse<Expense>>>("/api/expenses", {
      params,
    });
    return data.data;
  },
  /** Totals for the same filters as `list` — backs the KPI strip. */
  summary: async (params: ExpenseFilters) => {
    const { data } = await apiClient.get<ApiSuccess<ExpenseSummary>>("/api/expenses/summary", {
      params,
    });
    return data.data;
  },
  create: async (payload: ExpenseCreate) => {
    const { data } = await apiClient.post<ApiSuccess<Expense>>("/api/expenses", payload);
    return data.data;
  },
  update: async (id: string, payload: ExpenseUpdate) => {
    const { data } = await apiClient.patch<ApiSuccess<Expense>>(`/api/expenses/${id}`, payload);
    return data.data;
  },
  remove: async (id: string) => {
    const { data } = await apiClient.delete<ApiSuccess<{ id: string; deleted: boolean }>>(
      `/api/expenses/${id}`,
    );
    return data.data;
  },
};
