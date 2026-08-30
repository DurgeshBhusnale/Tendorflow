import { Link } from "react-router-dom";
import { MetricCard } from "@/components/shared/MetricCard";
import { StatusPill } from "@/components/shared/StatusPill";
import { useDashboardSummary } from "@/hooks/useDashboard";
import { formatCurrency, formatDate } from "@/lib/format";
import type { Client } from "@/types/client";
import type { Tender } from "@/types/tender";

function Panel({
  title,
  href,
  isEmpty,
  emptyLabel,
  children,
}: {
  title: string;
  href: string;
  isEmpty: boolean;
  emptyLabel: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-lg border">
      <header className="flex items-center justify-between border-b px-4 py-3">
        <h2 className="font-medium">{title}</h2>
        <Link to={href} className="text-sm text-muted-foreground underline">
          View all
        </Link>
      </header>
      {isEmpty ? (
        <p className="px-4 py-6 text-sm text-muted-foreground">{emptyLabel}</p>
      ) : (
        <div className="divide-y">{children}</div>
      )}
    </section>
  );
}

function RecentTenderRow({ tender }: { tender: Tender }) {
  return (
    <div className="flex items-center justify-between gap-3 px-4 py-3 text-sm">
      <div className="min-w-0">
        <p className="truncate font-medium">{tender.client.company_name}</p>
        <p className="text-muted-foreground">
          {tender.tender_name.name} · {formatDate(tender.created_at)}
        </p>
      </div>
      <div className="flex shrink-0 items-center gap-3">
        <span className="tabular-nums">{formatCurrency(tender.total_amount)}</span>
        <StatusPill
          label={tender.status}
          tone={tender.status === "Paid" ? "green" : "amber"}
        />
      </div>
    </div>
  );
}

function RecentClientRow({ client }: { client: Client }) {
  return (
    <div className="flex items-center justify-between gap-3 px-4 py-3 text-sm">
      <div className="min-w-0">
        <p className="truncate font-medium">{client.company_name}</p>
        <p className="truncate text-muted-foreground">{client.contact_person_name}</p>
      </div>
      <div className="shrink-0 text-right text-muted-foreground">
        <p>{formatDate(client.created_at)}</p>
        <p className="text-xs">by {client.created_by?.full_name ?? "—"}</p>
      </div>
    </div>
  );
}

export default function DashboardPage() {
  const { data, isLoading, error } = useDashboardSummary();

  if (isLoading) {
    return <div className="p-6">Loading…</div>;
  }
  if (error) {
    return <div className="p-6 text-red-600">{error.message}</div>;
  }
  if (!data) return null;

  return (
    <div className="space-y-6 p-6">
      <h1 className="text-xl font-semibold">Dashboard</h1>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="Total Active Clients" value={data.total_active_clients} />
        <MetricCard label="Pending Tenders" value={data.pending_tenders_count} />
        <MetricCard
          label="Total Tender Value (Paid)"
          value={formatCurrency(data.total_paid_tender_value)}
        />
        <MetricCard label="DSC Keys in Office" value={data.dsc_keys_in_office} />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Panel
          title="Recent Tenders"
          href="/tenders"
          isEmpty={data.recent_tenders.length === 0}
          emptyLabel="No tenders logged yet."
        >
          {data.recent_tenders.map((tender) => (
            <RecentTenderRow key={tender.id} tender={tender} />
          ))}
        </Panel>

        <Panel
          title="Recent Client Onboarding"
          href="/clients"
          isEmpty={data.recent_clients.length === 0}
          emptyLabel="No clients onboarded yet."
        >
          {data.recent_clients.map((client) => (
            <RecentClientRow key={client.id} client={client} />
          ))}
        </Panel>
      </div>
    </div>
  );
}
