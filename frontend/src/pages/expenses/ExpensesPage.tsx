import { CheckCircle2, Clock, Plus, Wallet } from "lucide-react";
import { useState } from "react";
import { Drawer } from "@/components/shared/Drawer";
import { MetricCard } from "@/components/shared/MetricCard";
import { PageHeader } from "@/components/shared/PageHeader";
import { Pagination } from "@/components/shared/Pagination";
import { SearchInput } from "@/components/shared/SearchInput";
import { SegmentedFilter } from "@/components/shared/SegmentedFilter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useConfirm } from "@/hooks/useConfirm";
import { useDeleteExpense, useExpenseSummary, useExpenses } from "@/hooks/useExpenses";
import { formatCurrency } from "@/lib/format";
import { ExpenseForm } from "@/pages/expenses/ExpenseForm";
import { ExpensesTable } from "@/pages/expenses/ExpensesTable";
import type { Expense, ExpenseStatus } from "@/types/expense";

const PAGE_SIZE = 25;
const STATUS_OPTIONS = ["All", "Pending", "Paid"] as const;
type StatusOption = (typeof STATUS_OPTIONS)[number];

export default function ExpensesPage() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusOption>("All");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [formState, setFormState] = useState<{ open: boolean; expense?: Expense }>({
    open: false,
  });

  // Shared by the table and the KPI strip so they always agree.
  const filters = {
    status: statusFilter === "All" ? undefined : (statusFilter as ExpenseStatus),
    search: search || undefined,
    start_date: startDate || undefined,
    end_date: endDate || undefined,
  };

  const { data, isLoading } = useExpenses({ ...filters, page, page_size: PAGE_SIZE });
  const { data: summary } = useExpenseSummary(filters);
  const deleteExpense = useDeleteExpense();
  const confirm = useConfirm();

  const totalCount = data?.total_count ?? 0;
  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));
  const hasDateRange = Boolean(startDate || endDate);

  function changeFilter(apply: () => void) {
    apply();
    setPage(1);
  }

  function clearFilters() {
    changeFilter(() => {
      setSearch("");
      setStatusFilter("All");
      setStartDate("");
      setEndDate("");
    });
  }

  function handleDelete(expense: Expense) {
    confirm({
      title: "Delete this expense?",
      description: `${formatCurrency(expense.amount)} — ${expense.details}. This cannot be undone.`,
      confirmLabel: "Delete Expense",
      tone: "destructive",
      onConfirm: () => deleteExpense.mutateAsync(expense.id),
    });
  }

  const addButton = (
    <Button onClick={() => setFormState({ open: true })}>
      <Plus />
      Log Expense
    </Button>
  );

  // Which cards to show follows the filter, as on the tenders page (CH-10):
  // filtering to one status makes the other bucket noise.
  const showPaid = statusFilter === "All" || statusFilter === "Paid";
  const showPending = statusFilter === "All" || statusFilter === "Pending";

  return (
    <div className="page">
      <PageHeader
        title="Expenses"
        description="What the business spends, logged against the day it was spent. Visible to admins only."
        actions={addButton}
      />

      {summary && (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          <MetricCard
            label="Total Expenses"
            value={formatCurrency(summary.total_amount)}
            icon={Wallet}
            tone="indigo"
            hint={`${summary.total_count} expense(s) in view`}
          />
          {showPaid && (
            <MetricCard
              label="Paid Amount"
              value={formatCurrency(summary.paid_amount)}
              icon={CheckCircle2}
              tone="green"
              hint={`${summary.paid_count} settled`}
            />
          )}
          {showPending && (
            <MetricCard
              label="Pending Amount"
              value={formatCurrency(summary.pending_amount)}
              icon={Clock}
              tone="amber"
              hint={`${summary.pending_count} still to pay`}
            />
          )}
        </div>
      )}

      <div className="surface">
        <div className="card-header">
          <SegmentedFilter
            label="Filter by status"
            options={STATUS_OPTIONS}
            value={statusFilter}
            onChange={(option) => changeFilter(() => setStatusFilter(option))}
          />
          <SearchInput
            value={search}
            onChange={(value) => changeFilter(() => setSearch(value))}
            placeholder="Search the details…"
            className="w-full sm:w-80"
          />
        </div>

        {/* Dates sit on their own row: two labelled fields do not fit beside
            the tabs at tablet width without wrapping mid-pair. */}
        <div className="flex flex-wrap items-end gap-3 px-4 pb-4 sm:px-5">
          <div className="space-y-1.5">
            <Label htmlFor="expense_start_date">From</Label>
            <Input
              id="expense_start_date"
              type="date"
              className="w-full sm:w-44"
              value={startDate}
              max={endDate || undefined}
              onChange={(e) => changeFilter(() => setStartDate(e.target.value))}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="expense_end_date">To</Label>
            <Input
              id="expense_end_date"
              type="date"
              className="w-full sm:w-44"
              value={endDate}
              min={startDate || undefined}
              onChange={(e) => changeFilter(() => setEndDate(e.target.value))}
            />
          </div>
          {hasDateRange && (
            <p className="pb-2.5 text-xs text-muted-foreground">Both ends are included.</p>
          )}
          <Button type="button" variant="outline" className="ml-auto" onClick={clearFilters}>
            Clear filters
          </Button>
        </div>

        <ExpensesTable
          expenses={data?.items ?? []}
          isLoading={isLoading}
          onEdit={(expense) => setFormState({ open: true, expense })}
          onDelete={handleDelete}
          emptyAction={addButton}
        />

        {totalCount > PAGE_SIZE && (
          <Pagination
            page={page}
            totalPages={totalPages}
            totalCount={totalCount}
            onPageChange={setPage}
          />
        )}
      </div>

      <Drawer
        open={formState.open}
        onClose={() => setFormState({ open: false })}
        title={formState.expense ? "Edit Expense" : "Log Expense"}
        description="Record what was spent, what it was for, and whether it has been paid."
      >
        <ExpenseForm
          expense={formState.expense}
          onSuccess={() => setFormState({ open: false })}
          onCancel={() => setFormState({ open: false })}
        />
      </Drawer>
    </div>
  );
}
