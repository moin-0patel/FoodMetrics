import {
  LayoutDashboard,
  Beef,
  BookOpen,
  CheckCircle2,
  FileBarChart,
  Users,
  Settings,
  ScrollText,
  ChefHat,
  Sprout,
  Trash2,
  Store,
  Package,
  Upload,
  type LucideIcon,
} from "lucide-react";
import type { Role, User } from "@/lib/data/types";
import { can, canImport, canManageWastage, type Capability } from "@/lib/auth/permissions";

/** Sidebar section a nav item belongs to (rendered as a labelled group). */
export type NavGroup = "Overview" | "Catalog" | "Operations" | "Admin";

export const NAV_GROUP_ORDER: NavGroup[] = ["Overview", "Catalog", "Operations", "Admin"];

export interface NavItem {
  to: string;
  label: string;
  icon: LucideIcon;
  /** Built-in roles that always see this item (kept for stable built-in behaviour). */
  roles: Role[];
  /** Item is also shown to any role (incl. custom roles) holding this capability. */
  cap?: Capability;
  /** Item is shown to every authenticated user (e.g. the dashboard). */
  always?: boolean;
  /** Item is also shown when this per-user predicate passes (e.g. a granted flag
   *  that no role/capability expresses). */
  grant?: (user: User) => boolean;
  group: NavGroup;
}

export const NAV_ITEMS: NavItem[] = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard, group: "Overview", roles: ["admin", "editor", "head_chef", "chef", "viewer"], always: true },
  { to: "/materials", label: "Raw Materials", icon: Beef, group: "Catalog", roles: ["admin", "editor", "head_chef"], cap: "material.view" },
  { to: "/packaging", label: "Packaging", icon: Package, group: "Catalog", roles: ["admin", "editor", "head_chef"], cap: "packaging.view" },
  { to: "/recipes", label: "Recipes", icon: BookOpen, group: "Catalog", roles: ["admin", "editor", "head_chef", "chef", "viewer"], cap: "recipe.viewAll" },
  { to: "/prep", label: "In-House Prep", icon: ChefHat, group: "Catalog", roles: ["admin", "editor", "head_chef"], cap: "recipe.editAll" },
  { to: "/yield", label: "Yield Management", icon: Sprout, group: "Catalog", roles: ["admin", "editor", "head_chef"], cap: "yield.manage" },
  // Wastage Management — Super Admins, plus any user a Super Admin grants can_manage_wastage.
  { to: "/wastage", label: "Wastage Management", icon: Trash2, group: "Operations", roles: ["super_admin"], grant: canManageWastage },
  { to: "/approvals", label: "Approvals", icon: CheckCircle2, group: "Operations", roles: ["admin"], cap: "recipe.approve" },
  // Reports now hosts its own tabs: Reports + (Admin-only) Export History &
  // Access History — so those two no longer have their own nav items.
  { to: "/reports", label: "Reports", icon: FileBarChart, group: "Operations", roles: ["admin", "editor", "head_chef"], cap: "report.excel" },
  // User Management now hosts Users + Viewer Access (all Admins) + a Super-Admin-only
  // Roles & Permissions tab, so Viewer Access and Roles no longer have their own items.
  { to: "/users", label: "User Management", icon: Users, group: "Admin", roles: ["admin"], cap: "user.manage" },
  // Brands & Outlets is Super-Admin only (creating/editing the brand + outlet master
  // data). No capability — the early return in navForRole shows every item to a
  // super_admin, and no other role matches roles:["super_admin"].
  { to: "/brands", label: "Brands & Outlets", icon: Store, group: "Admin", roles: ["super_admin"] },
  // Import Data hub — Super Admins, plus any user a Super Admin grants can_import.
  { to: "/import-data", label: "Import Data", icon: Upload, group: "Admin", roles: ["super_admin"], grant: canImport },
  { to: "/audit", label: "Price Changes", icon: ScrollText, group: "Admin", roles: ["admin"], cap: "audit.view" },
  { to: "/settings", label: "Settings", icon: Settings, group: "Admin", roles: ["admin"], cap: "settings.manage" },
];

export function navForRole(role: Role): NavItem[] {
  // Super Admin sees every section (it sits above Admin).
  if (role === "super_admin") return NAV_ITEMS;
  return NAV_ITEMS.filter(
    (item) => item.always || item.roles.includes(role) || (item.cap ? can(role, item.cap) : false),
  );
}

/** Like navForRole, but also honours per-user `grant` predicates (e.g. can_import). */
export function navForUser(user: User): NavItem[] {
  if (user.role === "super_admin") return NAV_ITEMS;
  return NAV_ITEMS.filter(
    (item) =>
      item.always ||
      item.roles.includes(user.role) ||
      (item.cap ? can(user.role, item.cap) : false) ||
      (item.grant ? item.grant(user) : false),
  );
}

/** Nav items for a role, bucketed into their groups in display order. */
export function navGroupsForRole(role: Role): { group: NavGroup; items: NavItem[] }[] {
  return groupNav(navForRole(role));
}

/** Nav items for a specific user (role + per-user grants), bucketed into groups. */
export function navGroupsForUser(user: User): { group: NavGroup; items: NavItem[] }[] {
  return groupNav(navForUser(user));
}

function groupNav(items: NavItem[]): { group: NavGroup; items: NavItem[] }[] {
  return NAV_GROUP_ORDER.map((group) => ({
    group,
    items: items.filter((i) => i.group === group),
  })).filter((g) => g.items.length > 0);
}
