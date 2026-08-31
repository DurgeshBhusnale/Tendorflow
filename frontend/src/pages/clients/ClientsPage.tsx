import { Building2, Plus } from "lucide-react";
import { useState } from "react";
import { Drawer } from "@/components/shared/Drawer";
import { MetricCard } from "@/components/shared/MetricCard";
import { PageHeader } from "@/components/shared/PageHeader";
import { Pagination } from "@/components/shared/Pagination";
import { SearchInput } from "@/components/shared/SearchInput";
import { Button } from "@/components/ui/button";
import { useClients, useDeleteClient } from "@/hooks/useClients";
import { ClientForm } from "@/pages/clients/ClientForm";
import { ClientsTable } from "@/pages/clients/ClientsTable";
import type { Client } from "@/types/client";

const PAGE_SIZE = 25;

export default function ClientsPage() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [formState, setFormState] = useState<{ open: boolean; client?: Client }>({
    open: false,
  });

  const { data, isLoading } = useClients({
    page,
    page_size: PAGE_SIZE,
    search: search || undefined,
  });
  const deleteClient = useDeleteClient();

  const totalCount = data?.total_count ?? 0;
  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));

  function handleSearchChange(value: string) {
    setSearch(value);
    setPage(1);
  }

  async function handleDelete(client: Client) {
    if (!window.confirm(`Delete ${client.company_name}? This also removes their records.`)) {
      return;
    }
    await deleteClient.mutateAsync(client.id);
  }

  const addButton = (
    <Button onClick={() => setFormState({ open: true })}>
      <Plus />
      Add Client
    </Button>
  );

  return (
    <div className="space-y-8 px-8 py-8">
      <PageHeader
        title="Clients"
        description="Everyone onboarded to the workspace. Employees can edit the clients they added; admins can edit any."
        actions={addButton}
      />

      <div className="grid grid-cols-1 gap-6 sm:max-w-xs">
        <MetricCard label="Total Active Clients" value={totalCount} icon={Building2} />
      </div>

      <div className="surface">
        <div className="flex flex-wrap items-center gap-3 border-b border-border px-6 py-4">
          <SearchInput
            value={search}
            onChange={handleSearchChange}
            placeholder="Search by contact person, company, or email…"
            className="w-full max-w-sm"
          />
        </div>

        <ClientsTable
          clients={data?.items ?? []}
          isLoading={isLoading}
          onEdit={(client) => setFormState({ open: true, client })}
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
        title={formState.client ? "Edit Client" : "Add Client"}
        description={
          formState.client
            ? "Update this client's contact details."
            : "Onboard a new client to the workspace."
        }
      >
        <ClientForm
          client={formState.client}
          onSuccess={() => setFormState({ open: false })}
          onCancel={() => setFormState({ open: false })}
        />
      </Drawer>
    </div>
  );
}
