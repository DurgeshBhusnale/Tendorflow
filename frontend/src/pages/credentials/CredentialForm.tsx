import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { DrawerBody, DrawerFooter } from "@/components/shared/Drawer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FieldError, Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { useClients } from "@/hooks/useClients";
import { useCreateCredential, useUpdateCredential } from "@/hooks/useCredentials";
import { usePortals } from "@/hooks/usePortals";
import { ApiError } from "@/types/api";
import type { Credential } from "@/types/credential";

const credentialSchema = z.object({
  client_id: z.string().uuid("Select a client"),
  portal_id: z.string().uuid("Select a portal"),
  login_identifier: z.string().max(200).optional(),
  password: z.string().min(1, "Required").max(200),
});
type CredentialFormValues = z.infer<typeof credentialSchema>;

interface CredentialFormProps {
  credential?: Credential;
  onSuccess: () => void;
  onCancel: () => void;
}

export function CredentialForm({ credential, onSuccess, onCancel }: CredentialFormProps) {
  const [formError, setFormError] = useState<string | null>(null);
  // Clients list is the select's source; page_size is the API max.
  const { data: clientsPage } = useClients({ page: 1, page_size: 100 });
  // Only active portals are offered — inactive ones stay valid on existing rows.
  const { data: portals } = usePortals({ active_only: true });
  const createCredential = useCreateCredential();
  const updateCredential = useUpdateCredential();

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<CredentialFormValues>({
    resolver: zodResolver(credentialSchema),
    defaultValues: credential
      ? {
          client_id: credential.client.id,
          portal_id: credential.portal.id,
          login_identifier: credential.login_identifier ?? "",
          // Never prefill with the masked value — the user retypes to change it.
          password: "",
        }
      : undefined,
  });

  const onSubmit = handleSubmit(async (values) => {
    setFormError(null);
    const payload = {
      ...values,
      login_identifier: values.login_identifier?.trim() || null,
    };
    try {
      if (credential) {
        await updateCredential.mutateAsync({ id: credential.id, payload });
      } else {
        await createCredential.mutateAsync(payload);
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
          <Label htmlFor="credential_client_id">Client</Label>
          <Select id="credential_client_id" {...register("client_id")}>
            <option value="">Select a client…</option>
            {clientsPage?.items.map((c) => (
              <option key={c.id} value={c.id}>
                {c.company_name}
              </option>
            ))}
          </Select>
          <FieldError>{errors.client_id?.message}</FieldError>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="credential_portal_id">Portal</Label>
          <Select id="credential_portal_id" {...register("portal_id")}>
            <option value="">Select a portal…</option>
            {portals?.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </Select>
          <FieldError>{errors.portal_id?.message}</FieldError>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="login_identifier">Username / Email / Phone (optional)</Label>
          <Input id="login_identifier" {...register("login_identifier")} />
          <FieldError>{errors.login_identifier?.message}</FieldError>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="credential_password">Password</Label>
          <Input
            id="credential_password"
            type="password"
            autoComplete="new-password"
            {...register("password")}
          />
          <FieldError>{errors.password?.message}</FieldError>
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
          {isSubmitting ? "Saving…" : credential ? "Save Changes" : "Add Credential"}
        </Button>
      </DrawerFooter>
    </form>
  );
}
