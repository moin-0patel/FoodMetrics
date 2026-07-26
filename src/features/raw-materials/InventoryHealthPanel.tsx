import { TrendingDown, TrendingUp } from "lucide-react";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { IngredientPriceHistory, RawMaterial } from "@/lib/data/types";

/**
 * Side panel for the Raw Materials page — the design's "Market Intelligence" and
 * "Inventory Health" cards.
 *
 * Both are computed from real records: price volatility is the net change across
 * logged price movements in the window, and health is priced coverage. Where the
 * design shows a forecast ("prices projected to rise"), this reports what has
 * actually been recorded instead — the app holds no forecast data and inventing
 * one would be a fabricated prediction.
 */

const WINDOW_DAYS = 30;

export interface Volatility {
  /** Net % change across ingredients that moved in the window; null if none did. */
  netPct: number | null;
  risers: number;
  fallers: number;
  /** Biggest single riser in the window. */
  topRiser: { name: string; pct: number } | null;
}

export function computeVolatility(
  history: IngredientPriceHistory[],
  materials: RawMaterial[],
  now: number = Date.now(),
): Volatility {
  const cutoff = now - WINDOW_DAYS * 864e5;
  const nameById = new Map(materials.map((m) => [m.id, m.ingredient_name]));
  const pcts: number[] = [];
  let risers = 0;
  let fallers = 0;
  let topRiser: Volatility["topRiser"] = null;

  for (const h of history) {
    const t = new Date(h.changed_at).getTime();
    if (Number.isNaN(t) || t < cutoff) continue;
    if (h.old_price == null || h.old_price <= 0 || h.new_price == null) continue;
    const pct = ((h.new_price - h.old_price) / h.old_price) * 100;
    pcts.push(pct);
    if (pct > 0) {
      risers++;
      if (!topRiser || pct > topRiser.pct) {
        topRiser = { name: nameById.get(h.ingredient_id) ?? "Unknown ingredient", pct };
      }
    } else if (pct < 0) {
      fallers++;
    }
  }

  return {
    netPct: pcts.length ? pcts.reduce((a, b) => a + b, 0) / pcts.length : null,
    risers,
    fallers,
    topRiser,
  };
}

function Row({ label, value, tone }: { label: string; value: string; tone?: string }) {
  return (
    <div className="flex items-center justify-between gap-3 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className={cn("font-semibold tabular-nums", tone ?? "text-foreground")}>{value}</span>
    </div>
  );
}

export function InventoryHealthPanel({
  materials,
  priceHistory,
  pricedPct,
  unpriced,
  recentUpdates,
}: {
  materials: RawMaterial[];
  priceHistory: IngredientPriceHistory[];
  pricedPct: number;
  unpriced: number;
  /** Price changes logged in the window. */
  recentUpdates: number;
}) {
  const v = computeVolatility(priceHistory, materials);
  const rising = (v.netPct ?? 0) > 0;

  return (
    <div className="grid gap-4 md:grid-cols-2">
      {/* Market intelligence — recorded movement, not a forecast. */}
      <Card className="p-4">
        <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-primary">
          Market Intelligence
        </p>
        <h3 className="mt-1.5 font-semibold text-foreground">Price Movement</h3>

        {v.netPct == null ? (
          <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
            No price changes recorded in the last {WINDOW_DAYS} days. Updating an ingredient&apos;s
            purchase price logs the movement here.
          </p>
        ) : (
          <>
            <p
              className={cn(
                "mt-2 flex items-center gap-1.5 text-2xl font-semibold tabular-nums",
                rising ? "text-red-600 dark:text-red-400" : "text-emerald-600 dark:text-emerald-400",
              )}
            >
              {rising ? <TrendingUp className="h-5 w-5" /> : <TrendingDown className="h-5 w-5" />}
              {rising ? "+" : ""}
              {v.netPct.toFixed(1)}%
            </p>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
              Average change across {v.risers + v.fallers} ingredient
              {v.risers + v.fallers === 1 ? "" : "s"} in the last {WINDOW_DAYS} days
              {v.topRiser && (
                <>
                  {" — "}
                  <span className="font-medium text-foreground">{v.topRiser.name}</span> rose the
                  most, at {v.topRiser.pct.toFixed(1)}%.
                </>
              )}
            </p>
            <div className="mt-3 space-y-1.5 border-t pt-3">
              <Row label="Rose" value={String(v.risers)} tone="text-red-600 dark:text-red-400" />
              <Row label="Fell" value={String(v.fallers)} tone="text-emerald-600 dark:text-emerald-400" />
            </div>
          </>
        )}
      </Card>

      {/* Inventory health */}
      <Card className="p-4">
        <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-primary">
          Inventory Health
        </p>
        <div className="mt-3 space-y-2">
          <Row label="Total SKU count" value={String(materials.length)} />
          <Row
            label="Priced coverage"
            value={materials.length === 0 ? "—" : `${pricedPct.toFixed(1)}%`}
            tone={
              pricedPct >= 90
                ? "text-emerald-600 dark:text-emerald-400"
                : "text-amber-600 dark:text-amber-400"
            }
          />
          <Row
            label="Missing a price"
            value={String(unpriced)}
            tone={unpriced > 0 ? "text-red-600 dark:text-red-400" : undefined}
          />
          <Row label={`Price updates (${WINDOW_DAYS}d)`} value={String(recentUpdates)} />
        </div>

        <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-muted">
          <div
            className={cn(
              "h-full rounded-full",
              pricedPct >= 90 ? "bg-emerald-500" : pricedPct >= 60 ? "bg-amber-500" : "bg-red-500",
            )}
            style={{ width: `${Math.max(0, Math.min(100, pricedPct))}%` }}
          />
        </div>

        {materials.length > 0 && unpriced > 0 && (
          <p className="mt-3 text-xs leading-relaxed text-muted-foreground">
            Unpriced ingredients are skipped when costing recipes, so any dish using one will
            under-report its food cost.
          </p>
        )}
      </Card>
    </div>
  );
}
