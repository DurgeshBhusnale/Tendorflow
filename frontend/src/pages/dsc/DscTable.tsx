import { Fingerprint } from "lucide-react";
import { useAuth } from "@/auth/AuthContext";
import { Avatar } from "@/components/shared/Avatar";
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
        <div className="flex min-w-0 items-center gap-3">
          <Avatar name={k.client.contact_person_name} />
          <div className="min-w-0">
            <span className="block truncate font-semibold text-foreground">
              {k.client.contact_person_name}
            </span>
            <span className="block truncate text-[13px] text-muted-foreground">
              {k.client.company_name}
            </span>
            {/* Status and location in the phone row itself: tapping opens the
                history panel rather than a detail sheet, so the row has to
                carry what this module exists to answer (CH-30). Both sit on
                the row's own lines rather than beside it, because the row also
                carries its edit and delete buttons. */}
            <span className="mt-1.5 flex items-center gap-2 md:hidden">
              <StatusPill label={k.key_status} tone={STATUS_TONES[k.key_status] ?? "slate"} />
              <span className="truncate text-[13px] font-medium text-foreground">
                {k.storage_location_notes ?? "No location"}
              </span>
            </span>
          </div>
        </div>
      ),
    },
    {
      header: "Key Status",
      // The phone row renders the pill inside the client cell instead.
      mobile: "hide",
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
      cell: (k) =>
        k.created_by ? (
          <span className="flex items-center gap-2">
            <Avatar name={k.created_by.full_name} size="sm" />
            <span className="truncate text-muted-foreground">{k.created_by.full_name}</span>
          </span>
        ) : (
          <span className="text-muted-foreground">—</span>
        ),
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
        k.key_status === "Key Issued" ? "md:bg-red-50/70 md:hover:bg-red-50" : undefined
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
