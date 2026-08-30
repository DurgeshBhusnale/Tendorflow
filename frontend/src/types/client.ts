export interface Client {
  id: string;
  contact_person_name: string;
  company_name: string;
  contact_number: string;
  email: string;
  created_by: { id: string; full_name: string } | null;
  created_at: string;
}

export interface ClientCreate {
  contact_person_name: string;
  company_name: string;
  contact_number: string;
  email: string;
}

export type ClientUpdate = Partial<ClientCreate>;
