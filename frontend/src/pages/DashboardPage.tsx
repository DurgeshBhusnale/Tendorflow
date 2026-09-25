import { ArrowRight, Building2, Fingerprint, FileText, Wallet } from "lucide-react";
import { Link } from "react-router-dom";
import { Avatar } from "@/components/shared/Avatar";
import { MetricCard } from "@/components/shared/MetricCard";
import { PageHeader } from "@/components/shared/PageHeader";
import { StatusPill } from "@/components/shared/StatusPill";
import { useDashboardSummary } from "@/hooks/useDashboard";
import { formatCurrency, formatDate, formatDay } from "@/lib/format";
import { cn } from "@/lib/utils";
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
      <header className="flex items-center justify-between gap-4 px-4 py-4 sm:px-5">
        <h2 className="text-base">{title}</h2>
        <Link
          to={href}
          className="inline-flex items-center gap-1.5 rounded-md text-[13px] font-semibold text-primary transition-colors hover:text-primary/80"
        >
          View all
          <ArrowRight className="size-3.5" />
        </Link>
      </header>
      {isEmpty ? (
        <p className="px-4 py-12 text-center text-sm text-muted-foreground sm:px-6">{emptyLabel}</p>
      ) : (
        <div className="divide-y divide-divider border-t border-divider">{children}</div>
      )}
    </section>
  );
}

function RecentTenderRow({ tender }: { tender: Tender }) {
  return (
    <div className="flex items-center justify-between gap-3 px-4 py-3 sm:gap-4 sm:px-5 sm:py-3.5">
      <div className="flex min-w-0 items-center gap-3">
        <Avatar name={tender.client.contact_person_name} />
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-foreground">
            {tender.client.contact_person_name}
          </p>
          <p className="mt-0.5 truncate text-xs text-muted-foreground">
            {tender.client.company_name} · {tender.tender_department.name} ·{" "}
            {formatDay(tender.tender_date)}
          </p>
        </div>
      </div>
      {/* Figure over pill on a phone, side by side once there is room. */}
      <div className="flex shrink-0 flex-col items-end gap-1.5 sm:flex-row sm:items-center sm:gap-4">
        <span className="text-sm font-bold tabular-nums text-foreground">
          {formatCurrency(tender.total_amount)}
        </span>
        <StatusPill
          label={tender.status}
          tone={
            tender.status === "Paid" ? "green" : tender.status === "Partially Paid" ? "blue" : "amber"
          }
        />
      </div>
    </div>
  );
}

function RecentClientRow({ client }: { client: Client }) {
  return (
    <div className="flex items-center justify-between gap-3 px-4 py-3 sm:gap-4 sm:px-5 sm:py-3.5">
      <div className="flex min-w-0 items-center gap-3">
        <Avatar name={client.company_name} />
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-foreground">{client.company_name}</p>
          <p className="mt-0.5 truncate text-xs text-muted-foreground">
            {client.contact_person_name}
          </p>
        </div>
      </div>
      <div className="shrink-0 text-right">
        <p className="text-xs text-muted-foreground">{formatDate(client.created_at)}</p>
        {/* Who onboarded them is desktop detail; the phone row keeps the date. */}
        <p className="mt-0.5 hidden text-xs text-muted-foreground sm:block">
          by {client.created_by?.full_name ?? "—"}
        </p>
      </div>
    </div>
  );
}

export default function DashboardPage() {
  const { data, isLoading, error } = useDashboardSummary();

  if (isLoading) {
    return <div className="px-4 py-16 text-center text-sm text-muted-foreground">Loading…</div>;
  }
  if (error) {
    return (
      <div className="p-4 sm:p-8">
        <p className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-destructive">
          {error.message}
        </p>
      </div>
    );
  }
  if (!data) return null;

  return (
    <div className="page">
      <PageHeader
        title="Dashboard"
        description="A snapshot of active clients, outstanding tender value, and the keys currently in the office."
      />

      {/* Three cards for employees, four for admins: paid tender value comes
          back null for anyone who is not an admin (CH-12). */}
      <div
        className={cn(
          "grid grid-cols-2 gap-3 sm:gap-4",
          data.total_paid_tender_value === null ? "xl:grid-cols-3" : "xl:grid-cols-4",
        )}
      >
        <MetricCard
          label="Total Active Clients"
          value={data.total_active_clients}
          icon={Building2}
          tone="indigo"
          hint="Onboarded to the workspace"
        />
        <MetricCard
          label="Pending Tenders"
          value={data.pending_tenders_count}
          icon={FileText}
          tone="amber"
          hint="Awaiting a first payment"
        />
        {data.total_paid_tender_value !== null && (
          <MetricCard
            label="Total Tender Value (Paid)"
            value={formatCurrency(data.total_paid_tender_value)}
            icon={Wallet}
            tone="green"
            hint="Collected on fully settled tenders"
          />
        )}
        <MetricCard
          label="DSC Keys in Office"
          value={data.dsc_keys_in_office}
          icon={Fingerprint}
          tone="violet"
          hint="Held on site, not issued out"
        />
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
