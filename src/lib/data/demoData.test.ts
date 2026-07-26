import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it, expect, beforeAll } from "vitest";
import { resetDb } from "@/lib/data/mock/db";
import { materialsRepo, type MaterialInput } from "@/lib/data/mock/materials";
import { recipesRepo, type ImportRecipeLine } from "@/lib/data/mock/recipes";
import { canonicalPurchase, type MeasurementType } from "@/lib/units";

// Proves the shipped demo CSVs actually import and produce a believable cost
// spread — rather than us asserting they do. Runs the real import + costing path,
// so a bad price or a typo'd ingredient name in a CSV fails here.

const ACTOR = "u-owner";
const DIR = join(__dirname, "..", "..", "..", "demo-data");
const TARGET = 30; // default food_cost_pct

/** Minimal CSV reader — the demo files have no quoted commas. */
function readCsv(file: string): Record<string, string>[] {
  const text = readFileSync(join(DIR, file), "utf8").trim();
  const [head, ...lines] = text.split(/\r?\n/);
  const cols = head.split(",");
  return lines
    .filter((l) => l.trim())
    .map((l) => {
      const cells = l.split(",");
      return Object.fromEntries(cols.map((c, i) => [c, (cells[i] ?? "").trim()]));
    });
}

const TYPE: Record<string, MeasurementType> = { Weight: "weight", Liquid: "volume", Count: "count" };

function materialRows(): MaterialInput[] {
  return readCsv("1_raw-materials.csv").map((r) => {
    const canon = canonicalPurchase(TYPE[r["Material Type"]] ?? "weight");
    return {
      ingredient_name: r.Ingredient,
      category: r.Category,
      purchase_price: Number(r["Purchase Price"]),
      purchase_quantity: 1,
      purchase_unit: canon.purchase_unit,
      base_unit: canon.base_unit,
    };
  });
}

function recipeLines(file: string): ImportRecipeLine[] {
  return readCsv(file).map((r) => ({
    recipe_name: r["Prep Name"] ?? r["Recipe Name"],
    category: r.Category || "Uncategorised",
    size: null,
    ingredient_name: r.Ingredient,
    quantity: Number(r.Quantity),
    unit: r.Unit || "Gram",
    selling_price: r["Selling Price"] ? Number(r["Selling Price"]) : null,
    packaging_cost: r.Packaging ? Number(r.Packaging) : null,
    image_url: r.Image || null,
  }));
}

describe("demo data imports cleanly and costs sensibly", () => {
  beforeAll(async () => {
    resetDb();
    await materialsRepo.importMaterials("upsert", materialRows(), ACTOR);
    await recipesRepo.importRecipes("upsert", recipeLines("3_in-house-prep.csv"), ACTOR, true, "demo-brand");
    await recipesRepo.importRecipes("upsert", recipeLines("4_menu-recipes.csv"), ACTOR, false, "demo-brand");
  });

  it("imports every ingredient with a price", async () => {
    const mats = await materialsRepo.list();
    expect(mats.length).toBe(materialRows().length);
    expect(mats.every((m) => m.cost_per_base_unit != null && m.cost_per_base_unit > 0)).toBe(true);
  });

  it("creates the preps and the menu dishes", async () => {
    const all = await recipesRepo.list();
    const preps = all.filter((r) => r.is_prep);
    const dishes = all.filter((r) => !r.is_prep);
    expect(preps.length).toBe(7);
    expect(dishes.length).toBe(8);
  });

  it("resolves every CSV ingredient — no unmatched names", async () => {
    const mats = await materialsRepo.list();
    const known = new Set(mats.map((m) => m.ingredient_name.toLowerCase()));
    const preps = (await recipesRepo.list()).filter((r) => r.is_prep);
    preps.forEach((p) => known.add(p.recipe_name.toLowerCase()));

    const referenced = [
      ...recipeLines("3_in-house-prep.csv"),
      ...recipeLines("4_menu-recipes.csv"),
    ].map((l) => l.ingredient_name.toLowerCase());

    const missing = [...new Set(referenced)].filter((n) => !known.has(n));
    expect(missing).toEqual([]);
  });

  it("costs every prep and dish above zero", async () => {
    const all = await recipesRepo.list();
    const uncosted = all.filter((r) => (r.total_cost ?? 0) <= 0).map((r) => r.recipe_name);
    expect(uncosted).toEqual([]);
  });

  it("attaches artwork to every menu dish", async () => {
    const dishes = (await recipesRepo.list()).filter((r) => !r.is_prep);
    expect(dishes.every((d) => (d.image_url ?? "").startsWith("/demo/"))).toBe(true);
  });

  it("lands a spread across the target — some under, at least one over", async () => {
    const dishes = (await recipesRepo.list()).filter((r) => !r.is_prep);
    const fcs = dishes
      .map((d) =>
        d.total_cost != null && d.selling_price != null && d.selling_price > 0
          ? (d.total_cost / d.selling_price) * 100
          : null,
      )
      .filter((v): v is number => v != null);

    expect(fcs.length).toBe(8); // every dish is priced
    expect(fcs.some((v) => v <= TARGET)).toBe(true); // healthy dishes exist
    expect(fcs.some((v) => v > TARGET)).toBe(true); // ...and something to act on
    // Nothing absurd — a demo shouldn't show a 300% food cost.
    expect(Math.max(...fcs)).toBeLessThan(80);
  });
});
