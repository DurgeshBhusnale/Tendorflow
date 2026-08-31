import { Building2 } from "lucide-react";
import { useAuth } from "@/auth/AuthContext";
import { DataTable, type Column } from "@/components/shared/DataTable";
import { EmptyState } from "@/components/shared/EmptyState";
import { NoActions, RowActions } from "@/components/shared/RowActions";
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
  const { user, isAdmin } = useAuth();

  // Mirrors the backend ownership rule (services/client_service.py): admins can
  // modify anything, employees only what they created. The server enforces this
  // regardless — this just avoids showing actions that would 403.
  const canModify = (client: Client) => isAdmin || client.created_by?.id === user?.id;

  const columns: Column<Client>[] = [
    { header: "Contact Person", cell: (c) => c.contact_person_name },
    {
      header: "Company Name",
      cell: (c) => <span className="font-medium text-foreground">{c.company_name}</span>,
    },
    {
      header: "Contact Number",
      cell: (c) => <span className="tabular-nums">{c.contact_number}</span>,
    },
    { header: "Email", cell: (c) => <span className="text-muted-foreground">{c.email}</span> },
    {
      header: "Onboarded By",
      cell: (c) => <span className="text-muted-foreground">{c.created_by?.full_name ?? "—"}</span>,
    },
    {
      header: "Date Added",
      cell: (c) => <span className="text-muted-foreground">{formatDate(c.created_at)}</span>,
    },
    {
      header: "Actions",
      align: "right",
      cell: (c) =>
        canModify(c) ? (
          <RowActions onEdit={() => onEdit(c)} onDelete={() => onDelete(c)} />
        ) : (
          <NoActions />
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
