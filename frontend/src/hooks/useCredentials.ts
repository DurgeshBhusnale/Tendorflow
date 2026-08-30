import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { credentialsApi } from "@/api/credentials";
import type { CredentialUpdate } from "@/types/credential";

export const credentialsKeys = {
  all: ["credentials"] as const,
  list: (params: object) => [...credentialsKeys.all, "list", params] as const,
  detail: (id: string) => [...credentialsKeys.all, "detail", id] as const,
};

export function useCredentials(params: {
  page: number;
  page_size: number;
  client_id?: string;
  portal_id?: string;
  search?: string;
}) {
  return useQuery({
    queryKey: credentialsKeys.list(params),
    queryFn: () => credentialsApi.list(params),
  });
}

export function useCreateCredential() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: credentialsApi.create,
    onSuccess: () => qc.invalidateQueries({ queryKey: credentialsKeys.all }),
  });
}

export function useUpdateCredential() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: CredentialUpdate }) =>
      credentialsApi.update(id, payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: credentialsKeys.all }),
  });
}

export function useDeleteCredential() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: credentialsApi.remove,
    onSuccess: () => qc.invalidateQueries({ queryKey: credentialsKeys.all }),
  });
}

/**
 * Reveals one credential's password on demand.
 *
 * A mutation rather than a query because revealing is a deliberate user action,
 * and the result must not be cached alongside the (masked) list data.
 */
export function useRevealPassword() {
  return useMutation({
    mutationFn: (id: string) => credentialsApi.get(id, { reveal: true }),
  });
}
