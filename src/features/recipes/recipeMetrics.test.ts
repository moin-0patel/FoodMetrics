import { describe, it, expect } from "vitest";
import {
  fullCostPerPortion,
  hasMenuPrice,
  menuPriceOf,
  foodCostPctOf,
  profitMarginOf,
} from "./recipeMetrics";
import type { Recipe } from "@/lib/data/types";

// Only cost_per_portion / packaging_cost / selling_price are read by the metrics.
const rec = (p: Partial<Recipe>): Recipe => p as Recipe;

describe("recipe metrics — packaging cost", () => {
  it("packaging of 0 leaves the full per-portion cost on food cost only", () => {
    const r = rec({ cost_per_portion: 50, packaging_cost: 0, selling_price: null });
    expect(fullCostPerPortion(r)).toBe(50);
  });

  it("packaging adds to the full per-portion cost", () => {
    const r = rec({ cost_per_portion: 50, packaging_cost: 10, selling_price: null });
    expect(fullCostPerPortion(r)).toBe(60);
  });

  it("tolerates a missing packaging_cost (legacy rows)", () => {
    const r = rec({ cost_per_portion: 40, selling_price: null });
    expect(fullCostPerPortion(r)).toBe(40);
  });
});

describe("recipe metrics — no price suggestion", () => {
  it("returns 0 (never a suggested price) when no menu price is saved", () => {
    const r = rec({ cost_per_portion: 50, packaging_cost: 10, selling_price: null });
    expect(hasMenuPrice(r)).toBe(false);
    expect(menuPriceOf(r)).toBe(0);
    expect(foodCostPctOf(r)).toBe(0);
    expect(profitMarginOf(r)).toBe(0);
  });

  it("treats a zero/negative saved price as unpriced", () => {
    expect(hasMenuPrice(rec({ selling_price: 0 }))).toBe(false);
    expect(menuPriceOf(rec({ cost_per_portion: 20, selling_price: 0 }))).toBe(0);
  });

  it("uses the actual saved menu price for FC% and profit", () => {
    const r = rec({ cost_per_portion: 50, packaging_cost: 10, selling_price: 200 });
    expect(hasMenuPrice(r)).toBe(true);
    expect(menuPriceOf(r)).toBe(200);
    expect(foodCostPctOf(r)).toBe(30); // 60 / 200
    expect(profitMarginOf(r)).toBe(140); // 200 − 60
  });
});
