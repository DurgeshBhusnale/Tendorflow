import { Clock, IndianRupee, PieChart, Plus, Trash2, Wallet } from "lucide-react";
import { useState } from "react";
import { useAuth } from "@/auth/AuthContext";
import { Drawer } from "@/components/shared/Drawer";
import { MetricCard } from "@/components/shared/MetricCard";
import { PageHeader } from "@/components/shared/PageHeader";
import { Pagination } from "@/components/shared/Pagination";
import { FilterSheet } from "@/components/shared/FilterSheet";
import { SearchInput } from "@/components/shared/SearchInput";
import { SegmentedFilter } from "@/components/shared/SegmentedFilter";
import { Button } from "@/components/ui/button";
import { Combobox } from "@/components/ui/combobox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { tendersApi } from "@/api/tenders";
import { useClients } from "@/hooks/useClients";
import { useConfirm } from "@/hooks/useConfirm";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import {
  useBulkDeleteTenders,
  useClientOutstanding,
  useDeleteTender,
  useTenderSummary,
  useTenders,
} from "@/hooks/useTenders";
import { formatCurrency } from "@/lib/format";
import { TenderForm } from "@/pages/tenders/TenderForm";
import { SettleDuesForm } from "@/pages/tenders/SettleDuesForm";
import { TendersTable } from "@/pages/tenders/TendersTable";
import type { Tender, TenderStatus } from "@/types/tender";

const PAGE_SIZE = 25;
const STATUS_OPTIONS = ["All", "Pending", "Partially Paid", "Paid"] as const;
type StatusOption = (typeof STATUS_OPTIONS)[number];

export default function TendersPage() {
  const { isAdmin } = useAuth();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [clientFilter, setClientFilter] = useState("");
  const [clientSearch, setClientSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusOption>("All");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [formState, setFormState] = useState<{ open: boolean; tender?: Tender }>({
    open: false,
  });
  // Ids only, so a selection survives the row objects being refetched. Cleared
  // whenever the filter or page moves, so a tender can never be deleted from
  // behind a view the user has already left (CH-29).
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [settleOpen, setSettleOpen] = useState(false);

  // Shared by the table and the summary strip so they always agree.
  const filters = {
    client_id: clientFilter || undefined,
    status: statusFilter === "All" ? undefined : (statusFilter as TenderStatus),
    search: search || undefined,
    start_date: startDate || undefined,
    end_date: endDate || undefined,
  };

  const { data, isLoading } = useTenders({ ...filters, page, page_size: PAGE_SIZE });
  // Admin-only (CH-12): the query is disabled for employees rather than merely
  // hidden, so no employee session fires a request the API answers with 403.
  const { data: summary } = useTenderSummary(filters, isAdmin);
  const debouncedClientSearch = useDebouncedValue(clientSearch);
  const { data: clientsPage } = useClients({
    page: 1,
    page_size: 50,
    search: debouncedClientSearch || undefined,
  });
  const deleteTender = useDeleteTender();
  const bulkDeleteTenders = useBulkDeleteTenders();
  const confirm = useConfirm();

  const rows = data?.items ?? [];
  const totalCount = data?.total_count ?? 0;
  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));
  const hasDateRange = Boolean(startDate || endDate);
  const allOnPageSelected = rows.length > 0 && rows.every((t) => selectedIds.has(t.id));
  // Badge on the phone's Filters button: the status tabs and the search field
  // stay visible above the list, so neither counts here.
  const activeFilterCount = [clientFilter, startDate, endDate].filter(Boolean).length;

  /**
   * The client the whole result set belongs to, if it belongs to exactly one.
   *
   * Picking a client in the filter is the obvious way to get there, but typing
   * a name into the search box narrows to one client just as often, and the
   * dues panel was missing in that case. Only trusted when every matching row
   * is on screen (`totalCount <= rows.length`) — page one being all one client
   * says nothing about page two.
   */
  const searchedClient =
    rows.length > 0 &&
    totalCount <= rows.length &&
    rows.every((t) => t.client.id === rows[0].client.id)
      ? rows[0].client
      : undefined;
  const settleClientId = clientFilter || searchedClient?.id || "";
  const filteredClient = (clientsPage?.items ?? []).find((c) => c.id === clientFilter);
  const settleClient = filteredClient ?? (clientFilter ? undefined : searchedClient);
  const clientLabel = settleClient
    ? `${settleClient.contact_person_name} · ${settleClient.company_name}`
    : "this client";

  // Only meaningful for one client at a time: a lump sum is paid by a person,
  // not by a filter (CH-35).
  const { data: outstanding } = useClientOutstanding(settleClientId);

  function changeFilter(apply: () => void) {
    apply();
    setPage(1);
    setSelectedIds(new Set());
  }

  function changePage(next: number) {
    setPage(next);
    setSelectedIds(new Set());
  }

  function toggleRow(id: string) {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  /** The header checkbox covers this page only, never the whole filter. */
  function toggleAllOnPage() {
    setSelectedIds((current) => {
      const allSelected = rows.length > 0 && rows.every((t) => current.has(t.id));
      return allSelected ? new Set() : new Set(rows.map((t) => t.id));
    });
  }

  /** The opt-in beyond the page: fetches every id the current filter matches. */
  async function selectAllMatching() {
    setSelectedIds(new Set(await tendersApi.listIds(filters)));
  }

  function handleBulkDelete() {
    const ids = [...selectedIds];
    confirm({
      title: `Delete ${ids.length} tender${ids.length === 1 ? "" : "s"}?`,
      description: (
        <>
          <p>
            {ids.length === 1 ? "This tender" : "These tenders"} will be removed permanently, along
            with {ids.length === 1 ? "its" : "their"} payment records.
          </p>
          <p>
            Any paid ones drop out of the revenue totals on this page and the dashboard, including
            for past date ranges. This cannot be undone.
          </p>
        </>
      ),
      confirmLabel: `Delete ${ids.length}`,
      tone: "destructive",
      onConfirm: async () => {
        await bulkDeleteTenders.mutateAsync(ids);
        setSelectedIds(new Set());
      },
    });
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

  function handleDelete(tender: Tender) {
    confirm({
      title: "Delete this tender?",
      description: `The ${tender.tender_department.name} tender for ${tender.client.company_name} (${formatCurrency(tender.total_amount)}) will be removed permanently, along with its payment record.`,
      confirmLabel: "Delete Tender",
      tone: "destructive",
      onConfirm: () => deleteTender.mutateAsync(tender.id),
    });
  }

  const addButton = (
    <Button onClick={() => setFormState({ open: true })}>
      <Plus />
      Log Tender
    </Button>
  );

  // Which cards to show follows the filter (CH-10). Filtering to a single
  // status makes the other buckets noise, and outstanding is only meaningful
  // where something is still owed.
  const showOutstanding = statusFilter !== "Paid";
  const showPaid = statusFilter === "All" || statusFilter === "Paid";
  const showPartial =
    summary !== undefined &&
    (statusFilter === "Partially Paid" ||
      (statusFilter === "All" && summary.partially_paid_count > 0));

  return (
    <div className="page">
      <PageHeader
        title="Tenders"
        description="Every submission logged against a client, with what has been paid and what is still owed."
        actions={addButton}
        primaryAction={{ label: "Log Tender", onClick: () => setFormState({ open: true }) }}
      />

      {/* Revenue and receivables are admin-only (CH-12). */}
      {isAdmin && summary && (
        <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-3">
          {showOutstanding && (
            <MetricCard
              label="Total Outstanding"
              value={formatCurrency(summary.total_outstanding_value)}
              icon={Clock}
              tone="amber"
              hint={`Unpaid balance across ${summary.pending_count + summary.partially_paid_count} tender(s)`}
            />
          )}
          {showPartial && (
            <MetricCard
              label="Partially Paid Value"
              value={formatCurrency(summary.total_partially_paid_value)}
              icon={PieChart}
              tone="blue"
              hint={`${summary.partially_paid_count} tender(s) part-settled`}
            />
          )}
          {showPaid && (
            <MetricCard
              label="Total Paid Value"
              value={formatCurrency(summary.total_paid_value)}
              icon={Wallet}
              tone="green"
              hint={`${summary.paid_count} tender(s) settled`}
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
            placeholder="Search by client, company or department…"
            className="w-full sm:w-80"
          />
        </div>

        {/* Client and dates on their own row: two labelled date fields do not
            fit beside the tabs at tablet width without wrapping mid-pair. On a
            phone the same fields open as a sheet instead (CH-30). */}
        <FilterSheet
          activeCount={activeFilterCount}
          onClear={clearFilters}
          resultCount={totalCount}
        >
          <div className="w-full space-y-1.5 sm:w-auto">
            <Label htmlFor="tender_client_filter">Client</Label>
            <Combobox
              id="tender_client_filter"
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
          </div>
          <div className="w-full space-y-1.5 sm:w-auto">
            <Label htmlFor="tender_start_date">From</Label>
            <Input
              id="tender_start_date"
              type="date"
              className="w-full sm:w-44"
              value={startDate}
              max={endDate || undefined}
              onChange={(e) => changeFilter(() => setStartDate(e.target.value))}
            />
          </div>
          <div className="w-full space-y-1.5 sm:w-auto">
            <Label htmlFor="tender_end_date">To</Label>
            <Input
              id="tender_end_date"
              type="date"
              className="w-full sm:w-44"
              value={endDate}
              min={startDate || undefined}
              onChange={(e) => changeFilter(() => setEndDate(e.target.value))}
            />
          </div>
          {hasDateRange && (
            <p className="text-xs text-muted-foreground sm:pb-2.5">
              Dates are IST, and both ends are included.
            </p>
          )}
          <Button
            type="button"
            variant="outline"
            className="hidden sm:ml-auto sm:inline-flex"
            onClick={clearFilters}
          >
            Clear filters
          </Button>
        </FilterSheet>

        {/* Only appears once something is ticked, so the table is unchanged
            until the user is actually mid-task (CH-29). */}
        {isAdmin && selectedIds.size > 0 && (
          <div className="flex flex-wrap items-center gap-3 border-y border-border bg-primary/5 px-4 py-3 sm:px-5">
            <span className="text-sm font-semibold text-foreground">
              {selectedIds.size} selected
            </span>
            {allOnPageSelected && selectedIds.size < totalCount && (
              <Button type="button" variant="outline" size="sm" onClick={selectAllMatching}>
                Select all {totalCount} matching this filter
              </Button>
            )}
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setSelectedIds(new Set())}
            >
              Clear selection
            </Button>
            <Button
              type="button"
              variant="destructive"
              size="sm"
              className="ml-auto"
              onClick={handleBulkDelete}
            >
              <Trash2 />
              Delete selected
            </Button>
          </div>
        )}

        <TendersTable
          tenders={rows}
          isLoading={isLoading}
          onEdit={(tender) => setFormState({ open: true, tender })}
          onDelete={handleDelete}
          emptyAction={addButton}
          // Checkboxes only where the selection can be acted on: deletion is
          // admin-only, so an employee gets the table exactly as before.
          selection={
            isAdmin
              ? { selectedIds, onToggle: toggleRow, onToggleAll: toggleAllOnPage }
              : undefined
          }
        />

        {/* Sits under the rows it summarises, and only once the view is down to
            a single client — chosen in the filter or narrowed to by search:
            a lump sum is paid by a person, not by a filter (CH-35). */}
        {settleClientId && outstanding && (
          <div className="flex flex-wrap items-center gap-x-6 gap-y-3 border-t border-border bg-muted/60 px-4 py-4 sm:px-5">
            <div className="min-w-0">
              <p className="eyebrow">Pending for this client</p>
              <p className="mt-0.5 text-xl font-bold tabular-nums text-foreground">
                {formatCurrency(outstanding.outstanding)}
              </p>
              <p className="mt-0.5 truncate text-[13px] text-muted-foreground">
                {outstanding.unpaid_count === 0
                  ? "Nothing outstanding"
                  : `across ${outstanding.unpaid_count} unpaid tender(s) · ${clientLabel}`}
              </p>
            </div>
            <Button
              type="button"
              className="ml-auto"
              disabled={outstanding.unpaid_count === 0}
              onClick={() => setSettleOpen(true)}
            >
              <IndianRupee />
              Record Payment
            </Button>
          </div>
        )}

        {totalCount > PAGE_SIZE && (
          <Pagination
            page={page}
            totalPages={totalPages}
            totalCount={totalCount}
            onPageChange={changePage}
          />
        )}
      </div>

      <Drawer
        open={formState.open}
        onClose={() => setFormState({ open: false })}
        title={formState.tender ? "Edit Tender" : "Log Tender"}
        description="Total and remaining amounts are calculated from quantity, price and what has been paid; the server is the source of truth."
      >
        <TenderForm
          tender={formState.tender}
          onSuccess={() => setFormState({ open: false })}
          onCancel={() => setFormState({ open: false })}
        />
      </Drawer>
      <Drawer
        open={settleOpen}
        onClose={() => setSettleOpen(false)}
        title="Record Payment"
        description="Spread what the client paid across their unpaid tenders, oldest first."
      >
        {settleClientId && outstanding && (
          <SettleDuesForm
            clientId={settleClientId}
            clientName={clientLabel}
            outstanding={outstanding.outstanding}
            onSuccess={() => setSettleOpen(false)}
            onCancel={() => setSettleOpen(false)}
          />
        )}
      </Drawer>
    </div>
  );
}
