import { Inbox } from "lucide-react";
import type { ComponentType, ReactNode } from "react";

interface EmptyStateProps {
  title: string;
  description?: string;
  /** Any lucide icon component; defaults to a neutral inbox glyph. */
  icon?: ComponentType<{ className?: string }>;
  action?: ReactNode;
}

/** Minimalist icon + descriptive text + primary action. */
export function EmptyState({ title, description, icon: Icon = Inbox, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center gap-3 px-6 py-16 text-center">
      <span className="flex size-11 items-center justify-center border border-border bg-muted">
        <Icon className="size-5 text-muted-foreground" />
      </span>
      <div className="space-y-1">
        <p className="font-display text-base font-semibold text-foreground">{title}</p>
        {description && <p className="max-w-sm text-sm text-muted-foreground">{description}</p>}
      </div>
      {action && <div className="mt-1">{action}</div>}
    </div>
  );
}
