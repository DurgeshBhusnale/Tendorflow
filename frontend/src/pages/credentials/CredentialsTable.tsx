import { useAuth } from "@/auth/AuthContext";
import { DataTable, type Column } from "@/components/shared/DataTable";
import { EmptyState } from "@/components/shared/EmptyState";
import { Button } from "@/components/ui/button";
import { formatDate } from "@/lib/format";
import { PasswordCell } from "@/pages/credentials/PasswordCell";
import type { Credential } from "@/types/credential";

interface CredentialsTableProps {
  credentials: Credential[];
  isLoading: boolean;
  onEdit: (credential: Credential) => void;
  onDelete: (credential: Credential) => void;
  emptyAction?: React.ReactNode;
}

export function CredentialsTable({
  credentials,
  isLoading,
  onEdit,
  onDelete,
  emptyAction,
}: CredentialsTableProps) {
  const { user, isAdmin } = useAuth();

  // Mirrors the backend ownership rule; the server enforces it regardless.
  // Note this gates *writes* only — any employee may reveal any password.
  const canModify = (credential: Credential) =>
    isAdmin || credential.created_by?.id === user?.id;

  const columns: Column<Credential>[] = [
    { header: "Client", cell: (c) => c.client.company_name },
    { header: "Portal", cell: (c) => c.portal.name },
    { header: "Login Identifier", cell: (c) => c.login_identifier ?? "—" },
    { header: "Password", cell: (c) => <PasswordCell credential={c} /> },
    { header: "Added By", cell: (c) => c.created_by?.full_name ?? "—" },
    { header: "Date", cell: (c) => formatDate(c.created_at) },
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
      rows={credentials}
      rowKey={(c) => c.id}
      isLoading={isLoading}
      empty={<EmptyState title="No credentials yet" action={emptyAction} />}
    />
  );
}
