import { useAuth } from "@/auth/AuthContext";
import { DataTable, type Column } from "@/components/shared/DataTable";
import { EmptyState } from "@/components/shared/EmptyState";
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
    { header: "Client", cell: (t) => t.client.company_name },
    { header: "Tender Name", cell: (t) => t.tender_name.name },
    { header: "Quantity", cell: (t) => t.quantity, align: "right" },
    { header: "Price", cell: (t) => formatCurrency(t.price), align: "right" },
    { header: "Total Amount", cell: (t) => formatCurrency(t.total_amount), align: "right" },
    {
      header: "Status",
      cell: (t) => (
        <StatusPill label={t.status} tone={t.status === "Paid" ? "green" : "amber"} />
      ),
    },
    { header: "Added By", cell: (t) => t.created_by?.full_name ?? "—" },
    { header: "Date", cell: (t) => formatDate(t.created_at) },
    {
      header: "Actions",
      cell: (t) =>
        canModify(t) ? (
          <div className="flex gap-2">
            {t.status === "Pending" && (
              <Button variant="outline" size="sm" onClick={() => onMarkPaid(t)}>
                Mark Paid
              </Button>
            )}
            <Button variant="outline" size="sm" onClick={() => onEdit(t)}>
              Edit
            </Button>
            <Button variant="outline" size="sm" onClick={() => onDelete(t)}>
              Delete
            </Button>
          </div>
        ) : (
          <span className="text-muted-foreground">—</span>
        ),
    },
  ];

  return (
    <DataTable
      columns={columns}
      rows={tenders}
      rowKey={(t) => t.id}
      isLoading={isLoading}
      empty={<EmptyState title="No tenders yet" action={emptyAction} />}
    />
  );
}
