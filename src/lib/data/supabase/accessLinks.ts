// Supabase-backed share links. create/revoke/list use the table directly (grantor +
// admin RLS from 0011). resolve() goes through the SECURITY DEFINER resolve_share_link
// RPC so expiry/revocation + financial stripping are enforced SERVER-SIDE — an anon
// visitor never reads the table. Mirrors the mock accessLinksRepo interface 1:1.
import type { AccessLinkStatus, Recipe, RecipeAccessLink, RecipeIngredientWithMaterial } from "../types";
import type { CreateLinkInput, ResolvedLink } from "../mock/accessLinks";
import { generateToken, hashToken } from "../mock/accessLinks";
import { nowISO, uid } from "../mock/db";
import { sb, fail } from "./helpers";

export type { CreateLinkInput, ResolvedLink };

const LINK_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

interface RpcIngredient {
  id: string;
  component_type: string;
  quantity_used: number;
  unit_used: string;
  sub_recipe: boolean;
  ingredient_name: string | null;
}

interface RpcSubRecipe {
  id: string;
  recipe_name: string;
  yield_quantity: number | null;
  yield_unit: string | null;
  ingredients: RpcIngredient[];
}

/** Map an RPC ingredient row to the RecipeIngredientWithMaterial shape (no financials). */
function mapLine(i: RpcIngredient, recipeId: string): RecipeIngredientWithMaterial {
  return {
    id: i.id,
    recipe_id: recipeId,
    ingredient_id: "",
    component_type: i.sub_recipe ? "recipe" : "material",
    quantity_used: i.quantity_used,
    unit_used: i.unit_used,
    calculated_cost: null,
    sort_order: 0,
    wastage_override_pct: null,
    cut_type: null,
    material: i.sub_recipe ? null : ({ ingredient_name: i.ingredient_name } as RecipeIngredientWithMaterial["material"]),
    subRecipe: i.sub_recipe ? ({ recipe_name: i.ingredient_name } as RecipeIngredientWithMaterial["subRecipe"]) : null,
  };
}

export const supabaseAccessLinksRepo = {
  async create(input: CreateLinkInput): Promise<{ link: RecipeAccessLink; token: string }> {
    const token = generateToken();
    const token_hash = await hashToken(token);
    const row: RecipeAccessLink = {
      id: uid(),
      token_hash,
      recipe_id: input.recipe_id,
      granted_by_user_id: input.granted_by_user_id,
      granted_by_name: input.granted_by_name,
      granted_by_role: input.granted_by_role,
      granted_to_user_id: input.granted_to_user_id ?? null,
      granted_to_email: input.granted_to_email ?? null,
      granted_to_role: input.granted_to_role ?? null,
      granted_to_brand_id: input.granted_to_brand_id ?? null,
      granted_to_outlet_id: input.granted_to_outlet_id ?? null,
      access_type: input.access_type,
      created_at: nowISO(),
      expires_at: new Date(Date.now() + LINK_TTL_MS).toISOString(),
      revoked_at: null,
      revoked_by_user_id: null,
      last_accessed_at: null,
      access_count: 0,
      status: "ACTIVE",
    };
    const { data, error } = await sb().from("recipe_access_links").insert(row).select("*").single();
    if (error) fail("Create share link", error.message);
    return { link: data as RecipeAccessLink, token };
  },

  async resolve(token: string): Promise<ResolvedLink> {
    const { data, error } = await sb().rpc("resolve_share_link", { p_token: token });
    if (error) fail("Open shared recipe", error.message);
    const r = data as {
      status: AccessLinkStatus;
      access_type?: ResolvedLink["access_type"];
      granted_by_name?: string;
      brand?: ResolvedLink["brand"];
      recipe?: Record<string, unknown>;
      ingredients?: RpcIngredient[];
      sub_recipes?: RpcSubRecipe[];
    };
    if (r.status !== "ACTIVE" || !r.recipe) return { status: r.status };
    // Re-assert zeros for the stripped financial fields so the Recipe type is complete.
    const recipe = { ...r.recipe, total_cost: 0, cost_per_portion: 0, packaging_cost: 0, selling_price: null } as unknown as Recipe;
    const ingredients: RecipeIngredientWithMaterial[] = (r.ingredients ?? []).map((i) => mapLine(i, recipe.id));
    // Each direct sub-recipe with its own (financial-free) ingredients, for the breakdown.
    const subRecipes = (r.sub_recipes ?? []).map((s) => ({
      recipe: {
        id: s.id,
        recipe_name: s.recipe_name,
        yield_quantity: s.yield_quantity ?? 0,
        yield_unit: s.yield_unit ?? "",
        total_cost: 0,
        cost_per_portion: 0,
        packaging_cost: 0,
        selling_price: null,
      } as unknown as Recipe,
      ingredients: (s.ingredients ?? []).map((i) => mapLine(i, s.id)),
    }));
    return { status: "ACTIVE", access_type: r.access_type, granted_by_name: r.granted_by_name, brand: r.brand, recipe, ingredients, subRecipes };
  },

  async revoke(id: string, byUserId: string | null): Promise<RecipeAccessLink> {
    const { data, error } = await sb()
      .from("recipe_access_links")
      .update({ revoked_at: nowISO(), revoked_by_user_id: byUserId, status: "REVOKED" })
      .eq("id", id)
      .select("*")
      .single();
    if (error) fail("Revoke share link", error.message);
    return data as RecipeAccessLink;
  },

  async list(): Promise<RecipeAccessLink[]> {
    const { data, error } = await sb().from("recipe_access_links").select("*").order("created_at", { ascending: false });
    if (error) fail("Load access history", error.message);
    return (data ?? []) as RecipeAccessLink[];
  },

  async listForRecipe(recipeId: string): Promise<RecipeAccessLink[]> {
    const { data, error } = await sb()
      .from("recipe_access_links")
      .select("*")
      .eq("recipe_id", recipeId)
      .order("created_at", { ascending: false });
    if (error) fail("Load recipe links", error.message);
    return (data ?? []) as RecipeAccessLink[];
  },
};
