import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { dscApi } from "@/api/dsc";
import type { DscKeyStatus, DscKeyUpdate } from "@/types/dsc";

export const dscKeys = {
  all: ["dsc"] as const,
  list: (params: object) => [...dscKeys.all, "list", params] as const,
  history: (id: string) => [...dscKeys.all, "history", id] as const,
};

export function useDscKeys(params: {
  page: number;
  page_size: number;
  client_id?: string;
  status?: DscKeyStatus;
  search?: string;
}) {
  return useQuery({
    queryKey: dscKeys.list(params),
    queryFn: () => dscApi.list(params),
  });
}

/** One key's creation/issuance/return trail. Fetched when the panel opens. */
export function useDscKeyHistory(id: string | undefined) {
  return useQuery({
    queryKey: dscKeys.history(id ?? ""),
    queryFn: () => dscApi.history(id as string),
    enabled: Boolean(id),
  });
}

export function useCreateDscKey() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: dscApi.create,
    onSuccess: () => qc.invalidateQueries({ queryKey: dscKeys.all }),
  });
}

export function useUpdateDscKey() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: DscKeyUpdate }) =>
      dscApi.update(id, payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: dscKeys.all }),
  });
}

export function useDeleteDscKey() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: dscApi.remove,
    onSuccess: () => qc.invalidateQueries({ queryKey: dscKeys.all }),
  });
}
