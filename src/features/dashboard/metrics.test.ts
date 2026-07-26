import { describe, it, expect } from "vitest";
import type { IngredientPriceHistory, RawMaterial, Recipe, RecipeCostHistory } from "@/lib/data/types";
import {
  computeKpis,
  costTrend,
  foodCostBySection,
  foodCostPct,
  marginHealthPct,
  menuDishes,
  recentPriceChanges,
  recipesNeedingAttention,
  relativeTime,
} from "./metrics";

// The dashboard must never invent a figure: with no data every metric is null or
// empty, so the UI can show an explicit empty state instead of a misleading zero.

const dish = (o: Partial<Recipe>): Recipe =>
  ({
    id: o.id ?? "r1",
    recipe_name: o.recipe_name ?? "Dish",
    category: o.category ?? "Mains",
    brand: o.brand ?? "b1",
    is_prep: false,
    status: "approved",
    total_cost: null,
    cost_per_portion: null,
    selling_price: null,
    created_at: "2026-06-01T00:00:00.000Z",
    ...o,
  }) as Recipe;

describe("foodCostPct", () => {
  it("is cost ÷ price as a percentage", () => {
    expect(foodCostPct({ total_cost: 30, selling_price: 100 })).toBe(30);
  });
  it("is null without both a cost and a price, and never divides by zero", () => {
    expect(foodCostPct({ total_cost: 30, selling_price: null })).toBeNull();
    expect(foodCostPct({ total_cost: null, selling_price: 100 })).toBeNull();
    expect(foodCostPct({ total_cost: 30, selling_price: 0 })).toBeNull();
  });
});

describe("menuDishes", () => {
  it("excludes preps, size variants and archived recipes", () => {
    const all = [
      dish({ id: "a" }),
      dish({ id: "b", is_prep: true }),
      dish({ id: "c", parent_recipe_id: "a" }),
      dish({ id: "d", archived_at: "2026-06-02T00:00:00.000Z" }),
    ];
    expect(menuDishes(all, "all").map((r) => r.id)).toEqual(["a"]);
  });

  it("filters to one brand when a brand is selected", () => {
    const all = [dish({ id: "a", brand: "b1" }), dish({ id: "b", brand: "b2" })];
    expect(menuDishes(all, "b2").map((r) => r.id)).toEqual(["b"]);
    expect(menuDishes(all, "all").length).toBe(2);
  });
});

describe("computeKpis", () => {
  it("returns nulls — not zeros — when there is no data", () => {
    const k = computeKpis([], 30, [], []);
    expect(k.avgFoodCostPct).toBeNull();
    expect(k.highestCost).toBeNull();
    expect(k.lastUpdate).toBeNull();
    expect(k.activeRecipes).toBe(0);
    expect(k.pricedCount).toBe(0);
  });

  it("averages only priced dishes and counts the rest as missing data", () => {
    const k = computeKpis(
      [
        dish({ id: "a", total_cost: 20, selling_price: 100 }), // 20%
        dish({ id: "b", total_cost: 40, selling_price: 100 }), // 40%
        dish({ id: "c" }), // unpriced
      ],
      30,
      [],
      [],
    );
    expect(k.avgFoodCostPct).toBeCloseTo(30, 6);
    expect(k.pricedCount).toBe(2);
    expect(k.missingData).toBe(1);
    expect(k.overTarget).toBe(1); // only the 40% dish
  });

  it("picks the highest cost-per-portion dish and the latest history stamp", () => {
    const k = computeKpis(
      [
        dish({ id: "a", recipe_name: "Cheap", cost_per_portion: 5 }),
        dish({ id: "b", recipe_name: "Pricey", cost_per_portion: 42 }),
      ],
      30,
      [{ changed_at: "2026-06-10T10:00:00.000Z" } as RecipeCostHistory],
      [{ changed_at: "2026-06-12T10:00:00.000Z" } as IngredientPriceHistory],
    );
    expect(k.highestCost).toEqual({ name: "Pricey", costPerPortion: 42 });
    expect(k.lastUpdate).toBe("2026-06-12T10:00:00.000Z");
  });
});

describe("foodCostBySection", () => {
  it("groups by category and flags status against the target", () => {
    const rows = foodCostBySection(
      [
        dish({ id: "a", category: "Mains", total_cost: 40, selling_price: 100 }), // 40% → critical
        dish({ id: "b", category: "Sides", total_cost: 20, selling_price: 100 }), // 20% → on target
        dish({ id: "c", category: "Sides", total_cost: 32, selling_price: 100 }), // avg 26% → warning
        dish({ id: "d", category: "Drinks" }), // unpriced
      ],
      25,
    );
    const by = Object.fromEntries(rows.map((r) => [r.section, r]));
    expect(by.Mains.status).toBe("critical");
    expect(by.Sides.actualPct).toBeCloseTo(26, 6);
    expect(by.Sides.status).toBe("warning"); // within 3 points over target
    expect(by.Drinks.actualPct).toBeNull();
    expect(by.Drinks.status).toBe("unpriced");
  });

  it("counts every dish in a section, priced or not", () => {
    const rows = foodCostBySection([dish({ id: "a" }), dish({ id: "b" })], 30);
    expect(rows[0].dishes).toBe(2);
  });
});

describe("recipesNeedingAttention", () => {
  it("lists only over-target dishes, worst first", () => {
    const items = recipesNeedingAttention(
      [
        dish({ id: "a", recipe_name: "Ok", total_cost: 20, selling_price: 100 }),
        dish({ id: "b", recipe_name: "Bad", total_cost: 40, selling_price: 100 }),
        dish({ id: "c", recipe_name: "Slightly", total_cost: 32, selling_price: 100 }),
      ],
      30,
    );
    expect(items.map((i) => i.name)).toEqual(["Bad", "Slightly"]);
    expect(items[0].severity).toBe("critical");
    expect(items[1].severity).toBe("warning");
  });

  it("is empty when everything is on target", () => {
    expect(recipesNeedingAttention([dish({ total_cost: 10, selling_price: 100 })], 30)).toEqual([]);
  });
});

describe("recentPriceChanges", () => {
  const mat = { id: "m1", ingredient_name: "Butter" } as RawMaterial;

  it("joins names, computes % change and sorts newest first", () => {
    const rows = recentPriceChanges(
      [
        { id: "h1", ingredient_id: "m1", old_price: 100, new_price: 110, changed_at: "2026-06-01T00:00:00.000Z" },
        { id: "h2", ingredient_id: "m1", old_price: 110, new_price: 99, changed_at: "2026-06-05T00:00:00.000Z" },
      ] as IngredientPriceHistory[],
      [mat],
    );
    expect(rows[0].id).toBe("h2");
    expect(rows[0].ingredient).toBe("Butter");
    expect(rows[0].changePct).toBeCloseTo(-10, 5);
    expect(rows[1].changePct).toBeCloseTo(10, 5);
  });

  it("returns a null change rather than dividing by a zero/absent old price", () => {
    const rows = recentPriceChanges(
      [{ id: "h", ingredient_id: "m1", old_price: 0, new_price: 50, changed_at: "2026-06-01T00:00:00.000Z" }] as IngredientPriceHistory[],
      [mat],
    );
    expect(rows[0].changePct).toBeNull();
  });

  it("labels an unmatched ingredient rather than crashing", () => {
    const rows = recentPriceChanges(
      [{ id: "h", ingredient_id: "gone", old_price: 1, new_price: 2, changed_at: "2026-06-01T00:00:00.000Z" }] as IngredientPriceHistory[],
      [],
    );
    expect(rows[0].ingredient).toBe("Unknown ingredient");
  });
});

describe("marginHealthPct", () => {
  it("is the share of priced dishes at or under target", () => {
    const dishes = [
      dish({ id: "a", total_cost: 20, selling_price: 100 }),
      dish({ id: "b", total_cost: 40, selling_price: 100 }),
      dish({ id: "c" }),
    ];
    expect(marginHealthPct(dishes, 30)).toBeCloseTo(50, 6);
  });
  it("is null when nothing is priced", () => {
    expect(marginHealthPct([dish({})], 30)).toBeNull();
  });
});

describe("costTrend", () => {
  it("averages per day, oldest first, and skips entries with no value", () => {
    const trend = costTrend([
      { changed_at: "2026-06-02T00:00:00.000Z", new_cost_per_portion: 10, new_total_cost: null },
      { changed_at: "2026-06-02T12:00:00.000Z", new_cost_per_portion: 20, new_total_cost: null },
      { changed_at: "2026-06-01T00:00:00.000Z", new_cost_per_portion: 5, new_total_cost: null },
      { changed_at: "2026-06-03T00:00:00.000Z", new_cost_per_portion: null, new_total_cost: null },
    ] as RecipeCostHistory[]);
    expect(trend).toEqual([5, 15]);
  });
  it("is empty with no history, so no sparkline is drawn", () => {
    expect(costTrend([])).toEqual([]);
  });
});

describe("relativeTime", () => {
  const now = new Date("2026-06-10T12:00:00.000Z").getTime();
  it("formats minutes, hours and days", () => {
    expect(relativeTime("2026-06-10T11:58:00.000Z", now)).toBe("2m ago");
    expect(relativeTime("2026-06-10T10:00:00.000Z", now)).toBe("2h ago");
    expect(relativeTime("2026-06-07T12:00:00.000Z", now)).toBe("3d ago");
  });
  it("handles null and unparseable input", () => {
    expect(relativeTime(null, now)).toBe("—");
    expect(relativeTime("not-a-date", now)).toBe("—");
  });
});
