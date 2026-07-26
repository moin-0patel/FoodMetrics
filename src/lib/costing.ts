// Costing engine — PRD §4.3 (formulae) & §10 (business logic).
// Pure, backend-agnostic, fully unit-tested against PRD §4.4 worked examples.

import { getConversionFactor } from "./units";

/** Step 1 — PRD §10.1. cost_per_base_unit = price / (qty × conversion). */
export function calculateCostPerBaseUnit(
  purchasePrice: number,
  purchaseQuantity: number,
  purchaseUnit: string,
  baseUnit: string,
): number {
  const conversionFactor = getConversionFactor(purchaseUnit, baseUnit);
  const totalBaseUnits = purchaseQuantity * conversionFactor;
  if (totalBaseUnits <= 0) return 0;
  return purchasePrice / totalBaseUnits;
}

/** Step 2 — PRD §10.2. calculated_cost for one ingredient row in a recipe. */
export function calculateIngredientCost(
  costPerBaseUnit: number,
  quantityUsed: number,
  unitUsed: string,
  baseUnit: string,
): number {
  const conversionFactor = getConversionFactor(unitUsed, baseUnit);
  const quantityInBaseUnit = quantityUsed * conversionFactor;
  return round2(costPerBaseUnit * quantityInBaseUnit);
}

/** Step 4 — PRD §4.3. cost_per_portion = total_cost / serving_size. */
export function calculateCostPerPortion(
  totalCost: number,
  servingSize: number,
): number {
  if (servingSize <= 0) return 0;
  return round2(totalCost / servingSize);
}

/** Step 5 — PRD §10.3. suggested_price = cost_per_portion / (foodCost% / 100). */
export function calculateSuggestedPrice(
  costPerPortion: number,
  foodCostPercentage: number,
): number {
  if (foodCostPercentage <= 0) return 0;
  return round2(costPerPortion / (foodCostPercentage / 100));
}

/** Steps 6 & 7 — PRD §10.4. Gross profit + gross margin %. */
export function calculateProfitMetrics(
  sellingPrice: number,
  costPerPortion: number,
): { grossProfit: number; grossMarginPct: number } {
  const grossProfit = sellingPrice - costPerPortion;
  const grossMarginPct = sellingPrice > 0 ? (grossProfit / sellingPrice) * 100 : 0;
  return {
    grossProfit: round2(grossProfit),
    grossMarginPct: round2(grossMarginPct),
  };
}

export interface CostingLineInput {
  costPerBaseUnit: number;
  quantityUsed: number;
  unitUsed: string;
  baseUnit: string;
}

export interface RecipeCostingResult {
  lineCosts: number[];
  totalCost: number;
  costPerPortion: number;
  suggestedPrice: number;
  grossProfit: number;
  grossMarginPct: number;
}

/**
 * Full recipe costing roll-up (PRD §4.3 steps 3–7). Aggregates line costs,
 * then derives per-portion, suggested price, and profit metrics.
 *
 * Note: line costs are persisted values and so are rounded to paise (PRD §10.2),
 * but the per-portion → price → profit chain carries full precision and rounds
 * only at display. This reproduces all six PRD §4.4 worked numbers, which the
 * PRD itself derives from the unrounded ₹49.875 per-portion.
 */
export function calculateRecipeCosting(
  lines: CostingLineInput[],
  servingSize: number,
  foodCostPercentage: number,
): RecipeCostingResult {
  const lineCosts = lines.map((l) =>
    calculateIngredientCost(l.costPerBaseUnit, l.quantityUsed, l.unitUsed, l.baseUnit),
  );
  const totalCost = round2(lineCosts.reduce((sum, c) => sum + c, 0));

  const rawCostPerPortion = servingSize > 0 ? totalCost / servingSize : 0;
  const rawSuggestedPrice =
    foodCostPercentage > 0 ? rawCostPerPortion / (foodCostPercentage / 100) : 0;
  const rawGrossProfit = rawSuggestedPrice - rawCostPerPortion;
  const rawGrossMarginPct =
    rawSuggestedPrice > 0 ? (rawGrossProfit / rawSuggestedPrice) * 100 : 0;

  return {
    lineCosts,
    totalCost,
    costPerPortion: round2(rawCostPerPortion),
    suggestedPrice: round2(rawSuggestedPrice),
    grossProfit: round2(rawGrossProfit),
    grossMarginPct: round2(rawGrossMarginPct),
  };
}

/**
 * Cost per yield-unit of an in-house prep, BEFORE the prep's own wastage — so a
 * menu using the prep applies wastage only once (matches the costing sheet,
 * which never compounds wastage across nested tables).
 */
export function prepUnitCostFrom(
  totalCost: number,
  yieldQuantity: number,
  wastagePct: number,
): number {
  const y = yieldQuantity > 0 ? yieldQuantity : 1;
  const raw = totalCost / (1 + (wastagePct || 0) / 100);
  return raw / y;
}

/**
 * The quantity (grams) a prep's total cost is spread over when pricing it as a
 * component: the COOKED (finished) weight when the chef recorded one, else the raw
 * yield. A prep loses weight when cooked, so 1 g of the finished prep is dearer.
 * `yield_unit` for preps is always "Gram", so `cooked_weight_g` (grams) is a valid
 * divisor with no unit conversion.
 */
export function prepYieldForPricing(r: { yield_quantity: number; cooked_weight_g?: number | null }): number {
  return r.cooked_weight_g != null && r.cooked_weight_g > 0 ? r.cooked_weight_g : r.yield_quantity;
}

/** Percentage change between two cost values (used by the price cascade). */
export function percentChange(oldValue: number, newValue: number): number {
  if (oldValue === 0) return newValue === 0 ? 0 : 100;
  return round2(((newValue - oldValue) / oldValue) * 100);
}

export function round2(value: number): number {
  return parseFloat(value.toFixed(2));
}
