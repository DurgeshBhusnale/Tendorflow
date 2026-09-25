import { ArrowLeft, Plus } from "lucide-react";
import type { ReactNode } from "react";
import { Link, useLocation } from "react-router-dom";
import { primaryTabs } from "@/lib/nav";
import { cn } from "@/lib/utils";

interface PageHeaderProps {
  title: string;
  description?: string;
  actions?: ReactNode;
  /**
   * The page's primary action, as a phone floating button (CH-30). Pass the
   * same handler the `actions` button uses: below `sm` the header's buttons
   * are hidden and this is what the user taps, in the thumb zone rather than
   * at the top of a scrolling page.
   */
  primaryAction?: { label: string; onClick: () => void };
}

/**
 * The page's title block — and, on a phone, its app bar (CH-30).
 *
 * Mobile keeps the bar to one line: a back arrow for pages that have no tab of
 * their own, the title, and nothing else. The supporting sentence is desktop
 * only; on a 390px screen it pushed the first row of data below the fold to say
 * something the user learns once.
 */
export function PageHeader({ title, description, actions, primaryAction }: PageHeaderProps) {
  const { pathname } = useLocation();
  const isTabRoot = primaryTabs.some((tab) => tab.to === pathname);

  return (
    <>
      <div
        className={cn(
          // Phone: a real app bar — full-bleed navy, the same surface the
          // desktop rail uses, pinned to the top of the scrolling column so
          // the title reads as chrome rather than as the page's first line.
          "sticky top-0 z-20 -mx-4 -mt-4 flex items-center gap-1 border-b border-sidebar-border bg-ink px-4 py-3",
          // Desktop: the title block it has always been.
          "sm:static sm:-mx-6 sm:-mt-6 sm:flex-col sm:items-stretch sm:gap-4 sm:border-0 sm:bg-transparent sm:px-6 sm:pb-0 sm:pt-6 lg:-mx-8 lg:-mt-8 lg:px-8 lg:pt-8",
          "md:flex-row md:items-end md:justify-between md:gap-6",
        )}
      >
        <div className="flex min-w-0 items-center gap-1 sm:block sm:space-y-1.5">
          {!isTabRoot && (
            <Link
              to="/more"
              aria-label="Back"
              className="-ml-2 flex size-10 shrink-0 items-center justify-center rounded-lg text-sidebar-foreground sm:hidden"
            >
              <ArrowLeft className="size-5" />
            </Link>
          )}
          <h1 className="min-w-0 flex-1 truncate text-xl leading-tight text-white sm:overflow-visible sm:whitespace-normal sm:text-[28px] sm:text-foreground">
            {title}
          </h1>
          {description && (
            <p className="hidden max-w-3xl text-sm leading-relaxed text-muted-foreground sm:block">
              {description}
            </p>
          )}
        </div>
        {actions && (
          <div className="hidden shrink-0 items-center gap-2.5 sm:flex">{actions}</div>
        )}
      </div>

      {primaryAction && (
        <button
          type="button"
          onClick={primaryAction.onClick}
          aria-label={primaryAction.label}
          title={primaryAction.label}
          className="fixed bottom-[calc(94px+env(safe-area-inset-bottom,0px))] right-4 z-30 flex size-14 items-center justify-center rounded-[18px] bg-primary text-primary-foreground shadow-[0_10px_24px_-6px_rgba(41,82,227,0.55)] transition-transform active:scale-95 sm:hidden"
        >
          <Plus className="size-6" strokeWidth={2.2} />
        </button>
      )}
    </>
  );
}
