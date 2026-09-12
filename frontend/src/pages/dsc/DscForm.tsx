import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { ClientPicker } from "@/components/shared/ClientPicker";
import { DrawerBody, DrawerFooter } from "@/components/shared/Drawer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FieldError, Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { useCreateDscKey, useUpdateDscKey } from "@/hooks/useDsc";
import { PHONE_MESSAGE, normalizePhone } from "@/lib/validation";
import { ApiError } from "@/types/api";
import { DSC_KEY_STATUSES, type DscKey, type DscKeyStatus } from "@/types/dsc";

const INDIAN_MOBILE = /^[6-9]\d{9}$/;

const dscKeySchema = z
  .object({
    client_id: z.string().uuid("Select a client"),
    key_status: z.enum(["Key Created", "Key Issued", "Key Returned"]),
    storage_location_notes: z.string().max(500).optional(),
    issued_to: z.string().max(120).optional(),
    issued_phone: z.string().max(20).optional(),
  })
  // Handing a key over without recording who took it is the exact failure this
  // module exists to prevent, so the details are mandatory on issue. On return
  // they are a nice-to-have and stay optional (CH-17).
  .superRefine((values, ctx) => {
    const phone = values.issued_phone ? normalizePhone(values.issued_phone) : "";

    if (values.key_status === "Key Issued") {
      if (!values.issued_to?.trim()) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["issued_to"],
          message: "Enter who this key is being issued to",
        });
      }
      if (!phone) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["issued_phone"],
          message: "Enter a contact number for the person receiving this key",
        });
        return;
      }
    }

    if (phone && !INDIAN_MOBILE.test(phone)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["issued_phone"],
        message: PHONE_MESSAGE,
      });
    }
  });
type DscKeyFormValues = z.infer<typeof dscKeySchema>;

interface DscFormProps {
  dscKey?: DscKey;
  onSuccess: () => void;
  onCancel: () => void;
}

export function DscForm({ dscKey, onSuccess, onCancel }: DscFormProps) {
  const [formError, setFormError] = useState<string | null>(null);
  const createDscKey = useCreateDscKey();
  const updateDscKey = useUpdateDscKey();

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<DscKeyFormValues>({
    resolver: zodResolver(dscKeySchema),
    defaultValues: dscKey
      ? {
          client_id: dscKey.client.id,
          // A legacy row may still hold the retired "Key Lost"; fall back so
          // the select has a value it can actually show.
          key_status: (DSC_KEY_STATUSES as string[]).includes(dscKey.key_status)
            ? (dscKey.key_status as DscKeyStatus)
            : "Key Created",
          storage_location_notes: dscKey.storage_location_notes ?? "",
        }
      : { key_status: "Key Created" },
  });

  const clientId = watch("client_id") ?? "";
  const keyStatus = watch("key_status");
  const capturesHolder = keyStatus === "Key Issued" || keyStatus === "Key Returned";

  // A key still sitting in the retired "Key Lost" state cannot stay there — the
  // status is not writable any more, so saving this form necessarily
  // re-classifies it. Say so, rather than letting the fallback above change the
  // record silently.
  const hasRetiredStatus =
    dscKey !== undefined && !(DSC_KEY_STATUSES as string[]).includes(dscKey.key_status);

  const onSubmit = handleSubmit(async (values) => {
    setFormError(null);
    const payload = {
      client_id: values.client_id,
      key_status: values.key_status,
      storage_location_notes: values.storage_location_notes?.trim() || null,
      // Only sent alongside a lifecycle change — these describe the event, not
      // the key, and the server files them into the key's history.
      issued_to: capturesHolder ? values.issued_to?.trim() || null : null,
      issued_phone: capturesHolder && values.issued_phone ? values.issued_phone.trim() : null,
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
        <ClientPicker
          idPrefix="dsc"
          value={clientId}
          onChange={(id) => setValue("client_id", id, { shouldValidate: true })}
          selected={dscKey?.client}
          error={errors.client_id?.message}
        />

        <div className="space-y-1.5">
          <Label htmlFor="dsc_key_status">Key Status</Label>
          <Select id="dsc_key_status" {...register("key_status")}>
            {DSC_KEY_STATUSES.map((status) => (
              <option key={status} value={status}>
                {status}
              </option>
            ))}
          </Select>
          {hasRetiredStatus && (
            <p className="border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700">
              This key is recorded as <strong>{dscKey?.key_status}</strong>, a status that is no
              longer in use. Saving will re-classify it as the status selected above — pick the
              one that reflects where the key actually is.
            </p>
          )}
        </div>

        {capturesHolder && (
          <div className="space-y-4 border border-border bg-muted p-4">
            <p className="eyebrow">
              {keyStatus === "Key Issued" ? "Issued To" : "Returned By (optional)"}
            </p>
            <div className="space-y-1.5">
              <Label htmlFor="dsc_issued_to">Name</Label>
              <Input id="dsc_issued_to" placeholder="Rohan Mehta" {...register("issued_to")} />
              <FieldError>{errors.issued_to?.message}</FieldError>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="dsc_issued_phone">Phone Number</Label>
              <Input
                id="dsc_issued_phone"
                type="tel"
                inputMode="numeric"
                placeholder="9876543210"
                {...register("issued_phone")}
              />
              <FieldError>{errors.issued_phone?.message}</FieldError>
            </div>
            <p className="text-xs text-muted-foreground">
              Recorded in this key&rsquo;s history along with your name and the time.
            </p>
          </div>
        )}

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
