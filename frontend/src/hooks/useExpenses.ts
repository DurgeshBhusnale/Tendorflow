import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { expensesApi, type ExpenseFilters } from "@/api/expenses";
import type { ExpenseUpdate } from "@/types/expense";

export const expensesKeys = {
  all: ["expenses"] as const,
  list: (params: object) => [...expensesKeys.all, "list", params] as const,
  summary: (params: object) => [...expensesKeys.all, "summary", params] as const,
};

export function useExpenses(params: ExpenseFilters & { page: number; page_size: number }) {
  return useQuery({
    queryKey: expensesKeys.list(params),
    queryFn: () => expensesApi.list(params),
  });
}

export function useExpenseSummary(params: ExpenseFilters) {
  return useQuery({
    queryKey: expensesKeys.summary(params),
    queryFn: () => expensesApi.summary(params),
  });
}

export function useCreateExpense() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: expensesApi.create,
    // Invalidating the whole key refreshes the KPI strip too, so the totals
    // can't drift from the table.
    onSuccess: () => qc.invalidateQueries({ queryKey: expensesKeys.all }),
  });
}

export function useUpdateExpense() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: ExpenseUpdate }) =>
      expensesApi.update(id, payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: expensesKeys.all }),
  });
}

export function useDeleteExpense() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: expensesApi.remove,
    onSuccess: () => qc.invalidateQueries({ queryKey: expensesKeys.all }),
  });
}
