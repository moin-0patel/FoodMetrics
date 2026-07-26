// Supabase-backed settings + audit repos, so both are SHARED across users (not
// per-browser) in Supabase mode. Reads are fail-safe (fall back to empty/null so
// the UI degrades to its defaults rather than breaking); writes surface real
// errors. Viewer-access (user_recipe_views) stays on the mock layer for now — its
// table FKs to a legacy `users` table and there are no Viewers yet.

import type { AuditEntityType, AuditLog, SystemSetting } from "../types";
import type { AuditFilter } from "../mock/misc";
import { sb, fail, audit as auditInsert } from "./helpers";

export const supabaseSettingsRepo = {
  async getAll(): Promise<SystemSetting[]> {
    const { data, error } = await sb().from("system_settings").select("*");
    if (error) return [];
    return (data ?? []) as SystemSetting[];
  },

  async get(key: string): Promise<string | null> {
    const { data, error } = await sb()
      .from("system_settings")
      .select("value")
      .eq("key", key)
      .maybeSingle();
    if (error) return null;
    return ((data?.value as string | undefined) ?? null) as string | null;
  },

  async foodCostPct(): Promise<number> {
    const { data, error } = await sb()
      .from("system_settings")
      .select("value")
      .eq("key", "food_cost_pct")
      .maybeSingle();
    const v = error ? null : ((data?.value as string | undefined) ?? null);
    return v ? Number(v) : 30;
  },

  async set(key: string, value: string, _actorId: string): Promise<void> {
    // updated_by left null to sidestep the legacy users(id) FK; RLS already gates
    // writes to admins/super-admins (settings_write policy).
    const { error } = await sb()
      .from("system_settings")
      .upsert({ key, value, updated_by: null, updated_at: new Date().toISOString() }, { onConflict: "key" });
    if (error) fail("Save setting", error.message);
  },
};

export const supabaseAuditRepo = {
  async list(filter: AuditFilter = {}): Promise<AuditLog[]> {
    let q = sb().from("audit_logs").select("*").order("performed_at", { ascending: false });
    if (filter.entityType && filter.entityType !== "all") q = q.eq("entity_type", filter.entityType);
    if (filter.userId && filter.userId !== "all") q = q.eq("performed_by", filter.userId);
    if (filter.from) q = q.gte("performed_at", filter.from);
    if (filter.to) q = q.lte("performed_at", filter.to + "T23:59:59.999Z");
    const { data, error } = await q;
    if (error) return [];
    return (data ?? []) as AuditLog[];
  },

  /** Direct audit writer (best-effort; the helper swallows errors so it never
   *  blocks the caller). Most audit rows are written by the data repos already. */
  async record(entry: {
    entity_type: AuditEntityType;
    entity_id: string;
    action: AuditLog["action"];
    performed_by: string | null;
    notes?: string;
  }): Promise<void> {
    await auditInsert({
      entity_type: entry.entity_type,
      entity_id: entry.entity_id,
      action: entry.action,
      performed_by: entry.performed_by,
      notes: entry.notes ?? null,
    });
  },
};
