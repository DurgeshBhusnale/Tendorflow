import { FileText } from "lucide-react";
import { useAuth } from "@/auth/AuthContext";
import { Avatar } from "@/components/shared/Avatar";
import { DataTable, type Column } from "@/components/shared/DataTable";
import { EmptyState } from "@/components/shared/EmptyState";
import { RowActions } from "@/components/shared/RowActions";
import { StatusPill, type PillTone } from "@/components/shared/StatusPill";
import { formatCurrency, formatDay } from "@/lib/format";
import type { Tender, TenderStatus } from "@/types/tender";

const STATUS_TONES: Record<TenderStatus, PillTone> = {
  Paid: "green",
  "Partially Paid": "blue",
  Pending: "amber",
};

// Payment state shades the whole row, not just the pill (CH-23): what is still
// owed is what this table gets scanned for. The hover tint is restated so the
// shade doesn't disappear under the cursor.
// Desktop only (CH-30): on a phone a full-bleed tint behind every row reads as
// an error state, and the amount and pill already carry the status there.
const STATUS_ROW_SHADES: Record<TenderStatus, string> = {
  Pending: "md:bg-red-100/70 md:hover:bg-red-100",
  "Partially Paid": "md:bg-blue-100/70 md:hover:bg-blue-100",
  Paid: "md:bg-emerald-100/70 md:hover:bg-emerald-100",
};

interface TendersTableProps {
  tenders: Tender[];
  isLoading: boolean;
  onEdit: (tender: Tender) => void;
  onDelete: (tender: Tender) => void;
  emptyAction?: React.ReactNode;
  /** Passed straight to DataTable; the page supplies it for admins only (CH-29). */
  selection?: {
    selectedIds: Set<string>;
    onToggle: (id: string) => void;
    onToggleAll: () => void;
  };
}

export function TendersTable({
  tenders,
  isLoading,
  onEdit,
  onDelete,
  emptyAction,
  selection,
}: TendersTableProps) {
  const { isAdmin } = useAuth();

  // Column order is specified in CH-08: date first, then who touched it, then
  // the two client identities, then the money.
  const columns: Column<Tender>[] = [
    {
      header: "Date",
      cell: (t) => <span className="text-muted-foreground">{formatDay(t.tender_date)}</span>,
    },
    {
      header: "Added/Updated By",
      cell: (t) =>
        t.created_by ? (
          <span className="flex items-center gap-2">
            <Avatar name={t.created_by.full_name} size="sm" />
            <span className="truncate text-muted-foreground">{t.created_by.full_name}</span>
          </span>
        ) : (
          <span className="text-muted-foreground">—</span>
        ),
    },
    {
      // Contact name over company: the two ways people refer to the same
      // client, in the width one column used to take.
      header: "Client Name",
      mobile: "title",
      cell: (t) => (
        <span className="flex items-center gap-3">
          <Avatar name={t.client.contact_person_name} />
          <span className="min-w-0">
            <span className="block truncate font-semibold text-foreground">
              {t.client.contact_person_name}
            </span>
            {/* The desktop table has a Date column; the phone row does not,
                and a tender without its date is half a record (CH-30). Two
                lines rather than a nested span, so each one truncates. */}
            <span className="block truncate text-[13px] text-muted-foreground md:hidden">
              {formatDay(t.tender_date)} · {t.client.company_name}
            </span>
            <span className="hidden truncate text-[13px] text-muted-foreground md:block">
              {t.client.company_name}
            </span>
          </span>
        </span>
      ),
    },
    {
      header: "Tender Department",
      cell: (t) => (
        <span className="inline-flex items-center rounded-md bg-muted px-2 py-1 text-xs font-semibold text-muted-foreground">
          {t.tender_department.name}
        </span>
      ),
    },
    { header: "Quantity", cell: (t) => t.quantity, align: "right" },
    { header: "Price", cell: (t) => formatCurrency(t.price), align: "right" },
    {
      header: "Total Amount",
      cell: (t) => <span className="font-semibold">{formatCurrency(t.total_amount)}</span>,
      align: "right",
      mobile: "amount",
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
      mobile: "status",
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
      header: "Received From",
      cell: (t) =>
        t.payer_name || t.payer_contact ? (
          <span className="min-w-0">
            <span className="block truncate text-foreground">{t.payer_name ?? "—"}</span>
            {t.payer_contact && (
              <span className="block truncate text-[13px] tabular-nums text-muted-foreground">
                {t.payer_contact}
              </span>
            )}
          </span>
        ) : (
          <span className="text-muted-foreground">—</span>
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
      rowClassName={(t) => STATUS_ROW_SHADES[t.status]}
      selection={selection}
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
