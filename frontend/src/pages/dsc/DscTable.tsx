import { useAuth } from "@/auth/AuthContext";
import { DataTable, type Column } from "@/components/shared/DataTable";
import { EmptyState } from "@/components/shared/EmptyState";
import { StatusPill, type PillTone } from "@/components/shared/StatusPill";
import { Button } from "@/components/ui/button";
import { formatDate } from "@/lib/format";
import type { DscKey, DscKeyStatus } from "@/types/dsc";

const STATUS_TONES: Record<DscKeyStatus, PillTone> = {
  "Key Created": "green",
  "Key Returned": "green",
  "Key Issued": "amber",
  "Key Lost": "red",
};

interface DscTableProps {
  dscKeys: DscKey[];
  isLoading: boolean;
  onEdit: (dscKey: DscKey) => void;
  onDelete: (dscKey: DscKey) => void;
  emptyAction?: React.ReactNode;
}

export function DscTable({
  dscKeys,
  isLoading,
  onEdit,
  onDelete,
  emptyAction,
}: DscTableProps) {
  const { user, isAdmin } = useAuth();

  // Mirrors the backend ownership rule; the server enforces it regardless.
  // Reads are open to everyone — that is the point of this shared dashboard.
  const canModify = (dscKey: DscKey) => isAdmin || dscKey.created_by?.id === user?.id;

  const columns: Column<DscKey>[] = [
    { header: "Client", cell: (k) => k.client.company_name },
    {
      header: "Key Status",
      cell: (k) => <StatusPill label={k.key_status} tone={STATUS_TONES[k.key_status]} />,
    },
    {
      header: "Storage Location Notes",
      // The reason this module exists — kept visually prominent.
      cell: (k) =>
        k.storage_location_notes ? (
          <span className="font-medium">{k.storage_location_notes}</span>
        ) : (
          <span className="text-muted-foreground">No location recorded</span>
        ),
    },
    { header: "Created By", cell: (k) => k.created_by?.full_name ?? "—" },
    { header: "Created At", cell: (k) => formatDate(k.created_at) },
    {
      header: "Actions",
      cell: (k) =>
        canModify(k) ? (
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => onEdit(k)}>
              Edit
            </Button>
            <Button variant="outline" size="sm" onClick={() => onDelete(k)}>
              Delete
            </Button>
          </div>
        ) : (
          <span className="text-muted-foreground">—</span>
        ),
    },
  ];

  return (
    <DataTable
      columns={columns}
      rows={dscKeys}
      rowKey={(k) => k.id}
      isLoading={isLoading}
      empty={<EmptyState title="No DSC keys logged yet" action={emptyAction} />}
    />
  );
}
