// First-run seed for the local mock backend: ORGANISATION STRUCTURE ONLY.
//
// The app deliberately starts EMPTY — no brands, outlets, raw materials, recipes,
// prices, yields, packaging or wastage. Only the minimum needed for the UI to
// function and for someone to sign in:
//   • the six built-in roles, with capabilities mirroring the permissions MATRIX
//   • default system settings (food-cost target, alert threshold, category lists)
//   • a single Super-Admin owner account
//
// Brands and outlets are created in Brands & Outlets; catalog content is created
// by users or imported through the app's import screens (see import-templates/).
// Nothing fictional and no brand name is seeded here.

import { ALL_CAPABILITIES, MATRIX } from "../auth/permissions";
import type { MockDb } from "./mock/db";
import type { BrandRecord, OutletRecord, RoleRecord, SystemRole, User } from "./types";

const SEED_TS = "2026-06-01T09:00:00.000Z";
const U_OWNER = "u-owner";

/**
 * Password for the seeded owner account in MOCK/local-dev mode only, taken from
 * `VITE_DEV_LOGIN_PASSWORD`. There is intentionally NO fallback: shipping a
 * hardcoded password would put a working credential in the repository. When the
 * variable is unset, mock sign-in is disabled and the login screen says so.
 *
 * Real deployments use Supabase Auth, where the password lives in Supabase and
 * never touches this file.
 */
export const DEV_LOGIN_PASSWORD: string | null =
  import.meta.env?.VITE_DEV_LOGIN_PASSWORD || null;

// --- Users -----------------------------------------------------------------
// Exactly one account: the owner / Super Admin. Every other user is created
// through Users → Add User (or Supabase in a real deployment).
const users: User[] = [
  {
    id: U_OWNER,
    name: "M S Patel (Owner)",
    email: "mspatel05831@gmail.com",
    role: "super_admin",
    status: "active",
    approved: true,
    email_verified: true,
    dashboard_access: true,
    password: DEV_LOGIN_PASSWORD ?? undefined,
    created_at: SEED_TS,
    updated_at: SEED_TS,
  },
];

// --- Brands & outlets ------------------------------------------------------
// None are seeded. A Super Admin creates them in Brands & Outlets, and every
// brand reference in the app is a runtime id — no brand is hardcoded anywhere.
const brands: BrandRecord[] = [];
const outlets: OutletRecord[] = [];

// --- Roles (built-in, Super-Admin managed) ---------------------------------
// Seeded with the SAME capabilities as the permissions MATRIX, so behaviour is
// identical until a Super Admin adds a custom role. super_admin/admin are
// protected — their names back the DB RLS policies and triggers.
const SYSTEM_ROLE_DEFS: { key: SystemRole; label: string; description: string; protected: boolean; sort: number }[] = [
  { key: "super_admin", label: "Super Admin", description: "Full system control, incl. roles, brands & outlets. Protected — cannot be deleted.", protected: true, sort: 10 },
  { key: "admin", label: "Admin", description: "Manage users, recipes, materials, pricing, approvals & reports.", protected: true, sort: 20 },
  { key: "editor", label: "Editor", description: "Create/edit recipes, materials, pricing, yield & wastage.", protected: false, sort: 30 },
  { key: "head_chef", label: "Head Chef", description: "Edit recipes, record wastage & grant viewer access (no pricing).", protected: false, sort: 40 },
  { key: "chef", label: "Chef", description: "Read-only access to approved recipes.", protected: false, sort: 50 },
  { key: "viewer", label: "Viewer", description: "Read-only access to approved recipes in their brands.", protected: false, sort: 60 },
];

const roles: RoleRecord[] = SYSTEM_ROLE_DEFS.map((d) => ({
  key: d.key,
  label: d.label,
  description: d.description,
  is_system: true,
  protected: d.protected,
  sort_order: d.sort,
  capabilities: d.key === "super_admin" ? [...ALL_CAPABILITIES] : [...MATRIX[d.key]],
  created_by: U_OWNER,
  created_at: SEED_TS,
  updated_by: U_OWNER,
  updated_at: SEED_TS,
}));

// --- Default system settings ------------------------------------------------
// Category lists are the picker options offered when creating materials and
// recipes. They are labels only — no costing data.
const INGREDIENT_CATEGORIES = [
  "Vegetables", "Fruits", "Protein", "Dairy", "Grains & Flour", "Oils & Fats",
  "Spices", "Sauces & Condiments", "Beverages", "Bakery", "Dry Fruits",
  "In-House Prep", "Other",
];

const RECIPE_CATEGORIES = [
  "Pasta", "Pizza", "Sushi", "Mains", "Appetizers", "Small Plates",
  "Sides", "Salad", "Dessert", "Beverage", "In-House Prep",
];

/**
 * The one and only seed. Organisation structure is populated; every catalog and
 * activity table starts empty.
 */
export function buildSeed(): MockDb {
  return {
    users: structuredClone(users),
    brands: structuredClone(brands),
    outlets: structuredClone(outlets),
    roles: structuredClone(roles),
    system_settings: [
      { id: "s-foodcost", key: "food_cost_pct", value: "30", updated_by: U_OWNER, updated_at: SEED_TS },
      { id: "s-margin", key: "margin_alert_pct", value: "35", updated_by: U_OWNER, updated_at: SEED_TS },
      { id: "s-categories", key: "ingredient_categories", value: JSON.stringify(INGREDIENT_CATEGORIES), updated_by: U_OWNER, updated_at: SEED_TS },
      { id: "s-recipe-categories", key: "recipe_categories", value: JSON.stringify(RECIPE_CATEGORIES), updated_by: U_OWNER, updated_at: SEED_TS },
    ],

    // --- Empty catalog: created by users or via the import screens ----------
    raw_materials: [],
    recipes: [],
    recipe_ingredients: [],
    recipe_versions: [],
    recipe_packaging: [],
    packaging_items: [],
    ingredient_yields: [],

    // --- Empty activity / history ------------------------------------------
    recipe_cost_history: [],
    ingredient_price_history: [],
    wastage_entries: [],
    wastage_lines: [],
    user_recipe_views: [],
    audit_logs: [],
    export_history: [],
    recipe_access_links: [],
  };
}
