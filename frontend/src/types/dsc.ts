export type DscKeyStatus = "Key Created" | "Key Issued" | "Key Returned" | "Key Lost";

export const DSC_KEY_STATUSES: DscKeyStatus[] = [
  "Key Created",
  "Key Issued",
  "Key Returned",
  "Key Lost",
];

export interface DscKey {
  id: string;
  client: { id: string; company_name: string };
  key_status: DscKeyStatus;
  storage_location_notes: string | null;
  created_by: { id: string; full_name: string } | null;
  created_at: string;
}

export interface DscKeyCreate {
  client_id: string;
  key_status?: DscKeyStatus;
  storage_location_notes?: string | null;
}

export interface DscKeyUpdate {
  client_id?: string;
  key_status?: DscKeyStatus;
  storage_location_notes?: string | null;
}
