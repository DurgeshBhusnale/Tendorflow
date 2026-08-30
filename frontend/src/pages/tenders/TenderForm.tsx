import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useClients } from "@/hooks/useClients";
import { useCreateTender, useUpdateTender } from "@/hooks/useTenders";
import { useTenderNames } from "@/hooks/useTenderNames";
import { formatCurrency } from "@/lib/format";
import { ApiError } from "@/types/api";
import type { Tender } from "@/types/tender";

const tenderSchema = z.object({
  client_id: z.string().uuid("Select a client"),
  tender_name_id: z.string().uuid("Select a tender name"),
  quantity: z.coerce.number().int("Whole numbers only").positive("Must be greater than 0"),
  price: z
    .string()
    .min(1, "Required")
    .refine((v) => !Number.isNaN(Number(v)) && Number(v) >= 0, "Must be 0 or more")
    .refine((v) => /^\d+(\.\d{1,2})?$/.test(v), "At most 2 decimal places"),
  status: z.enum(["Paid", "Pending"]),
});
type TenderFormValues = z.infer<typeof tenderSchema>;

interface TenderFormProps {
  tender?: Tender;
  onSuccess: () => void;
  onCancel: () => void;
}

export function TenderForm({ tender, onSuccess, onCancel }: TenderFormProps) {
  const [formError, setFormError] = useState<string | null>(null);
  const { data: clientsPage } = useClients({ page: 1, page_size: 100 });
  const { data: tenderNames } = useTenderNames({ active_only: true });
  const createTender = useCreateTender();
  const updateTender = useUpdateTender();

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<TenderFormValues>({
    resolver: zodResolver(tenderSchema),
    defaultValues: tender
      ? {
          client_id: tender.client.id,
          tender_name_id: tender.tender_name.id,
          quantity: tender.quantity,
          price: tender.price,
          status: tender.status,
        }
      : { status: "Pending" },
  });

  // Display-only mirror of the Postgres generated column, so the user sees the
  // total while typing. Never submitted — the server computes the real value.
  const quantity = Number(watch("quantity"));
  const price = Number(watch("price"));
  const previewTotal =
    Number.isFinite(quantity) && Number.isFinite(price) ? quantity * price : 0;

  const onSubmit = handleSubmit(async (values) => {
    setFormError(null);
    try {
      if (tender) {
        await updateTender.mutateAsync({ id: tender.id, payload: values });
      } else {
        await createTender.mutateAsync(values);
      }
      onSuccess();
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : "Something went wrong.");
    }
  });

  return (
    <form onSubmit={onSubmit} className="max-w-md space-y-3 rounded-lg border p-4">
      <h2 className="font-medium">{tender ? "Edit Tender" : "Log Tender"}</h2>

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
        <label className="text-sm font-medium">Tender Name</label>
        <select
          className="w-full rounded-md border px-3 py-2 text-sm"
          {...register("tender_name_id")}
        >
          <option value="">Select a tender name…</option>
          {tenderNames?.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
        </select>
        {errors.tender_name_id && (
          <p className="text-sm text-red-600">{errors.tender_name_id.message}</p>
        )}
      </div>

      <div className="space-y-1">
        <label className="text-sm font-medium">Quantity</label>
        <Input type="number" min={1} step={1} {...register("quantity")} />
        {errors.quantity && <p className="text-sm text-red-600">{errors.quantity.message}</p>}
      </div>

      <div className="space-y-1">
        <label className="text-sm font-medium">Price</label>
        <Input type="text" inputMode="decimal" placeholder="2500.00" {...register("price")} />
        {errors.price && <p className="text-sm text-red-600">{errors.price.message}</p>}
      </div>

      <div className="space-y-1">
        <label className="text-sm font-medium">Total Amount</label>
        <Input readOnly disabled value={formatCurrency(previewTotal)} />
        <p className="text-xs text-muted-foreground">
          Calculated automatically — the server is the source of truth.
        </p>
      </div>

      <div className="space-y-1">
        <label className="text-sm font-medium">Status</label>
        <select className="w-full rounded-md border px-3 py-2 text-sm" {...register("status")}>
          <option value="Pending">Pending</option>
          <option value="Paid">Paid</option>
        </select>
      </div>

      {formError && <p className="text-sm text-red-600">{formError}</p>}
      <div className="flex gap-2">
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? "Saving…" : tender ? "Save Changes" : "Log Tender"}
        </Button>
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </form>
  );
}
