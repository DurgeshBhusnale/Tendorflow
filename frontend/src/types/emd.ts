/** "With Us" is money the business is still holding; "Returned" has gone back. */
export type EmdStatus = "With Us" | "Returned";

export const EMD_STATUSES: EmdStatus[] = ["With Us", "Returned"];

export interface Emd {
  id: string;
  client: { id: string; contact_person_name: string; company_name: string };
  /** Captured per deposit, so it need not match the client's saved number. */
  contact_number: string;
  /** Money is a string to preserve decimal precision — parse only for display. */
  amount: string;
  status: EmdStatus;
  /** The day the deposit was taken, as YYYY-MM-DD. Render with `formatDay`. */
  emd_date: string;
  /** Whoever last edited the row, not necessarily who first logged it. */
  created_by: { id: string; full_name: string } | null;
  created_at: string;
  updated_at: string;
}

export interface EmdCreate {
  client_id: string;
  contact_number: string;
  amount: string;
  status?: EmdStatus;
  /** YYYY-MM-DD. The server defaults it to today in IST when omitted. */
  emd_date?: string;
}

export interface EmdUpdate {
  client_id?: string;
  contact_number?: string;
  amount?: string;
  status?: EmdStatus;
  emd_date?: string;
}

export interface EmdSummary {
  /** What the business is holding right now, and therefore still owes back. */
  total_with_us: string;
  total_returned: string;
  with_us_count: number;
  returned_count: number;
}
