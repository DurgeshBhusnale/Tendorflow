export interface Client {
  id: string;
  contact_person_name: string;
  company_name: string;
  contact_number: string;
  email: string;
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
}

export type ClientUpdate = Partial<ClientCreate>;
