import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useClients } from "@/hooks/useClients";
import { useCreateDscKey, useUpdateDscKey } from "@/hooks/useDsc";
import { ApiError } from "@/types/api";
import { DSC_KEY_STATUSES, type DscKey } from "@/types/dsc";

const dscKeySchema = z.object({
  client_id: z.string().uuid("Select a client"),
  key_status: z.enum(["Key Created", "Key Issued", "Key Returned", "Key Lost"]),
  storage_location_notes: z.string().max(500).optional(),
});
type DscKeyFormValues = z.infer<typeof dscKeySchema>;

interface DscFormProps {
  dscKey?: DscKey;
  onSuccess: () => void;
  onCancel: () => void;
}

export function DscForm({ dscKey, onSuccess, onCancel }: DscFormProps) {
  const [formError, setFormError] = useState<string | null>(null);
  const { data: clientsPage } = useClients({ page: 1, page_size: 100 });
  const createDscKey = useCreateDscKey();
  const updateDscKey = useUpdateDscKey();

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<DscKeyFormValues>({
    resolver: zodResolver(dscKeySchema),
    defaultValues: dscKey
      ? {
          client_id: dscKey.client.id,
          key_status: dscKey.key_status,
          storage_location_notes: dscKey.storage_location_notes ?? "",
        }
      : { key_status: "Key Created" },
  });

  const onSubmit = handleSubmit(async (values) => {
    setFormError(null);
    const payload = {
      ...values,
      storage_location_notes: values.storage_location_notes?.trim() || null,
    };
    try {
      if (dscKey) {
        await updateDscKey.mutateAsync({ id: dscKey.id, payload });
      } else {
        await createDscKey.mutateAsync(payload);
      }
      onSuccess();
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : "Something went wrong.");
    }
  });

  return (
    <form onSubmit={onSubmit} className="max-w-md space-y-3 rounded-lg border p-4">
      <h2 className="font-medium">{dscKey ? "Edit DSC Key" : "Log DSC Key"}</h2>

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
        <label className="text-sm font-medium">Key Status</label>
        <select
          className="w-full rounded-md border px-3 py-2 text-sm"
          {...register("key_status")}
        >
          {DSC_KEY_STATUSES.map((status) => (
            <option key={status} value={status}>
              {status}
            </option>
          ))}
        </select>
      </div>

      <div className="space-y-1">
        <label className="text-sm font-medium">Storage Location Notes</label>
        <Input placeholder="Drawer 3 / Box B" {...register("storage_location_notes")} />
        {errors.storage_location_notes && (
          <p className="text-sm text-red-600">{errors.storage_location_notes.message}</p>
        )}
      </div>

      {formError && <p className="text-sm text-red-600">{formError}</p>}
      <div className="flex gap-2">
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? "Saving…" : dscKey ? "Save Changes" : "Log Key"}
        </Button>
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </form>
  );
}
