import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { recipesRepo } from "@/lib/data";
import type { RecipeIngredientWithMaterial } from "@/lib/data/types";
import { useDashboardBrand } from "@/features/dashboard/brandTheme";
import { useRecipes } from "@/features/recipes/hooks";

/**
 * App-wide brand scoping. The global brand selector (All / each brand) should
 * make every section show only that brand's data. Recipes and wastage carry a
 * `brand` field directly; raw materials, yields and packaging are shared master
 * data with no brand column, so "belongs to a brand" is DERIVED from usage: an
 * ingredient/packaging item is in a brand's scope if any of that brand's recipes
 * use it — transitively through prep sub-recipes (a prep pulls in its own
 * ingredients for whichever brand's recipe references it).
 *
 * Returns `inMaterialScope(id)` / `inPackagingScope(id)` predicates that are
 * always true when "All" is selected (no filtering), so callers can filter
 * unconditionally: `list.filter((m) => inMaterialScope(m.id))`.
 */
export interface BrandScope {
  brand: string;
  isAll: boolean;
  inMaterialScope: (materialId: string) => boolean;
  inPackagingScope: (packagingItemId: string) => boolean;
}

/** Minimal shapes the derivation needs (kept loose so it's easy to unit-test). */
interface ScopeRecipe {
  id: string;
  brand: string;
}
interface ScopeIngredientLink {
  recipe_id: string;
  ingredient_id: string | null;
  component_type: string;
}
interface ScopePackagingLink {
  recipe_id: string;
  packaging_item_id: string;
}

/**
 * Pure derivation: the set of material ids and packaging item ids used by a
 * brand's recipes, transitively through prep sub-recipes. Exported for testing.
 */
export function deriveBrandScope(
  brand: string,
  recipes: ScopeRecipe[],
  links: ScopeIngredientLink[],
  packagingLinks: ScopePackagingLink[],
): { materialIds: Set<string>; packagingIds: Set<string> } {
  const childRecipes = new Map<string, string[]>();
  const recipeMaterials = new Map<string, string[]>();
  for (const l of links) {
    if (!l.ingredient_id) continue;
    if (l.component_type === "recipe") {
      const a = childRecipes.get(l.recipe_id) ?? [];
      a.push(l.ingredient_id);
      childRecipes.set(l.recipe_id, a);
    } else {
      const a = recipeMaterials.get(l.recipe_id) ?? [];
      a.push(l.ingredient_id);
      recipeMaterials.set(l.recipe_id, a);
    }
  }
  const recipePackaging = new Map<string, string[]>();
  for (const p of packagingLinks) {
    const a = recipePackaging.get(p.recipe_id) ?? [];
    a.push(p.packaging_item_id);
    recipePackaging.set(p.recipe_id, a);
  }

  const materialIds = new Set<string>();
  const packagingIds = new Set<string>();
  const seen = new Set<string>();
  // Walk out from every recipe tagged with the selected brand, collecting the
  // materials/packaging of it and all its (transitive) prep sub-recipes.
  const stack = recipes.filter((r) => r.brand === brand).map((r) => r.id);
  while (stack.length) {
    const rid = stack.pop() as string;
    if (seen.has(rid)) continue;
    seen.add(rid);
    for (const mid of recipeMaterials.get(rid) ?? []) materialIds.add(mid);
    for (const pid of recipePackaging.get(rid) ?? []) packagingIds.add(pid);
    for (const cid of childRecipes.get(rid) ?? []) stack.push(cid);
  }
  return { materialIds, packagingIds };
}

export function useBrandScope(): BrandScope {
  const brand = useDashboardBrand((s) => s.brand);
  const isAll = brand === "all";
  const { data: recipes = [] } = useRecipes();
  // Reuse the shared "all recipe ingredients" query (same key → no extra fetch).
  const linksQ = useQuery<RecipeIngredientWithMaterial[]>({
    queryKey: ["recipes", "allIngredients"],
    queryFn: () => recipesRepo.allIngredients(),
    enabled: !isAll,
  });
  const packagingQ = useQuery({
    queryKey: ["recipes", "allPackaging"],
    queryFn: () => recipesRepo.allPackaging(),
    enabled: !isAll,
  });

  // Until the graph has loaded, don't filter (avoids a flash of an empty list).
  const ready = isAll || (!linksQ.isLoading && !packagingQ.isLoading);
  const linksData = linksQ.data; // stable react-query reference — safe as a dep
  const packagingData = packagingQ.data;

  const { materialIds, packagingIds } = useMemo(() => {
    if (isAll || !ready) return { materialIds: null as Set<string> | null, packagingIds: null as Set<string> | null };
    return deriveBrandScope(brand, recipes, linksData ?? [], packagingData ?? []);
  }, [isAll, ready, brand, recipes, linksData, packagingData]);

  return {
    brand,
    isAll,
    inMaterialScope: (id: string) => materialIds == null || materialIds.has(id),
    inPackagingScope: (id: string) => packagingIds == null || packagingIds.has(id),
  };
}
