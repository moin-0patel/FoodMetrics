// §11–§19 Temporary recipe share links. A cryptographically-random token is put in
// the URL; only its SHA-256 hash is stored. Expiry (7 days) and revocation are checked
// when the token is resolved — never trusted from the client. Shared views strip ALL
// financial fields before returning, so a link never exposes cost/price data.
//
// NOTE: enforcement here runs in the client data layer (mock/localStorage mode). When
// the Supabase backend is active, resolve/expiry must run in an edge function / RLS so
// it is truly server-side; this repo is the contract that mirrors.
import type {
  AccessLinkStatus,
  AccessType,
  Recipe,
  RecipeAccessLink,
  RecipeIngredientWithMaterial,
  Role,
} from "../types";
import { delay, getDb, mutate, nowISO, uid } from "./db";
import { findMaterial } from "./recompute";

const LINK_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days (§11)

const toHex = (buf: ArrayBuffer | Uint8Array) =>
  Array.from(buf instanceof Uint8Array ? buf : new Uint8Array(buf), (b) => b.toString(16).padStart(2, "0")).join("");

/** 32 random bytes → 64-char hex token (cryptographically secure). */
export function generateToken(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return toHex(bytes);
}

export async function hashToken(token: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(token));
  return toHex(digest);
}

function effectiveStatus(link: RecipeAccessLink, now = Date.now()): AccessLinkStatus {
  if (link.revoked_at) return "REVOKED";
  if (new Date(link.expires_at).getTime() <= now) return "EXPIRED";
  return "ACTIVE";
}

/** Remove every financial field before a shared/public payload leaves the layer (§19). */
function stripFinancials(recipe: Recipe, ingredients: RecipeIngredientWithMaterial[]) {
  // wastage_pct is a costing parameter (§19) — strip it alongside the money fields.
  const r: Recipe = { ...recipe, total_cost: 0, cost_per_portion: 0, packaging_cost: 0, selling_price: null, wastage_pct: 0 };
  const ings = ingredients.map((i) => ({
    ...i,
    calculated_cost: null,
    material: i.material ? { ...i.material, cost_per_base_unit: null, purchase_price: null } : null,
    subRecipe: i.subRecipe ? { ...i.subRecipe, total_cost: 0, cost_per_portion: 0, packaging_cost: 0, selling_price: null, wastage_pct: 0 } : null,
  }));
  return { recipe: r, ingredients: ings };
}

export interface CreateLinkInput {
  recipe_id: string;
  granted_by_user_id: string | null;
  granted_by_name: string;
  granted_by_role: Role;
  granted_to_user_id?: string | null;
  granted_to_email?: string | null;
  granted_to_role?: Role | null;
  granted_to_brand_id?: string | null;
  granted_to_outlet_id?: string | null;
  access_type: AccessType;
}

export interface ResolvedLink {
  status: AccessLinkStatus;
  access_type?: AccessType;
  granted_by_name?: string;
  brand?: string;
  recipe?: Recipe;
  ingredients?: RecipeIngredientWithMaterial[];
  /** Each direct sub-recipe with its own (financial-free) ingredients, for the breakdown. */
  subRecipes?: { recipe: Recipe; ingredients: RecipeIngredientWithMaterial[] }[];
}

export const accessLinksRepo = {
  async create(input: CreateLinkInput): Promise<{ link: RecipeAccessLink; token: string }> {
    const token = generateToken();
    const token_hash = await hashToken(token);
    const link = await delay(
      mutate((db) => {
        const now = nowISO();
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
          created_at: now,
          expires_at: new Date(Date.now() + LINK_TTL_MS).toISOString(),
          revoked_at: null,
          revoked_by_user_id: null,
          last_accessed_at: null,
          access_count: 0,
          status: "ACTIVE",
        };
        db.recipe_access_links.push(row);
        return row;
      }),
    );
    return { link, token };
  },

  /** Resolve a raw token → read-only, financial-free recipe payload (or a status). */
  async resolve(token: string): Promise<ResolvedLink> {
    const token_hash = await hashToken(token);
    return delay(
      mutate((db) => {
        const link = db.recipe_access_links.find((l) => l.token_hash === token_hash);
        if (!link) return { status: "REVOKED" as AccessLinkStatus }; // invalid/modified token → unusable
        const status = effectiveStatus(link);
        link.status = status;
        if (status !== "ACTIVE") return { status };
        const recipe = db.recipes.find((r) => r.id === link.recipe_id);
        if (!recipe) return { status: "REVOKED" as AccessLinkStatus };
        link.access_count += 1;
        link.last_accessed_at = nowISO();
        const linesFor = (rid: string): RecipeIngredientWithMaterial[] =>
          db.recipe_ingredients
            .filter((ri) => ri.recipe_id === rid)
            .sort((a, b) => a.sort_order - b.sort_order)
            .map((ri) => ({
              ...ri,
              material: ri.component_type === "recipe" ? null : findMaterial(db, ri.ingredient_id) ?? null,
              subRecipe: ri.component_type === "recipe" ? db.recipes.find((r) => r.id === ri.ingredient_id) ?? null : null,
            })) as RecipeIngredientWithMaterial[];
        const raw = linesFor(recipe.id);
        const stripped = stripFinancials(recipe, raw);
        // Each direct sub-recipe with its own (financial-free) ingredients.
        const subIds = [...new Set(raw.filter((r) => r.component_type === "recipe").map((r) => r.ingredient_id))];
        const subRecipes = subIds
          .map((id) => {
            const sub = db.recipes.find((r) => r.id === id);
            if (!sub) return null;
            const s = stripFinancials(sub, linesFor(sub.id));
            return { recipe: s.recipe, ingredients: s.ingredients as RecipeIngredientWithMaterial[] };
          })
          .filter((x) => x !== null) as { recipe: Recipe; ingredients: RecipeIngredientWithMaterial[] }[];
        return {
          status,
          access_type: link.access_type,
          granted_by_name: link.granted_by_name,
          brand: db.brands.find((b) => b.id === recipe.brand)?.name ?? recipe.brand,
          recipe: stripped.recipe,
          ingredients: stripped.ingredients,
          subRecipes,
        };
      }),
    );
  },

  async revoke(id: string, byUserId: string | null): Promise<RecipeAccessLink> {
    return delay(
      mutate((db) => {
        const link = db.recipe_access_links.find((l) => l.id === id);
        if (!link) throw new Error("Link not found");
        if (!link.revoked_at) {
          link.revoked_at = nowISO();
          link.revoked_by_user_id = byUserId;
          link.status = "REVOKED";
        }
        return link;
      }),
    );
  },

  /** All links, with status recomputed for display (expired links flip automatically). */
  async list(): Promise<RecipeAccessLink[]> {
    return delay(
      getDb()
        .recipe_access_links.map((l) => ({ ...l, status: effectiveStatus(l) }))
        .sort((a, b) => b.created_at.localeCompare(a.created_at)),
    );
  },

  async listForRecipe(recipeId: string): Promise<RecipeAccessLink[]> {
    return delay(
      getDb()
        .recipe_access_links.filter((l) => l.recipe_id === recipeId)
        .map((l) => ({ ...l, status: effectiveStatus(l) }))
        .sort((a, b) => b.created_at.localeCompare(a.created_at)),
    );
  },
};
