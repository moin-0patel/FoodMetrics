// Supabase-backed users repository (Supabase Auth). Mirrors the mock `usersRepo`
// interface so feature code is unchanged — selection happens in src/lib/data/index.ts
// by whether Supabase is configured. Backed by the `public.user_profiles` table
// (db/migrations/0007); access is enforced by RLS keyed on the Supabase auth uid.

import { supabase } from "@/lib/supabase/client";
import { profileToUser, type ProfileRow } from "@/lib/supabase/types";
import type { User } from "../types";
import type { CreateUserInput, UpdateUserInput } from "../mock/users";

function fail(context: string, message?: string): never {
  throw new Error(message || `${context} failed`);
}

function client() {
  if (!supabase) fail("Supabase is not configured");
  return supabase;
}

export const supabaseUsersRepo = {
  async list(): Promise<User[]> {
    const { data, error } = await client()
      .from("user_profiles")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) fail("Load users", error.message);
    return (data as ProfileRow[]).map(profileToUser);
  },

  async getById(id: string): Promise<User | null> {
    const { data, error } = await client()
      .from("user_profiles")
      .select("*")
      .eq("id", id)
      .maybeSingle<ProfileRow>();
    if (error) fail("Load user", error.message);
    return data ? profileToUser(data) : null;
  },

  // With Supabase Auth, a profile row is created by the on-signup trigger keyed to
  // an auth.users id — the client can't mint an auth user for someone else. So an
  // admin invites a user (they self-register) and then assigns role/scope via update.
  async create(_input: CreateUserInput, _actorId: string): Promise<User> {
    fail(
      "Create user",
      "In Supabase mode, users self-register (Create account) and an admin then approves and assigns their role. Direct creation requires a server-side invite.",
    );
  },

  async update(id: string, patch: UpdateUserInput, actorId: string): Promise<User> {
    if (patch.password) {
      fail("Update user", "Passwords are managed by Supabase — use “Send Password Reset”.");
    }
    const row: Record<string, unknown> = {};
    if (patch.name !== undefined) row.name = patch.name;
    if (patch.email !== undefined) row.email = patch.email;
    if (patch.role !== undefined) {
      row.role = patch.role;
      row.role_updated_by = actorId; // last_role_update is stamped by the DB trigger
    }
    if (patch.status !== undefined) row.status = patch.status;
    if (patch.assigned_brand !== undefined) row.assigned_brand = patch.assigned_brand;
    if (patch.assigned_outlet !== undefined) row.assigned_outlet = patch.assigned_outlet;
    if (patch.brand_scope !== undefined) row.brand_scope = patch.brand_scope;
    if (patch.selected_brand_ids !== undefined) row.selected_brand_ids = patch.selected_brand_ids;
    if (patch.outlet_scope !== undefined) row.outlet_scope = patch.outlet_scope;
    if (patch.selected_outlet_ids !== undefined) row.selected_outlet_ids = patch.selected_outlet_ids;
    if (patch.phone !== undefined) row.phone = patch.phone;
    if (patch.avatar_url !== undefined) row.avatar_url = patch.avatar_url;
    if (patch.last_login !== undefined) row.last_login = patch.last_login;
    if (patch.accessible_brands !== undefined) row.accessible_brands = patch.accessible_brands;
    if (patch.show_cost !== undefined) row.show_cost = patch.show_cost;
    if (patch.dashboard_access !== undefined) row.dashboard_access = patch.dashboard_access;
    if (patch.approved !== undefined) row.approved = patch.approved;

    const { data, error } = await client()
      .from("user_profiles")
      .update(row)
      .eq("id", id)
      .select("*")
      .single<ProfileRow>();
    if (error) fail("Update user", error.message);
    let profile = data as ProfileRow;

    // Data-Import grant is applied as a separate, best-effort update so the main
    // save never breaks if the can_import column hasn't been migrated yet
    // (db/migrations/0030). Once migrated, it persists normally.
    if (patch.can_import !== undefined) {
      const r = await client()
        .from("user_profiles")
        .update({ can_import: patch.can_import })
        .eq("id", id)
        .select("*")
        .single<ProfileRow>();
      if (!r.error && r.data) profile = r.data;
    }
    // Wastage-access grant — same best-effort pattern (db/migrations/0032).
    if (patch.can_manage_wastage !== undefined) {
      const r = await client()
        .from("user_profiles")
        .update({ can_manage_wastage: patch.can_manage_wastage })
        .eq("id", id)
        .select("*")
        .single<ProfileRow>();
      if (!r.error && r.data) profile = r.data;
    }
    return profileToUser(profile);
  },

  /**
   * Permanently delete a user via the delete-user Edge Function (service role) —
   * the browser can't remove a Supabase auth account itself. Guards (self-delete,
   * super-admin, last admin/super) are enforced server-side in the function.
   */
  async remove(id: string, _actorId: string): Promise<void> {
    const { data, error } = await client().functions.invoke("delete-user", {
      body: { userId: id },
    });
    if (error) {
      let msg = error.message || "Delete user failed";
      // A FunctionsHttpError (e.g. the 401/403 auth guards) carries the Response;
      // read its JSON body so the user sees the real reason, not a generic status.
      const ctx = (error as { context?: Response }).context;
      if (ctx && typeof ctx.json === "function") {
        try {
          const body = (await ctx.json()) as { error?: string };
          if (body?.error) msg = body.error;
        } catch {
          // body wasn't JSON — keep the original message
        }
      }
      // Most common cause: the Edge Function hasn't been deployed yet.
      if (/failed to send a request|function not found|not found|failed to fetch/i.test(msg)) {
        msg =
          "User deletion isn't available yet — the delete-user Edge Function must be deployed " +
          "(run: supabase functions deploy delete-user).";
      }
      fail("Delete user", msg);
    }
    const res = data as { ok?: boolean; error?: string } | null;
    if (!res?.ok) fail("Delete user", res?.error || "Delete user failed");
  },
};
