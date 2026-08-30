import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useClients } from "@/hooks/useClients";
import { useDeleteDscKey, useDscKeys } from "@/hooks/useDsc";
import { DscForm } from "@/pages/dsc/DscForm";
import { DscTable } from "@/pages/dsc/DscTable";
import { DSC_KEY_STATUSES, type DscKey, type DscKeyStatus } from "@/types/dsc";

const PAGE_SIZE = 25;

export default function DscPage() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [clientFilter, setClientFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState<"" | DscKeyStatus>("");
  const [formState, setFormState] = useState<{ open: boolean; dscKey?: DscKey }>({
    open: false,
  });

  const { data, isLoading } = useDscKeys({
    page,
    page_size: PAGE_SIZE,
    search: search || undefined,
    client_id: clientFilter || undefined,
    status: statusFilter || undefined,
  });
  const { data: clientsPage } = useClients({ page: 1, page_size: 100 });
  const deleteDscKey = useDeleteDscKey();

  const totalCount = data?.total_count ?? 0;
  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));

  function changeFilter(apply: () => void) {
    apply();
    setPage(1);
  }

  async function handleDelete(dscKey: DscKey) {
    if (!window.confirm(`Delete the DSC key entry for ${dscKey.client.company_name}?`)) return;
    await deleteDscKey.mutateAsync(dscKey.id);
  }

  const addButton = <Button onClick={() => setFormState({ open: true })}>+ Log Key</Button>;

  return (
    <div className="space-y-4 p-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-xl font-semibold">DSC Keys</h1>
          <p className="text-sm text-muted-foreground">
            Visible to all employees — find any client's key at a glance.
          </p>
        </div>
        {!formState.open && addButton}
      </div>

      {formState.open && (
        <DscForm
          dscKey={formState.dscKey}
          onSuccess={() => setFormState({ open: false })}
          onCancel={() => setFormState({ open: false })}
        />
      )}

      <div className="flex flex-wrap gap-3">
        <Input
          placeholder="Search by client or storage location…"
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
        <select
          className="rounded-md border px-3 py-2 text-sm"
          value={statusFilter}
          onChange={(e) => changeFilter(() => setStatusFilter(e.target.value as "" | DscKeyStatus))}
        >
          <option value="">All statuses</option>
          {DSC_KEY_STATUSES.map((status) => (
            <option key={status} value={status}>
              {status}
            </option>
          ))}
        </select>
      </div>

      <DscTable
        dscKeys={data?.items ?? []}
        isLoading={isLoading}
        onEdit={(dscKey) => setFormState({ open: true, dscKey })}
        onDelete={handleDelete}
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
