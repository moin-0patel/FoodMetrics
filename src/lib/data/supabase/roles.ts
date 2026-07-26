// Supabase role master data repo. Mirrors the mock rolesRepo. Roles live in
// public.roles with their granted capabilities in public.role_capabilities
// (db/migrations/0016_roles.sql). RLS restricts writes to Super Admins and a
// trigger protects the built-in roles; uniqueness/assignment are enforced by the
// DB (23505 → duplicate, 23503 → still assigned to a user).

import type { RoleRecord } from "../types";
import { GRANTABLE_CAPABILITIES } from "@/lib/auth/permissions";
import { audit, fail, sb } from "./helpers";
import { nowISO } from "../mock/db";
import type { RoleInput } from "../mock/roles";

// NOTE: create/update go through the upsert_role RPC (db/migrations/0016) so the
// roles row + its capabilities are written in ONE transaction — a role is never
// left capability-less by a partial failure (unlike a delete-then-insert pair).

interface RoleRow {
  key: string;
  label: string;
  description: string | null;
  is_system: boolean;
  protected: boolean;
  sort_order: number;
  created_by: string | null;
  created_at: string;
  updated_by: string | null;
  updated_at: string;
}

const GRANTABLE = new Set<string>(GRANTABLE_CAPABILITIES);
const sanitizeCaps = (caps: string[]): string[] =>
  [...new Set(caps)].filter((c) => GRANTABLE.has(c));
const slugKey = (label: string) =>
  label.toLowerCase().trim().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");

/** Join roles + role_capabilities into RoleRecord[]. */
async function loadRoles(): Promise<RoleRecord[]> {
  const [rolesRes, capsRes] = await Promise.all([
    sb().from("roles").select("*").order("sort_order"),
    sb().from("role_capabilities").select("role_key, capability"),
  ]);
  if (rolesRes.error) fail("Load roles", rolesRes.error.message);
  if (capsRes.error) fail("Load role capabilities", capsRes.error.message);
  const byRole = new Map<string, string[]>();
  for (const c of (capsRes.data ?? []) as { role_key: string; capability: string }[]) {
    const arr = byRole.get(c.role_key) ?? [];
    arr.push(c.capability);
    byRole.set(c.role_key, arr);
  }
  return ((rolesRes.data ?? []) as RoleRow[]).map((r) => ({
    ...r,
    capabilities: byRole.get(r.key) ?? [],
  }));
}

export const supabaseRolesRepo = {
  async list(): Promise<RoleRecord[]> {
    return loadRoles();
  },

  async getByKey(key: string): Promise<RoleRecord | null> {
    const { data, error } = await sb().from("roles").select("*").eq("key", key).maybeSingle();
    if (error) fail("Load role", error.message);
    if (!data) return null;
    const caps = await sb().from("role_capabilities").select("capability").eq("role_key", key);
    if (caps.error) fail("Load role", caps.error.message);
    return {
      ...(data as RoleRow),
      capabilities: (caps.data ?? []).map((c) => (c as { capability: string }).capability),
    };
  },

  async create(input: RoleInput, actorId: string): Promise<RoleRecord> {
    const label = input.label.trim();
    if (!label) fail("Create role", "Role name is required");
    const key = input.key?.trim() || slugKey(label);
    if (!key) fail("Create role", "Role name must contain letters or numbers");
    const caps = sanitizeCaps(input.capabilities);
    const description = input.description?.trim() || null;
    const { error } = await sb().rpc("upsert_role", {
      p_key: key,
      p_label: label,
      p_description: description,
      p_caps: caps,
      p_is_create: true,
    });
    if (error) {
      if (error.code === "23505") fail("Create role", "A role with this name already exists");
      fail("Create role", error.message);
    }
    await audit({
      entity_type: "role",
      entity_id: key,
      action: "create",
      new_values: { label, capabilities: caps },
      performed_by: actorId,
      notes: `Created role "${label}"`,
    });
    const now = nowISO();
    // Transient return — the mutation hook invalidates ["roles"] and the list
    // query refetches the authoritative row + capabilities immediately after.
    return {
      key, label, description, is_system: false, protected: false, sort_order: input.sort_order ?? 100,
      capabilities: caps, created_by: actorId, created_at: now, updated_by: actorId, updated_at: now,
    };
  },

  async update(key: string, input: RoleInput, actorId: string): Promise<RoleRecord> {
    const label = input.label.trim();
    if (!label) fail("Update role", "Role name is required");
    const caps = sanitizeCaps(input.capabilities);
    const description = input.description?.trim() || null;
    const { error } = await sb().rpc("upsert_role", {
      p_key: key,
      p_label: label,
      p_description: description,
      p_caps: caps,
      p_is_create: false,
    });
    if (error) {
      if ((error.message ?? "").toLowerCase().includes("built-in")) {
        fail("Update role", "Built-in roles can't be edited");
      }
      fail("Update role", error.message);
    }
    await audit({
      entity_type: "role",
      entity_id: key,
      action: "update",
      new_values: { label, capabilities: caps },
      performed_by: actorId,
      notes: `Updated role "${label}"`,
    });
    const now = nowISO();
    return {
      key, label, description, is_system: false, protected: false, sort_order: input.sort_order ?? 100,
      capabilities: caps, created_by: actorId, created_at: now, updated_by: actorId, updated_at: now,
    };
  },

  async remove(key: string, actorId: string): Promise<void> {
    const existing = await supabaseRolesRepo.getByKey(key);
    const { error } = await sb().from("roles").delete().eq("key", key);
    if (error) {
      if (error.code === "23503") {
        fail("Delete role", "Cannot delete a role that is still assigned to users. Reassign them first.");
      }
      fail("Delete role", error.message);
    }
    await audit({
      entity_type: "role",
      entity_id: key,
      action: "delete",
      performed_by: actorId,
      notes: existing ? `Deleted role "${existing.label}"` : "Deleted role",
    });
  },
};
