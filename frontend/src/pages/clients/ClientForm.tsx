import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { DrawerBody, DrawerFooter } from "@/components/shared/Drawer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FieldError, Label } from "@/components/ui/label";
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
    <form onSubmit={onSubmit} className="flex h-full flex-col">
      <DrawerBody>
        <div className="space-y-1.5">
          <Label htmlFor="contact_person_name">Contact Person</Label>
          <Input id="contact_person_name" {...register("contact_person_name")} />
          <FieldError>{errors.contact_person_name?.message}</FieldError>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="company_name">Company Name</Label>
          <Input id="company_name" {...register("company_name")} />
          <FieldError>{errors.company_name?.message}</FieldError>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="contact_number">Contact Number</Label>
          <Input id="contact_number" {...register("contact_number")} />
          <FieldError>{errors.contact_number?.message}</FieldError>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="email">Email</Label>
          <Input id="email" type="email" {...register("email")} />
          <FieldError>{errors.email?.message}</FieldError>
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
          {isSubmitting ? "Saving…" : client ? "Save Changes" : "Add Client"}
        </Button>
      </DrawerFooter>
    </form>
  );
}
