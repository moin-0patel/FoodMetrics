import { describe, it, expect, beforeEach } from "vitest";
import { resetDb } from "./mock/db";
import { materialsRepo } from "./mock/materials";
import { recipesRepo } from "./mock/recipes";
import { yieldsRepo } from "./mock/yields";
import { calculateCostPerBaseUnit } from "../costing";
import { seedTestCatalog, totalCost, bumpPricePerKg, ACTOR, type TestCatalog } from "./__fixtures__/catalog";

// VERIFICATION ONLY — asserts the existing costing chain is correct end to end.
// No pricing formula is changed here; this is the audit proof. The catalog ships
// empty, so the fixture builds the material → prep → prep → dish chain first.

describe("costing audit", () => {
  let fx: TestCatalog;

  beforeEach(async () => {
    resetDb();
    fx = await seedTestCatalog();
  });

  it("raw material: price ÷ (qty × conversion) = cost per base unit", async () => {
    const m = await materialsRepo.create(
      { ingredient_name: "Audit Onion", category: "Vegetables", purchase_price: 100, purchase_quantity: 1, purchase_unit: "KG", base_unit: "Gram" },
      ACTOR,
    );
    expect(m.cost_per_base_unit).toBeCloseTo(0.1, 6); // ₹100 / 1000 g
    expect(calculateCostPerBaseUnit(240, 1, "Litre", "ML")).toBeCloseTo(0.24, 6);
  });

  it("sub-recipe: a raw-material price change flows leaf → prep → parent (latest cost, no stale)", async () => {
    // Chili Crunch Sauce (parent prep) is costed from Chilli Crisp (child prep),
    // which is mostly dried red chilli. Raising the leaf must roll up through both.
    const crispBefore = await totalCost(fx.crisp.id);
    const sauceBefore = await totalCost(fx.sauce.id);

    await bumpPricePerKg(fx.chilli, 500);

    expect(await totalCost(fx.crisp.id)).toBeGreaterThan(crispBefore); // child prep recomputed
    expect(await totalCost(fx.sauce.id)).toBeGreaterThan(sauceBefore); // parent used the LATEST sub-recipe cost
  });

  it("yield: adding a wastage yield for an ingredient recomputes recipes that use it", async () => {
    const doughBefore = await totalCost(fx.dough.id);
    // A 30% wastage yield on olive oil raises its effective ₹/g, so the dough costs more.
    await yieldsRepo.create(
      { ingredient_id: fx.oil.id, purchase_cost: 900, purchase_quantity: 1, purchase_unit: "KG", wastage_quantity: 300, wastage_unit: "Gram" },
      ACTOR,
    );
    expect(await totalCost(fx.dough.id)).toBeGreaterThan(doughBefore);
  });

  it("a menu dish costed from a prep component has a positive per-portion cost", async () => {
    const pizza = await recipesRepo.getById(fx.pizza.id);
    expect(pizza!.cost_per_portion ?? 0).toBeGreaterThan(0);
    // Raising a leaf inside the prep must reach the dish two levels up.
    const before = await totalCost(fx.pizza.id);
    await bumpPricePerKg(fx.flour, 400);
    expect(await totalCost(fx.pizza.id)).toBeGreaterThan(before);
  });

  it("selling price never affects total cost (only food cost %)", async () => {
    const costBefore = (await recipesRepo.getById(fx.pizza.id))!.total_cost;
    await recipesRepo.setSellingPrice(fx.pizza.id, 5000, ACTOR);
    const after = (await recipesRepo.getById(fx.pizza.id))!;
    expect(after.total_cost).toBe(costBefore); // cost unchanged
    expect(after.selling_price).toBe(5000);
  });
});
