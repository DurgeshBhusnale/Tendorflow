import type { Client } from "@/types/client";
import type { Tender } from "@/types/tender";

export interface DashboardSummary {
  total_active_clients: number;
  pending_tenders_count: number;
  /** Money as a string, parsed only for display. */
  total_paid_tender_value: string;
  dsc_keys_in_office: number;
  recent_tenders: Tender[];
  recent_clients: Client[];
}
