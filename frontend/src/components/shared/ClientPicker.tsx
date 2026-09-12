import * as React from "react";

import { Combobox, type ComboboxOption } from "@/components/ui/combobox";
import { FieldError, Label } from "@/components/ui/label";
import { useClients } from "@/hooks/useClients";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";

/** The shape every module's nested client reference shares. */
export interface ClientRef {
  id: string;
  contact_person_name: string;
  company_name: string;
}

interface ClientPickerProps {
  /** The selected client's id — the only value any form actually submits. */
  value: string;
  onChange: (clientId: string) => void;
  /**
   * The currently linked client, when editing an existing row. Seeds both
   * labels without waiting on a search that may not return this client.
   */
  selected?: ClientRef | null;
  idPrefix: string;
  error?: string;
  disabled?: boolean;
}

const PAGE_SIZE = 50;

/**
 * Picks a client by contact name *or* company name (CH-14).
 *
 * Two fields, one value. Whichever the user recognises is the one they type
 * into, and choosing in either fills the other, because both render from the
 * same selected id.
 *
 * Options come from the server as the user types rather than from a fixed
 * first page — the old fixed `page_size: 100` silently stopped offering
 * clients once the hundredth was onboarded.
 */
export function ClientPicker({
  value,
  onChange,
  selected,
  idPrefix,
  error,
  disabled,
}: ClientPickerProps) {
  const [search, setSearch] = React.useState("");
  const debouncedSearch = useDebouncedValue(search);
  const { data } = useClients({
    page: 1,
    page_size: PAGE_SIZE,
    search: debouncedSearch || undefined,
  });

  const clients = React.useMemo<ClientRef[]>(() => {
    const items: ClientRef[] = data?.items ?? [];
    // The linked client may not match the current search; without this the
    // fields would blank out mid-edit and a save could drop the association.
    if (selected && !items.some((item) => item.id === selected.id)) {
      return [selected, ...items];
    }
    return items;
  }, [data?.items, selected]);

  const byContact: ComboboxOption[] = clients.map((client) => ({
    value: client.id,
    label: client.contact_person_name,
    hint: client.company_name,
  }));
  const byCompany: ComboboxOption[] = clients.map((client) => ({
    value: client.id,
    label: client.company_name,
    hint: client.contact_person_name,
  }));

  return (
    <div className="space-y-1.5">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor={`${idPrefix}_client_name`}>Client Name</Label>
          <Combobox
            id={`${idPrefix}_client_name`}
            options={byContact}
            value={value}
            onChange={onChange}
            onSearchChange={setSearch}
            placeholder="Search contact person…"
            emptyMessage="No client matches"
            disabled={disabled}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor={`${idPrefix}_company_name`}>Company Name</Label>
          <Combobox
            id={`${idPrefix}_company_name`}
            options={byCompany}
            value={value}
            onChange={onChange}
            onSearchChange={setSearch}
            placeholder="Search company…"
            emptyMessage="No client matches"
            disabled={disabled}
          />
        </div>
      </div>
      <FieldError>{error}</FieldError>
    </div>
  );
}
