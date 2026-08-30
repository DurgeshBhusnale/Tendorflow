import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
    <form onSubmit={onSubmit} className="max-w-md space-y-3 rounded-lg border p-4">
      <h2 className="font-medium">{credential ? "Edit Credential" : "Add Credential"}</h2>

      <div className="space-y-1">
        <label className="text-sm font-medium">Client</label>
        <select className="w-full rounded-md border px-3 py-2 text-sm" {...register("client_id")}>
          <option value="">Select a client…</option>
          {clientsPage?.items.map((c) => (
            <option key={c.id} value={c.id}>
              {c.company_name}
            </option>
          ))}
        </select>
        {errors.client_id && <p className="text-sm text-red-600">{errors.client_id.message}</p>}
      </div>

      <div className="space-y-1">
        <label className="text-sm font-medium">Portal</label>
        <select className="w-full rounded-md border px-3 py-2 text-sm" {...register("portal_id")}>
          <option value="">Select a portal…</option>
          {portals?.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
        {errors.portal_id && <p className="text-sm text-red-600">{errors.portal_id.message}</p>}
      </div>

      <div className="space-y-1">
        <label className="text-sm font-medium">Username / Email / Phone (optional)</label>
        <Input {...register("login_identifier")} />
        {errors.login_identifier && (
          <p className="text-sm text-red-600">{errors.login_identifier.message}</p>
        )}
      </div>

      <div className="space-y-1">
        <label className="text-sm font-medium">Password</label>
        <Input type="password" autoComplete="new-password" {...register("password")} />
        {errors.password && <p className="text-sm text-red-600">{errors.password.message}</p>}
      </div>

      {formError && <p className="text-sm text-red-600">{formError}</p>}
      <div className="flex gap-2">
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? "Saving…" : credential ? "Save Changes" : "Add Credential"}
        </Button>
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </form>
  );
}
