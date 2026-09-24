export type TenderStatus = "Paid" | "Pending" | "Partially Paid";

export const TENDER_STATUSES: TenderStatus[] = ["Pending", "Partially Paid", "Paid"];

export type PaymentMode = "Cash" | "Online";

export const PAYMENT_MODES: PaymentMode[] = ["Cash", "Online"];

export interface Tender {
  id: string;
  client: { id: string; contact_person_name: string; company_name: string };
  tender_department: { id: string; name: string };
  quantity: number;
  /** Money is a string to preserve decimal precision — parse only for display. */
  price: string;
  /** Computed by Postgres as quantity * price. Never sent by the client. */
  total_amount: string;
  /** How much has actually been received. Equals total_amount when status is Paid. */
  paid_amount: string;
  /** Computed by Postgres as total_amount - paid_amount. Never sent by the client. */
  remaining_amount: string;
  status: TenderStatus;
  /** Null for Pending tenders, and for rows paid before this field existed. */
  payment_mode: PaymentMode | null;
  /** Who came in to pay, when that was recorded. Optional (CH-32). */
  payer_name: string | null;
  /** Their number, ten digits. Optional, and only set when a name was. */
  payer_contact: string | null;
  /** Whoever last edited the row, not necessarily who first logged it. */
  created_by: { id: string; full_name: string } | null;
  /**
   * The calendar day the tender is logged for, as YYYY-MM-DD (CH-22). What the
   * Date column, the date filter and the ordering use. Render with `formatDay`.
   */
  tender_date: string;
  /** When the row was typed in. An audit timestamp, not the tender's date. */
  created_at: string;
  /** When the row last changed. */
  updated_at: string;
}

export interface TenderCreate {
  client_id: string;
  tender_department_id: string;
  quantity: number;
  price: string;
  status?: TenderStatus;
  /** Required for Partially Paid; the server derives it for Paid. */
  paid_amount?: string | null;
  /** Required whenever money changed hands — Paid or Partially Paid. */
  payment_mode?: PaymentMode | null;
  /** YYYY-MM-DD. The server defaults it to today in IST when omitted. */
  tender_date?: string;
  payer_name?: string | null;
  payer_contact?: string | null;
}

export interface TenderUpdate {
  client_id?: string;
  tender_department_id?: string;
  quantity?: number;
  price?: string;
  status?: TenderStatus;
  paid_amount?: string | null;
  payment_mode?: PaymentMode | null;
  tender_date?: string;
  payer_name?: string | null;
  payer_contact?: string | null;
}

export interface TenderSummary {
  total_pending_value: string;
  total_paid_value: string;
  total_partially_paid_value: string;
  /** Unpaid balance across Pending and Partially Paid rows — what is still owed. */
  total_outstanding_value: string;
  pending_count: number;
  paid_count: number;
  partially_paid_count: number;
}

/** What one client still owes across every unpaid tender of theirs (CH-35). */
export interface ClientOutstanding {
  outstanding: string;
  unpaid_count: number;
}

export interface TenderSettlement {
  client_id: string;
  amount: string;
  payment_mode: PaymentMode;
  /** True asks the server for the plan without writing it. */
  preview?: boolean;
}

/** What one tender receives out of a settlement. */
export interface TenderAllocation {
  tender_id: string;
  tender_date: string;
  tender_department: string;
  total_amount: string;
  previously_paid: string;
  applied: string;
  new_paid_amount: string;
  new_status: TenderStatus;
}

export interface TenderSettlementResult {
  preview: boolean;
  amount_applied: string;
  outstanding_before: string;
  outstanding_after: string;
  allocations: TenderAllocation[];
}
