import { Fingerprint } from "lucide-react";
import { useAuth } from "@/auth/AuthContext";
import { DataTable, type Column } from "@/components/shared/DataTable";
import { EmptyState } from "@/components/shared/EmptyState";
import { NoActions, RowActions } from "@/components/shared/RowActions";
import { StatusPill, type PillTone } from "@/components/shared/StatusPill";
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

export function DscTable({ dscKeys, isLoading, onEdit, onDelete, emptyAction }: DscTableProps) {
  const { user, isAdmin } = useAuth();

  // Mirrors the backend ownership rule; the server enforces it regardless.
  // Reads are open to everyone — that is the point of this shared dashboard.
  const canModify = (dscKey: DscKey) => isAdmin || dscKey.created_by?.id === user?.id;

  const columns: Column<DscKey>[] = [
    {
      header: "Client",
      mobile: "title",
      cell: (k) => <span className="font-medium text-foreground">{k.client.company_name}</span>,
    },
    {
      header: "Key Status",
      cell: (k) => <StatusPill label={k.key_status} tone={STATUS_TONES[k.key_status]} />,
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
      header: "Created By",
      cell: (k) => <span className="text-muted-foreground">{k.created_by?.full_name ?? "—"}</span>,
    },
    {
      header: "Created At",
      cell: (k) => <span className="text-muted-foreground">{formatDate(k.created_at)}</span>,
    },
    {
      header: "Actions",
      align: "right",
      mobile: "actions",
      cell: (k) =>
        canModify(k) ? (
          <RowActions onEdit={() => onEdit(k)} onDelete={() => onDelete(k)} />
        ) : (
          <NoActions />
        ),
    },
  ];

  return (
    <DataTable
      columns={columns}
      rows={dscKeys}
      rowKey={(k) => k.id}
      isLoading={isLoading}
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
