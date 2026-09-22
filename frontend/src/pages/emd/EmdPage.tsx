import { Plus } from "lucide-react";
import { useState } from "react";
import { Drawer } from "@/components/shared/Drawer";
import { MetricCard } from "@/components/shared/MetricCard";
import { PageHeader } from "@/components/shared/PageHeader";
import { Pagination } from "@/components/shared/Pagination";
import { SearchInput } from "@/components/shared/SearchInput";
import { Button } from "@/components/ui/button";
import { Combobox } from "@/components/ui/combobox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useClients } from "@/hooks/useClients";
import { useConfirm } from "@/hooks/useConfirm";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import { useDeleteEmd, useEmdSummary, useEmds } from "@/hooks/useEmds";
import { formatCurrency } from "@/lib/format";
import { cn } from "@/lib/utils";
import { EmdForm } from "@/pages/emd/EmdForm";
import { EmdTable } from "@/pages/emd/EmdTable";
import type { Emd, EmdStatus } from "@/types/emd";

const PAGE_SIZE = 25;
const STATUS_OPTIONS = ["All", "With Us", "Returned"] as const;
type StatusOption = (typeof STATUS_OPTIONS)[number];

export default function EmdPage() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [clientFilter, setClientFilter] = useState("");
  const [clientSearch, setClientSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusOption>("All");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [formState, setFormState] = useState<{ open: boolean; emd?: Emd }>({ open: false });

  // Shared by the table and the KPI strip so they always agree.
  const filters = {
    client_id: clientFilter || undefined,
    status: statusFilter === "All" ? undefined : (statusFilter as EmdStatus),
    search: search || undefined,
    start_date: startDate || undefined,
    end_date: endDate || undefined,
  };

  const { data, isLoading } = useEmds({ ...filters, page, page_size: PAGE_SIZE });
  const { data: summary } = useEmdSummary(filters);
  const debouncedClientSearch = useDebouncedValue(clientSearch);
  const { data: clientsPage } = useClients({
    page: 1,
    page_size: 50,
    search: debouncedClientSearch || undefined,
  });
  const deleteEmd = useDeleteEmd();
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
      setClientFilter("");
      setStatusFilter("All");
      setStartDate("");
      setEndDate("");
    });
  }

  function handleDelete(emd: Emd) {
    confirm({
      title: "Delete this EMD?",
      description: `${formatCurrency(emd.amount)} logged against ${emd.client.company_name}. The record of the deposit goes with it. This cannot be undone.`,
      confirmLabel: "Delete EMD",
      tone: "destructive",
      onConfirm: () => deleteEmd.mutateAsync(emd.id),
    });
  }

  const addButton = (
    <Button onClick={() => setFormState({ open: true })}>
      <Plus />
      Log EMD
    </Button>
  );

  // Which cards show follows the filter, as on the other pages: filtering to
  // one status makes the other bucket noise.
  const showWithUs = statusFilter === "All" || statusFilter === "With Us";
  const showReturned = statusFilter === "All" || statusFilter === "Returned";

  return (
    <div className="page">
      <PageHeader
        title="EMD"
        description="Earnest money deposits taken from clients so a tender's deposit can be paid online. Each one is either still with us or returned."
        actions={addButton}
      />

      {summary && (
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
          {showWithUs && (
            <MetricCard
              label="Total With Us"
              value={formatCurrency(summary.total_with_us)}
              hint={`${summary.with_us_count} deposit(s) still held`}
            />
          )}
          {showReturned && (
            <MetricCard
              label="Total Returned"
              value={formatCurrency(summary.total_returned)}
              hint={`${summary.returned_count} deposit(s) given back`}
            />
          )}
        </div>
      )}

      <div className="surface">
        <div className="toolbar">
          <SearchInput
            value={search}
            onChange={(value) => changeFilter(() => setSearch(value))}
            placeholder="Search by client, company or number…"
            className="w-full sm:max-w-xs"
          />
          <Combobox
            aria-label="Filter by client"
            className="w-full sm:w-56"
            options={(clientsPage?.items ?? []).map((c) => ({
              value: c.id,
              label: c.contact_person_name,
              hint: c.company_name,
            }))}
            value={clientFilter}
            onChange={(value) => changeFilter(() => setClientFilter(value))}
            onSearchChange={setClientSearch}
            placeholder="All clients"
            emptyMessage="No client matches"
            clearable
          />

          <div className="flex border border-border" role="group" aria-label="Filter by status">
            {STATUS_OPTIONS.map((option) => (
              <button
                key={option}
                type="button"
                aria-pressed={statusFilter === option}
                onClick={() => changeFilter(() => setStatusFilter(option))}
                className={cn(
                  "h-10 whitespace-nowrap border-r border-border px-3 text-sm transition-colors last:border-r-0",
                  statusFilter === option
                    ? "bg-ink font-semibold text-white"
                    : "bg-card text-muted-foreground hover:bg-accent hover:text-foreground",
                )}
              >
                {option}
              </button>
            ))}
          </div>
        </div>

        {/* Dates sit on their own row: two labelled fields do not fit the
            toolbar at tablet width without wrapping mid-pair. */}
        <div className="flex flex-wrap items-end gap-3 border-b border-divider px-4 pb-4 sm:px-6">
          <div className="space-y-1.5">
            <Label htmlFor="emd_start_date">From</Label>
            <Input
              id="emd_start_date"
              type="date"
              className="w-full sm:w-44"
              value={startDate}
              max={endDate || undefined}
              onChange={(e) => changeFilter(() => setStartDate(e.target.value))}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="emd_end_date">To</Label>
            <Input
              id="emd_end_date"
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

        <EmdTable
          emds={data?.items ?? []}
          isLoading={isLoading}
          onEdit={(emd) => setFormState({ open: true, emd })}
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
        title={formState.emd ? "Edit EMD" : "Log EMD"}
        description="Record a deposit taken from a client, and mark it returned once it goes back."
      >
        <EmdForm
          emd={formState.emd}
          onSuccess={() => setFormState({ open: false })}
          onCancel={() => setFormState({ open: false })}
        />
      </Drawer>
    </div>
  );
}
