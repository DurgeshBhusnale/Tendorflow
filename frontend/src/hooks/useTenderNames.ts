import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { tenderNamesApi } from "@/api/tender-names";
import type { TenderNameUpdate } from "@/types/tender-name";

export const tenderNamesKeys = {
  all: ["tender-names"] as const,
  list: (params: object) => [...tenderNamesKeys.all, "list", params] as const,
};

export function useTenderNames(params: { active_only?: boolean } = {}) {
  return useQuery({
    queryKey: tenderNamesKeys.list(params),
    queryFn: () => tenderNamesApi.list(params),
  });
}

export function useCreateTenderName() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: tenderNamesApi.create,
    onSuccess: () => qc.invalidateQueries({ queryKey: tenderNamesKeys.all }),
  });
}

export function useUpdateTenderName() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: TenderNameUpdate }) =>
      tenderNamesApi.update(id, payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: tenderNamesKeys.all }),
  });
}
