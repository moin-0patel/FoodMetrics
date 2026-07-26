// Yield engine — centralized, reusable, pure. Computes usable quantity and the
// effective (yield-adjusted) ingredient cost after preparation wastage.
//
// Core rule (PRD §4): the FULL purchase cost belongs to the USABLE quantity.
// e.g. ₹100 buys 1 kg of onion; 200 g is wastage → 800 g usable still costs ₹100,
// so the effective cost is ₹100 / 800 g = ₹0.125/g = ₹125/kg (NOT ₹80 for 800 g).

import { round2 } from "./costing";
import { getConversionFactor, getUnitFamily } from "./units";
import type { IngredientYield } from "./data/types";

/** Convert a quantity in `unit` to its family base unit (Gram / ML / itself). */
export function toBaseQuantity(qty: number, unit: string): number {
  const family = getUnitFamily(unit);
  const base = family === "weight" ? "Gram" : family === "volume" ? "ML" : unit;
  return qty * getConversionFactor(unit, base);
}

/** Usable = raw − wastage (all in the same base unit). */
export function usableQuantity(rawQty: number, wastageQty: number): number {
  return round3(rawQty - wastageQty);
}

/** Wastage % = wastage / raw × 100. */
export function wastagePercentage(wastageQty: number, rawQty: number): number {
  if (rawQty <= 0) return 0;
  return round2((wastageQty / rawQty) * 100);
}

/** Yield % = usable / raw × 100  (equivalently 100 − wastage%). */
export function yieldPercentage(usableQty: number, rawQty: number): number {
  if (rawQty <= 0) return 0;
  return round2((usableQty / rawQty) * 100);
}

/** Original cost per base unit = purchase cost / raw quantity. */
export function originalCostPerBaseUnit(purchaseCost: number, rawQtyBase: number): number {
  if (rawQtyBase <= 0) return 0;
  return purchaseCost / rawQtyBase;
}

/**
 * Yield-adjusted cost per base unit = purchase cost / USABLE quantity.
 * Kept at full precision (e.g. ₹0.125/g); round only for display / per-kg.
 */
export function yieldAdjustedCostPerBaseUnit(purchaseCost: number, usableQty: number): number {
  if (usableQty <= 0) return 0;
  return purchaseCost / usableQty;
}

/** Per-kg (or per-litre) figure from a per-gram (or per-ml) cost. */
export function perKilo(perBaseUnit: number): number {
  return round2(perBaseUnit * 1000);
}

export interface YieldInput {
  purchaseCost: number;
  purchaseQuantity: number;
  purchaseUnit: string;
  /** Wastage in the base unit (Gram/ML/piece). */
  wastageQty: number;
}

export interface YieldResult {
  rawQtyBase: number;
  usableQty: number;
  wastagePct: number;
  yieldPct: number;
  originalUnitCost: number; // per base unit (full precision)
  yieldAdjustedUnitCost: number; // per base unit (full precision)
  yieldAdjustedCostPerKg: number; // rounded for display
}

/** Full yield roll-up for the form's live calculation. */
export function computeYield(input: YieldInput): YieldResult {
  const rawQtyBase = round3(toBaseQuantity(input.purchaseQuantity, input.purchaseUnit));
  const usableQty = usableQuantity(rawQtyBase, input.wastageQty);
  const yieldAdjustedUnitCost = yieldAdjustedCostPerBaseUnit(input.purchaseCost, usableQty);
  return {
    rawQtyBase,
    usableQty,
    wastagePct: wastagePercentage(input.wastageQty, rawQtyBase),
    yieldPct: yieldPercentage(usableQty, rawQtyBase),
    originalUnitCost: originalCostPerBaseUnit(input.purchaseCost, rawQtyBase),
    yieldAdjustedUnitCost,
    yieldAdjustedCostPerKg: perKilo(yieldAdjustedUnitCost),
  };
}

function round3(value: number): number {
  return parseFloat(value.toFixed(3));
}

/** The yield record in effect for an ingredient as of a date (latest effective_from ≤ asOf). */
export function activeYield(
  yields: IngredientYield[],
  ingredientId: string,
  asOf?: string,
): IngredientYield | null {
  const cutoff = asOf ?? new Date().toISOString().slice(0, 10);
  return (
    yields
      .filter((y) => y.ingredient_id === ingredientId && y.effective_from <= cutoff)
      .sort((a, b) => b.effective_from.localeCompare(a.effective_from))[0] ?? null
  );
}

/**
 * §9 cost-selection rule (centralized — do not duplicate). Returns the per-base-
 * unit cost to charge a recipe for an ingredient: the yield-adjusted rate when
 * yield data exists, otherwise the standard purchase cost per base unit. An
 * optional recipe-specific wastage % (§10) overrides the standard yield for that
 * line only, recomputing the rate from the yield record's purchase basis.
 */
export function effectiveCostPerBaseUnit(
  baseUnitCost: number | null,
  yieldRecord: IngredientYield | null,
  overrideWastagePct?: number | null,
): number | null {
  if (!yieldRecord) return baseUnitCost;
  const wastagePct = overrideWastagePct != null ? overrideWastagePct : yieldRecord.wastage_percentage;
  const usable = yieldRecord.raw_quantity * (1 - wastagePct / 100);
  if (usable <= 0) return baseUnitCost;
  return yieldRecord.purchase_cost / usable;
}

/**
 * Effective ₹/base-unit for a chosen cut/prep: the full purchase cost falls on
 * the usable portion, so per usable unit = base cost ÷ (yield% / 100). A yield
 * above 100 (e.g. boiled pasta absorbing water) makes it cheaper per usable unit.
 */
export function costForCutYield(baseUnitCost: number | null, cutYieldPct: number): number | null {
  if (baseUnitCost == null) return null;
  if (cutYieldPct <= 0) return baseUnitCost;
  return baseUnitCost / (cutYieldPct / 100);
}
