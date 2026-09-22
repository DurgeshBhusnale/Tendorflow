export type ExpenseStatus = "Paid" | "Pending";

export const EXPENSE_STATUSES: ExpenseStatus[] = ["Pending", "Paid"];

export interface Expense {
  id: string;
  /** Money is a string to preserve decimal precision — parse only for display. */
  amount: string;
  /** Free text, no length cap: what the money was spent on. */
  details: string;
  status: ExpenseStatus;
  /** The day the money was spent, as YYYY-MM-DD. Render with `formatDay`. */
  expense_date: string;
  /** Whoever last edited the row, not necessarily who first logged it. */
  created_by: { id: string; full_name: string } | null;
  created_at: string;
  updated_at: string;
}

export interface ExpenseCreate {
  amount: string;
  details: string;
  status?: ExpenseStatus;
  /** YYYY-MM-DD. The server defaults it to today in IST when omitted. */
  expense_date?: string;
}

export interface ExpenseUpdate {
  amount?: string;
  details?: string;
  status?: ExpenseStatus;
  expense_date?: string;
}

export interface ExpenseSummary {
  /** Every filtered expense; paid + pending always add up to this. */
  total_amount: string;
  paid_amount: string;
  pending_amount: string;
  total_count: number;
  paid_count: number;
  pending_count: number;
}
