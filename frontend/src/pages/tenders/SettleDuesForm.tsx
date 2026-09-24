import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { DrawerBody, DrawerFooter } from "@/components/shared/Drawer";
import { StatusPill } from "@/components/shared/StatusPill";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FieldError, Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { useSettleClientDues } from "@/hooks/useTenders";
import { formatCurrency, formatDay } from "@/lib/format";
import { ApiError } from "@/types/api";
import { PAYMENT_MODES, type TenderSettlementResult } from "@/types/tender";

const MONEY = /^\d+(\.\d{1,2})?$/;

const settleSchema = z.object({
  amount: z
    .string()
    .min(1, "Required")
    .refine((v) => MONEY.test(v), "At most 2 decimal places")
    .refine((v) => Number(v) > 0, "Must be more than 0"),
  payment_mode: z.enum(["Cash", "Online"]),
});
type SettleFormValues = z.infer<typeof settleSchema>;

interface SettleDuesFormProps {
  clientId: string;
  clientName: string;
  outstanding: string;
  onSuccess: () => void;
  onCancel: () => void;
}

/**
 * Records a lump sum against one client's dues (CH-35).
 *
 * Two steps on purpose. The first asks the server what the money would do and
 * shows it tender by tender; the second carries it out. Both call the same
 * endpoint, so the plan on screen cannot disagree with what is written — and
 * an allocation that silently rewrites several financial rows should be seen
 * before it happens, not after.
 */
export function SettleDuesForm({
  clientId,
  clientName,
  outstanding,
  onSuccess,
  onCancel,
}: SettleDuesFormProps) {
  const [formError, setFormError] = useState<string | null>(null);
  const [plan, setPlan] = useState<TenderSettlementResult | null>(null);
  const settle = useSettleClientDues();

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<SettleFormValues>({
    resolver: zodResolver(settleSchema),
    defaultValues: { amount: "", payment_mode: "Cash" },
  });

  // Any edit invalidates the plan on screen, so the button always reads as
  // "show me what this does" until the figures match again.
  const amount = watch("amount");
  const paymentMode = watch("payment_mode");
  const planMatchesForm =
    plan !== null && plan.amount_applied === Number(amount || 0).toFixed(2);

  const onSubmit = handleSubmit(async (values) => {
    setFormError(null);
    try {
      const result = await settle.mutateAsync({
        client_id: clientId,
        amount: values.amount,
        payment_mode: values.payment_mode,
        preview: !planMatchesForm,
      });
      if (result.preview) {
        setPlan(result);
      } else {
        onSuccess();
      }
    } catch (err) {
      setPlan(null);
      setFormError(err instanceof ApiError ? err.message : "Something went wrong.");
    }
  });

  return (
    <form onSubmit={onSubmit} className="flex h-full flex-col">
      <DrawerBody>
        <div className="rounded-xl border border-border bg-muted px-4 py-3">
          <p className="eyebrow">Outstanding</p>
          <p className="mt-0.5 text-2xl font-bold tabular-nums text-foreground">
            {formatCurrency(outstanding)}
          </p>
          <p className="mt-1 text-[13px] text-muted-foreground">owed by {clientName}</p>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="settle_amount">Amount Paid</Label>
          <Input
            id="settle_amount"
            type="text"
            inputMode="decimal"
            placeholder="5000.00"
            {...register("amount")}
          />
          <FieldError>{errors.amount?.message}</FieldError>
          <p className="text-xs text-muted-foreground">
            Applied to the oldest unpaid tender first, then the next, until it runs out. It cannot
            be more than the outstanding balance.
          </p>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="settle_payment_mode">Payment Mode</Label>
          <Select id="settle_payment_mode" {...register("payment_mode")}>
            {PAYMENT_MODES.map((mode) => (
              <option key={mode} value={mode}>
                {mode}
              </option>
            ))}
          </Select>
        </div>

        {plan && planMatchesForm && (
          <div className="space-y-3 rounded-xl border border-border p-4">
            <p className="eyebrow">What this will do</p>
            <ul className="space-y-2.5">
              {plan.allocations.map((allocation) => (
                <li
                  key={allocation.tender_id}
                  className="flex flex-wrap items-center justify-between gap-2 border-b border-divider pb-2.5 last:border-b-0 last:pb-0"
                >
                  <span className="min-w-0">
                    <span className="block text-sm font-medium text-foreground">
                      {formatCurrency(allocation.applied)} to{" "}
                      {formatDay(allocation.tender_date)} · {allocation.tender_department}
                    </span>
                    <span className="block text-[13px] text-muted-foreground">
                      {formatCurrency(allocation.new_paid_amount)} of{" "}
                      {formatCurrency(allocation.total_amount)} paid
                    </span>
                  </span>
                  <StatusPill
                    label={allocation.new_status}
                    tone={allocation.new_status === "Paid" ? "green" : "blue"}
                  />
                </li>
              ))}
            </ul>
            <p className="text-[13px] text-muted-foreground">
              {formatCurrency(plan.outstanding_after)} will still be outstanding
              {plan.allocations.length === 1
                ? " after this tender."
                : ` across the remaining tenders.`}
            </p>
          </div>
        )}

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
        <Button type="submit" disabled={isSubmitting || !paymentMode}>
          {isSubmitting
            ? "Working…"
            : planMatchesForm
              ? `Apply ${formatCurrency(plan?.amount_applied ?? "0")}`
              : "Preview allocation"}
        </Button>
      </DrawerFooter>
    </form>
  );
}
