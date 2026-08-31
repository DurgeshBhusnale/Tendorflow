import { CheckCircle2, FileText } from "lucide-react";
import { useAuth } from "@/auth/AuthContext";
import { DataTable, type Column } from "@/components/shared/DataTable";
import { EmptyState } from "@/components/shared/EmptyState";
import { NoActions, RowActions } from "@/components/shared/RowActions";
import { StatusPill } from "@/components/shared/StatusPill";
import { Button } from "@/components/ui/button";
import { formatCurrency, formatDate } from "@/lib/format";
import type { Tender } from "@/types/tender";

interface TendersTableProps {
  tenders: Tender[];
  isLoading: boolean;
  onEdit: (tender: Tender) => void;
  onDelete: (tender: Tender) => void;
  onMarkPaid: (tender: Tender) => void;
  emptyAction?: React.ReactNode;
}

export function TendersTable({
  tenders,
  isLoading,
  onEdit,
  onDelete,
  onMarkPaid,
  emptyAction,
}: TendersTableProps) {
  const { user, isAdmin } = useAuth();

  // Mirrors the backend ownership rule; the server enforces it regardless.
  const canModify = (tender: Tender) => isAdmin || tender.created_by?.id === user?.id;

  const columns: Column<Tender>[] = [
    {
      header: "Client",
      cell: (t) => <span className="font-medium text-foreground">{t.client.company_name}</span>,
    },
    { header: "Tender Name", cell: (t) => t.tender_name.name },
    { header: "Quantity", cell: (t) => t.quantity, align: "right" },
    { header: "Price", cell: (t) => formatCurrency(t.price), align: "right" },
    {
      header: "Total Amount",
      cell: (t) => <span className="font-semibold">{formatCurrency(t.total_amount)}</span>,
      align: "right",
    },
    {
      header: "Status",
      cell: (t) => <StatusPill label={t.status} tone={t.status === "Paid" ? "green" : "amber"} />,
    },
    {
      header: "Added By",
      cell: (t) => <span className="text-muted-foreground">{t.created_by?.full_name ?? "—"}</span>,
    },
    {
      header: "Date",
      cell: (t) => <span className="text-muted-foreground">{formatDate(t.created_at)}</span>,
    },
    {
      header: "Actions",
      align: "right",
      cell: (t) =>
        canModify(t) ? (
          <RowActions onEdit={() => onEdit(t)} onDelete={() => onDelete(t)}>
            {t.status === "Pending" && (
              <Button
                variant="outline"
                size="icon"
                onClick={() => onMarkPaid(t)}
                aria-label="Mark Paid"
                title="Mark Paid"
                className="text-emerald-600 hover:bg-emerald-50 hover:text-emerald-700"
              >
                <CheckCircle2 />
              </Button>
            )}
          </RowActions>
        ) : (
          <NoActions />
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
