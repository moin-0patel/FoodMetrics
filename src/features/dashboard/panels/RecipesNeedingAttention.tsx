import { useNavigate } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { AttentionItem } from "../metrics";

// Dishes running over the food-cost target, worst first. "Critical" is more than
// 3 points over; anything else over target is a warning.

const BADGE: Record<AttentionItem["severity"], string> = {
  critical: "bg-red-500/12 text-red-700 dark:text-red-400",
  warning: "bg-amber-500/15 text-amber-700 dark:text-amber-400",
};

export function RecipesNeedingAttention({
  items,
  totalOverTarget,
}: {
  items: AttentionItem[];
  totalOverTarget: number;
}) {
  const navigate = useNavigate();
  return (
    <Card className="flex flex-col p-5">
      <h2 className="text-sm font-semibold text-foreground">Recipes Needing Attention</h2>

      {items.length === 0 ? (
        <p className="flex-1 py-10 text-center text-sm text-muted-foreground">
          Nothing over target. Dishes appear here when their food cost exceeds the target.
        </p>
      ) : (
        <>
          <ul className="mt-4 flex-1 space-y-2.5">
            {items.map((it) => (
              <li key={it.id}>
                <button
                  type="button"
                  onClick={() => navigate(`/recipes/${it.id}`)}
                  className="w-full rounded-lg border p-3 text-left transition-colors hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <div className="flex items-start justify-between gap-2">
                    <span className="text-sm font-semibold text-foreground">{it.name}</span>
                    <span
                      className={cn(
                        "shrink-0 rounded px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide",
                        BADGE[it.severity],
                      )}
                    >
                      {it.severity}
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Cost:{" "}
                    <span className="font-semibold text-red-600 tabular-nums dark:text-red-400">
                      {it.actualPct.toFixed(0)}%
                    </span>
                    {"  ·  "}Target: <span className="tabular-nums">{it.targetPct.toFixed(0)}%</span>
                  </p>
                </button>
              </li>
            ))}
          </ul>

          <Button
            variant="outline"
            className="mt-4 w-full"
            onClick={() => navigate("/recipes")}
          >
            View All Issues{totalOverTarget > items.length ? ` (${totalOverTarget})` : ""}
          </Button>
        </>
      )}
    </Card>
  );
}
