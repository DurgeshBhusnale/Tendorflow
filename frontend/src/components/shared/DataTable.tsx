import type { ReactNode } from "react";

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

export function DataTable<T>({
  columns,
  rows,
  rowKey,
  isLoading,
  empty,
}: DataTableProps<T>) {
  if (isLoading) {
    return <div className="p-4 text-sm text-muted-foreground">Loading…</div>;
  }
  if (rows.length === 0 && empty) {
    return <>{empty}</>;
  }

  return (
    <table className="w-full text-sm">
      <thead>
        <tr className="border-b text-left">
          {columns.map((col) => (
            <th
              key={col.header}
              className={`p-2 font-medium ${col.align === "right" ? "text-right" : ""}`}
            >
              {col.header}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => (
          <tr key={rowKey(row)} className="border-b">
            {columns.map((col) => (
              <td
                key={col.header}
                className={`p-2 ${col.align === "right" ? "text-right" : ""}`}
              >
                {col.cell(row)}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}
