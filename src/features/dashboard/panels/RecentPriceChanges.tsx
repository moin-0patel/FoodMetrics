import { useNavigate } from "react-router-dom";
import { ArrowRight, TrendingDown, TrendingUp } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { cn, formatINR, formatDate } from "@/lib/utils";
import type { PriceChangeRow } from "../metrics";

// Recent ingredient price movements, straight from ingredient_price_history. A
// rise is bad (red) because it pushes food cost up; a fall is good.

/** Same-day changes show the time; older ones show the date. */
function whenLabel(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  const today = new Date();
  const sameDay =
    d.getFullYear() === today.getFullYear() &&
    d.getMonth() === today.getMonth() &&
    d.getDate() === today.getDate();
  if (sameDay) {
    return `Today, ${d.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" })}`;
  }
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);
  const isYesterday =
    d.getFullYear() === yesterday.getFullYear() &&
    d.getMonth() === yesterday.getMonth() &&
    d.getDate() === yesterday.getDate();
  return isYesterday ? "Yesterday" : formatDate(iso);
}

export function RecentPriceChanges({ rows }: { rows: PriceChangeRow[] }) {
  const navigate = useNavigate();
  return (
    <Card className="overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-5 py-3.5">
        <h2 className="text-sm font-semibold text-foreground">Recent Price Changes</h2>
        <Button variant="outline" size="sm" onClick={() => navigate("/materials")}>
          All Ingredients <ArrowRight className="h-3.5 w-3.5" />
        </Button>
      </div>

      {rows.length === 0 ? (
        <p className="px-5 py-10 text-center text-sm text-muted-foreground">
          No price changes recorded yet. Updating an ingredient&apos;s purchase price logs it here
          and re-costs every recipe that uses it.
        </p>
      ) : (
        // Narrow screens scroll the table rather than the page.
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Ingredient</TableHead>
                <TableHead className="text-right">Old Price</TableHead>
                <TableHead className="text-right">New Price</TableHead>
                <TableHead className="text-right">% Change</TableHead>
                <TableHead>Date</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r) => {
                const up = (r.changePct ?? 0) > 0;
                return (
                  <TableRow key={r.id}>
                    <TableCell className="font-medium">{r.ingredient}</TableCell>
                    <TableCell className="text-right tabular-nums text-muted-foreground">
                      {formatINR(r.oldPrice)}
                    </TableCell>
                    <TableCell className="text-right font-semibold tabular-nums">
                      {formatINR(r.newPrice)}
                    </TableCell>
                    <TableCell className="text-right">
                      {r.changePct == null ? (
                        <span className="text-muted-foreground">—</span>
                      ) : (
                        <span
                          className={cn(
                            "inline-flex items-center gap-1 font-medium tabular-nums",
                            up
                              ? "text-red-600 dark:text-red-400"
                              : "text-emerald-600 dark:text-emerald-400",
                          )}
                        >
                          {up ? (
                            <TrendingUp className="h-3.5 w-3.5" />
                          ) : (
                            <TrendingDown className="h-3.5 w-3.5" />
                          )}
                          {up ? "+" : ""}
                          {r.changePct.toFixed(1)}%
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-muted-foreground">
                      {whenLabel(r.changedAt)}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}
    </Card>
  );
}
