import { MasterListManager, type MasterListItem } from "@/components/shared/MasterListManager";
import {
  useCreateTenderDepartment,
  useDeleteTenderDepartment,
  useTenderDepartments,
  useUpdateTenderDepartment,
} from "@/hooks/useTenderDepartments";

export default function TenderDepartmentsPage() {
  const { data, isLoading } = useTenderDepartments();
  const createTenderDepartment = useCreateTenderDepartment();
  const updateTenderDepartment = useUpdateTenderDepartment();
  const deleteTenderDepartment = useDeleteTenderDepartment();

  return (
    <MasterListManager
      title="Tender Departments"
      entityLabel="Tender Department"
      inUseBy="logged tenders"
      items={data ?? []}
      isLoading={isLoading}
      onCreate={(name) => createTenderDepartment.mutateAsync({ name })}
      onToggleActive={(item: MasterListItem) =>
        updateTenderDepartment.mutateAsync({ id: item.id, payload: { is_active: !item.is_active } })
      }
      onDelete={(item: MasterListItem) => deleteTenderDepartment.mutateAsync(item.id)}
    />
  );
}
