import { describe, it, expect, beforeEach } from "vitest";
import { resetDb } from "@/lib/data/mock/db";
import { recipesRepo } from "@/lib/data/mock/recipes";
import { materialsRepo } from "@/lib/data/mock/materials";
import { deriveBrandScope } from "./useBrandScope";

// Proves the app-wide brand scoping: a brand's derived material/packaging set is
// exactly what that brand's recipes use (transitively through prep sub-recipes),
// so switching brands shows different catalogue data. Brands and the catalog are
// both user-created, so the test builds two brands with overlapping-but-distinct
// ingredient sets, plus a prep to prove transitive pull-in.

const ACTOR = "u-owner";
const BRAND_A = "brand-a";
const BRAND_B = "brand-b";

const perKg = (name: string, price: number) => ({
  ingredient_name: name,
  category: "Test",
  purchase_price: price,
  purchase_quantity: 1,
  purchase_unit: "KG",
  base_unit: "Gram",
});

async function buildTwoBrandCatalog() {
  // shared is used by both brands; onlyA / onlyB are exclusive to one each.
  const shared = await materialsRepo.create(perKg("Shared Salt", 20), ACTOR);
  const onlyA = await materialsRepo.create(perKg("A-Only Cheese", 600), ACTOR);
  const onlyB = await materialsRepo.create(perKg("B-Only Miso", 900), ACTOR);
  const doughMat = await materialsRepo.create(perKg("Flour", 40), ACTOR);

  // A prep sub-recipe: its flour is only reachable via brand A's dish.
  const dough = await recipesRepo.create(
    { recipe_name: "Pizza Dough", category: "In-House Prep", brand: BRAND_A, serving_size: 1, is_prep: true, yield_quantity: 1000, yield_unit: "Gram" },
    [{ ingredient_id: doughMat.id, quantity_used: 1000, unit_used: "Gram" }],
    ACTOR,
  );

  await recipesRepo.create(
    { recipe_name: "A Dish", category: "Mains", brand: BRAND_A, serving_size: 1 },
    [
      { ingredient_id: shared.id, quantity_used: 5, unit_used: "Gram" },
      { ingredient_id: onlyA.id, quantity_used: 100, unit_used: "Gram" },
      { ingredient_id: dough.id, component_type: "recipe", quantity_used: 250, unit_used: "Gram" },
    ],
    ACTOR,
  );

  await recipesRepo.create(
    { recipe_name: "B Dish", category: "Mains", brand: BRAND_B, serving_size: 1 },
    [
      { ingredient_id: shared.id, quantity_used: 5, unit_used: "Gram" },
      { ingredient_id: onlyB.id, quantity_used: 80, unit_used: "Gram" },
    ],
    ACTOR,
  );

  return { shared, onlyA, onlyB, doughMat };
}

async function scopes() {
  const recipes = await recipesRepo.list();
  const links = await recipesRepo.allIngredients();
  const pkg = await recipesRepo.allPackaging();
  return {
    a: deriveBrandScope(BRAND_A, recipes, links, pkg),
    b: deriveBrandScope(BRAND_B, recipes, links, pkg),
  };
}

describe("deriveBrandScope", () => {
  beforeEach(() => resetDb());

  it("scopes materials + packaging to each brand's recipes, differing per brand", async () => {
    const fx = await buildTwoBrandCatalog();
    const { a, b } = await scopes();

    // Both brands actually use ingredients.
    expect(a.materialIds.size).toBeGreaterThan(0);
    expect(b.materialIds.size).toBeGreaterThan(0);

    // The two brands are not identical catalogues (each has something the other lacks).
    expect(a.materialIds.has(fx.onlyA.id)).toBe(true);
    expect(b.materialIds.has(fx.onlyB.id)).toBe(true);
    const aOnly = [...a.materialIds].filter((m) => !b.materialIds.has(m));
    const bOnly = [...b.materialIds].filter((m) => !a.materialIds.has(m));
    expect(aOnly.length + bOnly.length).toBeGreaterThan(0);

    // ...but a material used by both brands is in both scopes.
    expect(a.materialIds.has(fx.shared.id)).toBe(true);
    expect(b.materialIds.has(fx.shared.id)).toBe(true);

    // Transitive prep pull-in: the dough is a prep sub-recipe of brand A's dish,
    // so the dough's own flour lands in brand A's material scope.
    expect(a.materialIds.has(fx.doughMat.id)).toBe(true);
  });

  it("an unselected brand's exclusive material is filtered out", async () => {
    const fx = await buildTwoBrandCatalog();
    const { a, b } = await scopes();

    // Anything exclusive to B must NOT appear in A's scope, and vice versa.
    expect(a.materialIds.has(fx.onlyB.id)).toBe(false);
    expect(b.materialIds.has(fx.onlyA.id)).toBe(false);
    // B has no prep, so A's dough material is out of B's scope too.
    expect(b.materialIds.has(fx.doughMat.id)).toBe(false);
  });
});
