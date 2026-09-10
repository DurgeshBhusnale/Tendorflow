import type { Client } from "@/types/client";
import type { Tender } from "@/types/tender";

export interface DashboardSummary {
  total_active_clients: number;
  pending_tenders_count: number;
  /**
   * Money as a string, parsed only for display. Null for employees — this is
   * revenue, and the server withholds it rather than trusting the UI to hide
   * the card (CH-12).
   */
  total_paid_tender_value: string | null;
  dsc_keys_in_office: number;
  recent_tenders: Tender[];
  recent_clients: Client[];
}
