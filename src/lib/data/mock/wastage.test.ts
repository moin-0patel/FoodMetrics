import { describe, it, expect, beforeEach } from "vitest";
import { resetDb } from "./db";
import { wastageRepo } from "./wastage";
import { seedTestCatalog, seedTestBrand, ACTOR, type TestCatalog } from "../__fixtures__/catalog";

describe("multi-line wastage", () => {
  let fx: TestCatalog;
  let brandId: string;
  let outletId: string;

  beforeEach(async () => {
    resetDb();
    fx = await seedTestCatalog();
    const { brand, outlet } = await seedTestBrand();
    brandId = brand.id;
    outletId = outlet.id;
  });

  it("sums line costs + packaging into total_cost and stores itemised lines", async () => {
    const entry = await wastageRepo.create(
      {
        name: "Evening spoilage",
        wastage_date: "2026-06-01",
        brand: brandId,
        outlet_id: outletId,
        category: "Kitchen",
        wastage_type: "Spoilage",
        reason: "spoiled",
        department: "Kitchen Staff",
        done_by: "Tester",
        packaging_cost: 10,
        lines: [
          { item_type: "ingredient", ingredient_id: fx.flour.id, recipe_id: null, quantity: 2, unit: "Gram", unit_cost: 5 },
          { item_type: "ingredient", ingredient_id: fx.oil.id, recipe_id: null, quantity: 1, unit: "Gram", unit_cost: 3 },
        ],
      },
      ACTOR,
    );
    // ingredient cost = 2*5 + 1*3 = 13; + packaging 10 = 23
    expect(entry.total_cost).toBe(23);
    expect(entry.name).toBe("Evening spoilage");
    expect(entry.status).toBe("recorded");

    const withLines = await wastageRepo.getWithLines(entry.id);
    expect(withLines?.lines.length).toBe(2);
    expect(withLines?.lines[0].name).toBeTruthy();
    expect(withLines?.lines[0].total_cost).toBe(10);
  });

  it("recomputes the total on update and deletes lines with the record", async () => {
    const base = {
      wastage_date: "2026-06-01",
      brand: brandId,
      outlet_id: outletId,
      wastage_type: "Spoilage" as const,
      reason: "x",
      department: "Kitchen Staff" as const,
      done_by: "T",
    };
    const entry = await wastageRepo.create(
      { ...base, packaging_cost: 0, lines: [{ item_type: "ingredient", ingredient_id: fx.flour.id, recipe_id: null, quantity: 1, unit: "Gram", unit_cost: 4 }] },
      ACTOR,
    );
    expect(entry.total_cost).toBe(4);
    const updated = await wastageRepo.update(
      entry.id,
      { ...base, packaging_cost: 5, lines: [{ item_type: "ingredient", ingredient_id: fx.flour.id, recipe_id: null, quantity: 3, unit: "Gram", unit_cost: 4 }] },
      ACTOR,
    );
    expect(updated.total_cost).toBe(17); // 3*4 + 5
    await wastageRepo.remove(entry.id, ACTOR);
    expect(await wastageRepo.getWithLines(entry.id)).toBeNull();
  });
});
