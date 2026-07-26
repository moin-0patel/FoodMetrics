// Active repository set. Selection rules:
//  • USERS  → Supabase whenever Supabase is configured (auth + users live together).
//  • DATA (materials/recipes/yields/wastage) → Supabase ONLY when the opt-in
//    VITE_DATA_BACKEND=supabase flag is set (Phase 2). Otherwise the mock layer,
//    so enabling Supabase auth never silently swaps the data layer. Mock is also
//    the local-dev fallback. No feature code imports the mock/supabase modules.

import { isSupabaseConfigured, isSupabaseDataBackend } from "@/lib/supabase/client";
import { usersRepo as mockUsersRepo } from "./mock/users";
import { supabaseUsersRepo } from "./supabase/users";
import { materialsRepo as mockMaterialsRepo } from "./mock/materials";
import { supabaseMaterialsRepo } from "./supabase/materials";
import { yieldsRepo as mockYieldsRepo } from "./mock/yields";
import { supabaseYieldsRepo } from "./supabase/yields";
import { wastageRepo as mockWastageRepo } from "./mock/wastage";
import { supabaseWastageRepo } from "./supabase/wastage";
import { recipesRepo as mockRecipesRepo } from "./mock/recipes";
import { supabaseRecipesRepo } from "./supabase/recipes";
import { exportsRepo as mockExportsRepo } from "./mock/exports";
import { supabaseExportsRepo } from "./supabase/exports";
import { accessLinksRepo as mockAccessLinksRepo } from "./mock/accessLinks";
import { supabaseAccessLinksRepo } from "./supabase/accessLinks";
import { brandsRepo as mockBrandsRepo } from "./mock/brands";
import { supabaseBrandsRepo } from "./supabase/brands";
import { outletsRepo as mockOutletsRepo } from "./mock/outlets";
import { supabaseOutletsRepo } from "./supabase/outlets";
import { rolesRepo as mockRolesRepo } from "./mock/roles";
import { supabaseRolesRepo } from "./supabase/roles";
import { packagingRepo as mockPackagingRepo } from "./mock/packaging";
import { supabasePackagingRepo } from "./supabase/packaging";
import { mockAdminRepo } from "./mock/admin";
import { supabaseAdminRepo } from "./supabase/admin";

export { authenticate } from "./mock/users";
export { applicableUnitCost } from "./mock/wastage";
export type { CreateUserInput, UpdateUserInput } from "./mock/users";
export type { MaterialInput } from "./mock/materials";
export type { YieldInput, ImportYieldRow } from "./mock/yields";
export type { WastageInput } from "./mock/wastage";
export type { RecipeHeaderInput, RecipeLineInput, ImportRecipeLine } from "./mock/recipes";
export type { RoleInput } from "./mock/roles";
export type { BrandInput } from "./mock/brands";
export type { OutletInput } from "./mock/outlets";
export type { PackagingInput } from "./mock/packaging";

export const usersRepo = isSupabaseConfigured ? supabaseUsersRepo : mockUsersRepo;
export const materialsRepo = isSupabaseDataBackend ? supabaseMaterialsRepo : mockMaterialsRepo;
export const yieldsRepo = isSupabaseDataBackend ? supabaseYieldsRepo : mockYieldsRepo;
export const wastageRepo = isSupabaseDataBackend ? supabaseWastageRepo : mockWastageRepo;
export const recipesRepo = isSupabaseDataBackend ? supabaseRecipesRepo : mockRecipesRepo;
export const exportsRepo = isSupabaseDataBackend ? supabaseExportsRepo : mockExportsRepo;
// Share links: mock mode enforces expiry client-side; the Supabase path resolves
// tokens through the SECURITY DEFINER resolve_share_link RPC (server-enforced, 0011).
export const accessLinksRepo = isSupabaseDataBackend ? supabaseAccessLinksRepo : mockAccessLinksRepo;
// Brands & outlets: dynamically-managed master data (Super-Admin only).
export const brandsRepo = isSupabaseDataBackend ? supabaseBrandsRepo : mockBrandsRepo;
export const outletsRepo = isSupabaseDataBackend ? supabaseOutletsRepo : mockOutletsRepo;
// Packaging master: dynamically-managed cost items (admin-managed).
export const packagingRepo = isSupabaseDataBackend ? supabasePackagingRepo : mockPackagingRepo;
// Super-admin catalog wipe: Supabase path calls the server-gated wipe_catalog()
// RPC; mock path clears the local catalog arrays.
export const adminRepo = isSupabaseDataBackend ? supabaseAdminRepo : mockAdminRepo;
// Roles & permissions: follow the USERS backend (roles couple to user_profiles.role),
// so a custom role and the users it's assigned to always live in the same store.
export const rolesRepo = isSupabaseConfigured ? supabaseRolesRepo : mockRolesRepo;

// Viewer-access stays on the mock layer (its table FKs to a legacy `users` table).
// Settings + audit follow the data backend so they're SHARED in Supabase mode.
import { viewsRepo, settingsRepo as mockSettingsRepo, auditRepo as mockAuditRepo } from "./mock/misc";
import { supabaseSettingsRepo, supabaseAuditRepo } from "./supabase/misc";
export { viewsRepo };
export const settingsRepo = isSupabaseDataBackend ? supabaseSettingsRepo : mockSettingsRepo;
export const auditRepo = isSupabaseDataBackend ? supabaseAuditRepo : mockAuditRepo;
export type { AuditFilter } from "./mock/misc";
export type { ExportRecordInput } from "./mock/exports";
export type { CreateLinkInput, ResolvedLink } from "./mock/accessLinks";

export { resetDb } from "./mock/db";
export * from "./types";
