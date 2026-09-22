import { Plus } from "lucide-react";
import { useState } from "react";
import { Drawer } from "@/components/shared/Drawer";
import { PageHeader } from "@/components/shared/PageHeader";
import { Pagination } from "@/components/shared/Pagination";
import { SearchInput } from "@/components/shared/SearchInput";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { useClients } from "@/hooks/useClients";
import { useConfirm } from "@/hooks/useConfirm";
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
  const confirm = useConfirm();

  const totalCount = data?.total_count ?? 0;
  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));

  function resetToFirstPage<T>(setter: (value: T) => void) {
    return (value: T) => {
      setter(value);
      setPage(1);
    };
  }

  function handleDelete(credential: Credential) {
    confirm({
      title: "Delete this credential?",
      description: `The ${credential.portal.name} login for ${credential.client.company_name} will be removed permanently.`,
      confirmLabel: "Delete Credential",
      tone: "destructive",
      onConfirm: () => deleteCredential.mutateAsync(credential.id),
    });
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
        description="Portal logins for every client. Anyone signed in can reveal a password or edit a login; only admins can delete one."
        actions={addButton}
      />

      <div className="surface">
        <div className="card-header">
          <div className="flex items-center gap-2.5">
            <h2 className="text-base">All credentials</h2>
            <span className="count-chip">{totalCount} stored</span>
          </div>
          <SearchInput
            value={search}
            onChange={resetToFirstPage(setSearch)}
            placeholder="Search by client or portal…"
            className="w-full sm:w-80"
          />
        </div>

        <div className="toolbar">
          <div className="w-full space-y-1.5 sm:w-56">
            <Label htmlFor="credential_client_filter">Client</Label>
            <Select
              id="credential_client_filter"
              aria-label="Filter by client"
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
          </div>
          <div className="w-full space-y-1.5 sm:w-56">
            <Label htmlFor="credential_portal_filter">Portal</Label>
            <Select
              id="credential_portal_filter"
              aria-label="Filter by portal"
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
