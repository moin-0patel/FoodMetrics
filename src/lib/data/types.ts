// Domain types mirroring PRD §9.2 table specifications.
// These map 1:1 to the Postgres schema authored in db/migrations.

/** The six built-in ("system") roles. Custom roles are arbitrary string keys
 *  created by a Super Admin (see the `roles` table), so the domain `Role` is a
 *  string — the literal union is kept as `SystemRole` for the built-ins that the
 *  DB RLS/triggers and code helpers still key off by name. */
export type SystemRole = "super_admin" | "admin" | "editor" | "head_chef" | "chef" | "viewer";
export type Role = string;

export const SYSTEM_ROLE_KEYS: SystemRole[] = ["super_admin", "admin", "editor", "head_chef", "chef", "viewer"];
/** Reserved roles that can never be deleted or edited from the app — their names
 *  are hard-wired into the Postgres RLS policies and guard triggers. */
export const PROTECTED_ROLE_KEYS: SystemRole[] = ["super_admin", "admin"];

/** Built-in role display labels. Custom roles resolve their label from the roles
 *  table via roleLabel()/the role cache; this stays as the fallback for the six. */
export const ROLE_LABELS: Record<string, string> = {
  super_admin: "Super Admin",
  admin: "Admin",
  editor: "Editor",
  head_chef: "Head Chef",
  chef: "Chef",
  viewer: "Viewer",
};

/** A role definition — built-in or a Super-Admin-created custom role. Capabilities
 *  are stored as capability keys (see `Capability` in src/lib/auth/permissions.ts);
 *  they're typed `string[]` here to keep this module free of a permissions import. */
export interface RoleRecord {
  key: string;
  label: string;
  description: string | null;
  /** True for the six built-in roles (not editable/deletable in Phase 1). */
  is_system: boolean;
  /** True for super_admin/admin — reserved names the DB depends on. */
  protected: boolean;
  sort_order: number;
  capabilities: string[];
  created_by: string | null;
  created_at: string;
  updated_by: string | null;
  updated_at: string;
}
export type UserStatus = "active" | "inactive";
export type RecipeStatus = "draft" | "testing" | "approved" | "rejected";
/** A brand id. Brands are created and managed at runtime (Brands & Outlets),
 *  so this is an opaque id rather than a fixed union. */
export type Brand = string;
export type MaterialStatus = "active" | "inactive";

/**
 * How much of a recipe's costing a viewer is allowed to see.
 *   • "no_cost"   — ingredients, process and quantities, but no money
 *   • "full_cost" — everything, including unit costs, totals and margins
 *
 * Legacy rows may still hold the original brand-named values; `normalizeViewType`
 * maps those forward. Write only the canonical values above.
 */
export type ViewType = "no_cost" | "full_cost";

/** Accept legacy view_type values stored before these were renamed. */
export function normalizeViewType(value: string | null | undefined): ViewType | null {
  if (value === "no_cost" || value === "full_cost") return value;
  if (value === "capiche") return "no_cost";
  if (value === "aiko") return "full_cost";
  return null;
}

/** Lifecycle status for a dynamically-managed brand or outlet (§10). Archived
 *  records are retained for history but hidden from new operations. */
export type BrandOutletStatus = "active" | "inactive" | "archived";

/** A dynamically-managed restaurant brand (Super-Admin only). Brands are created
 *  in-app; recipes, users, wastage, exports and share links all reference them by
 *  id, so no brand is hardcoded anywhere. */
export interface BrandRecord {
  id: string;
  name: string;
  /** Lower-cased, whitespace-collapsed name used for duplicate detection. */
  normalized_name: string;
  brand_code: string;
  display_name: string;
  /** Accent/text colour (hex). Chosen per brand; a stable colour is derived if unset. */
  accent_color: string | null;
  logo_url: string | null;
  status: BrandOutletStatus;
  notes: string | null;
  created_by: string | null;
  created_at: string;
  updated_by: string | null;
  updated_at: string;
}

/** A dynamically-managed outlet under a brand (Super-Admin only). The six seeded
 *  outlets are created in-app; wastage and user records reference them by id,
 *  keep resolving unchanged. */
export interface OutletRecord {
  id: string;
  brand_id: string;
  name: string;
  normalized_name: string;
  outlet_code: string;
  city: string | null;
  state: string | null;
  address: string | null;
  phone: string | null;
  email: string | null;
  opening_date: string | null;
  timezone: string;
  status: BrandOutletStatus;
  manager_user_id: string | null;
  notes: string | null;
  created_by: string | null;
  created_at: string;
  updated_by: string | null;
  updated_at: string;
}

/** Operational wastage taxonomy (§13). */
export const WASTAGE_TYPES = [
  "Raw Material Wastage",
  "Preparation Wastage",
  "Cooking Wastage",
  "Spoilage",
  "Expired Stock",
  "Overproduction",
  "Returned Food",
  "Incorrect Preparation",
  "Damaged Stock",
  "Quality Rejection",
  "Other",
] as const;
export type WastageType = (typeof WASTAGE_TYPES)[number];

export const DEPARTMENTS = [
  "Kitchen Staff",
  "Service Staff",
  "Other",
] as const;
export type Department = (typeof DEPARTMENTS)[number];

/** A recorded operational wastage event at an outlet (§11–§14). Separate from
 *  the Yield Management master data. */
export interface WastageEntry {
  id: string;
  /** Optional label for the wastage record (recipe-style). */
  name?: string | null;
  wastage_date: string;
  /** Brand id (dynamic — see the brands table). */
  brand: string;
  outlet_id: string;
  /** Free-text category (e.g. "Kitchen", "Expiry"). */
  category?: string | null;
  wastage_type: WastageType;
  /** Header single-item fields mirror the FIRST wastage line (backward compatible);
   *  the full itemised breakdown lives in wastage_lines. */
  item_type: "ingredient" | "recipe";
  ingredient_id: string | null;
  recipe_id: string | null;
  quantity: number;
  unit: string;
  unit_cost: number;
  /** Ingredient cost + packaging_cost = total wastage cost. */
  packaging_cost?: number;
  total_cost: number;
  description?: string | null;
  reason: string | null;
  department: Department;
  shift: string | null;
  /** Free-text name of the person who caused/handled the wastage. */
  done_by: string | null;
  entered_by: string | null;
  approved_by: string | null;
  status?: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

/** One itemised wastage line (recipe-style). */
export interface WastageLine {
  id: string;
  wastage_id: string;
  item_type: "ingredient" | "recipe";
  ingredient_id: string | null;
  recipe_id: string | null;
  quantity: number;
  unit: string;
  unit_cost: number;
  total_cost: number;
}

/** A wastage line joined to the wasted item's name (for display). */
export interface WastageLineWithItem extends WastageLine {
  name: string;
}

/** §20 Controlled brand-access scope for a user/role. */
export type BrandScope = "ALL_BRANDS" | "SELECTED_BRANDS" | "ASSIGNED_BRAND";
/** §20 Controlled outlet-access scope for a user/role. */
export type OutletScope =
  | "ALL_OUTLETS"
  | "ALL_OUTLETS_IN_BRAND"
  | "SELECTED_OUTLETS"
  | "ASSIGNED_OUTLET"
  | "NO_OUTLET_ACCESS";

export interface User {
  id: string;
  name: string;
  email: string;
  role: Role;
  status: UserStatus;
  /** Mock-only: plaintext password for the local auth simulation. */
  password?: string;
  /** Optional contact number shown on the profile. */
  phone?: string | null;
  /** Avatar image as a data URL (mock) or external URL. */
  avatar_url?: string | null;
  /** Whether the user's email is verified (mirrored from Supabase auth on sign-in). */
  email_verified?: boolean;
  /** Brand assignment (brand id) for Outlet Manager / Staff. */
  assigned_brand?: string | null;
  /** Outlet assignment (outlet id) for Outlet Manager / Staff. */
  assigned_outlet?: string | null;
  /** §19–§20 brand access scope. Unset → legacy (staff: all; viewer: accessible_brands). */
  brand_scope?: BrandScope | null;
  selected_brand_ids?: string[];
  /** §19–§20 outlet access scope. Unset → legacy (staff: all; viewer/chef: brand-scoped). */
  outlet_scope?: OutletScope | null;
  selected_outlet_ids?: string[];
  /** Last successful sign-in timestamp (set by the auth layer). */
  last_login?: string | null;
  /** When the role was last changed + who changed it (role history). */
  last_role_update?: string | null;
  role_updated_by?: string | null;
  /** Saved UI theme preference ('light' | 'dark'). */
  theme_pref?: string | null;
  /** Viewer-only: which brand ids' approved recipes this viewer can see. */
  accessible_brands?: string[];
  /** Viewer-only: whether this viewer sees costs/pricing (else recipe-only). */
  show_cost?: boolean;
  /** Whether this user sees the Master Costing dashboard (cost stats). Admins
   *  always do; other roles only when an admin grants it. */
  dashboard_access?: boolean;
  /** Whether this user may reach the Data Import hub. Super Admins always; any
   *  other user only when a Super Admin grants it. */
  can_import?: boolean;
  /** Whether this user may open and use Wastage Management. Super Admins always;
   *  any other user only when a Super Admin grants it. */
  can_manage_wastage?: boolean;
  /** Self sign-ups start unapproved (false) and can't enter the app until an
   *  admin verifies them. Owners/admin-created/seed users are approved. A missing
   *  value means approved (legacy/seed users). */
  approved?: boolean;
  created_at: string;
  updated_at: string;
}

export interface RawMaterial {
  id: string;
  ingredient_name: string;
  category: string;
  /** Free-text note about the ingredient (storage, brand, prep, etc.). */
  notes: string | null;
  purchase_price: number | null;
  purchase_quantity: number;
  purchase_unit: string;
  base_unit: string;
  /** Generated: purchase_price / (purchase_quantity × conversion). Null if no price. */
  cost_per_base_unit: number | null;
  last_price_update: string | null;
  status: MaterialStatus;
  created_by: string | null;
  created_at: string;
}

// --- Packaging master (Primary/Secondary/Tertiary cost items) ---------------
export type PackagingType = "primary" | "secondary" | "tertiary";
export const PACKAGING_TYPES: PackagingType[] = ["primary", "secondary", "tertiary"];
export const PACKAGING_TYPE_LABELS: Record<PackagingType, string> = {
  primary: "Primary Packaging",
  secondary: "Secondary Packaging",
  tertiary: "Tertiary Packaging",
};

/** A packaging master item (Pizza Box, Sauce Cup…) with a unit price. Recipes
 *  reference these via recipe_packaging lines. Stored as a string so a Super Admin
 *  can add future packaging types without a code change. */
export interface PackagingItem {
  id: string;
  name: string;
  /** Lower-cased, whitespace-collapsed name for duplicate detection. */
  normalized_name: string;
  packaging_type: string;
  unit: string;
  unit_price: number | null;
  status: MaterialStatus;
  notes: string | null;
  created_by: string | null;
  created_at: string;
  updated_by: string | null;
  updated_at: string;
}

/** One packaging line on a recipe: how many of a packaging item it uses. The
 *  unit price is snapshotted so historic recipe costs stay stable. */
export interface RecipePackaging {
  id: string;
  recipe_id: string;
  packaging_item_id: string;
  quantity_used: number;
  unit: string;
  unit_price: number;
  created_at: string;
}

/** A recipe packaging line joined to its master item (for display). */
export interface RecipePackagingWithItem extends RecipePackaging {
  item: PackagingItem | null;
}

export interface Recipe {
  id: string;
  recipe_name: string;
  category: string;
  /** Brand id (dynamic — see the brands table). */
  brand: string;
  description: string | null;
  /** Ordered preparation/cooking steps (from the cookbook METHOD section). */
  method: string[];
  /** Pizza size variants (§14–§20): a variant points at its master recipe; the
   *  master itself is the primary (15-inch) and is the only row shown in lists. */
  parent_recipe_id?: string | null;
  size_code?: "11_INCH" | "15_INCH" | null;
  size_label?: string | null;
  /** Recipe photo as a data URL (mock) or external URL. */
  image_url: string | null;
  preparation_time: number | null;
  serving_size: number;
  status: RecipeStatus;
  total_cost: number | null;
  cost_per_portion: number | null;
  /** Finished dish weight in grams — sum of ingredient quantities (weight + volume,
   *  count excluded), converted to grams. App-maintained (recompute), never entered.
   *  This is the RAW weight (before cooking). */
  total_weight_g?: number | null;
  /** Final weight after cooking (grams), manually measured and entered. Null until
   *  recorded. Compared against total_weight_g to derive the cooking-loss %. */
  cooked_weight_g?: number | null;
  /** Manually-typed creator label (e.g. "Chef Rahul", "Central Kitchen"). Distinct
   *  from created_by (the system user id). Blank for legacy recipes until edited. */
  created_by_name?: string | null;
  /** Actual menu price set by the chef. Null → no price; the app never suggests one. */
  selling_price: number | null;
  /** Per-portion packaging cost (box/container), added on top of food cost. */
  packaging_cost: number;
  /** Wastage % added on top of the raw ingredient cost (PRD / sheet "Wastage"). */
  wastage_pct: number;
  /** True for in-house prep recipes (sauces, doughs, pastes) used as components. */
  is_prep: boolean;
  /** Batch output used to derive a prep's per-unit cost (defaults to sum of grams). */
  yield_quantity: number;
  yield_unit: string;
  created_by: string | null;
  approved_by: string | null;
  approved_at: string | null;
  rejection_note: string | null;
  /** Soft-archive: when set, the recipe is retired from active lists but kept
   *  (with its cost history) so reports and sub-recipe links stay intact. This is
   *  independent of the workflow `status`, which is preserved and restored on
   *  un-archive. Null → the recipe is active. */
  archived_at?: string | null;
  archived_by?: string | null;
  version_no: number;
  created_at: string;
  updated_at: string;
  updated_by: string | null;
}

/** A recipe line is either a raw material or another (prep) recipe. */
export type ComponentType = "material" | "recipe";

export interface RecipeIngredient {
  id: string;
  recipe_id: string;
  /** Points at a raw_material (component_type 'material') or a recipe ('recipe'). */
  ingredient_id: string;
  component_type: ComponentType;
  quantity_used: number;
  unit_used: string;
  calculated_cost: number | null;
  sort_order: number;
  /** Recipe-specific wastage % override (§10). Null → use the ingredient's standard yield. */
  wastage_override_pct?: number | null;
  /** Selected cut/prep variant for a vegetable (e.g. "Sliced", "Diced"). Its yield
   *  drives the yield-adjusted cost; null → use the ingredient as-is. */
  cut_type?: string | null;
}

export interface RecipeCostHistory {
  id: string;
  recipe_id: string;
  old_total_cost: number | null;
  new_total_cost: number | null;
  old_cost_per_portion: number | null;
  new_cost_per_portion: number | null;
  change_reason: string | null;
  changed_by: string | null;
  changed_at: string;
}

/**
 * Standard yield (preparation-loss) data for an ingredient. The full purchase
 * cost is distributed across the USABLE quantity, giving the effective rate.
 */
export interface IngredientYield {
  id: string;
  /** Optional label for the yield record; falls back to the ingredient name. */
  name?: string | null;
  ingredient_id: string;
  purchase_cost: number;
  purchase_quantity: number;
  purchase_unit: string;
  /** Raw quantity expressed in the base unit (Gram/ML/piece). */
  raw_quantity: number;
  raw_unit: string;
  wastage_quantity: number;
  wastage_unit: string;
  usable_quantity: number;
  wastage_percentage: number;
  yield_percentage: number;
  /** Per base unit. */
  original_unit_cost: number;
  /** Per base unit, distributing full cost over the usable quantity. */
  yield_adjusted_unit_cost: number;
  effective_from: string;
  notes: string | null;
  created_at: string;
  updated_at: string;
  created_by: string | null;
}

export interface IngredientPriceHistory {
  id: string;
  ingredient_id: string;
  old_price: number | null;
  new_price: number | null;
  old_cost_per_base_unit: number | null;
  new_cost_per_base_unit: number | null;
  changed_by: string | null;
  changed_at: string;
}

export interface RecipeVersion {
  id: string;
  recipe_id: string;
  version_no: number;
  snapshot: unknown;
  notes: string | null;
  created_by: string | null;
  created_at: string;
}

export interface UserRecipeView {
  id: string;
  user_id: string;
  recipe_id: string;
  view_type: ViewType;
  assigned_by: string | null;
  assigned_at: string;
}

export type AuditEntityType = "recipe" | "ingredient" | "user" | "brand" | "outlet" | "role" | "packaging";
export type AuditAction = "create" | "update" | "delete" | "approve" | "reject" | "submit";

export interface AuditLog {
  id: string;
  entity_type: AuditEntityType;
  entity_id: string;
  action: AuditAction;
  old_values: unknown | null;
  new_values: unknown | null;
  performed_by: string | null;
  performed_at: string;
  notes: string | null;
}

export interface SystemSetting {
  id: string;
  key: string;
  value: string;
  updated_by: string | null;
  updated_at: string;
}

export type ExportFormat = "pdf" | "csv" | "xlsx";
export type ExportEntityType = "recipe" | "report";
export type ExportStatus = "success" | "failed";

/** §14 Controlled access types for a shared recipe link (no free-text). */
export type AccessType = "READ_ONLY" | "DOWNLOAD_PDF" | "VIEW_AND_DOWNLOAD";
export type AccessLinkStatus = "ACTIVE" | "EXPIRED" | "REVOKED";

/** §15 A temporary, read-only recipe share link. The raw token is never stored —
 *  only its hash — and expiry/revocation are checked when the token is resolved. */
export interface RecipeAccessLink {
  id: string;
  token_hash: string;
  recipe_id: string;
  granted_by_user_id: string | null;
  granted_by_name: string;
  granted_by_role: Role;
  granted_to_user_id: string | null;
  granted_to_email: string | null;
  granted_to_role: Role | null;
  granted_to_brand_id: string | null;
  granted_to_outlet_id: string | null;
  access_type: AccessType;
  created_at: string;
  expires_at: string;
  revoked_at: string | null;
  revoked_by_user_id: string | null;
  last_accessed_at: string | null;
  access_count: number;
  status: AccessLinkStatus;
}

/** §9 One audit row per successful export. Exporter identity + timestamp are
 *  snapshotted from the authenticated session at export time (never user-typed). */
export interface ExportHistory {
  id: string;
  exported_by_user_id: string | null;
  exporter_name_snapshot: string;
  exporter_email_snapshot: string | null;
  exporter_role_snapshot: Role;
  export_type: string; // e.g. "single_recipe", "recipe_report"
  entity_type: ExportEntityType;
  entity_id: string | null;
  recipe_name_snapshot: string | null;
  report_name: string | null;
  brand_id: string | null;
  outlet_id: string | null;
  filters_used: string | null;
  file_format: ExportFormat;
  exported_at: string; // UTC ISO
  timezone: string; // e.g. "Asia/Kolkata"
  status: ExportStatus;
}

/** A recipe ingredient joined with its raw material or sub-recipe, for the UI. */
export interface RecipeIngredientWithMaterial extends RecipeIngredient {
  material: RawMaterial | null;
  /** Set when component_type === 'recipe' — the referenced prep recipe. */
  subRecipe: Recipe | null;
}
