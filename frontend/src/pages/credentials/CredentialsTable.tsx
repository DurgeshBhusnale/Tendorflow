import { KeyRound } from "lucide-react";
import { useAuth } from "@/auth/AuthContext";
import { DataTable, type Column } from "@/components/shared/DataTable";
import { EmptyState } from "@/components/shared/EmptyState";
import { NoActions, RowActions } from "@/components/shared/RowActions";
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
  const canModify = (credential: Credential) => isAdmin || credential.created_by?.id === user?.id;

  const columns: Column<Credential>[] = [
    {
      header: "Client",
      mobile: "title",
      cell: (c) => <span className="font-medium text-foreground">{c.client.company_name}</span>,
    },
    { header: "Portal", cell: (c) => c.portal.name },
    {
      header: "Login Identifier",
      cell: (c) => c.login_identifier ?? <span className="text-muted-foreground">—</span>,
    },
    { header: "Password", cell: (c) => <PasswordCell credential={c} /> },
    {
      header: "Added By",
      cell: (c) => <span className="text-muted-foreground">{c.created_by?.full_name ?? "—"}</span>,
    },
    {
      header: "Date",
      cell: (c) => <span className="text-muted-foreground">{formatDate(c.created_at)}</span>,
    },
    {
      header: "Actions",
      align: "right",
      mobile: "actions",
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
