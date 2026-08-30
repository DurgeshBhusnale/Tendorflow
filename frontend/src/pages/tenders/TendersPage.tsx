import { useState } from "react";
import { MetricCard } from "@/components/shared/MetricCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useClients } from "@/hooks/useClients";
import {
  useDeleteTender,
  useTenderSummary,
  useTenders,
  useUpdateTender,
} from "@/hooks/useTenders";
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

  const addButton = <Button onClick={() => setFormState({ open: true })}>+ Log Tender</Button>;

  return (
    <div className="space-y-4 p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Tenders</h1>
        {!formState.open && addButton}
      </div>

      <div className="grid max-w-2xl grid-cols-2 gap-4">
        <MetricCard
          label={`Total Pending Value (${summary?.pending_count ?? 0})`}
          value={formatCurrency(summary?.total_pending_value ?? "0")}
        />
        <MetricCard
          label={`Total Paid Value (${summary?.paid_count ?? 0})`}
          value={formatCurrency(summary?.total_paid_value ?? "0")}
        />
      </div>

      {formState.open && (
        <TenderForm
          tender={formState.tender}
          onSuccess={() => setFormState({ open: false })}
          onCancel={() => setFormState({ open: false })}
        />
      )}

      <div className="flex flex-wrap items-center gap-3">
        <Input
          placeholder="Search by client or tender name…"
          value={search}
          onChange={(e) => changeFilter(() => setSearch(e.target.value))}
          className="max-w-xs"
        />
        <select
          className="rounded-md border px-3 py-2 text-sm"
          value={clientFilter}
          onChange={(e) => changeFilter(() => setClientFilter(e.target.value))}
        >
          <option value="">All clients</option>
          {clientsPage?.items.map((c) => (
            <option key={c.id} value={c.id}>
              {c.company_name}
            </option>
          ))}
        </select>
        <div className="flex overflow-hidden rounded-md border">
          {STATUS_OPTIONS.map((option) => (
            <button
              key={option}
              type="button"
              onClick={() => changeFilter(() => setStatusFilter(option))}
              className={cn(
                "px-3 py-2 text-sm",
                statusFilter === option ? "bg-muted font-medium" : "hover:bg-muted/50",
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
        <div className="flex items-center gap-3 text-sm">
          <Button
            variant="outline"
            size="sm"
            disabled={page <= 1}
            onClick={() => setPage((p) => p - 1)}
          >
            Previous
          </Button>
          <span className="text-muted-foreground">
            Page {page} of {totalPages}
          </span>
          <Button
            variant="outline"
            size="sm"
            disabled={page >= totalPages}
            onClick={() => setPage((p) => p + 1)}
          >
            Next
          </Button>
        </div>
      )}
    </div>
  );
}
