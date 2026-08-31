import { ArrowRight, Building2, Fingerprint, FileText, Wallet } from "lucide-react";
import { Link } from "react-router-dom";
import { MetricCard } from "@/components/shared/MetricCard";
import { PageHeader } from "@/components/shared/PageHeader";
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
    <section className="surface flex flex-col">
      <header className="flex items-center justify-between border-b border-border px-6 py-4">
        <h2 className="text-base">{title}</h2>
        <Link
          to={href}
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-primary transition-colors hover:text-primary/80"
        >
          View all
          <ArrowRight className="size-3.5" />
        </Link>
      </header>
      {isEmpty ? (
        <p className="px-6 py-12 text-center text-sm text-muted-foreground">{emptyLabel}</p>
      ) : (
        <div className="divide-y divide-divider">{children}</div>
      )}
    </section>
  );
}

function RecentTenderRow({ tender }: { tender: Tender }) {
  return (
    <div className="flex items-center justify-between gap-4 px-6 py-4">
      <div className="min-w-0">
        <p className="truncate text-sm font-medium text-foreground">{tender.client.company_name}</p>
        <p className="mt-0.5 truncate text-xs text-muted-foreground">
          {tender.tender_name.name} · {formatDate(tender.created_at)}
        </p>
      </div>
      <div className="flex shrink-0 items-center gap-4">
        <span className="text-sm font-semibold tabular-nums text-foreground">
          {formatCurrency(tender.total_amount)}
        </span>
        <StatusPill label={tender.status} tone={tender.status === "Paid" ? "green" : "amber"} />
      </div>
    </div>
  );
}

function RecentClientRow({ client }: { client: Client }) {
  return (
    <div className="flex items-center justify-between gap-4 px-6 py-4">
      <div className="min-w-0">
        <p className="truncate text-sm font-medium text-foreground">{client.company_name}</p>
        <p className="mt-0.5 truncate text-xs text-muted-foreground">
          {client.contact_person_name}
        </p>
      </div>
      <div className="shrink-0 text-right">
        <p className="text-xs text-muted-foreground">{formatDate(client.created_at)}</p>
        <p className="mt-0.5 text-xs text-muted-foreground">
          by {client.created_by?.full_name ?? "—"}
        </p>
      </div>
    </div>
  );
}

export default function DashboardPage() {
  const { data, isLoading, error } = useDashboardSummary();

  if (isLoading) {
    return <div className="px-8 py-16 text-center text-sm text-muted-foreground">Loading…</div>;
  }
  if (error) {
    return (
      <div className="p-8">
        <p className="border border-red-100 bg-red-50 px-4 py-3 text-sm text-destructive">
          {error.message}
        </p>
      </div>
    );
  }
  if (!data) return null;

  return (
    <div className="space-y-8 px-8 py-8">
      <PageHeader
        title="Dashboard"
        description="A snapshot of active clients, outstanding tender value, and the keys currently in the office."
      />

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          label="Total Active Clients"
          value={data.total_active_clients}
          icon={Building2}
        />
        <MetricCard label="Pending Tenders" value={data.pending_tenders_count} icon={FileText} />
        <MetricCard
          label="Total Tender Value (Paid)"
          value={formatCurrency(data.total_paid_tender_value)}
          icon={Wallet}
        />
        <MetricCard label="DSC Keys in Office" value={data.dsc_keys_in_office} icon={Fingerprint} />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
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
