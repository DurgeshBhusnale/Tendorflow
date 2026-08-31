import { Plus } from "lucide-react";
import { useState } from "react";
import { Drawer } from "@/components/shared/Drawer";
import { MetricCard } from "@/components/shared/MetricCard";
import { PageHeader } from "@/components/shared/PageHeader";
import { Pagination } from "@/components/shared/Pagination";
import { SearchInput } from "@/components/shared/SearchInput";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { useClients } from "@/hooks/useClients";
import { useDeleteTender, useTenderSummary, useTenders, useUpdateTender } from "@/hooks/useTenders";
import { formatCurrency } from "@/lib/format";
import { cn } from "@/lib/utils";
import { TenderForm } from "@/pages/tenders/TenderForm";
import { TendersTable } from "@/pages/tenders/TendersTable";
import type { Tender, TenderStatus } from "@/types/tender";

const PAGE_SIZE = 25;
const STATUS_OPTIONS = ["All", "Paid", "Pending"] as const;
type StatusOption = (typeof STATUS_OPTIONS)[number];

export default function TendersPage() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [clientFilter, setClientFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusOption>("All");
  const [formState, setFormState] = useState<{ open: boolean; tender?: Tender }>({
    open: false,
  });

  // Shared by the table and the summary strip so they always agree.
  const filters = {
    client_id: clientFilter || undefined,
    status: statusFilter === "All" ? undefined : (statusFilter as TenderStatus),
    search: search || undefined,
  };

  const { data, isLoading } = useTenders({ ...filters, page, page_size: PAGE_SIZE });
  const { data: summary } = useTenderSummary(filters);
  const { data: clientsPage } = useClients({ page: 1, page_size: 100 });
  const updateTender = useUpdateTender();
  const deleteTender = useDeleteTender();

  const totalCount = data?.total_count ?? 0;
  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));

  function changeFilter(apply: () => void) {
    apply();
    setPage(1);
  }

  async function handleDelete(tender: Tender) {
    if (!window.confirm(`Delete this ${tender.tender_name.name} tender?`)) return;
    await deleteTender.mutateAsync(tender.id);
  }

  const addButton = (
    <Button onClick={() => setFormState({ open: true })}>
      <Plus />
      Log Tender
    </Button>
  );

  return (
    <div className="page">
      <PageHeader
        title="Tenders"
        description="Every submission logged against a client, with pending and paid value totalled for the current filter."
        actions={addButton}
      />

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:max-w-3xl">
        <MetricCard
          label="Total Pending Value"
          value={formatCurrency(summary?.total_pending_value ?? "0")}
          hint={`${summary?.pending_count ?? 0} tender(s) awaiting payment`}
        />
        <MetricCard
          label="Total Paid Value"
          value={formatCurrency(summary?.total_paid_value ?? "0")}
          hint={`${summary?.paid_count ?? 0} tender(s) settled`}
        />
      </div>

      <div className="surface">
        <div className="toolbar">
          <SearchInput
            value={search}
            onChange={(value) => changeFilter(() => setSearch(value))}
            placeholder="Search by client or tender name…"
            className="w-full sm:max-w-xs"
          />
          <Select
            aria-label="Filter by client"
            className="w-full sm:w-auto sm:min-w-[11rem]"
            value={clientFilter}
            onChange={(e) => changeFilter(() => setClientFilter(e.target.value))}
          >
            <option value="">All clients</option>
            {clientsPage?.items.map((c) => (
              <option key={c.id} value={c.id}>
                {c.company_name}
              </option>
            ))}
          </Select>

          <div className="flex border border-border" role="group" aria-label="Filter by status">
            {STATUS_OPTIONS.map((option) => (
              <button
                key={option}
                type="button"
                aria-pressed={statusFilter === option}
                onClick={() => changeFilter(() => setStatusFilter(option))}
                className={cn(
                  "h-10 border-r border-border px-4 text-sm transition-colors last:border-r-0",
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

        <TendersTable
          tenders={data?.items ?? []}
          isLoading={isLoading}
          onEdit={(tender) => setFormState({ open: true, tender })}
          onDelete={handleDelete}
          onMarkPaid={(tender) =>
            updateTender.mutate({ id: tender.id, payload: { status: "Paid" } })
          }
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
        title={formState.tender ? "Edit Tender" : "Log Tender"}
        description="Total amount is calculated from quantity and price; the server is the source of truth."
      >
        <TenderForm
          tender={formState.tender}
          onSuccess={() => setFormState({ open: false })}
          onCancel={() => setFormState({ open: false })}
        />
      </Drawer>
    </div>
  );
}
