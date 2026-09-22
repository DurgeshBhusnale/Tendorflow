import { KeyRound } from "lucide-react";
import { useAuth } from "@/auth/AuthContext";
import { Avatar } from "@/components/shared/Avatar";
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
        <div className="flex min-w-0 items-center gap-3">
          <Avatar name={c.client.contact_person_name} />
          <div className="min-w-0">
            <span className="block truncate font-semibold text-foreground">
              {c.client.contact_person_name}
            </span>
            <span className="block truncate text-[13px] text-muted-foreground">
              {c.client.company_name}
            </span>
          </div>
        </div>
      ),
    },
    {
      header: "Portal",
      // Portal names run long ("Central Public Procurement Portal (CPPP)"), and
      // this table has eight columns to fit — clipped with the full name on hover.
      cell: (c) => (
        <span
          title={c.portal.name}
          className="inline-block max-w-[10rem] truncate rounded-md bg-muted px-2 py-1 text-xs font-semibold text-muted-foreground"
        >
          {c.portal.name}
        </span>
      ),
    },
    {
      header: "Login Identifier",
      cell: (c) => c.login_identifier ?? <span className="text-muted-foreground">—</span>,
    },
    { header: "Password", cell: (c) => <PasswordCell credential={c} /> },
    {
      // Both columns report the latest change, not the original entry (CH-13):
      // when a password is rotated, who did it and when is what matters.
      // Who and when in one cell: this table already carries a portal name and
      // a password control, and eight columns do not fit a 1440px desktop.
      header: "Added/Updated By",
      cell: (c) => (
        <span className="flex items-center gap-2">
          {c.created_by && <Avatar name={c.created_by.full_name} size="sm" />}
          <span className="min-w-0">
            <span className="block truncate text-foreground">
              {c.created_by?.full_name ?? "—"}
            </span>
            <span className="block truncate text-xs text-muted-foreground">
              {formatDate(c.updated_at)}
            </span>
          </span>
        </span>
      ),
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
