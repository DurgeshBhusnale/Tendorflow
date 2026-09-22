import { Fragment, type ReactNode } from "react";

import { cn } from "@/lib/utils";

export interface Column<T> {
  header: string;
  cell: (row: T) => ReactNode;
  align?: "left" | "right";
  /**
   * How this column behaves in the stacked mobile layout.
   *  - `title`   heads the card (defaults to the first column)
   *  - `actions` sits opposite the title rather than in the detail list
   *  - `hide`    omitted on mobile, for columns the title already implies
   * Anything else becomes a label/value pair.
   */
  mobile?: "title" | "actions" | "hide";
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
 * horizontal dividers only, no zebra striping, generous cell padding. Below that
 * a table cannot work — nine columns on a 390px screen means either horizontal
 * scrolling to reach the actions or unreadable text — so each row becomes a card
 * with the key value as its heading and the rest as labelled pairs.
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
  if (isLoading) {
    return <div className="px-6 py-16 text-center text-sm text-muted-foreground">Loading…</div>;
  }
  if (rows.length === 0 && empty) {
    return <>{empty}</>;
  }

  const titleColumn = columns.find((col) => col.mobile === "title") ?? columns[0];
  const actionsColumn = columns.find((col) => col.mobile === "actions");
  const detailColumns = columns.filter(
    (col) => col !== titleColumn && col !== actionsColumn && col.mobile !== "hide",
  );

  const selectedOnPage = selection
    ? rows.filter((row) => selection.selectedIds.has(rowKey(row))).length
    : 0;
  const allOnPageSelected = selectedOnPage > 0 && selectedOnPage === rows.length;

  return (
    <>
      {/* Mobile: one card per row. */}
      <ul className="divide-y divide-divider md:hidden">
        {rows.map((row) => (
          <li
            key={rowKey(row)}
            className={cn("px-4 py-4", rowClassName?.(row))}
            onClick={onRowClick ? () => onRowClick(row) : undefined}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex min-w-0 items-start gap-3">
                {selection && (
                  <span className="pt-0.5">
                    <RowCheckbox
                      checked={selection.selectedIds.has(rowKey(row))}
                      onChange={() => selection.onToggle(rowKey(row))}
                      label="Select row"
                    />
                  </span>
                )}
                <div className="min-w-0 text-sm font-medium text-foreground">
                  {titleColumn?.cell(row)}
                </div>
              </div>
              {actionsColumn && <div className="shrink-0">{actionsColumn.cell(row)}</div>}
            </div>
            {detailColumns.length > 0 && (
              <dl className="mt-3 grid grid-cols-[minmax(0,8rem)_minmax(0,1fr)] gap-x-3 gap-y-2">
                {detailColumns.map((col) => (
                  <Fragment key={col.header}>
                    <dt className="eyebrow pt-0.5">{col.header}</dt>
                    <dd className="min-w-0 break-words text-sm text-foreground">{col.cell(row)}</dd>
                  </Fragment>
                ))}
              </dl>
            )}
          </li>
        ))}
      </ul>

      {/* Desktop: the real table. */}
      <div className="hidden w-full overflow-x-auto md:block">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="border-b border-border">
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
                    "eyebrow whitespace-nowrap px-4 py-3 text-left",
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
                  "border-b border-divider transition-colors last:border-b-0 hover:bg-muted/60",
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
                      "whitespace-nowrap px-4 py-4 align-middle text-foreground",
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
