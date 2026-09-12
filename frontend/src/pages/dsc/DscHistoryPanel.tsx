import { KeyRound, LogOut, Undo2, type LucideIcon } from "lucide-react";
import { DrawerBody } from "@/components/shared/Drawer";
import { formatDate } from "@/lib/format";
import { useDscKeyHistory } from "@/hooks/useDsc";
import type { DscEventType, DscKey } from "@/types/dsc";

const EVENT_ICONS: Record<DscEventType, LucideIcon> = {
  Created: KeyRound,
  Issued: LogOut,
  Returned: Undo2,
};

const EVENT_LABELS: Record<DscEventType, string> = {
  Created: "Key logged",
  Issued: "Issued out",
  Returned: "Returned to office",
};

/**
 * The full trail for one key: its creation, every issuance and every return
 * (CH-18).
 *
 * Keys backfilled when history tracking was added show only a creation entry —
 * who held them before that was never recorded.
 */
export function DscHistoryPanel({ dscKey }: { dscKey: DscKey }) {
  const { data: events, isLoading } = useDscKeyHistory(dscKey.id);

  return (
    <DrawerBody>
      <div className="border border-border bg-muted p-4">
        <p className="eyebrow">Client</p>
        <p className="font-medium text-foreground">{dscKey.client.contact_person_name}</p>
        <p className="text-sm text-muted-foreground">{dscKey.client.company_name}</p>
        <p className="mt-3 eyebrow">Current Status</p>
        <p className="font-medium text-foreground">{dscKey.key_status}</p>
        <p className="mt-3 eyebrow">Storage Location</p>
        <p className="text-sm text-foreground">
          {dscKey.storage_location_notes ?? "No location recorded"}
        </p>
      </div>

      {isLoading && <p className="text-sm text-muted-foreground">Loading…</p>}

      {!isLoading && (events?.length ?? 0) === 0 && (
        <p className="text-sm text-muted-foreground">No history recorded for this key.</p>
      )}

      <ol className="space-y-0">
        {events?.map((event, index) => {
          const Icon = EVENT_ICONS[event.event_type] ?? KeyRound;
          const isLast = index === events.length - 1;
          return (
            <li key={event.id} className="flex gap-3">
              {/* Icon rail doubles as the timeline: the connector is a border
                  on the icon's own column, so it can never fall out of step
                  with an entry's height. */}
              <div className="flex flex-col items-center">
                <span className="flex size-8 shrink-0 items-center justify-center border border-border bg-card">
                  <Icon className="size-4 text-muted-foreground" aria-hidden />
                </span>
                {!isLast && <span className="w-px flex-1 bg-border" />}
              </div>

              <div className={isLast ? "min-w-0 pb-1" : "min-w-0 pb-6"}>
                <p className="text-sm font-semibold text-foreground">
                  {EVENT_LABELS[event.event_type] ?? event.event_type}
                </p>
                <p className="text-xs text-muted-foreground">
                  {formatDate(event.created_at)} · {event.created_by?.full_name ?? "Unknown user"}
                </p>
                {event.issued_to && (
                  <p className="mt-1.5 text-sm text-foreground">
                    {event.event_type === "Returned" ? "Returned by" : "Held by"}{" "}
                    <span className="font-medium">{event.issued_to}</span>
                    {event.issued_phone && (
                      <span className="text-muted-foreground"> · {event.issued_phone}</span>
                    )}
                  </p>
                )}
                {event.notes && (
                  <p className="mt-1 text-xs italic text-muted-foreground">{event.notes}</p>
                )}
              </div>
            </li>
          );
        })}
      </ol>
    </DrawerBody>
  );
}
