// Client-side permission layer mirroring the PRD §7.2 matrix, §7.3 viewer
// sub-types, and §14.2 view-mode data visibility. This maps 1:1 to the
// Postgres RLS policies (PRD §9.3) authored in db/migrations — when Supabase
// is added these checks are backed by RLS, not replaced.

import {
  type OutletRecord,
  type Recipe,
  type Role,
  type SystemRole,
  type User,
  type ViewType,
} from "../data/types";
import { capabilitiesForRole } from "./roleCache";

export type Capability =
  // user management
  | "user.manage"
  // raw materials
  | "material.view"
  | "material.edit"
  // packaging master
  | "packaging.view"
  | "packaging.manage"
  // yield management (R&D)
  | "yield.manage"
  // operational wastage
  | "wastage.create"
  // recipes
  | "recipe.create"
  | "recipe.editAll"
  | "recipe.delete"
  | "recipe.duplicate"
  | "recipe.submit"
  // approval
  | "recipe.approve"
  // viewing
  | "recipe.viewAll"
  // viewer access management
  | "viewer.assign"
  // settings
  | "settings.manage"
  // reports
  | "report.excel"
  | "audit.view"
  // role & permission management (Super Admin only)
  | "role.manage";

// The built-in role → capability matrix. This is now the SEED and the pre-hydration
// fallback for the six system roles: the same rows are seeded into role_capabilities,
// and once the role cache is primed (AppLayout) `can()` reads live data instead —
// so a Super Admin can grant/revoke capabilities on custom roles without a code change.
export const MATRIX: Record<SystemRole, Capability[]> = {
  // Super Admin: everything, plus exclusive role/permission management.
  super_admin: [
    "user.manage",
    "material.view",
    "material.edit",
    "packaging.view",
    "packaging.manage",
    "yield.manage",
    "wastage.create",
    "recipe.create",
    "recipe.editAll",
    "recipe.delete",
    "recipe.duplicate",
    "recipe.submit",
    "recipe.approve",
    "recipe.viewAll",
    "viewer.assign",
    "settings.manage",
    "report.excel",
    "audit.view",
    "role.manage",
  ],
  admin: [
    "user.manage",
    "material.view",
    "material.edit",
    "packaging.view",
    "packaging.manage",
    "yield.manage",
    "wastage.create",
    "recipe.create",
    "recipe.editAll",
    "recipe.delete",
    "recipe.duplicate",
    "recipe.submit",
    "recipe.approve",
    "recipe.viewAll",
    "viewer.assign",
    "settings.manage",
    "report.excel",
    "audit.view",
  ],
  // Editor: manages recipes, raw materials, pricing, yield, wastage; imports data.
  editor: [
    "material.view",
    "material.edit",
    "packaging.view",
    "packaging.manage",
    "yield.manage",
    "wastage.create",
    "recipe.create",
    "recipe.editAll",
    "recipe.duplicate",
    "recipe.submit",
    "recipe.viewAll",
    "viewer.assign",
    "report.excel",
  ],
  // Head Chef: edits + sees everything, records wastage, and can grant chefs/viewers
  // recipe-view access — but does not change ingredient prices (admin/editor only).
  head_chef: [
    "material.view",
    "packaging.view",
    "yield.manage",
    "wastage.create",
    "recipe.create",
    "recipe.editAll",
    "recipe.duplicate",
    "recipe.submit",
    "recipe.viewAll",
    "viewer.assign",
    "report.excel",
  ],
  // Chef: read-only, same as a Viewer.
  chef: [],
  viewer: [],
};

export function can(role: Role | undefined, cap: Capability): boolean {
  if (!role) return false;
  if (role === "super_admin") return true; // Super Admin can do anything.
  // Prefer live capabilities from the role cache (built-ins + custom roles). Before
  // the cache is primed it returns null, so we fall back to the built-in matrix for
  // the six system roles (custom roles simply get nothing until the cache loads).
  const live = capabilitiesForRole(role);
  if (live) return live.has(cap);
  return (MATRIX[role as SystemRole] ?? []).includes(cap);
}

/** The protected top-level role. Only a Super Admin manages roles/permissions. */
export function isSuperAdmin(role: Role | undefined): boolean {
  return role === "super_admin";
}

/** Every capability in the system (the Super Admin set, which is the superset). */
export const ALL_CAPABILITIES: Capability[] = MATRIX.super_admin;

/** The capabilities a role currently holds (for the Roles & Permissions view).
 *  Reads live data (cache) when available, else the built-in matrix. */
export function roleCapabilities(role: Role): Capability[] {
  const live = capabilitiesForRole(role);
  if (live) return ALL_CAPABILITIES.filter((c) => live.has(c));
  return MATRIX[role as SystemRole] ?? [];
}

/** Capabilities grouped by area — drives the Roles & Permissions checkboxes. */
export const CAPABILITY_GROUPS: { label: string; capabilities: Capability[] }[] = [
  { label: "Recipes", capabilities: ["recipe.viewAll", "recipe.create", "recipe.editAll", "recipe.duplicate", "recipe.submit", "recipe.approve", "recipe.delete"] },
  { label: "Raw Materials & Yield", capabilities: ["material.view", "material.edit", "yield.manage"] },
  { label: "Operations", capabilities: ["wastage.create", "report.excel", "viewer.assign", "audit.view"] },
  { label: "Settings", capabilities: ["settings.manage"] },
  { label: "Administration (reserved)", capabilities: ["user.manage", "role.manage"] },
];

/** Capabilities that are RESERVED to the built-in Admin / Super Admin roles: the
 *  Postgres RLS + guard triggers gate these on the role NAME (is_app_admin /
 *  is_app_super_admin), so granting them to a custom role would do nothing
 *  server-side. They're shown locked in the Roles editor to keep app & DB in sync. */
export const RESERVED_CAPABILITIES: Capability[] = [
  "user.manage",
  "role.manage",
];

/** Capabilities a custom role MAY be granted (everything except the reserved set). */
export const GRANTABLE_CAPABILITIES: Capability[] = ALL_CAPABILITIES.filter(
  (c) => !RESERVED_CAPABILITIES.includes(c),
);

/** Human labels for capability keys (Roles & Permissions matrix). */
export const CAPABILITY_LABELS: Record<Capability, string> = {
  "user.manage": "Manage users",
  "material.view": "View raw materials",
  "material.edit": "Edit raw materials / prices",
  "packaging.view": "View packaging",
  "packaging.manage": "Manage packaging",
  "yield.manage": "Manage yields",
  "wastage.create": "Record wastage",
  "recipe.create": "Create recipes",
  "recipe.editAll": "Edit any recipe",
  "recipe.delete": "Delete recipes",
  "recipe.duplicate": "Duplicate recipes",
  "recipe.submit": "Submit for approval",
  "recipe.approve": "Approve / reject recipes",
  "recipe.viewAll": "View all recipes",
  "viewer.assign": "Grant viewer access",
  "settings.manage": "Manage settings",
  "report.excel": "Export reports",
  "audit.view": "View audit / price changes",
  "role.manage": "Manage roles & permissions",
};

/** Roles that are read-only (treated like a Viewer everywhere). */
export function isReadOnlyRole(role: Role | undefined): boolean {
  return role === "viewer" || role === "chef";
}

/** Can this user edit this specific recipe? Anyone with the "edit any recipe"
 *  capability (Admin/Editor/Head Chef by default, plus any custom role granted it),
 *  else the creator. */
export function canEditRecipe(user: User | null, recipe: Recipe): boolean {
  if (!user) return false;
  if (can(user.role, "recipe.editAll")) return true;
  return recipe.created_by === user.id;
}

// --- Viewer view-mode visibility (PRD §14.2) ------------------------------
export interface ViewVisibility {
  ingredients: boolean;
  process: boolean;
  quantities: boolean;
  unitCosts: boolean;
  totalCost: boolean;
  costPerPortion: boolean;
  sellingPrice: boolean;
  grossProfit: boolean;
}

/** Recipe content without any monetary figures. */
const NO_COST: ViewVisibility = {
  ingredients: true,
  process: true,
  quantities: true,
  unitCosts: false,
  totalCost: false,
  costPerPortion: false,
  sellingPrice: false,
  grossProfit: false,
};

/** Everything, including unit costs, totals, selling price and margin. */
const FULL_COST: ViewVisibility = {
  ingredients: true,
  process: true,
  quantities: true,
  unitCosts: true,
  totalCost: true,
  costPerPortion: true,
  sellingPrice: true,
  grossProfit: true,
};

/**
 * Visibility for a given audience. Admin/editor see everything; viewers see
 * according to their assigned view_type for the recipe.
 */
export function visibilityFor(
  role: Role,
  viewType: ViewType | null,
): ViewVisibility {
  // Admin/Editor/Head Chef see full costing; Viewer + Chef are restricted.
  if (!isReadOnlyRole(role)) return FULL_COST;
  if (viewType === "full_cost") return FULL_COST;
  return NO_COST; // safest default for an unassigned viewer
}

/**
 * Brands a viewer can see. Default (unset) is EVERYTHING — a viewer gets full
 * access until an editor/admin restricts them to specific brands.
 */
export function viewerBrands(user: User | null, allBrandIds: string[]): string[] {
  return userBrands(user, allBrandIds);
}

/** Viewers see costs by default; an editor/admin can turn this off. */
export function viewerShowCost(user: User | null): boolean {
  return user?.show_cost ?? true;
}

/** A viewer/chef can see a recipe if it's approved and in one of their brands. */
export function viewerCanAccess(user: User | null, recipe: Recipe, allBrandIds: string[]): boolean {
  if (!user || !isReadOnlyRole(user.role)) return false;
  return recipe.status === "approved" && viewerBrands(user, allBrandIds).includes(recipe.brand);
}

/** Visibility for any user: staff roles see all; viewer/chef per their show_cost grant. */
export function visibilityForUser(user: User): ViewVisibility {
  if (!isReadOnlyRole(user.role)) return visibilityFor(user.role, null);
  return visibilityFor("viewer", viewerShowCost(user) ? "full_cost" : "no_cost");
}

/**
 * Whether the user sees the Master Costing dashboard (food/packaging/selling/FC%
 * stats). Admins always do; any other role only when an admin grants
 * `dashboard_access`. Everyone else gets the plain overview dashboard.
 */
export function canViewMasterDashboard(user: User | null): boolean {
  if (!user) return false;
  return user.role === "super_admin" || user.role === "admin" || user.dashboard_access === true;
}

/**
 * Whether the user may reach the Data Import hub. Super Admins always; any other
 * user (any role) only when a Super Admin grants `can_import`.
 */
export function canImport(user: User | null): boolean {
  if (!user) return false;
  return user.role === "super_admin" || user.can_import === true;
}

/**
 * Whether the user may open and use the Wastage Management page. Super Admins
 * always; any other user (any role) only when a Super Admin grants
 * `can_manage_wastage`.
 */
export function canManageWastage(user: User | null): boolean {
  if (!user) return false;
  return user.role === "super_admin" || user.can_manage_wastage === true;
}

/**
 * A self sign-up that an admin hasn't verified yet. Such users are authenticated
 * but blocked from the app (shown the pending-approval screen). Admins are never
 * pending. A missing `approved` value means approved (legacy/seed users).
 */
export function isPendingApproval(user: User | null): boolean {
  if (!user) return false;
  return user.approved === false && user.role !== "admin" && user.role !== "super_admin";
}

// --- Brand / outlet scope ------------------------------------------------
// Admin / Editor / Head Chef operate across everything; Viewer + Chef follow their
// accessible_brands grant.

/** Brands a user may act within (for scoping selectors + data). */
export function userBrands(user: User | null, allBrandIds: string[]): string[] {
  if (!user) return [];
  if (user.role === "super_admin") return allBrandIds; // §13 full access, ignores scope
  switch (user.brand_scope) {
    case "ALL_BRANDS":
      return allBrandIds;
    case "SELECTED_BRANDS":
      return user.selected_brand_ids ?? [];
    case "ASSIGNED_BRAND":
      return user.assigned_brand ? [user.assigned_brand] : [];
  }
  // No explicit scope → legacy behaviour.
  if (isReadOnlyRole(user.role)) return user.accessible_brands ?? allBrandIds;
  return allBrandIds; // admin, editor, head_chef see every brand
}

/** Outlets a user may see (all for staff roles; brand-scoped for viewer/chef).
 *  Not status-filtered, so historical records for inactive/archived outlets stay
 *  visible — new-entry selectors filter to active themselves. Callers pass the
 *  live outlet list (loaded from the brands/outlets repo). */
export function accessibleOutlets(
  user: User | null,
  outlets: OutletRecord[],
  allBrandIds: string[],
): OutletRecord[] {
  if (!user) return [];
  if (user.role === "super_admin") return outlets; // §13 full access, ignores scope
  const brands = userBrands(user, allBrandIds);
  switch (user.outlet_scope) {
    case "NO_OUTLET_ACCESS":
      return [];
    case "ALL_OUTLETS":
      return outlets;
    case "ALL_OUTLETS_IN_BRAND":
      return outlets.filter((o) => brands.includes(o.brand_id));
    case "SELECTED_OUTLETS": {
      const ids = new Set(user.selected_outlet_ids ?? []);
      return outlets.filter((o) => ids.has(o.id));
    }
    case "ASSIGNED_OUTLET":
      return outlets.filter((o) => o.id === user.assigned_outlet);
  }
  // No explicit scope → legacy: staff see all; viewer/chef are brand-scoped.
  if (!isReadOnlyRole(user.role)) return outlets;
  return outlets.filter((o) => brands.includes(o.brand_id));
}

export function canAccessOutlet(
  user: User | null,
  outletId: string,
  outlets: OutletRecord[],
  allBrandIds: string[],
): boolean {
  return accessibleOutlets(user, outlets, allBrandIds).some((o) => o.id === outletId);
}

export function canAccessBrand(user: User | null, brand: string, allBrandIds: string[]): boolean {
  return userBrands(user, allBrandIds).includes(brand);
}

export const HOME_BY_ROLE: Record<Role, string> = {
  super_admin: "/dashboard",
  admin: "/dashboard",
  editor: "/dashboard",
  head_chef: "/dashboard",
  chef: "/dashboard",
  viewer: "/dashboard",
};
