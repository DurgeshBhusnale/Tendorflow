import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { ClientPicker } from "@/components/shared/ClientPicker";
import { DrawerBody, DrawerFooter } from "@/components/shared/Drawer";
import { Button } from "@/components/ui/button";
import { Combobox } from "@/components/ui/combobox";
import { Input } from "@/components/ui/input";
import { FieldError, Label } from "@/components/ui/label";
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
  // Only active portals are offered — inactive ones stay valid on existing rows.
  const { data: portals } = usePortals({ active_only: true });
  const createCredential = useCreateCredential();
  const updateCredential = useUpdateCredential();

  const {
    register,
    handleSubmit,
    watch,
    setValue,
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

  const clientId = watch("client_id") ?? "";
  const portalId = watch("portal_id") ?? "";

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
        <ClientPicker
          idPrefix="credential"
          value={clientId}
          onChange={(id) => setValue("client_id", id, { shouldValidate: true })}
          selected={credential?.client}
          error={errors.client_id?.message}
        />

        <div className="space-y-1.5">
          <Label htmlFor="credential_portal_id">Portal</Label>
          <Combobox
            id="credential_portal_id"
            options={(portals ?? []).map((p) => ({ value: p.id, label: p.name }))}
            value={portalId}
            onChange={(id) => setValue("portal_id", id, { shouldValidate: true })}
            placeholder="Search portals…"
            emptyMessage="No portal matches"
          />
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
