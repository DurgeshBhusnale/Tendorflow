import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useCreateUser, useUpdateUser, useUsers } from "@/hooks/useUsers";
import { ApiError } from "@/types/api";

const createUserSchema = z.object({
  full_name: z.string().min(1, "Required"),
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
  const createUser = useCreateUser();
  const updateUser = useUpdateUser();

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

  return (
    <div className="p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Users</h1>
        <Button onClick={() => setShowForm((v) => !v)}>
          {showForm ? "Cancel" : "Onboard User"}
        </Button>
      </div>

      {showForm && (
        <form onSubmit={onSubmit} className="mt-4 max-w-md space-y-3 rounded-lg border p-4">
          <div className="space-y-1">
            <label className="text-sm font-medium">Full Name</label>
            <Input {...register("full_name")} />
            {errors.full_name && (
              <p className="text-sm text-red-600">{errors.full_name.message}</p>
            )}
          </div>
          <div className="space-y-1">
            <label className="text-sm font-medium">Email</label>
            <Input type="email" {...register("email")} />
            {errors.email && <p className="text-sm text-red-600">{errors.email.message}</p>}
          </div>
          <div className="space-y-1">
            <label className="text-sm font-medium">Temporary Password</label>
            <Input type="password" {...register("password")} />
            {errors.password && <p className="text-sm text-red-600">{errors.password.message}</p>}
          </div>
          <div className="space-y-1">
            <label className="text-sm font-medium">Role</label>
            <select className="w-full rounded-md border px-3 py-2 text-sm" {...register("role")}>
              <option value="employee">Employee</option>
              <option value="admin">Admin</option>
            </select>
          </div>
          {formError && <p className="text-sm text-red-600">{formError}</p>}
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? "Creating…" : "Create User"}
          </Button>
        </form>
      )}

      <table className="mt-6 w-full text-sm">
        <thead>
          <tr className="border-b text-left">
            <th className="p-2">Name</th>
            <th className="p-2">Email</th>
            <th className="p-2">Role</th>
            <th className="p-2">Date Added</th>
            <th className="p-2">Active</th>
          </tr>
        </thead>
        <tbody>
          {isLoading && (
            <tr>
              <td className="p-2" colSpan={5}>
                Loading…
              </td>
            </tr>
          )}
          {data?.items.map((u) => (
            <tr key={u.id} className="border-b">
              <td className="p-2">{u.full_name}</td>
              <td className="p-2">{u.email}</td>
              <td className="p-2">{u.role}</td>
              <td className="p-2">{new Date(u.created_at).toLocaleDateString()}</td>
              <td className="p-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    updateUser.mutate({ id: u.id, payload: { is_active: !u.is_active } })
                  }
                >
                  {u.is_active ? "Active" : "Inactive"}
                </Button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
