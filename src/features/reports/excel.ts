// Excel export — PRD §6.3 / §13.2. Four sheets via SheetJS (xlsx).

import { calculateIngredientCost, round2 } from "@/lib/costing";
import { canConvert } from "@/lib/units";
import { formatDate } from "@/lib/utils";
import type {
  IngredientPriceHistory,
  RawMaterial,
  Recipe,
  RecipeCostHistory,
  RecipeIngredientWithMaterial,
  User,
} from "@/lib/data/types";

export interface ExcelExportData {
  recipes: Recipe[];
  ingredients: RecipeIngredientWithMaterial[];
  costHistory: RecipeCostHistory[];
  priceHistory: IngredientPriceHistory[];
  usersById: Map<string, User>;
  materialsById: Map<string, RawMaterial>;
}

export async function generateExcelReport(data: ExcelExportData, label: string) {
  const XLSX = await import("xlsx");
  const wb = XLSX.utils.book_new();
  const name = (id: string | null) => (id ? data.usersById.get(id)?.name ?? "—" : "—");
  const recipeName = (id: string) =>
    data.recipes.find((r) => r.id === id)?.recipe_name ?? "—";

  // Sheet 1 — Recipe Summary
  const summary = data.recipes.map((r) => {
    const perPortion = r.cost_per_portion ?? 0;
    const packaging = r.packaging_cost ?? 0;
    const full = round2(perPortion + packaging);
    // No suggested price — report the actual saved menu price (blank when none) and
    // the food-cost % derived from it.
    const menuPrice = r.selling_price != null && r.selling_price > 0 ? r.selling_price : null;
    return {
      "Recipe Name": r.recipe_name,
      "Created By": r.created_by_name ?? "",
      Category: r.category,
      "Serving Size": r.serving_size,
      "Dish Weight (g)": r.total_weight_g ?? "",
      "Total Cost": r.total_cost ?? 0,
      "Cost/Portion": perPortion,
      Packaging: packaging,
      "Menu Price": menuPrice ?? "",
      "Food Cost % (with pkg)": menuPrice ? round2((full / menuPrice) * 100) : "",
      "Food Cost % (no pkg)": menuPrice ? round2((perPortion / menuPrice) * 100) : "",
      Status: r.status,
      "Approved By": name(r.approved_by),
      Date: formatDate(r.approved_at ?? r.created_at),
    };
  });

  // Sheet 2 — Ingredient Breakdown
  const totalByRecipe = new Map<string, number>();
  data.ingredients.forEach((i) => {
    const m = i.material;
    const cost =
      m && m.cost_per_base_unit !== null && canConvert(i.unit_used, m.base_unit)
        ? calculateIngredientCost(m.cost_per_base_unit, i.quantity_used, i.unit_used, m.base_unit)
        : 0;
    totalByRecipe.set(i.recipe_id, (totalByRecipe.get(i.recipe_id) ?? 0) + cost);
  });
  const breakdown = data.ingredients.map((i) => {
    const m = i.material;
    const cost =
      m && m.cost_per_base_unit !== null && canConvert(i.unit_used, m.base_unit)
        ? calculateIngredientCost(m.cost_per_base_unit, i.quantity_used, i.unit_used, m.base_unit)
        : 0;
    const total = totalByRecipe.get(i.recipe_id) ?? 0;
    return {
      "Recipe Name": recipeName(i.recipe_id),
      Ingredient: m?.ingredient_name ?? "—",
      Qty: i.quantity_used,
      Unit: i.unit_used,
      "Unit Cost": m?.cost_per_base_unit ?? 0,
      "Total Cost": round2(cost),
      "% of Total": total > 0 ? round2((cost / total) * 100) : 0,
    };
  });

  // Sheet 3 — Cost History
  const cost = data.costHistory.map((h) => ({
    "Recipe Name": recipeName(h.recipe_id ?? ""),
    "Old Cost": h.old_total_cost ?? 0,
    "New Cost": h.new_total_cost ?? 0,
    "Change %":
      h.old_total_cost && h.old_total_cost > 0
        ? round2((((h.new_total_cost ?? 0) - h.old_total_cost) / h.old_total_cost) * 100)
        : 0,
    "Changed By": name(h.changed_by),
    Date: formatDate(h.changed_at),
  }));

  // Sheet 4 — Ingredient Price Log
  const price = data.priceHistory.map((h) => ({
    Ingredient: data.materialsById.get(h.ingredient_id)?.ingredient_name ?? "—",
    "Old Price": h.old_price ?? 0,
    "New Price": h.new_price ?? 0,
    Unit: data.materialsById.get(h.ingredient_id)?.base_unit ?? "",
    "Changed By": name(h.changed_by),
    Date: formatDate(h.changed_at),
  }));

  // Sheet 5 — Packaging: per-recipe packaging cost + by-category / by-brand rollups.
  const menuRecipes = data.recipes.filter((r) => !r.is_prep);
  const packagingByRecipe = menuRecipes
    .filter((r) => (r.packaging_cost ?? 0) > 0)
    .map((r) => ({
      "Recipe Name": r.recipe_name,
      Brand: r.brand,
      Category: r.category,
      "Packaging Cost": round2(r.packaging_cost ?? 0),
      "Menu Price": r.selling_price ?? "",
      "Packaging % of Price": r.selling_price ? round2(((r.packaging_cost ?? 0) / r.selling_price) * 100) : "",
    }))
    .sort((a, b) => b["Packaging Cost"] - a["Packaging Cost"]);
  const rollup = (key: "brand" | "category") => {
    const m = new Map<string, { total: number; count: number }>();
    for (const r of menuRecipes) {
      const k = (key === "brand" ? r.brand : r.category) || "—";
      const cur = m.get(k) ?? { total: 0, count: 0 };
      cur.total += r.packaging_cost ?? 0;
      cur.count += 1;
      m.set(k, cur);
    }
    return [...m.entries()].map(([k, v]) => ({
      [key === "brand" ? "Brand" : "Category"]: k,
      Recipes: v.count,
      "Total Packaging": round2(v.total),
      "Avg Packaging": round2(v.count ? v.total / v.count : 0),
    }));
  };

  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(summary), "Recipe Summary");
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(breakdown), "Ingredient Detail");
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(packagingByRecipe), "Packaging by Recipe");
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rollup("brand")), "Packaging by Brand");
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rollup("category")), "Packaging by Category");
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(cost), "Cost History");
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(price), "Price History");

  XLSX.writeFile(wb, `RecipeCosting_Report_${label}.xlsx`);
}
