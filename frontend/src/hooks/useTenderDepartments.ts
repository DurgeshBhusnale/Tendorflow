import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { tenderDepartmentsApi } from "@/api/tender-departments";
import type { TenderDepartmentUpdate } from "@/types/tender-department";

export const tenderDepartmentsKeys = {
  all: ["tender-departments"] as const,
  list: (params: object) => [...tenderDepartmentsKeys.all, "list", params] as const,
};

export function useTenderDepartments(params: { active_only?: boolean } = {}) {
  return useQuery({
    queryKey: tenderDepartmentsKeys.list(params),
    queryFn: () => tenderDepartmentsApi.list(params),
  });
}

export function useCreateTenderDepartment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: tenderDepartmentsApi.create,
    onSuccess: () => qc.invalidateQueries({ queryKey: tenderDepartmentsKeys.all }),
  });
}

export function useUpdateTenderDepartment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: TenderDepartmentUpdate }) =>
      tenderDepartmentsApi.update(id, payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: tenderDepartmentsKeys.all }),
  });
}
