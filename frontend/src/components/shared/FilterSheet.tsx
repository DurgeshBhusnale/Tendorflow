import { SlidersHorizontal, X } from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface FilterSheetProps {
  /** How many filters are set, for the trigger's badge. */
  activeCount: number;
  /** Shown as "Clear" beside the trigger, and inside the sheet. */
  onClear?: () => void;
  /** Result count for the sheet's confirm button, e.g. "Show 12 results". */
  resultCount?: number;
  children: ReactNode;
}

/**
 * A page's secondary filters: a toolbar row on desktop, a bottom sheet on a
 * phone (CH-30).
 *
 * One set of fields, not two — the same DOM node is laid out inline from `sm`
 * up and as a sheet below it, so there are no duplicate inputs or ids and no
 * second copy of the page's filter state to keep in sync.
 *
 * On a phone the fields would otherwise push the first row of data off the
 * screen: three dropdowns and two date inputs are taller than the list they
 * filter.
 */
export function FilterSheet({ activeCount, onClear, resultCount, children }: FilterSheetProps) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    document.addEventListener("keydown", onKeyDown);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [open]);

  return (
    <>
      <div className="flex items-center gap-2 px-4 pb-3 sm:hidden">
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="inline-flex h-9 items-center gap-2 rounded-full border border-border bg-card px-3.5 text-[13px] font-semibold text-foreground"
        >
          <SlidersHorizontal className="size-4 text-muted-foreground" />
          Filters
          {activeCount > 0 && (
            <span className="flex size-5 items-center justify-center rounded-full bg-primary text-[11px] font-bold text-primary-foreground">
              {activeCount}
            </span>
          )}
        </button>
        {activeCount > 0 && onClear && (
          <button
            type="button"
            onClick={onClear}
            className="inline-flex h-9 items-center rounded-full px-3 text-[13px] font-semibold text-muted-foreground"
          >
            Clear
          </button>
        )}
      </div>

      {open && (
        <div
          className="fixed inset-0 z-40 animate-fade-in bg-ink/45 sm:hidden"
          onClick={() => setOpen(false)}
          aria-hidden
        />
      )}

      <div
        role={open ? "dialog" : undefined}
        aria-modal={open ? true : undefined}
        aria-label={open ? "Filters" : undefined}
        className={cn(
          // Desktop: the toolbar row it has always been. The sheet's padding is
          // reset *before* the row's own: cn() runs tailwind-merge, which keeps
          // the last conflicting class, so a trailing sm:p-0 erased sm:px-5 and
          // left the fields flush against the card edge.
          "sm:static sm:z-auto sm:max-h-none sm:rounded-none sm:bg-transparent sm:p-0 sm:shadow-none",
          "sm:flex sm:flex-wrap sm:items-end sm:gap-3 sm:px-5 sm:pb-4",
          // Phone: the same fields, in a sheet.
          open
            ? "fixed inset-x-0 bottom-0 z-50 flex max-h-[85dvh] flex-col gap-4 overflow-y-auto rounded-t-2xl bg-card p-4 pb-[max(env(safe-area-inset-bottom,0px),16px)] shadow-pop"
            : "hidden",
        )}
      >
        <div className="flex items-center justify-between gap-3 sm:hidden">
          <h2 className="text-base">Filters</h2>
          <button
            type="button"
            onClick={() => setOpen(false)}
            aria-label="Close filters"
            className="flex size-10 items-center justify-center rounded-lg border border-border text-muted-foreground"
          >
            <X className="size-4" />
          </button>
        </div>

        {children}

        <Button type="button" className="h-12 w-full sm:hidden" onClick={() => setOpen(false)}>
          {resultCount === undefined
            ? "Show results"
            : `Show ${resultCount} ${resultCount === 1 ? "result" : "results"}`}
        </Button>
      </div>
    </>
  );
}
