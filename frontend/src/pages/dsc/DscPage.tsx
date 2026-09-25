import { Plus } from "lucide-react";
import { useState } from "react";
import { Drawer } from "@/components/shared/Drawer";
import { FilterSheet } from "@/components/shared/FilterSheet";
import { PageHeader } from "@/components/shared/PageHeader";
import { Pagination } from "@/components/shared/Pagination";
import { SearchInput } from "@/components/shared/SearchInput";
import { Button } from "@/components/ui/button";
import { Combobox } from "@/components/ui/combobox";
import { Label } from "@/components/ui/label";
import { useClients } from "@/hooks/useClients";
import { useConfirm } from "@/hooks/useConfirm";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import { useDeleteDscKey, useDscKeys } from "@/hooks/useDsc";
import { DscForm } from "@/pages/dsc/DscForm";
import { DscHistoryPanel } from "@/pages/dsc/DscHistoryPanel";
import { DscTable } from "@/pages/dsc/DscTable";
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
  const confirm = useConfirm();

  const totalCount = data?.total_count ?? 0;
  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));

  function changeFilter(apply: () => void) {
    apply();
    setPage(1);
  }

  function handleDelete(dscKey: DscKey) {
    confirm({
      title: "Delete this DSC key?",
      description: `The key entry for ${dscKey.client.company_name} and its full issuance history will be removed permanently.`,
      confirmLabel: "Delete Key",
      tone: "destructive",
      onConfirm: () => deleteDscKey.mutateAsync(dscKey.id),
    });
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
        primaryAction={{ label: "Log Key", onClick: () => setFormState({ open: true }) }}
      />

      <div className="surface">
        <div className="card-header">
          <div className="flex items-center gap-2.5">
            <h2 className="text-base">All keys</h2>
            <span className="count-chip">
              {totalCount} {totalCount === 1 ? "key" : "keys"}
            </span>
          </div>
          <SearchInput
            value={search}
            onChange={(value) => changeFilter(() => setSearch(value))}
            placeholder="Search by client, company or storage location…"
            className="w-full sm:w-80"
          />
        </div>

        <FilterSheet
          activeCount={[clientFilter, statusFilter].filter(Boolean).length}
          onClear={() =>
            changeFilter(() => {
              setClientFilter("");
              setStatusFilter("");
            })
          }
          resultCount={totalCount}
        >
          <div className="w-full space-y-1.5 sm:w-56">
            <Label htmlFor="dsc_client_filter">Client</Label>
            <Combobox
              id="dsc_client_filter"
              aria-label="Filter by client"
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
          <div className="w-full space-y-1.5 sm:w-48">
            <Label htmlFor="dsc_status_filter">Key status</Label>
            <Combobox
              id="dsc_status_filter"
              aria-label="Filter by status"
              options={DSC_KEY_STATUSES.map((status) => ({ value: status, label: status }))}
              value={statusFilter}
              onChange={(value) => changeFilter(() => setStatusFilter(value as "" | DscKeyStatus))}
              placeholder="All statuses"
              emptyMessage="No status matches"
              clearable
            />
          </div>
        </FilterSheet>

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
