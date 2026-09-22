import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { emdsApi, type EmdFilters } from "@/api/emds";
import type { EmdUpdate } from "@/types/emd";

export const emdsKeys = {
  all: ["emds"] as const,
  list: (params: object) => [...emdsKeys.all, "list", params] as const,
  summary: (params: object) => [...emdsKeys.all, "summary", params] as const,
};

export function useEmds(params: EmdFilters & { page: number; page_size: number }) {
  return useQuery({
    queryKey: emdsKeys.list(params),
    queryFn: () => emdsApi.list(params),
  });
}

export function useEmdSummary(params: EmdFilters) {
  return useQuery({
    queryKey: emdsKeys.summary(params),
    queryFn: () => emdsApi.summary(params),
  });
}

export function useCreateEmd() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: emdsApi.create,
    // Invalidating the whole key refreshes the KPI strip too, so the totals
    // can't drift from the table.
    onSuccess: () => qc.invalidateQueries({ queryKey: emdsKeys.all }),
  });
}

export function useUpdateEmd() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: EmdUpdate }) =>
      emdsApi.update(id, payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: emdsKeys.all }),
  });
}

export function useDeleteEmd() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: emdsApi.remove,
    onSuccess: () => qc.invalidateQueries({ queryKey: emdsKeys.all }),
  });
}
