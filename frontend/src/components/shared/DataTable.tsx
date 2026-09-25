import { ChevronRight, X } from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";

import { SheetActions } from "@/components/shared/RowActions";
import { cn } from "@/lib/utils";

export interface Column<T> {
  header: string;
  cell: (row: T) => ReactNode;
  align?: "left" | "right";
  /**
   * What this column does in the phone layout (CH-30).
   *
   * A phone row identifies a record; it does not reproduce it. Only the four
   * roles below are drawn in the row — everything else waits in the detail
   * sheet a tap away, which is also where the row's actions live.
   *
   *  - `title`   the row's heading (defaults to the first column)
   *  - `amount`  the figure, right-aligned and bold
   *  - `status`  the pill, under the amount
   *  - `actions` the row's buttons — moved into the sheet's footer
   *  - `hide`    dropped from the row *and* the sheet, for what the title implies
   * Anything else is a labelled pair inside the sheet only.
   */
  mobile?: "title" | "amount" | "status" | "actions" | "hide";
}

interface DataTableProps<T> {
  columns: Column<T>[];
  rows: T[];
  rowKey: (row: T) => string;
  isLoading?: boolean;
  empty?: ReactNode;
  /**
   * Per-row classes, applied to both renderings. For flagging a row's state in
   * the row itself rather than only in a status pill — a DSC key that is out of
   * the office, say (CH-16).
   */
  rowClassName?: (row: T) => string | undefined;
  /** Makes rows activatable. Keep it off tables whose rows have no detail view. */
  onRowClick?: (row: T) => void;
  /**
   * Adds a leading checkbox column for bulk actions (CH-29). Omit it entirely
   * where the user cannot act on a selection — a checkbox that leads nowhere is
   * worse than none — so callers gate this on the permission themselves.
   *
   * `onToggleAll` covers the rows currently rendered, never the whole filter:
   * the page must not select what it is not showing.
   */
  selection?: {
    selectedIds: Set<string>;
    onToggle: (id: string) => void;
    onToggleAll: () => void;
  };
}

/** Square, indigo, and indeterminate when only some of the page is selected. */
function RowCheckbox({
  checked,
  indeterminate,
  onChange,
  label,
}: {
  checked: boolean;
  indeterminate?: boolean;
  onChange: () => void;
  label: string;
}) {
  return (
    <input
      type="checkbox"
      checked={checked}
      ref={(el) => {
        if (el) el.indeterminate = Boolean(indeterminate) && !checked;
      }}
      onChange={onChange}
      // The row itself may be clickable, and a tick is not a navigation.
      onClick={(event) => event.stopPropagation()}
      aria-label={label}
      className="size-4 cursor-pointer accent-primary"
    />
  );
}

/**
 * The one table in the app.
 *
 * Two renderings of the same `columns` config. From `md` up it is a real table:
 * horizontal dividers only, no zebra striping, generous cell padding.
 *
 * Below that a table cannot work, and neither could the stacked card it used to
 * become — printing eleven labelled fields per record turned a list into a
 * stack of forms. A phone row now carries four things at most (title, amount,
 * status, and a chevron), and the rest opens in a detail sheet on tap: the same
 * `columns` config, rendered as labelled pairs, with the row's actions in the
 * footer (CH-30).
 */
export function DataTable<T>({
  columns,
  rows,
  rowKey,
  isLoading,
  empty,
  rowClassName,
  onRowClick,
  selection,
}: DataTableProps<T>) {
  const [openKey, setOpenKey] = useState<string | null>(null);

  // Escape closes the sheet, and the page behind it must not scroll under it.
  useEffect(() => {
    if (openKey === null) return;
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpenKey(null);
    }
    document.addEventListener("keydown", onKeyDown);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [openKey]);

  if (isLoading) {
    return <div className="px-6 py-16 text-center text-sm text-muted-foreground">Loading…</div>;
  }
  if (rows.length === 0 && empty) {
    return <>{empty}</>;
  }

  const titleColumn = columns.find((col) => col.mobile === "title") ?? columns[0];
  const actionsColumn = columns.find((col) => col.mobile === "actions");
  const amountColumn = columns.find((col) => col.mobile === "amount");
  const statusColumn = columns.find((col) => col.mobile === "status");
  const detailColumns = columns.filter(
    (col) => col !== titleColumn && col !== actionsColumn && col.mobile !== "hide",
  );

  const selectedOnPage = selection
    ? rows.filter((row) => selection.selectedIds.has(rowKey(row))).length
    : 0;
  const allOnPageSelected = selectedOnPage > 0 && selectedOnPage === rows.length;

  // Re-found rather than stored, so the sheet follows a refetch of its row.
  const openRow = openKey === null ? null : rows.find((row) => rowKey(row) === openKey);

  return (
    <>
      {/* Mobile: an identifying row, with the record itself one tap away. */}
      {selection && rows.length > 0 && (
        // The desktop select-all lives in the table header, which a phone has
        // no room for, so bulk actions were one-by-one there until now.
        <label className="flex items-center gap-3 border-b border-divider bg-muted/50 px-4 py-2.5 text-[13px] font-semibold text-muted-foreground md:hidden">
          <RowCheckbox
            checked={allOnPageSelected}
            indeterminate={selectedOnPage > 0}
            onChange={selection.onToggleAll}
            label="Select all rows on this page"
          />
          {allOnPageSelected ? "Deselect all" : `Select all ${rows.length}`}
        </label>
      )}
      <ul className="divide-y divide-divider md:hidden">
        {rows.map((row) => (
          <li
            key={rowKey(row)}
            className={cn("flex items-center gap-2 pl-4 pr-1", rowClassName?.(row))}
          >
            {selection && (
              <RowCheckbox
                checked={selection.selectedIds.has(rowKey(row))}
                onChange={() => selection.onToggle(rowKey(row))}
                label="Select row"
              />
            )}
            <button
              type="button"
              // A row with its own detail view keeps it (DSC opens history);
              // everything else opens the sheet.
              onClick={() => (onRowClick ? onRowClick(row) : setOpenKey(rowKey(row)))}
              className="flex min-w-0 flex-1 items-center gap-3 py-3 pr-3 text-left transition-colors active:bg-accent"
            >
              <span className="min-w-0 flex-1 text-sm text-foreground">{titleColumn?.cell(row)}</span>
              {(amountColumn || statusColumn) && (
                <span className="flex shrink-0 flex-col items-end gap-1.5">
                  {amountColumn && (
                    <span className="text-[15px] font-bold tabular-nums text-foreground">
                      {amountColumn.cell(row)}
                    </span>
                  )}
                  {statusColumn && <span>{statusColumn.cell(row)}</span>}
                </span>
              )}
              {/* The chevron is the affordance for "there is more behind
                  this row" — dropped where the row carries its own buttons,
                  which say the same thing and need the width more. */}
              {!(onRowClick && actionsColumn) && (
                <ChevronRight className="size-[18px] shrink-0 text-muted-foreground/50" />
              )}
            </button>
            {/* A row that opens its own detail view never opens the sheet, so
                its actions would be unreachable on a phone (DSC keys). They
                ride along in the row instead. */}
            {onRowClick && actionsColumn && (
              <span className="shrink-0 pr-2">{actionsColumn.cell(row)}</span>
            )}
          </li>
        ))}
      </ul>

      {openRow !== null && openRow !== undefined && (
        <div className="fixed inset-0 z-50 flex items-end md:hidden">
          <div
            className="absolute inset-0 animate-fade-in bg-ink/45"
            onClick={() => setOpenKey(null)}
            aria-hidden
          />
          <section
            role="dialog"
            aria-modal="true"
            aria-label="Record detail"
            className="relative flex max-h-[85dvh] w-full flex-col rounded-t-2xl bg-card shadow-pop"
          >
            <div className="flex justify-center pb-1 pt-2.5">
              <span aria-hidden className="h-1 w-10 rounded-full bg-border" />
            </div>
            <header className="flex items-start gap-3 px-4 pb-4 pt-2">
              <div className="min-w-0 flex-1 text-sm text-foreground">
                {titleColumn?.cell(openRow)}
              </div>
              <button
                type="button"
                onClick={() => setOpenKey(null)}
                aria-label="Close"
                className="flex size-10 shrink-0 items-center justify-center rounded-lg border border-border text-muted-foreground"
              >
                <X className="size-4" />
              </button>
            </header>
            <div className="min-h-0 flex-1 overflow-y-auto px-4">
              <dl className="divide-y divide-divider rounded-xl border border-border">
                {detailColumns.map((col) => (
                  <div
                    key={col.header}
                    className="flex items-start justify-between gap-4 px-3.5 py-3"
                  >
                    <dt className="shrink-0 text-[13px] text-muted-foreground">{col.header}</dt>
                    <dd className="min-w-0 break-words text-right text-[13.5px] font-semibold text-foreground">
                      {col.cell(openRow)}
                    </dd>
                  </div>
                ))}
              </dl>
            </div>
            {actionsColumn && (
              <div className="flex gap-2 border-t border-border px-4 pb-[max(env(safe-area-inset-bottom,0px),16px)] pt-3">
                {/* Acting on the record closes the sheet: what opens next (a
                    form drawer, a confirmation) owns the screen from here. */}
                <div
                  onClick={() => setOpenKey(null)}
                  className="flex flex-1 [&_button]:h-12 [&_button]:text-sm"
                >
                  <SheetActions>{actionsColumn.cell(openRow)}</SheetActions>
                </div>
              </div>
            )}
          </section>
        </div>
      )}

      {/* Desktop: the real table. */}
      <div className="hidden w-full overflow-x-auto md:block">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="border-y border-border bg-muted/60">
              {selection && (
                <th scope="col" className="w-10 px-4 py-3">
                  <RowCheckbox
                    checked={allOnPageSelected}
                    indeterminate={selectedOnPage > 0}
                    onChange={selection.onToggleAll}
                    label="Select all rows on this page"
                  />
                </th>
              )}
              {columns.map((col) => (
                <th
                  key={col.header}
                  scope="col"
                  className={cn(
                    // Tighter than the cards and drawers around it: an
                    // eleven-column table has to fit a 1440px desktop before
                    // it is allowed to be comfortable.
                    "eyebrow whitespace-nowrap px-3 py-3 text-left first:pl-5 last:pr-5",
                    col.align === "right" && "text-right",
                  )}
                >
                  {col.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr
                key={rowKey(row)}
                onClick={onRowClick ? () => onRowClick(row) : undefined}
                className={cn(
                  "border-b border-divider transition-colors last:border-b-0 hover:bg-accent",
                  onRowClick && "cursor-pointer",
                  rowClassName?.(row),
                )}
              >
                {selection && (
                  <td className="w-10 px-4 py-4 align-middle">
                    <RowCheckbox
                      checked={selection.selectedIds.has(rowKey(row))}
                      onChange={() => selection.onToggle(rowKey(row))}
                      label="Select row"
                    />
                  </td>
                )}
                {columns.map((col) => (
                  <td
                    key={col.header}
                    className={cn(
                      "whitespace-nowrap px-3 py-3.5 align-middle text-foreground first:pl-5 last:pr-5",
                      col.align === "right" && "text-right tabular-nums",
                    )}
                  >
                    {col.cell(row)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
