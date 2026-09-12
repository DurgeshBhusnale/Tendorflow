import { Fingerprint } from "lucide-react";
import { useAuth } from "@/auth/AuthContext";
import { DataTable, type Column } from "@/components/shared/DataTable";
import { EmptyState } from "@/components/shared/EmptyState";
import { RowActions } from "@/components/shared/RowActions";
import { StatusPill, type PillTone } from "@/components/shared/StatusPill";
import { formatDate } from "@/lib/format";
import type { DscKey } from "@/types/dsc";

// Keyed loosely because a legacy row may still carry the retired "Key Lost".
const STATUS_TONES: Record<string, PillTone> = {
  "Key Created": "green",
  "Key Returned": "green",
  "Key Issued": "red",
  "Key Lost": "red",
};

interface DscTableProps {
  dscKeys: DscKey[];
  isLoading: boolean;
  onEdit: (dscKey: DscKey) => void;
  onDelete: (dscKey: DscKey) => void;
  onViewHistory: (dscKey: DscKey) => void;
  emptyAction?: React.ReactNode;
}

export function DscTable({
  dscKeys,
  isLoading,
  onEdit,
  onDelete,
  onViewHistory,
  emptyAction,
}: DscTableProps) {
  const { isAdmin } = useAuth();

  const columns: Column<DscKey>[] = [
    {
      header: "Client",
      mobile: "title",
      cell: (k) => (
        <div className="min-w-0">
          <span className="block font-medium text-foreground">
            {k.client.contact_person_name}
          </span>
          <span className="block truncate text-xs text-muted-foreground">
            {k.client.company_name}
          </span>
        </div>
      ),
    },
    {
      header: "Key Status",
      cell: (k) => <StatusPill label={k.key_status} tone={STATUS_TONES[k.key_status] ?? "slate"} />,
    },
    {
      header: "Storage Location Notes",
      // The reason this module exists — kept visually prominent.
      cell: (k) =>
        k.storage_location_notes ? (
          <span className="font-medium text-foreground">{k.storage_location_notes}</span>
        ) : (
          <span className="text-muted-foreground">No location recorded</span>
        ),
    },
    {
      header: "Added/Updated By",
      cell: (k) => <span className="text-muted-foreground">{k.created_by?.full_name ?? "—"}</span>,
    },
    {
      header: "Date",
      cell: (k) => <span className="text-muted-foreground">{formatDate(k.updated_at)}</span>,
    },
    {
      header: "Actions",
      align: "right",
      mobile: "actions",
      cell: (k) => (
        // stopPropagation because the row itself opens the history panel; a
        // click on Edit must not do both.
        <div onClick={(event) => event.stopPropagation()}>
          <RowActions onEdit={() => onEdit(k)} onDelete={isAdmin ? () => onDelete(k) : undefined} />
        </div>
      ),
    },
  ];

  return (
    <DataTable
      columns={columns}
      rows={dscKeys}
      rowKey={(k) => k.id}
      isLoading={isLoading}
      onRowClick={onViewHistory}
      // A key that is out of the office is the one thing worth spotting from
      // across the room, so the whole row carries the warning, not just the
      // pill (CH-16).
      rowClassName={(k) =>
        k.key_status === "Key Issued" ? "bg-red-50/70 hover:bg-red-50" : undefined
      }
      empty={
        <EmptyState
          icon={Fingerprint}
          title="No DSC keys logged yet"
          description="Log a key so the whole team knows its status and where it is stored."
          action={emptyAction}
        />
      }
    />
  );
}
