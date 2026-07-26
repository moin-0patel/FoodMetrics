import type { BrandScope, OutletScope, Role, User, UserStatus } from "../types";
import { delay, getDb, mutate, nowISO, uid } from "./db";
import { recordAudit } from "./recompute";

const MAX_SUPER_ADMINS = 2;
const MAX_SUPER_MSG =
  "A maximum of 2 active Super Admin users is allowed. Remove or demote an existing Super Admin before assigning another.";
const isActiveSuperAdmin = (u: User) => u.role === "super_admin" && u.status === "active" && u.approved !== false;
const OWNER_EMAILS = ["mspatel05831@gmail.com"];
const isOwnerEmail = (email: string) => OWNER_EMAILS.includes(email.toLowerCase());

export interface CreateUserInput {
  name: string;
  email: string;
  role: Role;
  status?: UserStatus;
  assigned_brand?: string | null;
  assigned_outlet?: string | null;
  brand_scope?: BrandScope | null;
  selected_brand_ids?: string[];
  outlet_scope?: OutletScope | null;
  selected_outlet_ids?: string[];
  accessible_brands?: string[];
  can_import?: boolean;
  can_manage_wastage?: boolean;
  password: string;
}

export interface UpdateUserInput {
  name?: string;
  email?: string;
  role?: Role;
  status?: UserStatus;
  assigned_brand?: string | null;
  assigned_outlet?: string | null;
  brand_scope?: BrandScope | null;
  selected_brand_ids?: string[];
  outlet_scope?: OutletScope | null;
  selected_outlet_ids?: string[];
  password?: string;
  phone?: string | null;
  avatar_url?: string | null;
  last_login?: string | null;
  accessible_brands?: string[];
  show_cost?: boolean;
  dashboard_access?: boolean;
  can_import?: boolean;
  can_manage_wastage?: boolean;
  approved?: boolean;
}

/** Strip the mock-only password before handing a user to the UI. */
function publicUser(u: User): User {
  const { password: _pw, ...rest } = u;
  return rest;
}

export const usersRepo = {
  async list(): Promise<User[]> {
    return delay(getDb().users.map(publicUser));
  },

  async getById(id: string): Promise<User | null> {
    const u = getDb().users.find((x) => x.id === id);
    return delay(u ? publicUser(u) : null);
  },

  async create(input: CreateUserInput, actorId: string): Promise<User> {
    return delay(
      mutate((db) => {
        if (db.users.some((u) => u.email.toLowerCase() === input.email.toLowerCase())) {
          throw new Error("A user with this email already exists");
        }
        // Only a Super Admin may create another Super Admin (addendum §8/§3).
        if (input.role === "super_admin" && db.users.find((x) => x.id === actorId)?.role !== "super_admin") {
          throw new Error("Only a Super Admin can create a Super Admin");
        }
        // §14/§16 at most 5 active Super Admins (owner emails are always allowed).
        if (
          input.role === "super_admin" &&
          !isOwnerEmail(input.email) &&
          db.users.filter(isActiveSuperAdmin).length >= MAX_SUPER_ADMINS
        ) {
          throw new Error(MAX_SUPER_MSG);
        }
        const user: User = {
          id: uid(),
          name: input.name,
          email: input.email,
          role: input.role,
          status: input.status ?? "active",
          assigned_brand: input.assigned_brand ?? null,
          assigned_outlet: input.assigned_outlet ?? null,
          brand_scope: input.brand_scope ?? null,
          selected_brand_ids: input.selected_brand_ids,
          outlet_scope: input.outlet_scope ?? null,
          selected_outlet_ids: input.selected_outlet_ids,
          accessible_brands: input.accessible_brands,
          // Data Import & Wastage access are only honoured when a Super Admin creates the user.
          can_import: db.users.find((x) => x.id === actorId)?.role === "super_admin" ? input.can_import : undefined,
          can_manage_wastage: db.users.find((x) => x.id === actorId)?.role === "super_admin" ? input.can_manage_wastage : undefined,
          approved: true, // an admin is creating this account → pre-approved
          last_role_update: nowISO(),
          role_updated_by: actorId,
          password: input.password,
          created_at: nowISO(),
          updated_at: nowISO(),
        };
        db.users.push(user);
        recordAudit(db, {
          entity_type: "user",
          entity_id: user.id,
          action: "create",
          new_values: { name: user.name, email: user.email, role: user.role },
          performed_by: actorId,
          notes: `Created user ${user.email}`,
        });
        return publicUser(user);
      }),
    );
  },

  async update(id: string, patch: UpdateUserInput, actorId: string): Promise<User> {
    return delay(
      mutate((db) => {
        const u = db.users.find((x) => x.id === id);
        if (!u) throw new Error("User not found");
        const before = { name: u.name, email: u.email, role: u.role, status: u.status };
        const roleChanged = patch.role !== undefined && patch.role !== u.role;
        // §28 privilege-escalation safeguards.
        if (roleChanged && id === actorId) {
          throw new Error("You cannot change your own role");
        }
        const isActiveAdmin = (x: typeof u) => x.role === "admin" && x.status === "active" && x.approved !== false;
        const demotingAdmin = u.role === "admin" && roleChanged && patch.role !== "admin";
        const disablingAdmin = u.role === "admin" && patch.status === "inactive";
        if ((demotingAdmin || disablingAdmin) && db.users.filter(isActiveAdmin).length <= 1) {
          throw new Error("Cannot remove the last remaining Admin");
        }
        // Super Admin safeguards (addendum §8 + §4).
        const actor = db.users.find((x) => x.id === actorId);
        const actorIsSuper = actor?.role === "super_admin";
        const targetIsSuper = u.role === "super_admin";
        const assigningSuper = patch.role === "super_admin";
        // Only a Super Admin may assign the Super Admin role or edit a Super Admin user.
        if ((assigningSuper || (targetIsSuper && (roleChanged || patch.status !== undefined))) && !actorIsSuper) {
          throw new Error("Only a Super Admin can manage Super Admin users");
        }
        // The system must always retain at least one active Super Admin.
        const isActiveSuper = (x: typeof u) => x.role === "super_admin" && x.status === "active" && x.approved !== false;
        const demotingSuper = targetIsSuper && roleChanged && patch.role !== "super_admin";
        const disablingSuper = targetIsSuper && patch.status === "inactive";
        if ((demotingSuper || disablingSuper) && db.users.filter(isActiveSuper).length <= 1) {
          throw new Error("This action cannot be completed because the system must retain at least one active Super Admin.");
        }
        // §14/§16 at most 5 active Super Admins — blocks a 6th via promotion OR
        // reactivation. Owner emails are exempt so an owner is never locked out.
        const willBeSuper = (patch.role ?? u.role) === "super_admin";
        const willBeActive = (patch.status ?? u.status) === "active" && (patch.approved ?? u.approved) !== false;
        const becomingActiveSuper = willBeSuper && willBeActive && !isActiveSuperAdmin(u);
        if (
          becomingActiveSuper &&
          !isOwnerEmail(u.email) &&
          db.users.filter((x) => x.id !== id && isActiveSuperAdmin(x)).length >= MAX_SUPER_ADMINS
        ) {
          throw new Error(MAX_SUPER_MSG);
        }
        if (patch.name !== undefined) u.name = patch.name;
        if (patch.email !== undefined) u.email = patch.email;
        if (patch.role !== undefined) u.role = patch.role;
        if (patch.status !== undefined) u.status = patch.status;
        if (patch.assigned_brand !== undefined) u.assigned_brand = patch.assigned_brand;
        if (patch.assigned_outlet !== undefined) u.assigned_outlet = patch.assigned_outlet;
        if (patch.brand_scope !== undefined) u.brand_scope = patch.brand_scope;
        if (patch.selected_brand_ids !== undefined) u.selected_brand_ids = patch.selected_brand_ids;
        if (patch.outlet_scope !== undefined) u.outlet_scope = patch.outlet_scope;
        if (patch.selected_outlet_ids !== undefined) u.selected_outlet_ids = patch.selected_outlet_ids;
        if (patch.password) u.password = patch.password;
        if (patch.phone !== undefined) u.phone = patch.phone;
        if (patch.avatar_url !== undefined) u.avatar_url = patch.avatar_url;
        if (patch.last_login !== undefined) u.last_login = patch.last_login;
        if (patch.accessible_brands !== undefined) u.accessible_brands = patch.accessible_brands;
        if (patch.show_cost !== undefined) u.show_cost = patch.show_cost;
        if (patch.dashboard_access !== undefined) u.dashboard_access = patch.dashboard_access;
        // Only a Super Admin may grant/revoke Data Import & Wastage access.
        if (patch.can_import !== undefined && actorIsSuper) u.can_import = patch.can_import;
        if (patch.can_manage_wastage !== undefined && actorIsSuper) u.can_manage_wastage = patch.can_manage_wastage;
        if (patch.approved !== undefined) u.approved = patch.approved;
        if (roleChanged) {
          u.last_role_update = nowISO();
          u.role_updated_by = actorId;
        }
        u.updated_at = nowISO();
        recordAudit(db, {
          entity_type: "user",
          entity_id: u.id,
          action: "update",
          old_values: before,
          new_values: { name: u.name, email: u.email, role: u.role, status: u.status },
          performed_by: actorId,
          notes: roleChanged ? `Role changed ${before.role} → ${u.role}` : undefined,
        });
        return publicUser(u);
      }),
    );
  },

  /**
   * Permanently delete a user. Mirrors the server-side guards enforced by the
   * delete-user Edge Function: no self-delete, only a Super Admin deletes a Super
   * Admin, and never drop below one active Admin or one active Super Admin.
   */
  async remove(id: string, actorId: string): Promise<void> {
    return delay(
      mutate((db) => {
        const u = db.users.find((x) => x.id === id);
        if (!u) throw new Error("User not found");
        if (id === actorId) throw new Error("You cannot delete your own account");
        const actor = db.users.find((x) => x.id === actorId);
        if (u.role === "super_admin" && actor?.role !== "super_admin") {
          throw new Error("Only a Super Admin can delete a Super Admin user");
        }
        const isActiveAdmin = (x: User) => x.role === "admin" && x.status === "active" && x.approved !== false;
        if (u.role === "admin" && u.status === "active" && db.users.filter(isActiveAdmin).length <= 1) {
          throw new Error("Cannot delete the last remaining Admin");
        }
        if (isActiveSuperAdmin(u) && db.users.filter(isActiveSuperAdmin).length <= 1) {
          throw new Error("This action cannot be completed because the system must retain at least one active Super Admin.");
        }
        db.users = db.users.filter((x) => x.id !== id);
        recordAudit(db, {
          entity_type: "user",
          entity_id: id,
          action: "delete",
          old_values: { name: u.name, email: u.email, role: u.role },
          performed_by: actorId,
          notes: `Deleted user ${u.email}`,
        });
      }),
    );
  },
};

/** Mock auth — validates credentials and account status (PRD Module 1). */
export async function authenticate(email: string, password: string): Promise<User> {
  const db = getDb();
  const u = db.users.find((x) => x.email.toLowerCase() === email.toLowerCase());
  // The seeded owner has NO password unless VITE_DEV_LOGIN_PASSWORD is set (no
  // credential ships in the repo). Point that out instead of failing opaquely —
  // and never let a blank/undefined stored password authenticate.
  if (u && !u.password) {
    throw new Error(
      "Local sign-in isn't configured. Set VITE_DEV_LOGIN_PASSWORD in .env.local and reload, or configure Supabase auth.",
    );
  }
  if (!u || u.password !== password) {
    throw new Error("Invalid email or password");
  }
  if (u.status === "inactive") {
    throw new Error("Your account has been deactivated. Contact admin.");
  }
  return delay(publicUser(u));
}
