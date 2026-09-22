import type { ComponentType } from "react";
import { cn } from "@/lib/utils";

/** Tinted icon chips, so a row of metrics is scannable by colour as well as label. */
const TONES = {
  indigo: "bg-primary/10 text-primary",
  amber: "bg-amber-50 text-amber-700",
  green: "bg-emerald-50 text-emerald-700",
  blue: "bg-blue-50 text-blue-700",
  violet: "bg-violet-50 text-violet-700",
  red: "bg-red-50 text-destructive",
  slate: "bg-muted text-muted-foreground",
} as const;

export type MetricTone = keyof typeof TONES;

interface MetricCardProps {
  label: string;
  value: string | number;
  /** Any lucide icon component, rendered in a tinted chip in the corner. */
  icon?: ComponentType<{ className?: string }>;
  hint?: string;
  tone?: MetricTone;
}

export function MetricCard({ label, value, icon: Icon, hint, tone = "indigo" }: MetricCardProps) {
  return (
    <div className="surface p-5">
      <div className="flex items-start justify-between gap-3">
        <p className="text-[13px] font-medium leading-5 text-muted-foreground">{label}</p>
        {Icon && (
          <span
            className={cn(
              "flex size-9 shrink-0 items-center justify-center rounded-lg",
              TONES[tone],
            )}
          >
            <Icon className="size-[18px]" />
          </span>
        )}
      </div>
      <p className="mt-3.5 text-3xl font-bold tabular-nums tracking-[-0.03em] text-foreground">
        {value}
      </p>
      {hint && <p className="mt-2 text-xs leading-5 text-muted-foreground">{hint}</p>}
    </div>
  );
}
