import { describe, it, expect, beforeEach } from "vitest";
import { resetDb } from "./mock/db";
import { recipesRepo } from "./mock/recipes";
import { seedTestCatalog, totalCost, bumpPricePerKg, type TestCatalog } from "./__fixtures__/catalog";

// Validates nested (in-house prep) sub-recipes: a prep recipe references another
// prep as a component, and a leaf material price change rolls up prep → parent.
// The fixture builds Chili Crunch Sauce (which contains the Chilli Crisp prep).
describe("sub-recipe (in-house prep) costing", () => {
  let fx: TestCatalog;

  beforeEach(async () => {
    resetDb();
    fx = await seedTestCatalog();
  });

  it("Chili Crunch Sauce references another prep as a component", async () => {
    const data = await recipesRepo.getWithIngredients(fx.sauce.id);
    expect(data).toBeTruthy();
    const crisp = data!.ingredients.find((i) => i.ingredient_id === fx.crisp.id);
    expect(crisp?.component_type).toBe("recipe");
    expect(crisp?.subRecipe?.recipe_name).toBe("Chilli Crisp");
    expect(data!.recipe.total_cost!).toBeGreaterThan(0);
  });

  it("prep recipes are flagged is_prep with a positive yield", async () => {
    const dough = await recipesRepo.getById(fx.dough.id);
    expect(dough?.is_prep).toBe(true);
    expect(dough!.yield_quantity).toBeGreaterThan(0);
  });

  it("recipe total includes the wastage % on top of the raw ingredient cost", async () => {
    const data = await recipesRepo.getWithIngredients(fx.dough.id);
    const rawSum = data!.ingredients.reduce((s, i) => s + (i.calculated_cost ?? 0), 0);
    expect(data!.recipe.wastage_pct).toBe(5);
    expect(data!.recipe.total_cost!).toBeCloseTo(rawSum * 1.05, 1);
  });

  it("raising a leaf material price rolls up through the prep to the parent", async () => {
    const crispBefore = await totalCost(fx.crisp.id);
    const sauceBefore = await totalCost(fx.sauce.id);

    // Chilli Crisp is mostly dried red chilli (1 kg); raising it must lift both preps.
    await bumpPricePerKg(fx.chilli, 500);

    expect(await totalCost(fx.crisp.id)).toBeGreaterThan(crispBefore);
    expect(await totalCost(fx.sauce.id)).toBeGreaterThan(sauceBefore); // prep → prep roll-up
  });
});
