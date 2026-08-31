import { Plus } from "lucide-react";
import { useState } from "react";
import { Drawer } from "@/components/shared/Drawer";
import { PageHeader } from "@/components/shared/PageHeader";
import { Pagination } from "@/components/shared/Pagination";
import { SearchInput } from "@/components/shared/SearchInput";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
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
    <Button onClick={() => setFormState({ open: true })}>
      <Plus />
      Add Credential
    </Button>
  );

  return (
    <div className="page">
      <PageHeader
        title="Credentials"
        description="Portal logins for every client. Any employee can reveal a password; only the owner or an admin can change one."
        actions={addButton}
      />

      <div className="surface">
        <div className="toolbar">
          <SearchInput
            value={search}
            onChange={resetToFirstPage(setSearch)}
            placeholder="Search by client or portal…"
            className="w-full sm:max-w-xs"
          />
          <Select
            aria-label="Filter by client"
            className="w-full sm:w-auto sm:min-w-[11rem]"
            value={clientFilter}
            onChange={(e) => resetToFirstPage(setClientFilter)(e.target.value)}
          >
            <option value="">All clients</option>
            {clientsPage?.items.map((c) => (
              <option key={c.id} value={c.id}>
                {c.company_name}
              </option>
            ))}
          </Select>
          <Select
            aria-label="Filter by portal"
            className="w-full sm:w-auto sm:min-w-[11rem]"
            value={portalFilter}
            onChange={(e) => resetToFirstPage(setPortalFilter)(e.target.value)}
          >
            <option value="">All portals</option>
            {portals?.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </Select>
        </div>

        <CredentialsTable
          credentials={data?.items ?? []}
          isLoading={isLoading}
          onEdit={(credential) => setFormState({ open: true, credential })}
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
        title={formState.credential ? "Edit Credential" : "Add Credential"}
        description={
          formState.credential
            ? "Re-enter the password to change it; leaving the other fields untouched keeps them as they are."
            : "Store a portal login against a client."
        }
      >
        <CredentialForm
          credential={formState.credential}
          onSuccess={() => setFormState({ open: false })}
          onCancel={() => setFormState({ open: false })}
        />
      </Drawer>
    </div>
  );
}
