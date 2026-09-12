/**
 * "Key Lost" is retired (CH-15) and cannot be selected any more. The value
 * still exists on legacy rows, so anything rendering a status coming back from
 * the API must tolerate a string outside this union.
 */
export type DscKeyStatus = "Key Created" | "Key Issued" | "Key Returned";

export const DSC_KEY_STATUSES: DscKeyStatus[] = ["Key Created", "Key Issued", "Key Returned"];

export type DscEventType = "Created" | "Issued" | "Returned";

export interface DscKey {
  id: string;
  client: { id: string; contact_person_name: string; company_name: string };
  key_status: DscKeyStatus | string;
  storage_location_notes: string | null;
  /** Whoever last edited the row, not necessarily who first logged it. */
  created_by: { id: string; full_name: string } | null;
  created_at: string;
  updated_at: string;
}

/** One entry in a key's history: its creation, an issuance, or a return. */
export interface DscKeyEvent {
  id: string;
  event_type: DscEventType;
  issued_to: string | null;
  issued_phone: string | null;
  notes: string | null;
  created_by: { id: string; full_name: string } | null;
  created_at: string;
}

export interface DscKeyCreate {
  client_id: string;
  key_status?: DscKeyStatus;
  storage_location_notes?: string | null;
  /** Both required when key_status is "Key Issued", optional on a return. */
  issued_to?: string | null;
  issued_phone?: string | null;
}

export interface DscKeyUpdate {
  client_id?: string;
  key_status?: DscKeyStatus;
  storage_location_notes?: string | null;
  issued_to?: string | null;
  issued_phone?: string | null;
}
