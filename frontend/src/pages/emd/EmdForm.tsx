import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { DrawerBody, DrawerFooter } from "@/components/shared/Drawer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FieldError, Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useCreateEmd, useUpdateEmd } from "@/hooks/useEmds";
import { todayInIst } from "@/lib/format";
import { phoneSchema } from "@/lib/validation";
import { ApiError } from "@/types/api";
import { EMD_STATUSES, type Emd } from "@/types/emd";

const MONEY = /^\d+(\.\d{1,2})?$/;

const emdSchema = z.object({
  emd_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Select a date"),
  // Typed in rather than picked from the client list (CH-33): a deposit often
  // arrives with someone not yet on file, and stopping to onboard them first
  // is not how the front desk works.
  client_name: z.string().trim().min(1, "Required").max(120),
  company_name: z.string().trim().min(1, "Required").max(200),
  // Indian mobile only, normalized to ten digits before it is sent (CH-17).
  contact_number: phoneSchema,
  amount: z
    .string()
    .min(1, "Required")
    .refine((v) => MONEY.test(v), "At most 2 decimal places")
    .refine((v) => Number(v) >= 0, "Must be 0 or more"),
  status: z.enum(["With Us", "Returned"]),
  // Free text and optional: the detail arrives in whatever shape the bank gave
  // it, and it is often not known at the moment the deposit is taken.
  paid_to_bank_account: z.string().trim(),
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
    formState: { errors, isSubmitting },
  } = useForm<EmdFormValues>({
    resolver: zodResolver(emdSchema),
    defaultValues: emd
      ? {
          emd_date: emd.emd_date,
          client_name: emd.client_name,
          company_name: emd.company_name,
          contact_number: emd.contact_number,
          amount: emd.amount,
          status: emd.status,
          paid_to_bank_account: emd.paid_to_bank_account ?? "",
        }
      : {
          // Today in IST, matching the server's own default.
          emd_date: todayInIst(),
          status: "With Us",
          client_name: "",
          company_name: "",
          contact_number: "",
          amount: "",
          paid_to_bank_account: "",
        },
  });

  const onSubmit = handleSubmit(async (values) => {
    setFormError(null);
    // Blank stays blank rather than becoming an empty string on the row.
    const payload = {
      ...values,
      paid_to_bank_account: values.paid_to_bank_account || null,
    };
    try {
      if (emd) {
        await updateEmd.mutateAsync({ id: emd.id, payload });
      } else {
        await createEmd.mutateAsync(payload);
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

        <div className="space-y-1.5">
          <Label htmlFor="emd_client_name">Client Name</Label>
          <Input
            id="emd_client_name"
            placeholder="Who the deposit is for"
            {...register("client_name")}
          />
          <FieldError>{errors.client_name?.message}</FieldError>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="emd_company_name">Company Name</Label>
          <Input id="emd_company_name" placeholder="Their firm" {...register("company_name")} />
          <FieldError>{errors.company_name?.message}</FieldError>
          <p className="text-xs text-muted-foreground">
            Typed in, not picked from the client list — a deposit can be logged for someone not
            onboarded yet.
          </p>
        </div>

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
          <Label htmlFor="emd_paid_to_bank_account">Paid To — Bank Account Details</Label>
          <Textarea
            id="emd_paid_to_bank_account"
            rows={4}
            placeholder={"Bank and branch\nA/C number\nIFSC / UPI"}
            {...register("paid_to_bank_account")}
          />
          <FieldError>{errors.paid_to_bank_account?.message}</FieldError>
          <p className="text-xs text-muted-foreground">
            Optional — which account the deposit was actually paid into.
          </p>
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
          <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-destructive">
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
