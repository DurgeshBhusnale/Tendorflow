import { zodResolver } from "@hookform/resolvers/zod";
import { Plus, Trash2, Users } from "lucide-react";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { useAuth } from "@/auth/AuthContext";
import { DataTable, type Column } from "@/components/shared/DataTable";
import { Drawer, DrawerBody, DrawerFooter } from "@/components/shared/Drawer";
import { EmptyState } from "@/components/shared/EmptyState";
import { PageHeader } from "@/components/shared/PageHeader";
import { StatusPill } from "@/components/shared/StatusPill";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FieldError, Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { useCreateUser, useDeleteUser, useUpdateUser, useUsers } from "@/hooks/useUsers";
import { formatDate } from "@/lib/format";
import { usernameSchema } from "@/lib/validation";
import { ApiError } from "@/types/api";
import type { User } from "@/types/user";

const createUserSchema = z.object({
  full_name: z.string().min(1, "Required"),
  // Username is the sign-in credential; email stays required as the contact
  // address (CH-02). Neither is optional at onboarding.
  username: usernameSchema,
  email: z.string().email("Invalid email"),
  password: z
    .string()
    .min(8, "At least 8 characters")
    .regex(/[A-Za-z]/, "Must contain a letter")
    .regex(/\d/, "Must contain a number"),
  role: z.enum(["admin", "employee"]),
});
type CreateUserValues = z.infer<typeof createUserSchema>;

export default function UsersPage() {
  const [page] = useState(1);
  const [showForm, setShowForm] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const { data, isLoading } = useUsers({ page, page_size: 25 });
  const { user: currentUser } = useAuth();
  const createUser = useCreateUser();
  const updateUser = useUpdateUser();
  const deleteUser = useDeleteUser();

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<CreateUserValues>({
    resolver: zodResolver(createUserSchema),
    defaultValues: { role: "employee" },
  });

  const onSubmit = handleSubmit(async (values) => {
    setFormError(null);
    try {
      await createUser.mutateAsync(values);
      reset();
      setShowForm(false);
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : "Something went wrong.");
    }
  });

  async function handleDelete(user: User) {
    // Deliberately blunter than the other delete confirmations in the app: this
    // one cannot be undone and it strips the person's name off every record
    // they ever created.
    const confirmed = window.confirm(
      [
        `Permanently delete ${user.full_name}?`,
        "They lose access immediately, and their name is removed from every client, " +
          "tender, credential and DSC key they logged. This cannot be undone.",
        "To revoke access but keep their name on those records, use Deactivate instead.",
      ].join("\n\n"),
    );
    if (!confirmed) return;
    try {
      await deleteUser.mutateAsync(user.id);
    } catch (err) {
      window.alert(err instanceof ApiError ? err.message : "Could not delete this user.");
    }
  }

  function closeForm() {
    reset();
    setFormError(null);
    setShowForm(false);
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
    { header: "Email", cell: (u) => <span className="text-muted-foreground">{u.email}</span> },
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
        <div className="flex justify-end gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => updateUser.mutate({ id: u.id, payload: { is_active: !u.is_active } })}
          >
            {u.is_active ? "Deactivate" : "Reactivate"}
          </Button>
          {/* Deleting yourself is refused by the server too; hiding the button
              spares the admin a pointless error. */}
          {u.id !== currentUser?.id && (
            <Button
              variant="outline"
              size="icon"
              onClick={() => handleDelete(u)}
              aria-label={`Delete ${u.full_name}`}
              title="Delete permanently"
              className="text-destructive hover:bg-red-50 hover:text-destructive"
            >
              <Trash2 />
            </Button>
          )}
        </div>
      ),
    },
  ];

  const addButton = (
    <Button onClick={() => setShowForm(true)}>
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
        open={showForm}
        onClose={closeForm}
        title="Onboard User"
        description="The user signs in with the username and temporary password you set here."
      >
        <form onSubmit={onSubmit} className="flex h-full flex-col">
          <DrawerBody>
            <div className="space-y-1.5">
              <Label htmlFor="user_full_name">Full Name</Label>
              <Input id="user_full_name" {...register("full_name")} />
              <FieldError>{errors.full_name?.message}</FieldError>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="user_username">Username</Label>
              <Input
                id="user_username"
                autoCapitalize="none"
                spellCheck={false}
                placeholder="asha.patil"
                {...register("username")}
              />
              <FieldError>{errors.username?.message}</FieldError>
              <p className="text-xs text-muted-foreground">
                This is what they sign in with. It cannot be changed later.
              </p>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="user_email">Email</Label>
              <Input id="user_email" type="email" {...register("email")} />
              <FieldError>{errors.email?.message}</FieldError>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="user_password">Temporary Password</Label>
              <Input
                id="user_password"
                type="password"
                autoComplete="new-password"
                {...register("password")}
              />
              <FieldError>{errors.password?.message}</FieldError>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="user_role">Role</Label>
              <Select id="user_role" {...register("role")}>
                <option value="employee">Employee</option>
                <option value="admin">Admin</option>
              </Select>
            </div>
            {formError && (
              <p className="border border-red-100 bg-red-50 px-3 py-2 text-sm text-destructive">
                {formError}
              </p>
            )}
          </DrawerBody>

          <DrawerFooter>
            <Button type="button" variant="outline" onClick={closeForm}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Creating…" : "Create User"}
            </Button>
          </DrawerFooter>
        </form>
      </Drawer>
    </div>
  );
}
