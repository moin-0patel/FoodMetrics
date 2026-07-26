import { round2 } from "@/lib/costing";
import type { Recipe } from "@/lib/data/types";

/** Per-portion packaging cost (box/container). */
export function packagingOf(recipe: Recipe): number {
  return recipe.packaging_cost ?? 0;
}

/** Full per-portion cost the menu price must cover = food cost + packaging. */
export function fullCostPerPortion(recipe: Recipe): number {
  return round2((recipe.cost_per_portion ?? 0) + packagingOf(recipe));
}

/** True when a chef has manually saved a menu price. The app never suggests one. */
export function hasMenuPrice(recipe: Recipe): boolean {
  return !!(recipe.selling_price && recipe.selling_price > 0);
}

/**
 * Menu price = the chef-set selling price. Returns 0 when none is set — the app
 * does NOT suggest a price from a target food-cost %; callers show "–" instead.
 */
export function menuPriceOf(recipe: Recipe): number {
  return hasMenuPrice(recipe) ? (recipe.selling_price as number) : 0;
}

/** Actual food cost % = full per-portion cost (incl. packaging) ÷ menu price.
 *  0 when no price set. This is the "with packaging" figure. */
export function foodCostPctOf(recipe: Recipe): number {
  const menu = menuPriceOf(recipe);
  const cpp = fullCostPerPortion(recipe);
  return menu > 0 ? round2((cpp / menu) * 100) : 0;
}

/** Food cost % WITH packaging = (food cost + packaging) ÷ menu price × 100.
 *  Null when no menu price is set (so callers can show "–"). */
export function foodCostWithPackagingPct(recipe: Recipe): number | null {
  const menu = menuPriceOf(recipe);
  return menu > 0 ? round2((fullCostPerPortion(recipe) / menu) * 100) : null;
}

/** Food cost % WITHOUT packaging = food cost ÷ menu price × 100. Null when unpriced. */
export function foodCostNoPackagingPct(recipe: Recipe): number | null {
  const menu = menuPriceOf(recipe);
  return menu > 0 ? round2(((recipe.cost_per_portion ?? 0) / menu) * 100) : null;
}

/** Profit per portion = menu price − full per-portion cost. 0 when no price set. */
export function profitMarginOf(recipe: Recipe): number {
  const menu = menuPriceOf(recipe);
  return menu > 0 ? round2(menu - fullCostPerPortion(recipe)) : 0;
}

export type FcTone = "good" | "warn" | "bad";

/** Tone for the FC% badge/bar relative to the critical threshold (e.g. 35%). */
export function fcTone(fcPct: number, criticalPct: number): FcTone {
  if (fcPct >= criticalPct) return "bad";
  if (fcPct >= criticalPct - 5) return "warn";
  return "good";
}

export const FC_TONE_STYLES: Record<FcTone, { badge: string; bar: string }> = {
  good: { badge: "bg-emerald-100 text-emerald-700", bar: "bg-emerald-500" },
  warn: { badge: "bg-amber-100 text-amber-700", bar: "bg-amber-500" },
  bad: { badge: "bg-red-100 text-red-700", bar: "bg-red-500" },
};

/** Stable display SKU derived from the recipe id (REC-###). */
export function skuOf(id: string): string {
  let hash = 0;
  for (let i = 0; i < id.length; i++) hash = (hash * 31 + id.charCodeAt(i)) >>> 0;
  return `REC-${(hash % 900) + 100}`;
}
