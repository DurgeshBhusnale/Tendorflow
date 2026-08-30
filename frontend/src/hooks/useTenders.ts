import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { tendersApi, type TenderFilters } from "@/api/tenders";
import type { TenderUpdate } from "@/types/tender";

export const tendersKeys = {
  all: ["tenders"] as const,
  list: (params: object) => [...tendersKeys.all, "list", params] as const,
  summary: (params: object) => [...tendersKeys.all, "summary", params] as const,
};

export function useTenders(params: TenderFilters & { page: number; page_size: number }) {
  return useQuery({
    queryKey: tendersKeys.list(params),
    queryFn: () => tendersApi.list(params),
  });
}

export function useTenderSummary(params: TenderFilters) {
  return useQuery({
    queryKey: tendersKeys.summary(params),
    queryFn: () => tendersApi.summary(params),
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

export function useDeleteTender() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: tendersApi.remove,
    onSuccess: () => qc.invalidateQueries({ queryKey: tendersKeys.all }),
  });
}
