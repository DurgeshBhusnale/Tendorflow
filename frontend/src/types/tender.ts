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
  /** Whoever last edited the row, not necessarily who first logged it. */
  created_by: { id: string; full_name: string } | null;
  /** When the tender was logged. What the date filter and ordering use. */
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
}

export interface TenderUpdate {
  client_id?: string;
  tender_department_id?: string;
  quantity?: number;
  price?: string;
  status?: TenderStatus;
  paid_amount?: string | null;
  payment_mode?: PaymentMode | null;
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
