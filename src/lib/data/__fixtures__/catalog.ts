// Test-only catalog fixture.
//
// The app ships with an EMPTY catalog (see buildSeed), so tests that need
// materials/recipes build their own here — through the real repositories, so the
// costing chain, price cascade and history writes all run exactly as in the app.
//
// Deliberately tiny and hand-computed:
//
//   Flour              ₹40 / 1 KG    → ₹0.04/g
//   Olive Oil          ₹900 / 1 KG   → ₹0.90/g
//   Dried Red Chilli   ₹500 / 1 KG   → ₹0.50/g
//
//   Chilli Crisp (prep, 5% wastage)   1000 g chilli + 500 g oil
//   Chili Crunch Sauce (prep)         200 g Chilli Crisp  ← prep inside a prep
//   Pizza Dough (prep, 5% wastage)    1000 g flour + 221 g oil
//   Signature Pizza (menu dish)       250 g Pizza Dough
//
// Nothing here is loaded by the app; it exists only under test.

import { materialsRepo } from "../mock/materials";
import { recipesRepo } from "../mock/recipes";
import { brandsRepo } from "../mock/brands";
import { outletsRepo } from "../mock/outlets";
import type { BrandRecord, OutletRecord, RawMaterial, Recipe } from "../types";

/** The seeded owner — the only account that exists on a fresh DB. */
export const ACTOR = "u-owner";

/** Brand id the fixture files its recipes under. Opaque — brands are user-created. */
export const TEST_BRAND = "test-brand";

/** Create a brand (and one outlet under it) for tests that need a real brand id. */
export async function seedTestBrand(
  name = "Test Brand",
  code = "TB",
): Promise<{ brand: BrandRecord; outlet: OutletRecord }> {
  const brand = await brandsRepo.create({ name, brand_code: code }, ACTOR);
  const outlet = await outletsRepo.create(
    { brand_id: brand.id, name: `${name} Central`, outlet_code: `${code}-CEN` },
    ACTOR,
  );
  return { brand, outlet };
}

export interface TestCatalog {
  flour: RawMaterial;
  oil: RawMaterial;
  chilli: RawMaterial;
  crisp: Recipe;
  sauce: Recipe;
  dough: Recipe;
  pizza: Recipe;
}

const perKg = (name: string, category: string, pricePerKg: number) => ({
  ingredient_name: name,
  category,
  purchase_price: pricePerKg,
  purchase_quantity: 1,
  purchase_unit: "KG",
  base_unit: "Gram",
});

/**
 * Create the fixture catalog in the current mock DB. Call after `resetDb()`.
 * Returns the created records so tests can reference real ids.
 */
export async function seedTestCatalog(): Promise<TestCatalog> {
  const flour = await materialsRepo.create(perKg("Flour", "Grains & Flour", 40), ACTOR);
  const oil = await materialsRepo.create(perKg("Olive Oil", "Oils & Fats", 900), ACTOR);
  const chilli = await materialsRepo.create(perKg("Dried Red Chilli", "Spices", 500), ACTOR);

  // Child prep: mostly dried red chilli, so a chilli price rise must move it.
  const crisp = await recipesRepo.create(
    {
      recipe_name: "Chilli Crisp",
      category: "In-House Prep",
      brand: TEST_BRAND,
      serving_size: 1,
      is_prep: true,
      yield_quantity: 1500,
      yield_unit: "Gram",
      wastage_pct: 5,
    },
    [
      { ingredient_id: chilli.id, quantity_used: 1000, unit_used: "Gram" },
      { ingredient_id: oil.id, quantity_used: 500, unit_used: "Gram" },
    ],
    ACTOR,
  );

  // Parent prep referencing the child prep as a component (prep inside a prep).
  const sauce = await recipesRepo.create(
    {
      recipe_name: "Chili Crunch Sauce",
      category: "In-House Prep",
      brand: TEST_BRAND,
      serving_size: 1,
      is_prep: true,
      yield_quantity: 400,
      yield_unit: "Gram",
      wastage_pct: 5,
    },
    [
      { ingredient_id: crisp.id, component_type: "recipe", quantity_used: 200, unit_used: "Gram" },
      { ingredient_id: oil.id, quantity_used: 200, unit_used: "Gram" },
    ],
    ACTOR,
  );

  // 221 g of olive oil: a +₹1000/KG rise on oil adds ≈ ₹221 raw, ≈ ₹232 with 5% wastage.
  const dough = await recipesRepo.create(
    {
      recipe_name: "Pizza Dough",
      category: "In-House Prep",
      brand: TEST_BRAND,
      serving_size: 1,
      is_prep: true,
      yield_quantity: 1221,
      yield_unit: "Gram",
      wastage_pct: 5,
    },
    [
      { ingredient_id: flour.id, quantity_used: 1000, unit_used: "Gram" },
      { ingredient_id: oil.id, quantity_used: 221, unit_used: "Gram" },
    ],
    ACTOR,
  );

  // Menu dish built from the dough prep.
  const pizza = await recipesRepo.create(
    {
      recipe_name: "Signature Pizza",
      category: "Pizza",
      brand: TEST_BRAND,
      serving_size: 1,
      selling_price: 450,
      packaging_cost: 12,
    },
    [{ ingredient_id: dough.id, component_type: "recipe", quantity_used: 250, unit_used: "Gram" }],
    ACTOR,
  );

  return { flour, oil, chilli, crisp, sauce, dough, pizza };
}

/** Re-read a recipe's current total cost (recipes are recomputed in place). */
export async function totalCost(id: string): Promise<number> {
  const r = await recipesRepo.getById(id);
  if (!r) throw new Error(`fixture recipe ${id} missing`);
  return r.total_cost ?? 0;
}

/** Raise a material's price by `delta` per KG through the real update path. */
export async function bumpPricePerKg(m: RawMaterial, delta: number): Promise<void> {
  await materialsRepo.update(
    m.id,
    {
      ingredient_name: m.ingredient_name,
      category: m.category,
      purchase_price: (m.purchase_price ?? 0) + delta,
      purchase_quantity: 1,
      purchase_unit: "KG",
      base_unit: "Gram",
    },
    ACTOR,
  );
}
