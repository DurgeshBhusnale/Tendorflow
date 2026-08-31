import { Plus } from "lucide-react";
import { useState } from "react";
import { Drawer } from "@/components/shared/Drawer";
import { PageHeader } from "@/components/shared/PageHeader";
import { Pagination } from "@/components/shared/Pagination";
import { SearchInput } from "@/components/shared/SearchInput";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
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
        description="Visible to all employees — find any client's key at a glance."
        actions={addButton}
      />

      <div className="surface">
        <div className="toolbar">
          <SearchInput
            value={search}
            onChange={(value) => changeFilter(() => setSearch(value))}
            placeholder="Search by client or storage location…"
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
          <Select
            aria-label="Filter by status"
            className="w-full sm:w-auto sm:min-w-[11rem]"
            value={statusFilter}
            onChange={(e) =>
              changeFilter(() => setStatusFilter(e.target.value as "" | DscKeyStatus))
            }
          >
            <option value="">All statuses</option>
            {DSC_KEY_STATUSES.map((status) => (
              <option key={status} value={status}>
                {status}
              </option>
            ))}
          </Select>
        </div>

        <DscTable
          dscKeys={data?.items ?? []}
          isLoading={isLoading}
          onEdit={(dscKey) => setFormState({ open: true, dscKey })}
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
        title={formState.dscKey ? "Edit DSC Key" : "Log DSC Key"}
        description="Record where the physical key lives so the next person can find it."
      >
        <DscForm
          dscKey={formState.dscKey}
          onSuccess={() => setFormState({ open: false })}
          onCancel={() => setFormState({ open: false })}
        />
      </Drawer>
    </div>
  );
}
