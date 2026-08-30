import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useClients } from "@/hooks/useClients";
import { useCredentials, useDeleteCredential } from "@/hooks/useCredentials";
import { usePortals } from "@/hooks/usePortals";
import { CredentialForm } from "@/pages/credentials/CredentialForm";
import { CredentialsTable } from "@/pages/credentials/CredentialsTable";
import type { Credential } from "@/types/credential";

const PAGE_SIZE = 25;

export default function CredentialsPage() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [clientFilter, setClientFilter] = useState("");
  const [portalFilter, setPortalFilter] = useState("");
  const [formState, setFormState] = useState<{ open: boolean; credential?: Credential }>({
    open: false,
  });

  const { data, isLoading } = useCredentials({
    page,
    page_size: PAGE_SIZE,
    search: search || undefined,
    client_id: clientFilter || undefined,
    portal_id: portalFilter || undefined,
  });
  const { data: clientsPage } = useClients({ page: 1, page_size: 100 });
  const { data: portals } = usePortals();
  const deleteCredential = useDeleteCredential();

  const totalCount = data?.total_count ?? 0;
  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));

  function resetToFirstPage<T>(setter: (value: T) => void) {
    return (value: T) => {
      setter(value);
      setPage(1);
    };
  }

  async function handleDelete(credential: Credential) {
    if (
      !window.confirm(
        `Delete the ${credential.portal.name} credential for ${credential.client.company_name}?`,
      )
    ) {
      return;
    }
    await deleteCredential.mutateAsync(credential.id);
  }

  const addButton = (
    <Button onClick={() => setFormState({ open: true })}>+ Add Credential</Button>
  );

  return (
    <div className="space-y-4 p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Credentials</h1>
        {!formState.open && addButton}
      </div>

      {formState.open && (
        <CredentialForm
          credential={formState.credential}
          onSuccess={() => setFormState({ open: false })}
          onCancel={() => setFormState({ open: false })}
        />
      )}

      <div className="flex flex-wrap gap-3">
        <Input
          placeholder="Search by client or portal…"
          value={search}
          onChange={(e) => resetToFirstPage(setSearch)(e.target.value)}
          className="max-w-xs"
        />
        <select
          className="rounded-md border px-3 py-2 text-sm"
          value={clientFilter}
          onChange={(e) => resetToFirstPage(setClientFilter)(e.target.value)}
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
          value={portalFilter}
          onChange={(e) => resetToFirstPage(setPortalFilter)(e.target.value)}
        >
          <option value="">All portals</option>
          {portals?.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
      </div>

      <CredentialsTable
        credentials={data?.items ?? []}
        isLoading={isLoading}
        onEdit={(credential) => setFormState({ open: true, credential })}
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
