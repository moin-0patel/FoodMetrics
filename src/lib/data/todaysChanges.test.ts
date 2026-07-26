import { describe, it, expect, beforeEach } from "vitest";
import { resetDb } from "./mock/db";
import { materialsRepo } from "./mock/materials";
import { recipesRepo } from "./mock/recipes";
import type { ImportRecipeLine } from "./mock/recipes";
import { canonicalPurchase, measurementTypeFromBaseUnit } from "../units";

// End-to-end verification of the behaviours changed in this session, exercised
// against the real mock repos + pure engines (not just type-checked).

const ACTOR = "u-admin";

describe("simplified raw-material purchase model", () => {
  it("weight → priced per 1 kg (base Gram, ×1000)", () => {
    expect(canonicalPurchase("weight")).toMatchObject({
      purchase_unit: "KG",
      base_unit: "Gram",
      baseUnitsPerCanonical: 1000,
      displayUnit: "1 kg",
    });
  });
  it("volume → priced per 1 litre (base ML, ×1000)", () => {
    expect(canonicalPurchase("volume")).toMatchObject({
      purchase_unit: "Litre",
      base_unit: "ML",
      baseUnitsPerCanonical: 1000,
      displayUnit: "1 litre",
    });
  });
  it("count → priced per 1 piece", () => {
    expect(canonicalPurchase("count")).toMatchObject({
      purchase_unit: "Piece",
      base_unit: "Piece",
      baseUnitsPerCanonical: 1,
      displayUnit: "1 piece",
    });
  });
  it("derives the type from a stored base unit (edit + import path)", () => {
    expect(measurementTypeFromBaseUnit("Gram")).toBe("weight");
    expect(measurementTypeFromBaseUnit("ML")).toBe("volume");
    expect(measurementTypeFromBaseUnit("Piece")).toBe("count");
  });
});

describe("raw material created on the per-1-unit model is cost-correct", () => {
  beforeEach(() => resetDb());

  it("₹100 per 1 kg → cost_per_base_unit ₹0.10/g", async () => {
    const m = await materialsRepo.create(
      { ingredient_name: "Verify Onion", category: "Vegetables", purchase_price: 100, purchase_quantity: 1, purchase_unit: "KG", base_unit: "Gram" },
      ACTOR,
    );
    expect(m.cost_per_base_unit).toBeCloseTo(0.1, 6);
  });

  it("₹200 per 1 litre → cost_per_base_unit ₹0.20/ml", async () => {
    const m = await materialsRepo.create(
      { ingredient_name: "Verify Oil", category: "Oils", purchase_price: 200, purchase_quantity: 1, purchase_unit: "Litre", base_unit: "ML" },
      ACTOR,
    );
    expect(m.cost_per_base_unit).toBeCloseTo(0.2, 6);
  });

  it("₹5 per 1 piece → cost_per_base_unit ₹5/piece", async () => {
    const m = await materialsRepo.create(
      { ingredient_name: "Verify Egg", category: "Dairy", purchase_price: 5, purchase_quantity: 1, purchase_unit: "Piece", base_unit: "Piece" },
      ACTOR,
    );
    expect(m.cost_per_base_unit).toBeCloseTo(5, 6);
  });

  it("a pending price stays null (no cost fabricated)", async () => {
    const m = await materialsRepo.create(
      { ingredient_name: "Verify Pending", category: "Other", purchase_price: null, purchase_quantity: 1, purchase_unit: "KG", base_unit: "Gram" },
      ACTOR,
    );
    expect(m.cost_per_base_unit).toBeNull();
  });
});

describe("In-House Prep import creates real preps", () => {
  beforeEach(() => resetDb());

  const prepRows: ImportRecipeLine[] = [
    { recipe_name: "Verify Sauce", category: "Sauces", size: null, ingredient_name: "Verify Tomato", quantity: 500, unit: "Gram", selling_price: null, packaging_cost: null },
    { recipe_name: "Verify Sauce", category: "Sauces", size: null, ingredient_name: "Verify Garlic", quantity: 100, unit: "Gram", selling_price: null, packaging_cost: null },
  ];

  it("marks is_prep, has no menu price/packaging, and a positive yield", async () => {
    const summary = await recipesRepo.importRecipes("add", prepRows, ACTOR, true);
    expect(summary.imported).toBe(1);

    const prep = (await recipesRepo.list()).find((r) => r.recipe_name === "Verify Sauce");
    expect(prep).toBeTruthy();
    expect(prep!.is_prep).toBe(true);
    expect(prep!.selling_price).toBeNull();
    expect(prep!.packaging_cost).toBe(0);
    expect(prep!.yield_quantity).toBeGreaterThan(0);
  });

  it("groups both ingredient rows onto the one prep", async () => {
    await recipesRepo.importRecipes("add", prepRows, ACTOR, true);
    const prep = (await recipesRepo.list()).find((r) => r.recipe_name === "Verify Sauce")!;
    const withLines = await recipesRepo.getWithIngredients(prep.id);
    expect(withLines?.ingredients.length).toBe(2);
  });
});

describe("Recipe import (isPrep=false) stays a menu recipe", () => {
  beforeEach(() => resetDb());

  it("keeps is_prep=false and persists the menu price + packaging", async () => {
    const rows: ImportRecipeLine[] = [
      { recipe_name: "Verify Pizza", category: "Pizza", size: null, ingredient_name: "Verify Dough", quantity: 300, unit: "Gram", selling_price: 500, packaging_cost: 20 },
    ];
    const summary = await recipesRepo.importRecipes("add", rows, ACTOR, false);
    expect(summary.imported).toBe(1);

    const rec = (await recipesRepo.list()).find((r) => r.recipe_name === "Verify Pizza")!;
    expect(rec.is_prep).toBe(false);
    expect(rec.selling_price).toBe(500);
    expect(rec.packaging_cost).toBe(20);
  });
});
