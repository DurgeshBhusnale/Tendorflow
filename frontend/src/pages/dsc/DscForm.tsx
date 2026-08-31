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
    <form onSubmit={onSubmit} className="flex h-full flex-col">
      <DrawerBody>
        <div className="space-y-1.5">
          <Label htmlFor="dsc_client_id">Client</Label>
          <Select id="dsc_client_id" {...register("client_id")}>
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
          <Label htmlFor="dsc_key_status">Key Status</Label>
          <Select id="dsc_key_status" {...register("key_status")}>
            {DSC_KEY_STATUSES.map((status) => (
              <option key={status} value={status}>
                {status}
              </option>
            ))}
          </Select>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="storage_location_notes">Storage Location Notes</Label>
          <Input
            id="storage_location_notes"
            placeholder="Drawer 3 / Box B"
            {...register("storage_location_notes")}
          />
          <FieldError>{errors.storage_location_notes?.message}</FieldError>
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
          {isSubmitting ? "Saving…" : dscKey ? "Save Changes" : "Log Key"}
        </Button>
      </DrawerFooter>
    </form>
  );
}
