import { Plus } from "lucide-react";
import { useState } from "react";
import { Drawer } from "@/components/shared/Drawer";
import { PageHeader } from "@/components/shared/PageHeader";
import { Pagination } from "@/components/shared/Pagination";
import { SearchInput } from "@/components/shared/SearchInput";
import { Button } from "@/components/ui/button";
import { Combobox } from "@/components/ui/combobox";
import { useClients } from "@/hooks/useClients";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import { useDeleteDscKey, useDscKeys } from "@/hooks/useDsc";
import { DscForm } from "@/pages/dsc/DscForm";
import { DscHistoryPanel } from "@/pages/dsc/DscHistoryPanel";
import { DscTable } from "@/pages/dsc/DscTable";
import { ApiError } from "@/types/api";
import { DSC_KEY_STATUSES, type DscKey, type DscKeyStatus } from "@/types/dsc";

const PAGE_SIZE = 25;

export default function DscPage() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [clientFilter, setClientFilter] = useState("");
  const [clientSearch, setClientSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"" | DscKeyStatus>("");
  const [formState, setFormState] = useState<{ open: boolean; dscKey?: DscKey }>({
    open: false,
  });
  const [historyKey, setHistoryKey] = useState<DscKey | null>(null);

  const { data, isLoading } = useDscKeys({
    page,
    page_size: PAGE_SIZE,
    search: search || undefined,
    client_id: clientFilter || undefined,
    status: statusFilter || undefined,
  });
  const debouncedClientSearch = useDebouncedValue(clientSearch);
  const { data: clientsPage } = useClients({
    page: 1,
    page_size: 50,
    search: debouncedClientSearch || undefined,
  });
  const deleteDscKey = useDeleteDscKey();

  const totalCount = data?.total_count ?? 0;
  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));

  function changeFilter(apply: () => void) {
    apply();
    setPage(1);
  }

  async function handleDelete(dscKey: DscKey) {
    if (!window.confirm(`Delete the DSC key entry for ${dscKey.client.company_name}?`)) return;
    try {
      await deleteDscKey.mutateAsync(dscKey.id);
    } catch (err) {
      window.alert(err instanceof ApiError ? err.message : "Could not delete this key.");
    }
  }

  const addButton = (
    <Button onClick={() => setFormState({ open: true })}>
      <Plus />
      Log Key
    </Button>
  );

  return (
    <div className="page">
      <PageHeader
        title="DSC Keys"
        description="Visible to all employees — find any client's key at a glance. Select a row to see its full history."
        actions={addButton}
      />

      <div className="surface">
        <div className="toolbar">
          <SearchInput
            value={search}
            onChange={(value) => changeFilter(() => setSearch(value))}
            placeholder="Search by client, company or storage location…"
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
          <Combobox
            aria-label="Filter by status"
            className="w-full sm:w-48"
            options={DSC_KEY_STATUSES.map((status) => ({ value: status, label: status }))}
            value={statusFilter}
            onChange={(value) => changeFilter(() => setStatusFilter(value as "" | DscKeyStatus))}
            placeholder="All statuses"
            emptyMessage="No status matches"
            clearable
          />
        </div>

        <DscTable
          dscKeys={data?.items ?? []}
          isLoading={isLoading}
          onEdit={(dscKey) => setFormState({ open: true, dscKey })}
          onDelete={handleDelete}
          onViewHistory={setHistoryKey}
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
        title={formState.dscKey ? "Edit DSC Key" : "Log DSC Key"}
        description="Record where the physical key lives so the next person can find it."
      >
        <DscForm
          dscKey={formState.dscKey}
          onSuccess={() => setFormState({ open: false })}
          onCancel={() => setFormState({ open: false })}
        />
      </Drawer>

      <Drawer
        open={historyKey !== null}
        onClose={() => setHistoryKey(null)}
        title="Key History"
        description="Every creation, issuance and return recorded against this key."
      >
        {historyKey && <DscHistoryPanel dscKey={historyKey} />}
      </Drawer>
    </div>
  );
}
