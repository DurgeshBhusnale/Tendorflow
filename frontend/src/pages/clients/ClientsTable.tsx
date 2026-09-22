import { Building2 } from "lucide-react";
import { useAuth } from "@/auth/AuthContext";
import { Avatar } from "@/components/shared/Avatar";
import { DataTable, type Column } from "@/components/shared/DataTable";
import { EmptyState } from "@/components/shared/EmptyState";
import { RowActions } from "@/components/shared/RowActions";
import { formatDate } from "@/lib/format";
import type { Client } from "@/types/client";

interface ClientsTableProps {
  clients: Client[];
  isLoading: boolean;
  onEdit: (client: Client) => void;
  onDelete: (client: Client) => void;
  emptyAction?: React.ReactNode;
}

export function ClientsTable({
  clients,
  isLoading,
  onEdit,
  onDelete,
  emptyAction,
}: ClientsTableProps) {
  const { isAdmin } = useAuth();

  const columns: Column<Client>[] = [
    {
      // Name over email in one cell: two facts about the same person, and it
      // buys back a column's width for the table.
      header: "Contact Person",
      cell: (c) => (
        <span className="flex items-center gap-3">
          <Avatar name={c.contact_person_name} />
          <span className="min-w-0">
            <span className="block truncate font-semibold text-foreground">
              {c.contact_person_name}
            </span>
            <span className="block truncate text-[13px] text-muted-foreground">{c.email}</span>
          </span>
        </span>
      ),
    },
    {
      header: "Company Name",
      mobile: "title",
      cell: (c) => <span className="font-medium text-foreground">{c.company_name}</span>,
    },
    {
      header: "Contact Number",
      cell: (c) => <span className="tabular-nums text-muted-foreground">{c.contact_number}</span>,
    },
    {
      header: "Bank Details",
      // Multi-line free text in a table that never wraps, so it is clamped to
      // one line with the full value on hover (CH-26).
      cell: (c) =>
        c.bank_details ? (
          <span className="block max-w-[14rem] truncate" title={c.bank_details}>
            {c.bank_details}
          </span>
        ) : (
          <span className="text-muted-foreground">—</span>
        ),
    },
    {
      // Every user may edit every client now, so both columns report the latest
      // change rather than the original onboarding (CH-19).
      header: "Onboarded/Updated By",
      cell: (c) =>
        c.created_by ? (
          <span className="flex items-center gap-2">
            <Avatar name={c.created_by.full_name} size="sm" />
            <span className="truncate text-muted-foreground">{c.created_by.full_name}</span>
          </span>
        ) : (
          <span className="text-muted-foreground">—</span>
        ),
    },
    {
      header: "Date",
      cell: (c) => <span className="text-muted-foreground">{formatDate(c.updated_at)}</span>,
    },
    {
      header: "Actions",
      align: "right",
      mobile: "actions",
      // Anyone may edit any client (CH-19); only admins may delete one, since
      // deleting cascades to their credentials, tenders and DSC keys.
      cell: (c) => (
        <RowActions onEdit={() => onEdit(c)} onDelete={isAdmin ? () => onDelete(c) : undefined} />
      ),
    },
  ];

  return (
    <DataTable
      columns={columns}
      rows={clients}
      rowKey={(c) => c.id}
      isLoading={isLoading}
      empty={
        <EmptyState
          icon={Building2}
          title="No clients yet"
          description="Onboard your first client to start logging credentials, DSC keys, and tenders against them."
          action={emptyAction}
        />
      }
    />
  );
}
