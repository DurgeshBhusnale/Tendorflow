import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";

interface PaginationProps {
  page: number;
  totalPages: number;
  totalCount: number;
  onPageChange: (page: number) => void;
}

/** Footer pager shared by every paginated list page. */
export function Pagination({ page, totalPages, totalCount, onPageChange }: PaginationProps) {
  return (
    <div className="flex items-center justify-between gap-3 border-t border-border px-4 py-3 sm:px-5 sm:py-3.5">
      <p className="text-[13px] text-muted-foreground">
        Page <span className="font-medium text-foreground">{page}</span> of {totalPages} ·{" "}
        <span className="font-medium text-foreground">{totalCount}</span> records
      </p>
      {/* Arrows alone on a phone: the labels cost width the record count needs,
          and a paired ‹ › is unambiguous next to "Page 2 of 6". */}
      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          disabled={page <= 1}
          onClick={() => onPageChange(page - 1)}
          aria-label="Previous page"
          className="max-sm:size-10 max-sm:p-0"
        >
          <ChevronLeft />
          <span className="max-sm:hidden">Previous</span>
        </Button>
        <Button
          variant="outline"
          size="sm"
          disabled={page >= totalPages}
          onClick={() => onPageChange(page + 1)}
          aria-label="Next page"
          className="max-sm:size-10 max-sm:p-0"
        >
          <span className="max-sm:hidden">Next</span>
          <ChevronRight />
        </Button>
      </div>
    </div>
  );
}
