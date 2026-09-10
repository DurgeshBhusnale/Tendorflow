import { Building2 } from "lucide-react";
import { useAuth } from "@/auth/AuthContext";
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
    { header: "Contact Person", cell: (c) => c.contact_person_name },
    {
      header: "Company Name",
      mobile: "title",
      cell: (c) => <span className="font-medium text-foreground">{c.company_name}</span>,
    },
    {
      header: "Contact Number",
      cell: (c) => <span className="tabular-nums">{c.contact_number}</span>,
    },
    { header: "Email", cell: (c) => <span className="text-muted-foreground">{c.email}</span> },
    {
      // Every user may edit every client now, so both columns report the latest
      // change rather than the original onboarding (CH-19).
      header: "Onboarded/Updated By",
      cell: (c) => <span className="text-muted-foreground">{c.created_by?.full_name ?? "—"}</span>,
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
