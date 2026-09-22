import { cn } from "@/lib/utils";

interface SegmentedFilterProps<T extends string> {
  /** Names the group for screen readers, e.g. "Filter by status". */
  label: string;
  options: readonly T[];
  value: T;
  onChange: (value: T) => void;
}

/**
 * The status switch at the head of a table card — tenders, EMD, expenses.
 *
 * One raised segment on a muted track, rather than the bordered button row of
 * the first prototype: a filter is a choice between a handful of views, and
 * this reads as one control instead of four buttons.
 */
export function SegmentedFilter<T extends string>({
  label,
  options,
  value,
  onChange,
}: SegmentedFilterProps<T>) {
  return (
    <div
      className="inline-flex items-center gap-1 self-start rounded-lg bg-muted p-1"
      role="group"
      aria-label={label}
    >
      {options.map((option) => (
        <button
          key={option}
          type="button"
          aria-pressed={value === option}
          onClick={() => onChange(option)}
          className={cn(
            "h-8 whitespace-nowrap rounded-md px-3 text-[13px] transition-colors",
            value === option
              ? "bg-card font-semibold text-foreground shadow-card"
              : "font-medium text-muted-foreground hover:text-foreground",
          )}
        >
          {option}
        </button>
      ))}
    </div>
  );
}
