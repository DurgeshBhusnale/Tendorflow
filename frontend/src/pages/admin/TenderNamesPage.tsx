import {
  MasterListManager,
  type MasterListItem,
} from "@/components/shared/MasterListManager";
import {
  useCreateTenderName,
  useTenderNames,
  useUpdateTenderName,
} from "@/hooks/useTenderNames";

export default function TenderNamesPage() {
  const { data, isLoading } = useTenderNames();
  const createTenderName = useCreateTenderName();
  const updateTenderName = useUpdateTenderName();

  return (
    <MasterListManager
      title="Tender Names"
      entityLabel="Tender Name"
      items={data ?? []}
      isLoading={isLoading}
      onCreate={(name) => createTenderName.mutateAsync({ name })}
      onToggleActive={(item: MasterListItem) =>
        updateTenderName.mutateAsync({ id: item.id, payload: { is_active: !item.is_active } })
      }
    />
  );
}
