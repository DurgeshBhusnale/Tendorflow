import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { ClientPicker } from "@/components/shared/ClientPicker";
import { DrawerBody, DrawerFooter } from "@/components/shared/Drawer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FieldError, Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { useClient } from "@/hooks/useClients";
import { useCreateEmd, useUpdateEmd } from "@/hooks/useEmds";
import { todayInIst } from "@/lib/format";
import { phoneSchema } from "@/lib/validation";
import { ApiError } from "@/types/api";
import { EMD_STATUSES, type Emd } from "@/types/emd";

const MONEY = /^\d+(\.\d{1,2})?$/;

const emdSchema = z.object({
  emd_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Select a date"),
  client_id: z.string().uuid("Select a client"),
  // Indian mobile only, normalized to ten digits before it is sent (CH-17).
  contact_number: phoneSchema,
  amount: z
    .string()
    .min(1, "Required")
    .refine((v) => MONEY.test(v), "At most 2 decimal places")
    .refine((v) => Number(v) >= 0, "Must be 0 or more"),
  status: z.enum(["With Us", "Returned"]),
});
type EmdFormValues = z.infer<typeof emdSchema>;

interface EmdFormProps {
  /** When provided, the form edits this deposit instead of logging a new one. */
  emd?: Emd;
  onSuccess: () => void;
  onCancel: () => void;
}

export function EmdForm({ emd, onSuccess, onCancel }: EmdFormProps) {
  const [formError, setFormError] = useState<string | null>(null);
  const createEmd = useCreateEmd();
  const updateEmd = useUpdateEmd();

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<EmdFormValues>({
    resolver: zodResolver(emdSchema),
    defaultValues: emd
      ? {
          emd_date: emd.emd_date,
          client_id: emd.client.id,
          contact_number: emd.contact_number,
          amount: emd.amount,
          status: emd.status,
        }
      : { emd_date: todayInIst(), status: "With Us", contact_number: "", amount: "" },
  });

  const clientId = watch("client_id") ?? "";
  const { data: pickedClient } = useClient(clientId);

  // Picking a client fills in their saved number, which is right most of the
  // time and always editable — the person handing the deposit over is not
  // always the standing contact. Keyed on the client *changing*, so an existing
  // row's stored number survives being opened for editing.
  const lastFilledFor = useRef(emd?.client.id ?? "");
  useEffect(() => {
    if (!clientId || clientId === lastFilledFor.current) return;
    if (pickedClient?.id !== clientId) return;
    lastFilledFor.current = clientId;
    setValue("contact_number", pickedClient.contact_number, { shouldValidate: true });
  }, [clientId, pickedClient, setValue]);

  const onSubmit = handleSubmit(async (values) => {
    setFormError(null);
    try {
      if (emd) {
        await updateEmd.mutateAsync({ id: emd.id, payload: values });
      } else {
        await createEmd.mutateAsync(values);
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
          <Label htmlFor="emd_date">Date</Label>
          <Input id="emd_date" type="date" {...register("emd_date")} />
          <FieldError>{errors.emd_date?.message}</FieldError>
        </div>

        <ClientPicker
          idPrefix="emd"
          value={clientId}
          onChange={(id) => setValue("client_id", id, { shouldValidate: true })}
          selected={emd?.client}
          error={errors.client_id?.message}
        />

        <div className="space-y-1.5">
          <Label htmlFor="emd_contact_number">Contact Number</Label>
          <Input
            id="emd_contact_number"
            type="tel"
            inputMode="numeric"
            placeholder="9876543210"
            {...register("contact_number")}
          />
          <FieldError>{errors.contact_number?.message}</FieldError>
          <p className="text-xs text-muted-foreground">
            Filled from the client, and editable — use whoever actually handed the deposit over.
          </p>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="emd_amount">Amount</Label>
          <Input
            id="emd_amount"
            type="text"
            inputMode="decimal"
            placeholder="5000.00"
            {...register("amount")}
          />
          <FieldError>{errors.amount?.message}</FieldError>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="emd_status">Status</Label>
          <Select id="emd_status" {...register("status")}>
            {EMD_STATUSES.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </Select>
          <p className="text-xs text-muted-foreground">
            With Us means the deposit is still held; switch to Returned once it goes back.
          </p>
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
          {isSubmitting ? "Saving…" : emd ? "Save Changes" : "Log EMD"}
        </Button>
      </DrawerFooter>
    </form>
  );
}
