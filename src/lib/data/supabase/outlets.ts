// Supabase outlet master data repo. Mirrors the mock outletsRepo. Writes both the
// new brand_id column and the legacy `brand` column (kept for back-compat) so any
// older reader keeps working. RLS restricts writes to Super Admins (0012).

import type { BrandOutletStatus, OutletRecord } from "../types";
import { audit, fail, sb } from "./helpers";
import { nowISO } from "../mock/db";
import type { OutletInput } from "../mock/outlets";

const norm = (s: string) => s.toLowerCase().replace(/\s+/g, " ").trim();
const codeNorm = (s: string) => s.toUpperCase().replace(/\s+/g, "").trim();

export const supabaseOutletsRepo = {
  async list(): Promise<OutletRecord[]> {
    const { data, error } = await sb().from("outlets").select("*").order("name");
    if (error) fail("Load outlets", error.message);
    return (data ?? []) as OutletRecord[];
  },

  async getById(id: string): Promise<OutletRecord | null> {
    const { data, error } = await sb().from("outlets").select("*").eq("id", id).maybeSingle();
    if (error) fail("Load outlet", error.message);
    return (data as OutletRecord | null) ?? null;
  },

  async listByBrand(brandId: string): Promise<OutletRecord[]> {
    const { data, error } = await sb().from("outlets").select("*").eq("brand_id", brandId).order("name");
    if (error) fail("Load outlets", error.message);
    return (data ?? []) as OutletRecord[];
  },

  async create(input: OutletInput, actorId: string): Promise<OutletRecord> {
    const name = input.name.trim();
    const { data, error } = await sb()
      .from("outlets")
      .insert({
        brand: input.brand_id,
        brand_id: input.brand_id,
        name,
        normalized_name: norm(name),
        outlet_code: codeNorm(input.outlet_code || name),
        city: input.city ?? null,
        state: input.state ?? null,
        address: input.address ?? null,
        phone: input.phone ?? null,
        email: input.email ?? null,
        opening_date: input.opening_date || null,
        timezone: input.timezone || "Asia/Kolkata",
        status: input.status ?? "active",
        manager_user_id: input.manager_user_id ?? null,
        notes: input.notes ?? null,
        created_by: actorId,
        updated_by: actorId,
      })
      .select("*")
      .single();
    if (error) {
      if (error.code === "23505") fail("Create outlet", "An outlet with this name or code already exists");
      if (error.code === "23503") fail("Create outlet", "Select a valid brand for this outlet");
      fail("Create outlet", error.message);
    }
    const outlet = data as OutletRecord;
    await audit({
      entity_type: "outlet",
      entity_id: outlet.id,
      action: "create",
      new_values: { name: outlet.name, brand_id: outlet.brand_id, code: outlet.outlet_code },
      performed_by: actorId,
      notes: `Created outlet "${outlet.name}"`,
    });
    return outlet;
  },

  async update(id: string, input: OutletInput, actorId: string): Promise<OutletRecord> {
    const name = input.name.trim();
    const patch: Record<string, unknown> = {
      brand: input.brand_id,
      brand_id: input.brand_id,
      name,
      normalized_name: norm(name),
      outlet_code: codeNorm(input.outlet_code || name),
      city: input.city ?? null,
      state: input.state ?? null,
      address: input.address ?? null,
      phone: input.phone ?? null,
      email: input.email ?? null,
      opening_date: input.opening_date || null,
      timezone: input.timezone || "Asia/Kolkata",
      manager_user_id: input.manager_user_id ?? null,
      notes: input.notes ?? null,
      updated_by: actorId,
      updated_at: nowISO(),
    };
    if (input.status) patch.status = input.status;
    const { data, error } = await sb().from("outlets").update(patch).eq("id", id).select("*").single();
    if (error) {
      if (error.code === "23505") fail("Update outlet", "An outlet with this name or code already exists");
      if (error.code === "23503") fail("Update outlet", "Select a valid brand for this outlet");
      fail("Update outlet", error.message);
    }
    const outlet = data as OutletRecord;
    await audit({
      entity_type: "outlet",
      entity_id: outlet.id,
      action: "update",
      new_values: { name: outlet.name, brand_id: outlet.brand_id, status: outlet.status },
      performed_by: actorId,
      notes: `Updated outlet "${outlet.name}"`,
    });
    return outlet;
  },

  async setStatus(id: string, status: BrandOutletStatus, actorId: string): Promise<OutletRecord> {
    const { data, error } = await sb()
      .from("outlets")
      .update({ status, updated_by: actorId, updated_at: nowISO() })
      .eq("id", id)
      .select("*")
      .single();
    if (error) fail("Update outlet status", error.message);
    const outlet = data as OutletRecord;
    const verb = status === "archived" ? "Archived" : status === "inactive" ? "Deactivated" : "Activated";
    await audit({
      entity_type: "outlet",
      entity_id: outlet.id,
      action: "update",
      new_values: { status },
      performed_by: actorId,
      notes: `${verb} outlet "${outlet.name}"`,
    });
    return outlet;
  },

  async remove(id: string, actorId: string): Promise<void> {
    const existing = await supabaseOutletsRepo.getById(id);
    const { error } = await sb().from("outlets").delete().eq("id", id);
    if (error) {
      if (error.code === "23503") {
        fail("Delete outlet", "Cannot delete an outlet with wastage records. Archive it instead.");
      }
      fail("Delete outlet", error.message);
    }
    await audit({
      entity_type: "outlet",
      entity_id: id,
      action: "delete",
      performed_by: actorId,
      notes: existing ? `Deleted outlet "${existing.name}"` : "Deleted outlet",
    });
  },
};
