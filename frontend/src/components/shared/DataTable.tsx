import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

export interface Column<T> {
  header: string;
  cell: (row: T) => ReactNode;
  align?: "left" | "right";
}

interface DataTableProps<T> {
  columns: Column<T>[];
  rows: T[];
  rowKey: (row: T) => string;
  isLoading?: boolean;
  empty?: ReactNode;
}

/**
 * The one table in the app. Horizontal dividers only — no zebra striping —
 * and generous cell padding so dense operational data still scans cleanly.
 *
 * Cells never wrap; the container scrolls instead. Horizontal padding is 16px
 * rather than the design system's 24px because that is what keeps all nine
 * columns of the tenders table — Actions included — on a 1440px desktop.
 */
export function DataTable<T>({ columns, rows, rowKey, isLoading, empty }: DataTableProps<T>) {
  if (isLoading) {
    return <div className="px-6 py-16 text-center text-sm text-muted-foreground">Loading…</div>;
  }
  if (rows.length === 0 && empty) {
    return <>{empty}</>;
  }

  return (
    <div className="w-full overflow-x-auto">
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="border-b border-border">
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
              className="border-b border-divider transition-colors last:border-b-0 hover:bg-muted/60"
            >
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
  );
}
