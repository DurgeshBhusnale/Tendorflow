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
import { Select } from "@/components/ui/select";
import { useCreateTender, useUpdateTender } from "@/hooks/useTenders";
import { useTenderDepartments } from "@/hooks/useTenderDepartments";
import { formatCurrency } from "@/lib/format";
import { ApiError } from "@/types/api";
import { PAYMENT_MODES, TENDER_STATUSES, type Tender } from "@/types/tender";

const MONEY = /^\d+(\.\d{1,2})?$/;

const tenderSchema = z
  .object({
    client_id: z.string().uuid("Select a client"),
    tender_department_id: z.string().uuid("Select a tender department"),
    quantity: z.coerce.number().int("Whole numbers only").positive("Must be greater than 0"),
    price: z
      .string()
      .min(1, "Required")
      .refine((v) => MONEY.test(v), "At most 2 decimal places")
      .refine((v) => Number(v) >= 0, "Must be 0 or more"),
    status: z.enum(["Pending", "Partially Paid", "Paid"]),
    paid_amount: z.string().optional(),
    payment_mode: z.enum(["Cash", "Online"]).optional(),
  })
  // The payment rules live here as well as in the API's Pydantic layer and a
  // Postgres CHECK. Same rule, three places, on purpose: this one is only for
  // telling the user which box to fill in.
  .superRefine((values, ctx) => {
    if (values.status === "Pending") return;

    if (!values.payment_mode) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["payment_mode"],
        message: "Select how this tender was paid",
      });
    }

    if (values.status !== "Partially Paid") return;

    const total = Number(values.quantity) * Number(values.price);
    if (!values.paid_amount) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["paid_amount"],
        message: "Enter how much has been paid so far",
      });
      return;
    }
    if (!MONEY.test(values.paid_amount)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["paid_amount"],
        message: "At most 2 decimal places",
      });
      return;
    }
    const paid = Number(values.paid_amount);
    if (paid <= 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["paid_amount"],
        message: "A partial payment must be more than zero",
      });
    } else if (Number.isFinite(total) && paid >= total) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["paid_amount"],
        message: "Less than the total — mark the tender as Paid instead",
      });
    }
  });
type TenderFormValues = z.infer<typeof tenderSchema>;

interface TenderFormProps {
  tender?: Tender;
  onSuccess: () => void;
  onCancel: () => void;
}

export function TenderForm({ tender, onSuccess, onCancel }: TenderFormProps) {
  const [formError, setFormError] = useState<string | null>(null);
  const { data: departments } = useTenderDepartments({ active_only: true });
  const createTender = useCreateTender();
  const updateTender = useUpdateTender();

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<TenderFormValues>({
    resolver: zodResolver(tenderSchema),
    defaultValues: tender
      ? {
          client_id: tender.client.id,
          tender_department_id: tender.tender_department.id,
          quantity: tender.quantity,
          price: tender.price,
          status: tender.status,
          paid_amount: tender.status === "Partially Paid" ? tender.paid_amount : "",
          payment_mode: tender.payment_mode ?? undefined,
        }
      : { status: "Pending" },
  });

  const clientId = watch("client_id") ?? "";
  const departmentId = watch("tender_department_id") ?? "";
  const status = watch("status");
  const quantity = Number(watch("quantity"));
  const price = Number(watch("price"));
  const paidAmount = Number(watch("paid_amount"));

  // Display-only mirrors of the two Postgres generated columns, so the user
  // sees both figures while typing. Neither is submitted.
  const previewTotal = Number.isFinite(quantity) && Number.isFinite(price) ? quantity * price : 0;
  const previewPaid =
    status === "Paid" ? previewTotal : status === "Partially Paid" && paidAmount > 0 ? paidAmount : 0;
  const previewRemaining = Math.max(previewTotal - previewPaid, 0);

  const isPaidStatus = status !== "Pending";

  const onSubmit = handleSubmit(async (values) => {
    setFormError(null);
    const payload = {
      client_id: values.client_id,
      tender_department_id: values.tender_department_id,
      quantity: values.quantity,
      price: values.price,
      status: values.status,
      // Cleared rather than omitted, so switching a tender back to Pending
      // actually wipes the stored payment record instead of leaving it behind.
      paid_amount: values.status === "Partially Paid" ? (values.paid_amount ?? null) : null,
      payment_mode: values.status === "Pending" ? null : (values.payment_mode ?? null),
    };
    try {
      if (tender) {
        await updateTender.mutateAsync({ id: tender.id, payload });
      } else {
        await createTender.mutateAsync(payload);
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
          idPrefix="tender"
          value={clientId}
          onChange={(id) => setValue("client_id", id, { shouldValidate: true })}
          selected={tender?.client}
          error={errors.client_id?.message}
        />

        <div className="space-y-1.5">
          <Label htmlFor="tender_department_id">Tender Department</Label>
          <Combobox
            id="tender_department_id"
            options={(departments ?? []).map((d) => ({ value: d.id, label: d.name }))}
            value={departmentId}
            onChange={(id) => setValue("tender_department_id", id, { shouldValidate: true })}
            placeholder="Search departments…"
            emptyMessage="No department matches"
          />
          <FieldError>{errors.tender_department_id?.message}</FieldError>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label htmlFor="tender_quantity">Quantity</Label>
            <Input id="tender_quantity" type="number" min={1} step={1} {...register("quantity")} />
            <FieldError>{errors.quantity?.message}</FieldError>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="tender_price">Price</Label>
            <Input
              id="tender_price"
              type="text"
              inputMode="decimal"
              placeholder="2500.00"
              {...register("price")}
            />
            <FieldError>{errors.price?.message}</FieldError>
          </div>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="tender_status">Status</Label>
          <Select id="tender_status" {...register("status")}>
            {TENDER_STATUSES.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </Select>
        </div>

        {/* Both fields appear only once money has changed hands (CH-05, CH-06).
            The amount is asked for on a partial payment alone — "Paid" means
            the whole total, so there is nothing to type. */}
        {status === "Partially Paid" && (
          <div className="space-y-1.5">
            <Label htmlFor="tender_paid_amount">Amount Paid So Far</Label>
            <Input
              id="tender_paid_amount"
              type="text"
              inputMode="decimal"
              placeholder="1000.00"
              {...register("paid_amount")}
            />
            <FieldError>{errors.paid_amount?.message}</FieldError>
          </div>
        )}

        {isPaidStatus && (
          <div className="space-y-1.5">
            <Label htmlFor="tender_payment_mode">Payment Mode</Label>
            <Select id="tender_payment_mode" {...register("payment_mode")}>
              <option value="">Select cash or online…</option>
              {PAYMENT_MODES.map((mode) => (
                <option key={mode} value={mode}>
                  {mode}
                </option>
              ))}
            </Select>
            <FieldError>{errors.payment_mode?.message}</FieldError>
          </div>
        )}

        {/* Calculated fields — visibly inert, never submitted. */}
        <div className="space-y-3 border border-border bg-muted p-4">
          <div>
            <p className="eyebrow">Total Amount</p>
            <p className="text-2xl font-semibold tabular-nums text-foreground">
              {formatCurrency(previewTotal)}
            </p>
          </div>
          {isPaidStatus && (
            <div className="grid grid-cols-2 gap-4 border-t border-border pt-3">
              <div>
                <p className="eyebrow">Paid</p>
                <p className="text-sm font-semibold tabular-nums text-foreground">
                  {formatCurrency(previewPaid)}
                </p>
              </div>
              <div>
                <p className="eyebrow">Remaining</p>
                <p className="text-sm font-semibold tabular-nums text-foreground">
                  {formatCurrency(previewRemaining)}
                </p>
              </div>
            </div>
          )}
          <p className="text-xs text-muted-foreground">
            Calculated automatically — the server is the source of truth.
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
          {isSubmitting ? "Saving…" : tender ? "Save Changes" : "Log Tender"}
        </Button>
      </DrawerFooter>
    </form>
  );
}
