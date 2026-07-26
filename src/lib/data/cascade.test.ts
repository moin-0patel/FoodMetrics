import { describe, it, expect, beforeEach } from "vitest";
import { resetDb } from "./mock/db";
import { materialsRepo } from "./mock/materials";
import { recipesRepo } from "./mock/recipes";
import { seedTestCatalog, totalCost, bumpPricePerKg, type TestCatalog } from "./__fixtures__/catalog";

// Validates the price cascade (PRD §4.5): updating an ingredient price
// recalculates every recipe that uses it and records cost history. The catalog
// ships empty, so the fixture builds the Pizza Dough prep (221 g olive oil,
// 5% wastage) through the real repos.
describe("price cascade", () => {
  let fx: TestCatalog;

  beforeEach(async () => {
    resetDb();
    fx = await seedTestCatalog();
  });

  it("a prep built from priced materials has a positive cost", async () => {
    const dough = await recipesRepo.getById(fx.dough.id);
    expect(dough).toBeTruthy();
    expect(dough!.total_cost!).toBeGreaterThan(0);
  });

  it("raising Olive Oil price cascades to recipes that use it", async () => {
    const before = await totalCost(fx.dough.id);
    const origPrice = fx.oil.purchase_price!;
    // Building the fixture already writes history (creating the pizza recomputes
    // the dough it references), so measure the delta this update causes.
    const historyBefore = (await recipesRepo.costHistory(fx.dough.id)).length;

    // +₹1000/KG = +₹1/g; Pizza Dough uses 221 g olive oil ⇒ +₹221 raw, +5% wastage.
    await bumpPricePerKg(fx.oil, 1000);

    const after = await totalCost(fx.dough.id);
    // +₹221 raw, then +5% wastage ⇒ ≈ ₹232 increase in the prep total.
    expect(after - before).toBeGreaterThan(225);
    expect(after - before).toBeLessThan(240);

    const history = await recipesRepo.costHistory(fx.dough.id);
    expect(history.length).toBe(historyBefore + 1);
    const latest = history[0]; // costHistory sorts newest-first
    expect(latest.old_total_cost).toBe(before);
    expect(latest.new_total_cost).toBe(after);

    const priceLog = await materialsRepo.priceHistory(fx.oil.id);
    expect(priceLog[0].old_price).toBe(origPrice);
    expect(priceLog[0].new_price).toBe(origPrice + 1000);
  });
});
