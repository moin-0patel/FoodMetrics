// Import configs for the Super-Admin Import Data hub. These were previously inline
// on MaterialsPage / YieldPage / RecipesPage; import now lives ONLY here, so the
// config builders are centralised. Each `run` persists via the repo and invalidates
// the relevant react-query caches.
import type { QueryClient } from "@tanstack/react-query";
import {
  materialsRepo,
  yieldsRepo,
  recipesRepo,
  type MaterialInput,
  type ImportYieldRow,
  type ImportRecipeLine,
} from "@/lib/data";
import { pick, toNum, toText, type ImportConfig } from "@/lib/import/importTypes";
import { canonicalPurchase, type MeasurementType, PURCHASE_UNITS } from "@/lib/units";

interface Deps {
  queryClient: QueryClient;
  userId: string;
}

/** Raw materials — COMMON across brands (shared kitchen building blocks). */
export function materialsImportConfig({ queryClient, userId }: Deps): ImportConfig<MaterialInput> {
  return {
    title: "Import Ingredients",
    columns: [
      { label: "Ingredient", required: true },
      { label: "Category" },
      { label: "Material Type" },
      { label: "Purchase Price" },
      { label: "Notes" },
    ],
    sample: {
      Ingredient: "Onion",
      Category: "Vegetables",
      "Material Type": "Weight",
      "Purchase Price": 100,
      Notes: "",
    },
    parseRow: (row, n) => {
      const name = toText(pick(row, ["Ingredient", "Ingredient Name", "Name"]));
      if (!name) return { error: `Row ${n}: ingredient name is required` };
      const price = toNum(pick(row, ["Purchase Price", "Purchase Price (₹)", "Price"]));
      if (price !== null && (Number.isNaN(price) || price < 0)) return { error: `Row ${n}: invalid purchase price` };
      // Material Type → automatic purchase unit (1 kg / 1 litre / 1 piece). Case +
      // whitespace insensitive; blank defaults to Weight.
      const typeRaw = toText(pick(row, ["Material Type", "Type"])).trim().toLowerCase();
      const type: MeasurementType | null =
        typeRaw === "" ? "weight"
          : /^(weight|kg|kilogram|gram|g)$/.test(typeRaw) ? "weight"
            : /^(liquid|volume|litre|liter|l|ml)$/.test(typeRaw) ? "volume"
              : /^(count|piece|pcs?|pc|unit|each|nos?)$/.test(typeRaw) ? "count"
                : null;
      if (!type) return { error: `Row ${n}: Material Type must be Weight, Liquid or Count (got "${typeRaw}")` };
      const canon = canonicalPurchase(type);
      return {
        value: {
          ingredient_name: name,
          category: toText(pick(row, ["Category"])) || "Other",
          notes: toText(pick(row, ["Notes"])) || null,
          purchase_price: price,
          purchase_quantity: 1,
          purchase_unit: canon.purchase_unit,
          base_unit: canon.base_unit,
        },
      };
    },
    run: async (mode, rows) => {
      const summary = await materialsRepo.importMaterials(mode, rows, userId);
      await queryClient.invalidateQueries({ queryKey: ["materials"] });
      await queryClient.invalidateQueries({ queryKey: ["recipes"] });
      return summary;
    },
  };
}

/** Yield — COMMON across brands (shared master data). */
export function yieldImportConfig({ queryClient, userId }: Deps): ImportConfig<ImportYieldRow> {
  return {
    title: "Import Yields",
    columns: [
      { label: "Ingredient", required: true },
      { label: "Purchase Cost", required: true },
      { label: "Purchase Quantity", required: true },
      { label: "Purchase Unit", required: true },
      { label: "Wastage Quantity", required: true },
      { label: "Effective From" },
      { label: "Notes" },
    ],
    sample: {
      Ingredient: "Onion",
      "Purchase Cost": 125,
      "Purchase Quantity": 1,
      "Purchase Unit": "KG",
      "Wastage Quantity": 200,
      "Effective From": "2026-06-01",
      Notes: "Peeling + trimming loss",
    },
    parseRow: (row, n) => {
      const ingredient_name = toText(pick(row, ["Ingredient", "Ingredient Name"]));
      if (!ingredient_name) return { error: `Row ${n}: ingredient is required` };
      const purchase_cost = toNum(pick(row, ["Purchase Cost", "Cost"]));
      if (purchase_cost == null || Number.isNaN(purchase_cost) || purchase_cost <= 0)
        return { error: `Row ${n}: purchase cost must be greater than 0` };
      const purchase_quantity = toNum(pick(row, ["Purchase Quantity", "Quantity", "Qty"]));
      if (purchase_quantity == null || Number.isNaN(purchase_quantity) || purchase_quantity <= 0)
        return { error: `Row ${n}: purchase quantity must be greater than 0` };
      const purchase_unit = toText(pick(row, ["Purchase Unit", "Unit"]));
      if (!PURCHASE_UNITS.includes(purchase_unit as (typeof PURCHASE_UNITS)[number]))
        return { error: `Row ${n}: invalid purchase unit "${purchase_unit}"` };
      const wastage_quantity = toNum(pick(row, ["Wastage Quantity", "Wastage"]));
      if (wastage_quantity == null || Number.isNaN(wastage_quantity) || wastage_quantity < 0)
        return { error: `Row ${n}: wastage quantity cannot be negative` };
      return {
        value: {
          ingredient_name,
          purchase_cost,
          purchase_quantity,
          purchase_unit,
          wastage_quantity,
          effective_from: toText(pick(row, ["Effective From", "Date"])) || null,
          notes: toText(pick(row, ["Notes"])) || null,
        },
      };
    },
    run: async (mode, rows) => {
      const summary = await yieldsRepo.importYields(mode, rows, userId);
      await queryClient.invalidateQueries({ queryKey: ["yields"] });
      await queryClient.invalidateQueries({ queryKey: ["recipes"] });
      return summary;
    },
  };
}

/**
 * Recipes. In-House Prep (isPrep=true) is COMMON — no size/price/packaging and no
 * brand choice. Menu recipes (isPrep=false) are brand-specific: `brand` decides
 * whether they land under one brand or another.
 */
export function recipeImportConfig({
  queryClient,
  userId,
  isPrep,
  brand,
}: Deps & { isPrep: boolean; brand: string }): ImportConfig<ImportRecipeLine> {
  if (isPrep) {
    return {
      title: "Import In-House Prep",
      columns: [
        { label: "Prep Name", required: true },
        { label: "Category" },
        { label: "Ingredient", required: true },
        { label: "Quantity", required: true },
        { label: "Unit" },
      ],
      sample: {
        "Prep Name": "Tomato Sauce",
        Category: "Sauces",
        Ingredient: "Tomato",
        Quantity: 500,
        Unit: "Gram",
      },
      parseRow: (row, n) => {
        const recipe_name = toText(pick(row, ["Prep Name", "Recipe Name", "Name"]));
        if (!recipe_name) return { error: `Row ${n}: prep name is required` };
        const ingredient_name = toText(pick(row, ["Ingredient", "Ingredient Name"]));
        if (!ingredient_name) return { error: `Row ${n}: ingredient is required` };
        const quantity = toNum(pick(row, ["Quantity", "Qty"]));
        if (quantity == null || Number.isNaN(quantity) || quantity <= 0) return { error: `Row ${n}: quantity must be greater than 0` };
        return {
          value: {
            recipe_name,
            category: toText(pick(row, ["Category"])) || "Uncategorised",
            size: null,
            ingredient_name,
            quantity,
            unit: toText(pick(row, ["Unit"])) || "Gram",
            selling_price: null,
            packaging_cost: null,
          },
        };
      },
      run: async (mode, rows) => {
        const summary = await recipesRepo.importRecipes(mode, rows, userId, true);
        await queryClient.invalidateQueries({ queryKey: ["recipes"] });
        await queryClient.invalidateQueries({ queryKey: ["materials"] });
        return summary;
      },
    };
  }
  return {
    title: "Import Menu Recipes",
    columns: [
      { label: "Recipe Name", required: true },
      { label: "Category" },
      { label: "Size" },
      { label: "Ingredient", required: true },
      { label: "Quantity", required: true },
      { label: "Unit" },
      { label: "Selling Price" },
      { label: "Packaging" },
      { label: "Image" },
    ],
    sample: {
      "Recipe Name": "Signature Pizza",
      Category: "Pizza",
      Size: "15-inch",
      Ingredient: "Pizza Dough",
      Quantity: 310,
      Unit: "Gram",
      "Selling Price": 940,
      Packaging: 30,
      Image: "/demo/pizza.svg",
    },
    parseRow: (row, n) => {
      const recipe_name = toText(pick(row, ["Recipe Name", "Recipe", "Name"]));
      if (!recipe_name) return { error: `Row ${n}: recipe name is required` };
      const ingredient_name = toText(pick(row, ["Ingredient", "Ingredient Name"]));
      if (!ingredient_name) return { error: `Row ${n}: ingredient is required` };
      const quantity = toNum(pick(row, ["Quantity", "Qty"]));
      if (quantity == null || Number.isNaN(quantity) || quantity <= 0) return { error: `Row ${n}: quantity must be greater than 0` };
      const sizeRaw = toText(pick(row, ["Size", "Variant"])).toLowerCase();
      const size = /11/.test(sizeRaw) ? "11_INCH" : /15/.test(sizeRaw) ? "15_INCH" : null;
      const selling = toNum(pick(row, ["Selling Price", "Selling"]));
      const pkg = toNum(pick(row, ["Packaging", "Packaging Cost"]));
      return {
        value: {
          recipe_name,
          category: toText(pick(row, ["Category"])) || "Uncategorised",
          size: size as "11_INCH" | "15_INCH" | null,
          ingredient_name,
          quantity,
          unit: toText(pick(row, ["Unit"])) || "Gram",
          selling_price: selling != null && !Number.isNaN(selling) ? selling : null,
          packaging_cost: pkg != null && !Number.isNaN(pkg) ? pkg : null,
          // Optional: a public path ("/demo/pizza.svg") or an absolute URL.
          image_url: toText(pick(row, ["Image", "Image URL", "Photo"])) || null,
        },
      };
    },
    run: async (mode, rows) => {
      const summary = await recipesRepo.importRecipes(mode, rows, userId, false, brand);
      await queryClient.invalidateQueries({ queryKey: ["recipes"] });
      await queryClient.invalidateQueries({ queryKey: ["materials"] });
      return summary;
    },
  };
}
