import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { clientsApi } from "@/api/clients";
import type { ClientUpdate } from "@/types/client";

export const clientsKeys = {
  all: ["clients"] as const,
  list: (params: object) => [...clientsKeys.all, "list", params] as const,
  detail: (id: string) => [...clientsKeys.all, "detail", id] as const,
};

export function useClients(params: { page: number; page_size: number; search?: string }) {
  return useQuery({
    queryKey: clientsKeys.list(params),
    queryFn: () => clientsApi.list(params),
  });
}

export function useClient(id: string) {
  return useQuery({
    queryKey: clientsKeys.detail(id),
    queryFn: () => clientsApi.get(id),
    enabled: Boolean(id),
  });
}

export function useCreateClient() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: clientsApi.create,
    onSuccess: () => qc.invalidateQueries({ queryKey: clientsKeys.all }),
  });
}

export function useUpdateClient() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: ClientUpdate }) =>
      clientsApi.update(id, payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: clientsKeys.all }),
  });
}

export function useDeleteClient() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: clientsApi.remove,
    onSuccess: () => qc.invalidateQueries({ queryKey: clientsKeys.all }),
  });
}
