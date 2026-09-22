import { Landmark } from "lucide-react";
import { useAuth } from "@/auth/AuthContext";
import { Avatar } from "@/components/shared/Avatar";
import { DataTable, type Column } from "@/components/shared/DataTable";
import { EmptyState } from "@/components/shared/EmptyState";
import { RowActions } from "@/components/shared/RowActions";
import { StatusPill, type PillTone } from "@/components/shared/StatusPill";
import { formatCurrency, formatDay } from "@/lib/format";
import type { Emd, EmdStatus } from "@/types/emd";

const STATUS_TONES: Record<EmdStatus, PillTone> = {
  "With Us": "blue",
  Returned: "green",
};

// Held money is blue rather than red: it is an open obligation, not a problem.
// Returned is green because that deposit is settled and needs no further action.
const STATUS_ROW_SHADES: Record<EmdStatus, string> = {
  "With Us": "bg-blue-100/70 hover:bg-blue-100",
  Returned: "bg-emerald-100/70 hover:bg-emerald-100",
};

interface EmdTableProps {
  emds: Emd[];
  isLoading: boolean;
  onEdit: (emd: Emd) => void;
  onDelete: (emd: Emd) => void;
  emptyAction?: React.ReactNode;
}

export function EmdTable({ emds, isLoading, onEdit, onDelete, emptyAction }: EmdTableProps) {
  const { isAdmin } = useAuth();

  const columns: Column<Emd>[] = [
    {
      header: "Date",
      cell: (e) => <span className="text-muted-foreground">{formatDay(e.emd_date)}</span>,
    },
    {
      // Contact name over company, as on the other record tables.
      header: "Client Name",
      mobile: "title",
      cell: (e) => (
        <span className="flex items-center gap-3">
          <Avatar name={e.client.contact_person_name} />
          <span className="min-w-0">
            <span className="block truncate font-semibold text-foreground">
              {e.client.contact_person_name}
            </span>
            <span className="block truncate text-[13px] text-muted-foreground">
              {e.client.company_name}
            </span>
          </span>
        </span>
      ),
    },
    {
      header: "Contact Number",
      cell: (e) => <span className="tabular-nums text-muted-foreground">{e.contact_number}</span>,
    },
    {
      header: "Amount",
      align: "right",
      cell: (e) => <span className="font-semibold">{formatCurrency(e.amount)}</span>,
    },
    {
      header: "Status",
      cell: (e) => <StatusPill label={e.status} tone={STATUS_TONES[e.status] ?? "slate"} />,
    },
    {
      header: "Added/Updated By",
      cell: (e) =>
        e.created_by ? (
          <span className="flex items-center gap-2">
            <Avatar name={e.created_by.full_name} size="sm" />
            <span className="truncate text-muted-foreground">{e.created_by.full_name}</span>
          </span>
        ) : (
          <span className="text-muted-foreground">—</span>
        ),
    },
    {
      header: "Actions",
      align: "right",
      mobile: "actions",
      // Anyone may edit a deposit (CH-19); only admins may delete one.
      cell: (e) => (
        <RowActions onEdit={() => onEdit(e)} onDelete={isAdmin ? () => onDelete(e) : undefined} />
      ),
    },
  ];

  return (
    <DataTable
      columns={columns}
      rows={emds}
      rowKey={(e) => e.id}
      isLoading={isLoading}
      rowClassName={(e) => STATUS_ROW_SHADES[e.status]}
      empty={
        <EmptyState
          icon={Landmark}
          title="No EMDs logged yet"
          description="Log a deposit taken from a client so the team can see what is still held."
          action={emptyAction}
        />
      }
    />
  );
}
