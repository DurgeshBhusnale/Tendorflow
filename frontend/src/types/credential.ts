export interface Credential {
  id: string;
  client: { id: string; contact_person_name: string; company_name: string };
  portal: { id: string; name: string };
  login_identifier: string | null;
  /** Masked as "••••••" everywhere except a deliberate single-row reveal. */
  password: string;
  /** Whoever last edited the row, not necessarily who first stored it. */
  created_by: { id: string; full_name: string } | null;
  created_at: string;
  updated_at: string;
}

export interface CredentialCreate {
  client_id: string;
  portal_id: string;
  login_identifier?: string | null;
  password: string;
}

export interface CredentialUpdate {
  client_id?: string;
  portal_id?: string;
  login_identifier?: string | null;
  password?: string;
}
