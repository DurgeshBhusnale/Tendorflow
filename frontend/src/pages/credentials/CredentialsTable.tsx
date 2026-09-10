import { KeyRound } from "lucide-react";
import { useAuth } from "@/auth/AuthContext";
import { DataTable, type Column } from "@/components/shared/DataTable";
import { EmptyState } from "@/components/shared/EmptyState";
import { RowActions } from "@/components/shared/RowActions";
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
  const { isAdmin } = useAuth();

  const columns: Column<Credential>[] = [
    {
      header: "Client",
      mobile: "title",
      cell: (c) => (
        <div className="min-w-0">
          <span className="block font-medium text-foreground">
            {c.client.contact_person_name}
          </span>
          <span className="block truncate text-xs text-muted-foreground">
            {c.client.company_name}
          </span>
        </div>
      ),
    },
    { header: "Portal", cell: (c) => c.portal.name },
    {
      header: "Login Identifier",
      cell: (c) => c.login_identifier ?? <span className="text-muted-foreground">—</span>,
    },
    { header: "Password", cell: (c) => <PasswordCell credential={c} /> },
    {
      // Both columns report the latest change, not the original entry (CH-13):
      // when a password is rotated, who did it and when is what matters.
      header: "Added/Updated By",
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
      // Anyone may edit any credential (CH-19); only admins may delete one.
      cell: (c) => (
        <RowActions onEdit={() => onEdit(c)} onDelete={isAdmin ? () => onDelete(c) : undefined} />
      ),
    },
  ];

  return (
    <DataTable
      columns={columns}
      rows={credentials}
      rowKey={(c) => c.id}
      isLoading={isLoading}
      empty={
        <EmptyState
          icon={KeyRound}
          title="No credentials yet"
          description="Store a portal login against a client so anyone on the team can find it when a tender is due."
          action={emptyAction}
        />
      }
    />
  );
}
