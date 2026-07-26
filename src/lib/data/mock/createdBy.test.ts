import { describe, it, expect, beforeEach } from "vitest";
import { resetDb } from "./db";
import { recipesRepo } from "./recipes";
import { materialsRepo } from "./materials";

const ACTOR = "u-owner";
const header = (name: string, createdBy?: string) => ({
  recipe_name: name,
  created_by_name: createdBy,
  category: "Test",
  brand: "test-brand",
  serving_size: 1,
});

describe("recipe Created By (manual creator label)", () => {
  // The catalog starts empty, so create the one material these recipes need.
  beforeEach(async () => {
    resetDb();
    await materialsRepo.create(
      { ingredient_name: "Flour", category: "Grains & Flour", purchase_price: 40, purchase_quantity: 1, purchase_unit: "KG", base_unit: "Gram" },
      ACTOR,
    );
  });
  const line = async () => ({ ingredient_id: (await materialsRepo.list())[0].id, quantity_used: 100, unit_used: "Gram" });

  it("stores the typed Created By on create", async () => {
    const r = await recipesRepo.create(header("CB New", "Chef Rahul"), [await line()], ACTOR);
    expect(r.created_by_name).toBe("Chef Rahul");
  });

  it("lets an existing recipe's Created By be set/changed on update", async () => {
    const l = [await line()];
    const r = await recipesRepo.create(header("CB Edit", "Central Kitchen"), l, ACTOR);
    const updated = await recipesRepo.update(r.id, header("CB Edit", "Executive Chef"), l, ACTOR);
    expect(updated.created_by_name).toBe("Executive Chef");
  });

  it("trims blanks to null", async () => {
    const r = await recipesRepo.create(header("CB Blank", "   "), [await line()], ACTOR);
    expect(r.created_by_name).toBeNull();
  });
});
