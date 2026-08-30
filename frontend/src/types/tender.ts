export type TenderStatus = "Paid" | "Pending";

export interface Tender {
  id: string;
  client: { id: string; company_name: string };
  tender_name: { id: string; name: string };
  quantity: number;
  /** Money is a string to preserve decimal precision — parse only for display. */
  price: string;
  /** Computed by Postgres as quantity * price. Never sent by the client. */
  total_amount: string;
  status: TenderStatus;
  created_by: { id: string; full_name: string } | null;
  created_at: string;
}

export interface TenderCreate {
  client_id: string;
  tender_name_id: string;
  quantity: number;
  price: string;
  status?: TenderStatus;
}

export interface TenderUpdate {
  client_id?: string;
  tender_name_id?: string;
  quantity?: number;
  price?: string;
  status?: TenderStatus;
}

export interface TenderSummary {
  total_pending_value: string;
  total_paid_value: string;
  pending_count: number;
  paid_count: number;
}
