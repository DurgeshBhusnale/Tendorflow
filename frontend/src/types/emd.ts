/** "With Us" is money the business is still holding; "Returned" has gone back. */
export type EmdStatus = "With Us" | "Returned";

export const EMD_STATUSES: EmdStatus[] = ["With Us", "Returned"];

export interface Emd {
  id: string;
  /**
   * Typed in rather than linked to a client record (CH-33): a deposit often
   * arrives with someone not yet on file. The cost is that these are plain
   * strings — no cascade, and two spellings are two different companies.
   */
  client_name: string;
  company_name: string;
  contact_number: string;
  /** Money is a string to preserve decimal precision — parse only for display. */
  amount: string;
  status: EmdStatus;
  /** The day the deposit was taken, as YYYY-MM-DD. Render with `formatDay`. */
  emd_date: string;
  /** Which account it was paid into. Free text, and often not recorded yet. */
  paid_to_bank_account: string | null;
  /** Whoever last edited the row, not necessarily who first logged it. */
  created_by: { id: string; full_name: string } | null;
  created_at: string;
  updated_at: string;
}

export interface EmdCreate {
  client_name: string;
  company_name: string;
  contact_number: string;
  amount: string;
  status?: EmdStatus;
  /** YYYY-MM-DD. The server defaults it to today in IST when omitted. */
  emd_date?: string;
  paid_to_bank_account?: string | null;
}

export interface EmdUpdate {
  client_name?: string;
  company_name?: string;
  contact_number?: string;
  amount?: string;
  status?: EmdStatus;
  emd_date?: string;
  paid_to_bank_account?: string | null;
}

export interface EmdSummary {
  /** What the business is holding right now, and therefore still owes back. */
  total_with_us: string;
  total_returned: string;
  with_us_count: number;
  returned_count: number;
}
