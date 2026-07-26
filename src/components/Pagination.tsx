import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * Shared list pager: the visible record range + prev/next + numbered page
 * buttons. Page size is fixed by the caller (no per-page selector).
 */
export function Pagination({
  page,
  pageSize,
  total,
  onPageChange,
  label = "items",
}: {
  page: number;
  pageSize: number;
  total: number;
  onPageChange: (page: number) => void;
  label?: string;
}) {
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  const current = Math.min(page, pageCount);
  const from = total === 0 ? 0 : (current - 1) * pageSize + 1;
  const to = Math.min(current * pageSize, total);

  // Compact window of page numbers around the current page.
  const pages: number[] = [];
  const end = Math.min(pageCount, Math.max(1, current - 2) + 4);
  for (let p = Math.max(1, end - 4); p <= end; p++) pages.push(p);

  return (
    <div className="flex flex-col items-center justify-between gap-3 border-t bg-muted/30 px-4 py-3 text-sm sm:flex-row">
      <span className="text-muted-foreground">
        Showing <strong>{from}-{to}</strong> of <strong>{total}</strong> {label}
      </span>

      <div className="flex items-center gap-1">
        <Button variant="outline" size="sm" disabled={current <= 1} onClick={() => onPageChange(current - 1)} aria-label="Previous page">
          <ChevronLeft className="h-4 w-4" />
        </Button>
        {pages.map((p) => (
          <Button
            key={p}
            size="sm"
            variant={p === current ? "default" : "outline"}
            onClick={() => onPageChange(p)}
            aria-current={p === current ? "page" : undefined}
          >
            {p}
          </Button>
        ))}
        <Button variant="outline" size="sm" disabled={current >= pageCount} onClick={() => onPageChange(current + 1)} aria-label="Next page">
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
