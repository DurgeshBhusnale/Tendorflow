import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { portalsApi } from "@/api/portals";
import type { PortalUpdate } from "@/types/portal";

export const portalsKeys = {
  all: ["portals"] as const,
  list: (params: object) => [...portalsKeys.all, "list", params] as const,
};

export function usePortals(params: { active_only?: boolean } = {}) {
  return useQuery({
    queryKey: portalsKeys.list(params),
    queryFn: () => portalsApi.list(params),
  });
}

export function useCreatePortal() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: portalsApi.create,
    onSuccess: () => qc.invalidateQueries({ queryKey: portalsKeys.all }),
  });
}

export function useUpdatePortal() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: PortalUpdate }) =>
      portalsApi.update(id, payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: portalsKeys.all }),
  });
}
