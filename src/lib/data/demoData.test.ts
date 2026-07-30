import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it, expect, beforeAll } from "vitest";
import { resetDb } from "@/lib/data/mock/db";
import { materialsRepo, type MaterialInput } from "@/lib/data/mock/materials";
import { recipesRepo, type ImportRecipeLine } from "@/lib/data/mock/recipes";
import { yieldsRepo, type ImportYieldRow } from "@/lib/data/mock/yields";
import { canonicalPurchase, type MeasurementType } from "@/lib/units";

// Proves the shipped demo CSVs actually import and produce a believable cost
// spread — rather than us asserting they do. Runs the real import + costing path
// for all four files in the documented order, so a bad price, a typo'd ingredient
// name or a missing column in a CSV fails here.

const ACTOR = "u-owner";
const DIR = join(__dirname, "..", "..", "..", "demo-data");
const TARGET = 30; // default food_cost_pct
const CATEGORIES = ["Pizza", "Pasta", "Burgers", "Starters", "Desserts"];

/** RFC-4180-ish reader: handles double-quoted cells so descriptions and method
 *  steps can contain commas. The app itself parses via SheetJS (see
 *  src/lib/import/parseFile.ts), which is already quote-aware. */
function splitRow(line: string): string[] {
  const cells: string[] = [];
  let cur = "";
  let quoted = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (quoted) {
      if (ch === '"') {
        if (line[i + 1] === '"') { cur += '"'; i++; } else quoted = false;
      } else cur += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === ",") { cells.push(cur); cur = ""; }
    else cur += ch;
  }
  cells.push(cur);
  return cells.map((c) => c.trim());
}

function readCsv(file: string): Record<string, string>[] {
  // The CSVs carry a UTF-8 BOM so Excel and SheetJS decode ₹ and · correctly.
  // Node's utf8 decode keeps it, which would corrupt the first header name.
  const text = readFileSync(join(DIR, file), "utf8").replace(/^﻿/, "").trim();
  const [head, ...lines] = text.split(/\r?\n/);
  const cols = splitRow(head);
  return lines
    .filter((l) => l.trim())
    .map((l) => {
      const cells = splitRow(l);
      return Object.fromEntries(cols.map((c, i) => [c, cells[i] ?? ""]));
    });
}

const TYPE: Record<string, MeasurementType> = { Weight: "weight", Liquid: "volume", Count: "count" };

function materialRows(): MaterialInput[] {
  return readCsv("1_raw-materials.csv").map((r) => {
    const canon = canonicalPurchase(TYPE[r["Material Type"]] ?? "weight");
    return {
      ingredient_name: r.Ingredient,
      category: r.Category,
      notes: r.Notes || null,
      purchase_price: Number(r["Purchase Price"]),
      purchase_quantity: 1,
      purchase_unit: canon.purchase_unit,
      base_unit: canon.base_unit,
    };
  });
}

function yieldRows(): ImportYieldRow[] {
  return readCsv("2_yield.csv").map((r) => ({
    ingredient_name: r.Ingredient,
    purchase_cost: Number(r["Purchase Cost"]),
    purchase_quantity: Number(r["Purchase Quantity"]),
    purchase_unit: r["Purchase Unit"],
    wastage_quantity: Number(r["Wastage Quantity"]),
    effective_from: r["Effective From"] || null,
    notes: r.Notes || null,
  }));
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
    description: r.Description || null,
    method: r.Method ? r.Method.split("|").map((s) => s.trim()).filter(Boolean) : null,
    preparation_time: r["Prep Time"] ? Number(r["Prep Time"]) : null,
    created_by_name: r["Created By"] || null,
  }));
}

describe("demo data imports cleanly and costs sensibly", () => {
  beforeAll(async () => {
    resetDb();
    await materialsRepo.importMaterials("upsert", materialRows(), ACTOR);
    await yieldsRepo.importYields("upsert", yieldRows(), ACTOR);
    await recipesRepo.importRecipes("upsert", recipeLines("3_in-house-prep.csv"), ACTOR, true, "demo-brand");
    await recipesRepo.importRecipes("upsert", recipeLines("4_menu-recipes.csv"), ACTOR, false, "demo-brand");
  });

  it("imports every ingredient with a price", async () => {
    const mats = await materialsRepo.list();
    expect(mats.length).toBe(materialRows().length);
    expect(mats.every((m) => m.cost_per_base_unit != null && m.cost_per_base_unit > 0)).toBe(true);
  });

  it("records a supplier note against every ingredient", async () => {
    const mats = await materialsRepo.list();
    expect(mats.every((m) => (m.notes ?? "").length > 0)).toBe(true);
  });

  it("creates the preps and the menu dishes", async () => {
    const all = await recipesRepo.list();
    const preps = all.filter((r) => r.is_prep);
    const dishes = all.filter((r) => !r.is_prep);
    expect(preps.length).toBe(6);
    expect(dishes.length).toBe(5);
  });

  it("puts exactly one dish in each of the five menu categories", async () => {
    const dishes = (await recipesRepo.list()).filter((r) => !r.is_prep);
    expect([...dishes.map((d) => d.category)].sort()).toEqual([...CATEGORIES].sort());
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

  // The sub-recipe tree is the point of the demo: a dish should cost up through
  // its preps, and no prep should sit there unused.
  it("wires every in-house prep into at least one dish", async () => {
    const all = await recipesRepo.list();
    const lines = await recipesRepo.allIngredients();
    const usedIds = new Set(
      lines.filter((l) => l.component_type === "recipe").map((l) => l.ingredient_id),
    );
    const orphans = all.filter((r) => r.is_prep && !usedIds.has(r.id)).map((r) => r.recipe_name);
    expect(orphans).toEqual([]);

    // Only the lava cake is built straight from raw materials.
    const dishesOnPreps = all
      .filter((r) => !r.is_prep)
      .filter((d) =>
        lines.some((l) => l.recipe_id === d.id && l.component_type === "recipe"),
      );
    expect(dishesOnPreps.length).toBe(4);
  });

  it("gives every recipe a description, method steps and a prep time", async () => {
    const all = await recipesRepo.list();
    const thin = all.filter(
      (r) => !(r.description ?? "").trim() || r.method.length === 0 || !r.preparation_time,
    );
    expect(thin.map((r) => r.recipe_name)).toEqual([]);
    expect(all.every((r) => (r.created_by_name ?? "").length > 0)).toBe(true);
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

    expect(fcs.length).toBe(5); // every dish is priced
    expect(fcs.some((v) => v <= TARGET)).toBe(true); // healthy dishes exist
    expect(fcs.some((v) => v > TARGET)).toBe(true); // ...and something to act on
    // Nothing absurd — a demo shouldn't show a 300% food cost.
    expect(Math.max(...fcs)).toBeLessThan(80);
  });
});
