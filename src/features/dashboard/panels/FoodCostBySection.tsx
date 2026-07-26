import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { SectionCost } from "../metrics";

// Food cost % per menu category against the target. The bar is the actual value
// scaled against the chart's max; the vertical tick marks where the target sits,
// so "over target" is visible at a glance without reading the numbers.

const BAR: Record<SectionCost["status"], string> = {
  "on-target": "bg-emerald-500",
  warning: "bg-amber-500",
  critical: "bg-red-500",
  unpriced: "bg-slate-300 dark:bg-slate-600",
};

function Legend() {
  return (
    <div className="flex items-center gap-4 text-xs text-muted-foreground">
      <span className="inline-flex items-center gap-1.5">
        <span className="h-2 w-2 rounded-full bg-emerald-500" /> On Target
      </span>
      <span className="inline-flex items-center gap-1.5">
        <span className="h-2 w-2 rounded-full bg-red-500" /> Critical
      </span>
    </div>
  );
}

export function FoodCostBySection({ sections }: { sections: SectionCost[] }) {
  // Scale bars against the largest of (worst actual, target) so the target tick
  // always lands inside the track, with headroom.
  const max = Math.max(...sections.map((s) => s.actualPct ?? 0), sections[0]?.targetPct ?? 30, 1) * 1.15;

  return (
    <Card className="p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-sm font-semibold text-foreground">Food Cost by Menu Section</h2>
        <Legend />
      </div>

      {sections.length === 0 ? (
        <p className="py-10 text-center text-sm text-muted-foreground">
          No menu dishes yet. Add recipes with a selling price to see food cost by section.
        </p>
      ) : (
        <ul className="mt-5 space-y-4">
          {sections.map((s) => (
            <li key={s.section}>
              <div className="flex items-baseline justify-between gap-3 text-sm">
                <span className="font-medium text-foreground">{s.section}</span>
                <span className="shrink-0 tabular-nums text-muted-foreground">
                  {s.actualPct == null ? (
                    <span className="italic">not priced</span>
                  ) : (
                    <>
                      <span
                        className={cn(
                          "font-semibold",
                          s.status === "critical" && "text-red-600 dark:text-red-400",
                          s.status === "warning" && "text-amber-600 dark:text-amber-400",
                          s.status === "on-target" && "text-emerald-600 dark:text-emerald-400",
                        )}
                      >
                        {s.actualPct.toFixed(0)}%
                      </span>
                      {"  /  "}Target {s.targetPct.toFixed(0)}%
                    </>
                  )}
                </span>
              </div>
              <div className="relative mt-1.5 h-2.5 w-full overflow-hidden rounded-full bg-muted">
                <div
                  className={cn("h-full rounded-full transition-all", BAR[s.status])}
                  style={{ width: `${Math.min(100, ((s.actualPct ?? 0) / max) * 100)}%` }}
                />
                {/* Target marker */}
                <span
                  aria-hidden="true"
                  className="absolute top-[-2px] h-[14px] w-0.5 rounded bg-foreground/45"
                  style={{ left: `${Math.min(100, (s.targetPct / max) * 100)}%` }}
                />
              </div>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
