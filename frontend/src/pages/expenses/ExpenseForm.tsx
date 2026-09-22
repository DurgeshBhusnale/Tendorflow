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
import { useCreateExpense, useUpdateExpense } from "@/hooks/useExpenses";
import { todayInIst } from "@/lib/format";
import { ApiError } from "@/types/api";
import { EXPENSE_STATUSES, type Expense } from "@/types/expense";

const MONEY = /^\d+(\.\d{1,2})?$/;

const expenseSchema = z.object({
  // The day the money was spent, which need not be today (CH-27).
  expense_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Select a date"),
  amount: z
    .string()
    .min(1, "Required")
    .refine((v) => MONEY.test(v), "At most 2 decimal places")
    .refine((v) => Number(v) >= 0, "Must be 0 or more"),
  // Deliberately uncapped, matching the column: this is the record of where the
  // money went, and truncating it would lose the only thing that explains an
  // old row.
  details: z.string().trim().min(1, "Required"),
  status: z.enum(["Paid", "Pending"]),
});
type ExpenseFormValues = z.infer<typeof expenseSchema>;

interface ExpenseFormProps {
  /** When provided, the form edits this expense instead of logging a new one. */
  expense?: Expense;
  onSuccess: () => void;
  onCancel: () => void;
}

export function ExpenseForm({ expense, onSuccess, onCancel }: ExpenseFormProps) {
  const [formError, setFormError] = useState<string | null>(null);
  const createExpense = useCreateExpense();
  const updateExpense = useUpdateExpense();

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ExpenseFormValues>({
    resolver: zodResolver(expenseSchema),
    defaultValues: expense
      ? {
          expense_date: expense.expense_date,
          amount: expense.amount,
          details: expense.details,
          status: expense.status,
        }
      : // Today in IST, matching the server's own default.
        { expense_date: todayInIst(), amount: "", details: "", status: "Pending" },
  });

  const onSubmit = handleSubmit(async (values) => {
    setFormError(null);
    try {
      if (expense) {
        await updateExpense.mutateAsync({ id: expense.id, payload: values });
      } else {
        await createExpense.mutateAsync(values);
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
          <Label htmlFor="expense_date">Date</Label>
          <Input id="expense_date" type="date" {...register("expense_date")} />
          <FieldError>{errors.expense_date?.message}</FieldError>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="expense_amount">Amount</Label>
          <Input
            id="expense_amount"
            type="text"
            inputMode="decimal"
            placeholder="2500.00"
            {...register("amount")}
          />
          <FieldError>{errors.amount?.message}</FieldError>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="expense_details">Details</Label>
          <Textarea
            id="expense_details"
            rows={5}
            placeholder="What was this spent on?"
            {...register("details")}
          />
          <FieldError>{errors.details?.message}</FieldError>
          <p className="text-xs text-muted-foreground">
            Write as much as you need — there is no length limit.
          </p>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="expense_status">Status</Label>
          <Select id="expense_status" {...register("status")}>
            {EXPENSE_STATUSES.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </Select>
          <p className="text-xs text-muted-foreground">
            Pending means the money is committed but not yet paid out.
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
          {isSubmitting ? "Saving…" : expense ? "Save Changes" : "Log Expense"}
        </Button>
      </DrawerFooter>
    </form>
  );
}
