import { Plus, Users } from "lucide-react";
import { useState } from "react";
import { useAuth } from "@/auth/AuthContext";
import { DataTable, type Column } from "@/components/shared/DataTable";
import { Drawer } from "@/components/shared/Drawer";
import { EmptyState } from "@/components/shared/EmptyState";
import { PageHeader } from "@/components/shared/PageHeader";
import { RowActions } from "@/components/shared/RowActions";
import { StatusPill } from "@/components/shared/StatusPill";
import { Button } from "@/components/ui/button";
import { useConfirm } from "@/hooks/useConfirm";
import { useDeleteUser, useUpdateUser, useUsers } from "@/hooks/useUsers";
import { formatDate } from "@/lib/format";
import { UserForm } from "@/pages/admin/UserForm";
import type { User } from "@/types/user";

export default function UsersPage() {
  const [page] = useState(1);
  const [formState, setFormState] = useState<{ open: boolean; user?: User }>({ open: false });
  const { data, isLoading } = useUsers({ page, page_size: 25 });
  const { user: currentUser } = useAuth();
  const updateUser = useUpdateUser();
  const deleteUser = useDeleteUser();
  const confirm = useConfirm();

  function handleDelete(user: User) {
    // Deliberately blunter than the other delete confirmations in the app: this
    // one cannot be undone and it strips the person's name off every record
    // they ever created.
    confirm({
      title: `Permanently delete ${user.full_name}?`,
      description: (
        <>
          <p>
            They lose access immediately, and their name is removed from every client, tender,
            credential and DSC key they logged. This cannot be undone.
          </p>
          <p>To revoke access but keep their name on those records, use Deactivate instead.</p>
        </>
      ),
      confirmLabel: "Delete User",
      tone: "destructive",
      onConfirm: () => deleteUser.mutateAsync(user.id),
    });
  }

  const columns: Column<User>[] = [
    {
      header: "Name",
      mobile: "title",
      cell: (u) => <span className="font-medium text-foreground">{u.full_name}</span>,
    },
    {
      header: "Username",
      cell: (u) => <span className="font-mono text-xs text-foreground">{u.username}</span>,
    },
    {
      header: "Email",
      cell: (u) => <span className="text-muted-foreground">{u.email ?? "—"}</span>,
    },
    { header: "Role", cell: (u) => <span className="capitalize">{u.role}</span> },
    {
      header: "Date Added",
      cell: (u) => <span className="text-muted-foreground">{formatDate(u.created_at)}</span>,
    },
    {
      header: "Status",
      cell: (u) => (
        <StatusPill
          label={u.is_active ? "Active" : "Inactive"}
          tone={u.is_active ? "green" : "slate"}
        />
      ),
    },
    {
      header: "Actions",
      align: "right",
      mobile: "actions",
      cell: (u) => (
        <RowActions
          onEdit={() => setFormState({ open: true, user: u })}
          // Deleting yourself is refused by the server too; hiding the button
          // spares the admin a pointless error.
          onDelete={u.id === currentUser?.id ? undefined : () => handleDelete(u)}
        >
          <Button
            variant="outline"
            size="sm"
            onClick={() => updateUser.mutate({ id: u.id, payload: { is_active: !u.is_active } })}
          >
            {u.is_active ? "Deactivate" : "Reactivate"}
          </Button>
        </RowActions>
      ),
    },
  ];

  const addButton = (
    <Button onClick={() => setFormState({ open: true })}>
      <Plus />
      Onboard User
    </Button>
  );

  return (
    <div className="page">
      <PageHeader
        title="Users"
        description="Admins and employees with access to this workspace. Deactivating revokes sign-in and keeps their history; deleting removes the account and its attribution for good."
        actions={addButton}
      />

      <div className="surface">
        <DataTable
          columns={columns}
          rows={data?.items ?? []}
          rowKey={(u) => u.id}
          isLoading={isLoading}
          empty={
            <EmptyState
              icon={Users}
              title="No users yet"
              description="Onboard a teammate to give them access to the workspace."
              action={addButton}
            />
          }
        />
      </div>

      <Drawer
        open={formState.open}
        onClose={() => setFormState({ open: false })}
        title={formState.user ? "Edit User" : "Onboard User"}
        description={
          formState.user
            ? "Change any detail of this account. The password only changes if you enter a new one."
            : "The user signs in with the username and temporary password you set here."
        }
      >
        <UserForm
          user={formState.user}
          onSuccess={() => setFormState({ open: false })}
          onCancel={() => setFormState({ open: false })}
        />
      </Drawer>
    </div>
  );
}
