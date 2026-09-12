import { FileText } from "lucide-react";
import { useAuth } from "@/auth/AuthContext";
import { DataTable, type Column } from "@/components/shared/DataTable";
import { EmptyState } from "@/components/shared/EmptyState";
import { RowActions } from "@/components/shared/RowActions";
import { StatusPill, type PillTone } from "@/components/shared/StatusPill";
import { formatCurrency, formatDate } from "@/lib/format";
import type { Tender, TenderStatus } from "@/types/tender";

const STATUS_TONES: Record<TenderStatus, PillTone> = {
  Paid: "green",
  "Partially Paid": "blue",
  Pending: "amber",
};

interface TendersTableProps {
  tenders: Tender[];
  isLoading: boolean;
  onEdit: (tender: Tender) => void;
  onDelete: (tender: Tender) => void;
  emptyAction?: React.ReactNode;
}

export function TendersTable({
  tenders,
  isLoading,
  onEdit,
  onDelete,
  emptyAction,
}: TendersTableProps) {
  const { isAdmin } = useAuth();

  // Column order is specified in CH-08: date first, then who touched it, then
  // the two client identities, then the money.
  const columns: Column<Tender>[] = [
    {
      header: "Date",
      cell: (t) => <span className="text-muted-foreground">{formatDate(t.created_at)}</span>,
    },
    {
      header: "Added/Updated By",
      cell: (t) => <span className="text-muted-foreground">{t.created_by?.full_name ?? "—"}</span>,
    },
    {
      header: "Client Name",
      mobile: "title",
      cell: (t) => (
        <span className="font-medium text-foreground">{t.client.contact_person_name}</span>
      ),
    },
    { header: "Company Name", cell: (t) => t.client.company_name },
    { header: "Tender Department", cell: (t) => t.tender_department.name },
    { header: "Quantity", cell: (t) => t.quantity, align: "right" },
    { header: "Price", cell: (t) => formatCurrency(t.price), align: "right" },
    {
      header: "Total Amount",
      cell: (t) => <span className="font-semibold">{formatCurrency(t.total_amount)}</span>,
      align: "right",
    },
    {
      header: "Paid Amount",
      cell: (t) => formatCurrency(t.paid_amount),
      align: "right",
    },
    {
      header: "Remaining Amount",
      // Its own column (CH-09): what a client still owes is the number this
      // table gets read for, and deriving it by eye from two others is exactly
      // the arithmetic the page should be doing.
      cell: (t) => (
        <span className={Number(t.remaining_amount) > 0 ? "font-semibold text-foreground" : ""}>
          {formatCurrency(t.remaining_amount)}
        </span>
      ),
      align: "right",
    },
    {
      header: "Status",
      cell: (t) => (
        <div className="flex flex-col items-start gap-1">
          <StatusPill label={t.status} tone={STATUS_TONES[t.status] ?? "slate"} />
          {t.payment_mode && (
            <span className="text-xs text-muted-foreground">{t.payment_mode}</span>
          )}
        </div>
      ),
    },
    {
      header: "Actions",
      align: "right",
      mobile: "actions",
      // Anyone may edit any tender (CH-19); only admins may delete one, since
      // `created_by` now names the last editor rather than an owner.
      cell: (t) => (
        <RowActions
          onEdit={() => onEdit(t)}
          onDelete={isAdmin ? () => onDelete(t) : undefined}
        />
      ),
    },
  ];

  return (
    <DataTable
      columns={columns}
      rows={tenders}
      rowKey={(t) => t.id}
      isLoading={isLoading}
      empty={
        <EmptyState
          icon={FileText}
          title="No tenders yet"
          description="Log a submission to start tracking quantity, price, and payment status per client."
          action={emptyAction}
        />
      }
    />
  );
}
