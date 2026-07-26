// Dynamic role master data (Super-Admin managed). Mirrors the Supabase
// public.roles + public.role_capabilities tables. The six built-in roles are
// seeded as `is_system` and are read-only here; a Super Admin can create, edit
// and delete CUSTOM roles and pick their capabilities. Reserved capabilities
// (user/role/brand/outlet management) can't be granted to a custom role — the DB
// RLS keeps those to the built-in Admin/Super Admin, so granting them would be a
// no-op server-side (see permissions.ts RESERVED_CAPABILITIES).

import type { RoleRecord } from "../types";
import { GRANTABLE_CAPABILITIES } from "@/lib/auth/permissions";
import { delay, getDb, mutate, nowISO } from "./db";
import { recordAudit } from "./recompute";

export interface RoleInput {
  /** Immutable key. Ignored on update; auto-derived from the label on create. */
  key?: string;
  label: string;
  description?: string | null;
  capabilities: string[];
  sort_order?: number;
}

const GRANTABLE = new Set<string>(GRANTABLE_CAPABILITIES);
/** A custom role may only hold grantable (non-reserved, known) capabilities. */
const sanitizeCaps = (caps: string[]): string[] =>
  [...new Set(caps)].filter((c) => GRANTABLE.has(c));

/** Derive a stable snake_case key from a role label. */
const slugKey = (label: string) =>
  label.toLowerCase().trim().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");

export const rolesRepo = {
  async list(): Promise<RoleRecord[]> {
    return delay(
      [...getDb().roles].sort((a, b) => a.sort_order - b.sort_order || a.label.localeCompare(b.label)),
    );
  },

  async getByKey(key: string): Promise<RoleRecord | null> {
    return delay(getDb().roles.find((r) => r.key === key) ?? null);
  },

  async create(input: RoleInput, actorId: string): Promise<RoleRecord> {
    return delay(
      mutate((db) => {
        const label = input.label.trim();
        if (!label) throw new Error("Role name is required");
        const key = (input.key?.trim() || slugKey(label));
        if (!key) throw new Error("Role name must contain letters or numbers");
        if (db.roles.some((r) => r.key === key)) {
          throw new Error("A role with this name already exists");
        }
        const maxSort = db.roles.reduce((m, r) => Math.max(m, r.sort_order), 0);
        const role: RoleRecord = {
          key,
          label,
          description: input.description?.trim() || null,
          is_system: false,
          protected: false,
          sort_order: input.sort_order ?? maxSort + 10,
          capabilities: sanitizeCaps(input.capabilities),
          created_by: actorId,
          created_at: nowISO(),
          updated_by: actorId,
          updated_at: nowISO(),
        };
        db.roles.push(role);
        recordAudit(db, {
          entity_type: "role",
          entity_id: role.key,
          action: "create",
          new_values: { label: role.label, capabilities: role.capabilities },
          performed_by: actorId,
          notes: `Created role "${role.label}"`,
        });
        return role;
      }),
    );
  },

  async update(key: string, input: RoleInput, actorId: string): Promise<RoleRecord> {
    return delay(
      mutate((db) => {
        const role = db.roles.find((r) => r.key === key);
        if (!role) throw new Error("Role not found");
        if (role.is_system) throw new Error("Built-in roles can't be edited");
        const label = input.label.trim();
        if (!label) throw new Error("Role name is required");
        if (db.roles.some((r) => r.key !== key && r.label.toLowerCase() === label.toLowerCase())) {
          throw new Error("A role with this name already exists");
        }
        const before = { label: role.label, capabilities: [...role.capabilities] };
        role.label = label;
        role.description = input.description?.trim() || null;
        role.capabilities = sanitizeCaps(input.capabilities);
        if (input.sort_order !== undefined) role.sort_order = input.sort_order;
        role.updated_by = actorId;
        role.updated_at = nowISO();
        recordAudit(db, {
          entity_type: "role",
          entity_id: role.key,
          action: "update",
          old_values: before,
          new_values: { label: role.label, capabilities: role.capabilities },
          performed_by: actorId,
          notes: `Updated role "${role.label}"`,
        });
        return role;
      }),
    );
  },

  /** Delete a custom role — blocked for built-ins and for a role still assigned. */
  async remove(key: string, actorId: string): Promise<void> {
    return delay(
      mutate((db) => {
        const role = db.roles.find((r) => r.key === key);
        if (!role) throw new Error("Role not found");
        if (role.is_system) throw new Error("Built-in roles can't be deleted");
        if (db.users.some((u) => u.role === key)) {
          throw new Error("Cannot delete a role that is still assigned to users. Reassign them first.");
        }
        db.roles = db.roles.filter((r) => r.key !== key);
        recordAudit(db, {
          entity_type: "role",
          entity_id: key,
          action: "delete",
          performed_by: actorId,
          notes: `Deleted role "${role.label}"`,
        });
      }),
    );
  },
};
