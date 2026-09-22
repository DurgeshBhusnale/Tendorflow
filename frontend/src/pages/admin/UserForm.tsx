import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { DrawerBody, DrawerFooter } from "@/components/shared/Drawer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FieldError, Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { useCreateUser, useUpdateUser } from "@/hooks/useUsers";
import { usernameSchema } from "@/lib/validation";
import { ApiError } from "@/types/api";
import type { User } from "@/types/user";

const passwordRules = z
  .string()
  .min(8, "At least 8 characters")
  .regex(/[A-Za-z]/, "Must contain a letter")
  .regex(/\d/, "Must contain a number");

// Optional everywhere (CH-25): blank means "no email", not "invalid email".
const optionalEmail = z
  .string()
  .trim()
  .refine((v) => v === "" || z.string().email().safeParse(v).success, "Invalid email");

function userSchema(isEdit: boolean) {
  return z.object({
    full_name: z.string().min(1, "Required"),
    username: usernameSchema,
    email: optionalEmail,
    // On edit the password box is a change, not a requirement — blank keeps
    // whatever the user already has.
    password: isEdit
      ? z.string().refine((v) => v === "" || passwordRules.safeParse(v).success, {
          message: "At least 8 characters, with a letter and a number",
        })
      : passwordRules,
    role: z.enum(["admin", "employee"]),
  });
}

type UserFormValues = z.infer<ReturnType<typeof userSchema>>;

interface UserFormProps {
  /** When provided, the form edits this user instead of onboarding a new one. */
  user?: User;
  onSuccess: () => void;
  onCancel: () => void;
}

export function UserForm({ user, onSuccess, onCancel }: UserFormProps) {
  const [formError, setFormError] = useState<string | null>(null);
  const createUser = useCreateUser();
  const updateUser = useUpdateUser();
  const isEdit = user !== undefined;

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<UserFormValues>({
    resolver: zodResolver(userSchema(isEdit)),
    defaultValues: user
      ? {
          full_name: user.full_name,
          username: user.username,
          email: user.email ?? "",
          password: "",
          role: user.role,
        }
      : { role: "employee", email: "", password: "" },
  });

  const onSubmit = handleSubmit(async (values) => {
    setFormError(null);
    try {
      if (user) {
        await updateUser.mutateAsync({
          id: user.id,
          payload: {
            full_name: values.full_name,
            username: values.username,
            // Null rather than "" so clearing the box clears the stored address.
            email: values.email || null,
            role: values.role,
            // Omitted entirely when blank, so the current password survives.
            ...(values.password ? { password: values.password } : {}),
          },
        });
      } else {
        await createUser.mutateAsync({
          full_name: values.full_name,
          username: values.username,
          email: values.email || null,
          password: values.password,
          role: values.role,
        });
      }
      onSuccess();
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : "Something went wrong.");
    }
  });

  return (
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
            {isEdit
              ? "This is what they sign in with — tell them if you change it. They stay signed in on any device they are already using."
              : "This is what they sign in with."}
          </p>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="user_email">Email (optional)</Label>
          <Input id="user_email" type="email" {...register("email")} />
          <FieldError>{errors.email?.message}</FieldError>
          <p className="text-xs text-muted-foreground">
            A contact address only — nobody signs in with it.
          </p>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="user_password">{isEdit ? "New Password" : "Temporary Password"}</Label>
          <Input
            id="user_password"
            type="password"
            autoComplete="new-password"
            {...register("password")}
          />
          <FieldError>{errors.password?.message}</FieldError>
          {isEdit && (
            <p className="text-xs text-muted-foreground">
              Leave blank to keep their current password.
            </p>
          )}
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
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? "Saving…" : isEdit ? "Save Changes" : "Create User"}
        </Button>
      </DrawerFooter>
    </form>
  );
}
