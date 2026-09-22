export interface Client {
  id: string;
  contact_person_name: string;
  company_name: string;
  contact_number: string;
  email: string;
  /** Free text, up to 500 chars. Null when none is on file (CH-26). */
  bank_details: string | null;
  /** Whoever last edited the row, not necessarily who first onboarded it. */
  created_by: { id: string; full_name: string } | null;
  created_at: string;
  updated_at: string;
}

export interface ClientCreate {
  contact_person_name: string;
  company_name: string;
  contact_number: string;
  email: string;
  /** Optional; send null or an empty string to store none. */
  bank_details?: string | null;
}

export type ClientUpdate = Partial<ClientCreate>;
