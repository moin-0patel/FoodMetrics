import { describe, it, expect, beforeEach } from "vitest";
import { toWeightGrams } from "./units";
import { formatWeight } from "./utils";
import { resetDb } from "./data/mock/db";
import { recipesRepo } from "./data/mock/recipes";
import { seedTestCatalog } from "./data/__fixtures__/catalog";

describe("dish weight — grams-equivalent engine", () => {
  it("weight units convert to grams", () => {
    expect(toWeightGrams(1, "KG")).toBe(1000);
    expect(toWeightGrams(250, "Gram")).toBe(250);
  });
  it("volume units convert to millilitres (treated 1:1 with grams)", () => {
    expect(toWeightGrams(1, "Litre")).toBe(1000);
    expect(toWeightGrams(80, "ML")).toBe(80);
  });
  it("count/piece units contribute no weight", () => {
    expect(toWeightGrams(3, "Piece")).toBe(0);
    expect(toWeightGrams(1, "Dozen")).toBe(0);
  });
  it("the spec example totals 500 g (250 + 150 + 80 + 20)", () => {
    const total =
      toWeightGrams(250, "Gram") +
      toWeightGrams(150, "Gram") +
      toWeightGrams(80, "Gram") +
      toWeightGrams(20, "Gram");
    expect(total).toBe(500);
  });
});

describe("formatWeight", () => {
  it("shows grams under 1 kg", () => expect(formatWeight(500)).toBe("500 g"));
  it("switches to kg at 1 kg and above", () => expect(formatWeight(1250)).toBe("1.25 kg"));
  it("shows a dash for zero / nullish", () => {
    expect(formatWeight(0)).toBe("—");
    expect(formatWeight(null)).toBe("—");
    expect(formatWeight(undefined)).toBe("—");
  });
});

describe("recipes carry a computed finished dish weight", () => {
  beforeEach(() => resetDb());
  it("a recipe's total_weight_g is the sum of its weight-bearing ingredients", async () => {
    const fx = await seedTestCatalog();
    // Pizza Dough = 1000 g flour + 221 g olive oil ⇒ 1221 g.
    const r = await recipesRepo.getById(fx.dough.id);
    expect(r).toBeTruthy();
    expect(r!.total_weight_g).toBeGreaterThan(0);
    expect(r!.total_weight_g).toBeCloseTo(1221, 1);
  });
});
