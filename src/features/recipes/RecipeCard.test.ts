import { describe, it, expect } from "vitest";
import type { Recipe } from "@/lib/data/types";
import { assessRecipe } from "./RecipeCard";

// The card's badge, colour and status line are all derived. These pin down that a
// dish which cannot be costed reports "pending" instead of showing 0%.

const dish = (o: Partial<Recipe>): Recipe =>
  ({
    id: "r1",
    recipe_name: "Dish",
    category: "Mains",
    brand: "b1",
    status: "approved",
    is_prep: false,
    total_cost: null,
    cost_per_portion: null,
    selling_price: null,
    image_url: null,
    ...o,
  }) as Recipe;

describe("assessRecipe", () => {
  const TARGET = 30;

  it("flags a draft as in development regardless of cost", () => {
    const a = assessRecipe(dish({ status: "draft", total_cost: 20, selling_price: 100 }), TARGET);
    expect(a.verdict).toBe("in-development");
    expect(a.badge).toBe("In development");
  });

  it("reports pending — not 0% — when there is no cost", () => {
    const a = assessRecipe(dish({ total_cost: null, selling_price: 100 }), TARGET);
    expect(a.verdict).toBe("pending");
    expect(a.fcPct).toBeNull();
    expect(a.status).toMatch(/no cost/i);
  });

  it("reports pending when there is no selling price", () => {
    const a = assessRecipe(dish({ total_cost: 20, selling_price: null }), TARGET);
    expect(a.verdict).toBe("pending");
    expect(a.status).toMatch(/no selling price/i);
  });

  it("never divides by a zero selling price", () => {
    const a = assessRecipe(dish({ total_cost: 20, selling_price: 0 }), TARGET);
    expect(a.verdict).toBe("pending");
    expect(a.fcPct).toBeNull();
  });

  it("calls more than 3 points over target critical", () => {
    const a = assessRecipe(dish({ total_cost: 40, selling_price: 100 }), TARGET); // 40%
    expect(a.verdict).toBe("critical");
    expect(a.badge).toBe("At risk");
  });

  it("calls just over target a watch, not critical", () => {
    const a = assessRecipe(dish({ total_cost: 32, selling_price: 100 }), TARGET); // 32%
    expect(a.verdict).toBe("at-risk");
    expect(a.badge).toBe("Over target");
  });

  it("calls comfortably under target high margin", () => {
    const a = assessRecipe(dish({ total_cost: 20, selling_price: 100 }), TARGET); // 20%
    expect(a.verdict).toBe("high-profit");
    expect(a.badge).toBe("High margin");
  });

  it("calls just under target on target, with no badge", () => {
    const a = assessRecipe(dish({ total_cost: 28, selling_price: 100 }), TARGET); // 28%
    expect(a.verdict).toBe("on-target");
    expect(a.badge).toBeNull();
    expect(a.fcPct).toBeCloseTo(28, 6);
  });

  it("treats exactly on target as on target, not over", () => {
    const a = assessRecipe(dish({ total_cost: 30, selling_price: 100 }), TARGET);
    expect(a.verdict).toBe("on-target");
  });
});
