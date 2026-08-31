import type { ComponentType } from "react";

interface MetricCardProps {
  label: string;
  value: string | number;
  /** Any lucide icon component, rendered as a quiet marker in the corner. */
  icon?: ComponentType<{ className?: string }>;
  hint?: string;
}

export function MetricCard({ label, value, icon: Icon, hint }: MetricCardProps) {
  return (
    <div className="surface p-6">
      <div className="flex items-start justify-between gap-4">
        <p className="eyebrow">{label}</p>
        {Icon && <Icon className="size-4 shrink-0 text-muted-foreground" />}
      </div>
      <p className="mt-3 text-3xl font-semibold tabular-nums tracking-tight text-foreground">
        {value}
      </p>
      {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}
