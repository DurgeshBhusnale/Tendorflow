import { useAuth } from "@/auth/AuthContext";
import { DataTable, type Column } from "@/components/shared/DataTable";
import { EmptyState } from "@/components/shared/EmptyState";
import { Button } from "@/components/ui/button";
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
    { header: "Company Name", cell: (c) => c.company_name },
    { header: "Contact Number", cell: (c) => c.contact_number },
    { header: "Email", cell: (c) => c.email },
    { header: "Onboarded By", cell: (c) => c.created_by?.full_name ?? "—" },
    { header: "Date Added", cell: (c) => formatDate(c.created_at) },
    {
      header: "Actions",
      cell: (c) =>
        canModify(c) ? (
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => onEdit(c)}>
              Edit
            </Button>
            <Button variant="outline" size="sm" onClick={() => onDelete(c)}>
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
      rows={clients}
      rowKey={(c) => c.id}
      isLoading={isLoading}
      empty={<EmptyState title="No clients yet" action={emptyAction} />}
    />
  );
}
