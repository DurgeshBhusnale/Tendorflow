import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { tendersApi, type TenderFilters } from "@/api/tenders";
import type { TenderSettlement, TenderUpdate } from "@/types/tender";

export const tendersKeys = {
  all: ["tenders"] as const,
  list: (params: object) => [...tendersKeys.all, "list", params] as const,
  summary: (params: object) => [...tendersKeys.all, "summary", params] as const,
  outstanding: (clientId: string) => [...tendersKeys.all, "outstanding", clientId] as const,
};

export function useTenders(params: TenderFilters & { page: number; page_size: number }) {
  return useQuery({
    queryKey: tendersKeys.list(params),
    queryFn: () => tendersApi.list(params),
  });
}

/**
 * The KPI strip's data. Admin-only (CH-12) — `enabled` keeps an employee's
 * session from firing a request the API answers with 403 on every page view.
 */
export function useTenderSummary(params: TenderFilters, enabled = true) {
  return useQuery({
    queryKey: tendersKeys.summary(params),
    queryFn: () => tendersApi.summary(params),
    enabled,
  });
}

/** One client's balance. Skipped entirely until a single client is chosen. */
export function useClientOutstanding(clientId: string) {
  return useQuery({
    queryKey: tendersKeys.outstanding(clientId),
    queryFn: () => tendersApi.outstanding(clientId),
    enabled: Boolean(clientId),
  });
}

/**
 * Records a payment against a client's dues (CH-35).
 *
 * A preview call is deliberately *not* a mutation: it writes nothing, so it
 * must not invalidate anything either.
 */
export function useSettleClientDues() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: TenderSettlement) => tendersApi.settle(payload),
    onSuccess: (result) => {
      if (!result.preview) qc.invalidateQueries({ queryKey: tendersKeys.all });
    },
  });
}

export function useCreateTender() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: tendersApi.create,
    // Invalidating the whole key refreshes the summary strip too, so the
    // totals can't drift from the table.
    onSuccess: () => qc.invalidateQueries({ queryKey: tendersKeys.all }),
  });
}

export function useUpdateTender() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: TenderUpdate }) =>
      tendersApi.update(id, payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: tendersKeys.all }),
  });
}

/** Deletes a selection, chunked to the API's 100-id ceiling. */
export function useBulkDeleteTenders() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (ids: string[]) => {
      let deleted = 0;
      for (let i = 0; i < ids.length; i += 100) {
        const result = await tendersApi.bulkRemove(ids.slice(i, i + 100));
        deleted += result.deleted;
      }
      return { deleted };
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: tendersKeys.all }),
  });
}

export function useDeleteTender() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: tendersApi.remove,
    onSuccess: () => qc.invalidateQueries({ queryKey: tendersKeys.all }),
  });
}
