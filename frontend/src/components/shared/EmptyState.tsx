import type { ReactNode } from "react";

export function EmptyState({ title, action }: { title: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed p-8">
      <p className="text-sm text-muted-foreground">{title}</p>
      {action}
    </div>
  );
}
