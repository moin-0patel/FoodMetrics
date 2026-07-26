import { Skeleton } from "@/components/ui/skeleton";

/**
 * Placeholder rows shown while a table/list loads. Drops into the same `Card`
 * the real table renders into, so the layout doesn't jump when data arrives.
 */
export function TableSkeleton({
  rows = 6,
  cols = 5,
}: {
  rows?: number;
  cols?: number;
}) {
  return (
    <div className="divide-y" aria-hidden>
      {Array.from({ length: rows }).map((_, r) => (
        <div key={r} className="flex items-center gap-4 px-4 py-3.5">
          {/* Leading avatar/icon block */}
          <Skeleton className="h-9 w-9 shrink-0 rounded-md" />
          {Array.from({ length: cols }).map((_, c) => (
            <Skeleton
              key={c}
              className="h-3.5"
              style={{
                // Vary widths so it reads as content, not a grid of identical bars.
                width: `${[28, 18, 14, 16, 20][c % 5]}%`,
                opacity: 1 - r * 0.08,
              }}
            />
          ))}
        </div>
      ))}
    </div>
  );
}
