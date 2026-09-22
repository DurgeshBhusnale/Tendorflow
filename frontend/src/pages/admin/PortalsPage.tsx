import {
  MasterListManager,
  type MasterListItem,
} from "@/components/shared/MasterListManager";
import {
  useCreatePortal,
  useDeletePortal,
  usePortals,
  useUpdatePortal,
} from "@/hooks/usePortals";

export default function PortalsPage() {
  const { data, isLoading } = usePortals();
  const createPortal = useCreatePortal();
  const updatePortal = useUpdatePortal();
  const deletePortal = useDeletePortal();

  return (
    <MasterListManager
      title="Portals"
      entityLabel="Portal"
      inUseBy="saved credentials"
      items={data ?? []}
      isLoading={isLoading}
      onCreate={(name) => createPortal.mutateAsync({ name })}
      onToggleActive={(item: MasterListItem) =>
        updatePortal.mutateAsync({ id: item.id, payload: { is_active: !item.is_active } })
      }
      onDelete={(item: MasterListItem) => deletePortal.mutateAsync(item.id)}
    />
  );
}
