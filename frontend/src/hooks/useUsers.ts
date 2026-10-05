import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { usersApi } from "@/api/users";
import type { UserUpdate } from "@/types/user";

export const usersKeys = {
  all: ["users"] as const,
  list: (params: object) => [...usersKeys.all, "list", params] as const,
  directory: () => [...usersKeys.all, "directory"] as const,
};

export function useUsers(params: {
  page: number;
  page_size: number;
  search?: string;
  role?: string;
}) {
  return useQuery({
    queryKey: usersKeys.list(params),
    queryFn: () => usersApi.list(params),
  });
}

/** Names for the "Added/Updated By" filter — readable by any role (CH-37). */
export function useUserDirectory() {
  return useQuery({
    queryKey: usersKeys.directory(),
    queryFn: usersApi.directory,
  });
}

export function useCreateUser() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: usersApi.create,
    onSuccess: () => qc.invalidateQueries({ queryKey: usersKeys.all }),
  });
}

export function useUpdateUser() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: UserUpdate }) =>
      usersApi.update(id, payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: usersKeys.all }),
  });
}

export function useDeleteUser() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: usersApi.remove,
    onSuccess: () => qc.invalidateQueries({ queryKey: usersKeys.all }),
  });
}
