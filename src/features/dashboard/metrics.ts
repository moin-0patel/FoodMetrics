// Dashboard metric derivations — pure functions over real records.
//
// Every figure the dashboard shows comes from here. Nothing is seeded, sampled or
// invented: when there is no data a metric returns null and the UI renders an
// explicit empty state rather than a zero that looks like a real measurement.

import type {
  IngredientPriceHistory,
  RawMaterial,
  Recipe,
  RecipeCostHistory,
} from "@/lib/data/types";

/** A recipe's food cost % = total cost ÷ selling price. Null unless both exist. */
export function foodCostPct(r: Pick<Recipe, "total_cost" | "selling_price">): number | null {
  const cost = r.total_cost;
  const price = r.selling_price;
  if (cost == null || price == null || price <= 0) return null;
  return (cost / price) * 100;
}

/**
 * Menu dishes only — excludes in-house preps, pizza size variants and
 * soft-archived recipes (`archived_at`, not a status value).
 */
export function menuDishes(recipes: Recipe[], brand: string): Recipe[] {
  return recipes.filter((r) => {
    if (r.is_prep || r.parent_recipe_id) return false;
    if (r.archived_at) return false;
    if (brand !== "all" && r.brand !== brand) return false;
    return true;
  });
}

export interface Kpis {
  /** Mean food cost % across dishes that have both a cost and a selling price. */
  avgFoodCostPct: number | null;
  /** How many dishes that average is based on (0 → avgFoodCostPct is null). */
  pricedCount: number;
  activeRecipes: number;
  /** Dish with the highest cost per portion, if any is costed. */
  highestCost: { name: string; costPerPortion: number } | null;
  /** Dishes whose food cost % exceeds the configured target. */
  overTarget: number;
  /** Most recent costing or price change across the catalog. */
  lastUpdate: string | null;
  /** Dishes with no cost or no selling price — the average can't include them. */
  missingData: number;
}

export function computeKpis(
  dishes: Recipe[],
  targetPct: number,
  costHistory: RecipeCostHistory[],
  priceHistory: IngredientPriceHistory[],
): Kpis {
  const pcts: number[] = [];
  let overTarget = 0;
  let missingData = 0;
  let highestCost: Kpis["highestCost"] = null;

  for (const r of dishes) {
    const fc = foodCostPct(r);
    if (fc == null) {
      missingData++;
    } else {
      pcts.push(fc);
      if (fc > targetPct) overTarget++;
    }
    const cpp = r.cost_per_portion;
    if (cpp != null && cpp > 0 && (!highestCost || cpp > highestCost.costPerPortion)) {
      highestCost = { name: r.recipe_name, costPerPortion: cpp };
    }
  }

  const stamps = [
    ...costHistory.map((h) => h.changed_at),
    ...priceHistory.map((h) => h.changed_at),
  ].filter(Boolean);

  return {
    avgFoodCostPct: pcts.length ? pcts.reduce((a, b) => a + b, 0) / pcts.length : null,
    pricedCount: pcts.length,
    activeRecipes: dishes.length,
    highestCost,
    overTarget,
    lastUpdate: stamps.length ? stamps.reduce((a, b) => (a > b ? a : b)) : null,
    missingData,
  };
}

/**
 * Average cost-per-portion per day from cost history, oldest → newest, for a
 * sparkline. Returns [] when there's no history — the card then omits the chart
 * instead of drawing a flat fake line.
 */
export function costTrend(history: RecipeCostHistory[], maxPoints = 12): number[] {
  const byDay = new Map<string, { sum: number; n: number }>();
  for (const h of history) {
    const v = h.new_cost_per_portion ?? h.new_total_cost;
    if (v == null) continue;
    const day = h.changed_at.slice(0, 10);
    const cur = byDay.get(day) ?? { sum: 0, n: 0 };
    cur.sum += v;
    cur.n += 1;
    byDay.set(day, cur);
  }
  return [...byDay.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .slice(-maxPoints)
    .map(([, v]) => v.sum / v.n);
}

/** Cumulative dish count per day from created_at, oldest → newest. */
export function recipeCountTrend(dishes: Recipe[], maxPoints = 12): number[] {
  const byDay = new Map<string, number>();
  for (const r of dishes) {
    if (!r.created_at) continue;
    const day = r.created_at.slice(0, 10);
    byDay.set(day, (byDay.get(day) ?? 0) + 1);
  }
  const days = [...byDay.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  let running = 0;
  return days.map(([, n]) => (running += n)).slice(-maxPoints);
}

export interface SectionCost {
  section: string;
  /** Mean food cost % for the section, or null if nothing in it is priced. */
  actualPct: number | null;
  targetPct: number;
  dishes: number;
  status: "on-target" | "warning" | "critical" | "unpriced";
}

/**
 * Food cost % grouped by menu category, against the target. "warning" is within
 * 3 points over target; beyond that is "critical".
 */
export function foodCostBySection(dishes: Recipe[], targetPct: number): SectionCost[] {
  const groups = new Map<string, number[]>();
  const counts = new Map<string, number>();
  for (const r of dishes) {
    const key = r.category?.trim() || "Uncategorised";
    counts.set(key, (counts.get(key) ?? 0) + 1);
    const fc = foodCostPct(r);
    if (fc == null) continue;
    groups.set(key, [...(groups.get(key) ?? []), fc]);
  }
  return [...counts.entries()]
    .map(([section, dishCount]) => {
      const pcts = groups.get(section) ?? [];
      const actualPct = pcts.length ? pcts.reduce((a, b) => a + b, 0) / pcts.length : null;
      let status: SectionCost["status"] = "unpriced";
      if (actualPct != null) {
        if (actualPct <= targetPct) status = "on-target";
        else if (actualPct <= targetPct + 3) status = "warning";
        else status = "critical";
      }
      return { section, actualPct, targetPct, dishes: dishCount, status };
    })
    .sort((a, b) => (b.actualPct ?? -1) - (a.actualPct ?? -1));
}

export interface AttentionItem {
  id: string;
  name: string;
  actualPct: number;
  targetPct: number;
  severity: "critical" | "warning";
}

/** Dishes over the food-cost target, worst first. */
export function recipesNeedingAttention(
  dishes: Recipe[],
  targetPct: number,
  limit = 5,
): AttentionItem[] {
  const out: AttentionItem[] = [];
  for (const r of dishes) {
    const fc = foodCostPct(r);
    if (fc == null || fc <= targetPct) continue;
    out.push({
      id: r.id,
      name: r.recipe_name,
      actualPct: fc,
      targetPct,
      severity: fc > targetPct + 3 ? "critical" : "warning",
    });
  }
  return out.sort((a, b) => b.actualPct - a.actualPct).slice(0, limit);
}

export interface PriceChangeRow {
  id: string;
  ingredient: string;
  oldPrice: number | null;
  newPrice: number | null;
  /** Percent change, or null when the old price was absent/zero. */
  changePct: number | null;
  changedAt: string;
}

/** Recent ingredient price changes, joined to material names, newest first. */
export function recentPriceChanges(
  history: IngredientPriceHistory[],
  materials: RawMaterial[],
  limit = 8,
): PriceChangeRow[] {
  const nameById = new Map(materials.map((m) => [m.id, m.ingredient_name]));
  return [...history]
    .sort((a, b) => b.changed_at.localeCompare(a.changed_at))
    .slice(0, limit)
    .map((h) => ({
      id: h.id,
      ingredient: nameById.get(h.ingredient_id) ?? "Unknown ingredient",
      oldPrice: h.old_price,
      newPrice: h.new_price,
      changePct:
        h.old_price != null && h.old_price > 0 && h.new_price != null
          ? ((h.new_price - h.old_price) / h.old_price) * 100
          : null,
      changedAt: h.changed_at,
    }));
}

/**
 * Share of priced dishes at or under target — the status bar's "margin health".
 * Null when nothing is priced, so the bar shows "no data" instead of 0%.
 */
export function marginHealthPct(dishes: Recipe[], targetPct: number): number | null {
  const priced = dishes.map(foodCostPct).filter((v): v is number => v != null);
  if (!priced.length) return null;
  return (priced.filter((v) => v <= targetPct).length / priced.length) * 100;
}

/** "2h ago" / "3d ago" style relative label. `now` is injectable for tests. */
export function relativeTime(iso: string | null, now: number = Date.now()): string {
  if (!iso) return "—";
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return "—";
  const mins = Math.floor((now - then) / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 30) return `${days}d ago`;
  const months = Math.floor(days / 30);
  return months < 12 ? `${months}mo ago` : `${Math.floor(months / 12)}y ago`;
}
