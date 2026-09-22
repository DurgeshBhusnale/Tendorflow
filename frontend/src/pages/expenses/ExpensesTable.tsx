import { Wallet } from "lucide-react";
import { DataTable, type Column } from "@/components/shared/DataTable";
import { EmptyState } from "@/components/shared/EmptyState";
import { RowActions } from "@/components/shared/RowActions";
import { StatusPill, type PillTone } from "@/components/shared/StatusPill";
import { formatCurrency, formatDay } from "@/lib/format";
import type { Expense, ExpenseStatus } from "@/types/expense";

const STATUS_TONES: Record<ExpenseStatus, PillTone> = {
  Paid: "green",
  Pending: "amber",
};

// Same treatment as the tenders table (CH-23): what is still owed reads from
// across the row, not from one pill.
const STATUS_ROW_SHADES: Record<ExpenseStatus, string> = {
  Pending: "bg-red-50/70 hover:bg-red-50",
  Paid: "bg-emerald-50/70 hover:bg-emerald-50",
};

interface ExpensesTableProps {
  expenses: Expense[];
  isLoading: boolean;
  onEdit: (expense: Expense) => void;
  onDelete: (expense: Expense) => void;
  emptyAction?: React.ReactNode;
}

export function ExpensesTable({
  expenses,
  isLoading,
  onEdit,
  onDelete,
  emptyAction,
}: ExpensesTableProps) {
  // No role check on the actions: the whole module is admin-only, so anyone
  // who can see this table can edit and delete in it (CH-27).
  const columns: Column<Expense>[] = [
    {
      header: "Date",
      cell: (e) => <span className="text-muted-foreground">{formatDay(e.expense_date)}</span>,
    },
    {
      header: "Details",
      mobile: "title",
      // The one column worth reading in full, so it wraps instead of being
      // clipped like the rest of the table's cells.
      cell: (e) => (
        <span className="block max-w-md whitespace-normal font-medium text-foreground">
          {e.details}
        </span>
      ),
    },
    {
      header: "Amount",
      align: "right",
      cell: (e) => <span className="font-semibold">{formatCurrency(e.amount)}</span>,
    },
    {
      header: "Status",
      cell: (e) => <StatusPill label={e.status} tone={STATUS_TONES[e.status] ?? "slate"} />,
    },
    {
      header: "Added/Updated By",
      cell: (e) => <span className="text-muted-foreground">{e.created_by?.full_name ?? "—"}</span>,
    },
    {
      header: "Actions",
      align: "right",
      mobile: "actions",
      cell: (e) => <RowActions onEdit={() => onEdit(e)} onDelete={() => onDelete(e)} />,
    },
  ];

  return (
    <DataTable
      columns={columns}
      rows={expenses}
      rowKey={(e) => e.id}
      isLoading={isLoading}
      rowClassName={(e) => STATUS_ROW_SHADES[e.status]}
      empty={
        <EmptyState
          icon={Wallet}
          title="No expenses yet"
          description="Log what the business spends to track it against the tender income."
          action={emptyAction}
        />
      }
    />
  );
}
