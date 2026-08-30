import { useState } from "react";
import { MetricCard } from "@/components/shared/MetricCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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

  const addButton = <Button onClick={() => setFormState({ open: true })}>+ Add Client</Button>;

  return (
    <div className="space-y-4 p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Clients</h1>
        {!formState.open && addButton}
      </div>

      <div className="max-w-xs">
        <MetricCard label="Total Active Clients" value={totalCount} />
      </div>

      {formState.open && (
        <ClientForm
          client={formState.client}
          onSuccess={() => setFormState({ open: false })}
          onCancel={() => setFormState({ open: false })}
        />
      )}

      <Input
        placeholder="Search by contact person, company, or email…"
        value={search}
        onChange={(e) => handleSearchChange(e.target.value)}
        className="max-w-sm"
      />

      <ClientsTable
        clients={data?.items ?? []}
        isLoading={isLoading}
        onEdit={(client) => setFormState({ open: true, client })}
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
