import type { ReactNode } from "react";
import { useLocation } from "react-router-dom";
import { navGroups } from "@/lib/nav";

interface PageHeaderProps {
  title: string;
  description?: string;
  actions?: ReactNode;
}

/**
 * Where the current route sits in the nav, as `Section / Page`.
 *
 * Derived from `lib/nav.ts` rather than passed in, so a page added to the rail
 * gets its trail for free and the two can't drift. Pages that aren't in the
 * rail simply get no trail.
 */
function useTrail(): [string, string] | null {
  const { pathname } = useLocation();
  for (const group of navGroups) {
    for (const item of group.items) {
      if (pathname === item.to || pathname.startsWith(`${item.to}/`)) {
        return [group.label ?? "Workspace", item.label];
      }
    }
  }
  return null;
}

/** Breadcrumb, page title and supporting line, with actions pinned right. */
export function PageHeader({ title, description, actions }: PageHeaderProps) {
  const trail = useTrail();

  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between sm:gap-6">
      <div className="min-w-0 space-y-1.5">
        {trail && (
          <p className="flex items-center gap-2 text-[13px] text-muted-foreground">
            <span className="truncate">{trail[0]}</span>
            <span aria-hidden className="text-border">
              /
            </span>
            <span className="truncate font-medium text-foreground/80">{trail[1]}</span>
          </p>
        )}
        <h1 className="text-2xl leading-tight sm:text-[28px]">{title}</h1>
        {description && (
          <p className="max-w-3xl text-sm leading-relaxed text-muted-foreground">{description}</p>
        )}
      </div>
      {actions && <div className="flex shrink-0 items-center gap-2.5">{actions}</div>}
    </div>
  );
}
