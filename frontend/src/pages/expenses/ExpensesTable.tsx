import { Wallet } from "lucide-react";
import { Avatar } from "@/components/shared/Avatar";
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
  Pending: "md:bg-red-100/70 md:hover:bg-red-100",
  Paid: "md:bg-emerald-100/70 md:hover:bg-emerald-100",
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
        <span className="block max-w-md">
          <span className="block whitespace-normal font-medium text-foreground">{e.details}</span>
          <span className="mt-0.5 block text-[13px] text-muted-foreground md:hidden">
            {formatDay(e.expense_date)}
          </span>
        </span>
      ),
    },
    {
      header: "Amount",
      align: "right",
      mobile: "amount",
      cell: (e) => <span className="font-semibold">{formatCurrency(e.amount)}</span>,
    },
    {
      header: "Status",
      mobile: "status",
      cell: (e) => <StatusPill label={e.status} tone={STATUS_TONES[e.status] ?? "slate"} />,
    },
    {
      header: "Added/Updated By",
      cell: (e) =>
        e.created_by ? (
          <span className="flex items-center gap-2">
            <Avatar name={e.created_by.full_name} size="sm" />
            <span className="truncate text-muted-foreground">{e.created_by.full_name}</span>
          </span>
        ) : (
          <span className="text-muted-foreground">—</span>
        ),
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
