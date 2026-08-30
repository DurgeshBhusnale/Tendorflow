import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useCreateClient, useUpdateClient } from "@/hooks/useClients";
import { ApiError } from "@/types/api";
import type { Client } from "@/types/client";

const clientSchema = z.object({
  contact_person_name: z.string().min(1, "Required").max(120),
  company_name: z.string().min(1, "Required").max(200),
  contact_number: z.string().regex(/^[\d +-]{7,20}$/, "Invalid phone number"),
  email: z.string().email("Invalid email"),
});
type ClientFormValues = z.infer<typeof clientSchema>;

interface ClientFormProps {
  /** When provided, the form edits this client instead of creating a new one. */
  client?: Client;
  onSuccess: () => void;
  onCancel: () => void;
}

export function ClientForm({ client, onSuccess, onCancel }: ClientFormProps) {
  const [formError, setFormError] = useState<string | null>(null);
  const createClient = useCreateClient();
  const updateClient = useUpdateClient();

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ClientFormValues>({
    resolver: zodResolver(clientSchema),
    defaultValues: client
      ? {
          contact_person_name: client.contact_person_name,
          company_name: client.company_name,
          contact_number: client.contact_number,
          email: client.email,
        }
      : undefined,
  });

  const onSubmit = handleSubmit(async (values) => {
    setFormError(null);
    try {
      if (client) {
        await updateClient.mutateAsync({ id: client.id, payload: values });
      } else {
        await createClient.mutateAsync(values);
      }
      onSuccess();
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : "Something went wrong.");
    }
  });

  return (
    <form onSubmit={onSubmit} className="max-w-md space-y-3 rounded-lg border p-4">
      <h2 className="font-medium">{client ? "Edit Client" : "Add Client"}</h2>
      <div className="space-y-1">
        <label className="text-sm font-medium">Contact Person</label>
        <Input {...register("contact_person_name")} />
        {errors.contact_person_name && (
          <p className="text-sm text-red-600">{errors.contact_person_name.message}</p>
        )}
      </div>
      <div className="space-y-1">
        <label className="text-sm font-medium">Company Name</label>
        <Input {...register("company_name")} />
        {errors.company_name && (
          <p className="text-sm text-red-600">{errors.company_name.message}</p>
        )}
      </div>
      <div className="space-y-1">
        <label className="text-sm font-medium">Contact Number</label>
        <Input {...register("contact_number")} />
        {errors.contact_number && (
          <p className="text-sm text-red-600">{errors.contact_number.message}</p>
        )}
      </div>
      <div className="space-y-1">
        <label className="text-sm font-medium">Email</label>
        <Input type="email" {...register("email")} />
        {errors.email && <p className="text-sm text-red-600">{errors.email.message}</p>}
      </div>
      {formError && <p className="text-sm text-red-600">{formError}</p>}
      <div className="flex gap-2">
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? "Saving…" : client ? "Save Changes" : "Add Client"}
        </Button>
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </form>
  );
}
