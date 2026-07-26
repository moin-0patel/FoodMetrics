// Supabase brand master data repo. Mirrors the mock brandsRepo. Uniqueness is
// enforced by DB constraints (23505 → friendly message); RLS restricts writes to
// Super Admins (db/migrations/0012_brands_outlets.sql).

import type { BrandOutletStatus, BrandRecord } from "../types";
import { audit, fail, sb } from "./helpers";
import { nowISO } from "../mock/db";
import type { BrandInput } from "../mock/brands";

const norm = (s: string) => s.toLowerCase().replace(/\s+/g, " ").trim();
const codeNorm = (s: string) => s.toUpperCase().replace(/\s+/g, "").trim();

export const supabaseBrandsRepo = {
  async list(): Promise<BrandRecord[]> {
    const { data, error } = await sb().from("brands").select("*").order("name");
    if (error) fail("Load brands", error.message);
    return (data ?? []) as BrandRecord[];
  },

  async getById(id: string): Promise<BrandRecord | null> {
    const { data, error } = await sb().from("brands").select("*").eq("id", id).maybeSingle();
    if (error) fail("Load brand", error.message);
    return (data as BrandRecord | null) ?? null;
  },

  async create(input: BrandInput, actorId: string): Promise<BrandRecord> {
    const name = input.name.trim();
    const { data, error } = await sb()
      .from("brands")
      .insert({
        name,
        normalized_name: norm(name),
        brand_code: codeNorm(input.brand_code || name.slice(0, 4)),
        display_name: (input.display_name || name).trim(),
        accent_color: input.accent_color ?? null,
        logo_url: input.logo_url ?? null,
        status: input.status ?? "active",
        notes: input.notes ?? null,
        created_by: actorId,
        updated_by: actorId,
      })
      .select("*")
      .single();
    if (error) {
      if (error.code === "23505") fail("Create brand", "A brand with this name or code already exists");
      fail("Create brand", error.message);
    }
    const brand = data as BrandRecord;
    await audit({
      entity_type: "brand",
      entity_id: brand.id,
      action: "create",
      new_values: { name: brand.name, code: brand.brand_code },
      performed_by: actorId,
      notes: `Created brand "${brand.name}"`,
    });
    return brand;
  },

  async update(id: string, input: BrandInput, actorId: string): Promise<BrandRecord> {
    const name = input.name.trim();
    const patch: Record<string, unknown> = {
      name,
      normalized_name: norm(name),
      brand_code: codeNorm(input.brand_code || name.slice(0, 4)),
      display_name: (input.display_name || name).trim(),
      accent_color: input.accent_color ?? null,
      logo_url: input.logo_url ?? null,
      notes: input.notes ?? null,
      updated_by: actorId,
      updated_at: nowISO(),
    };
    if (input.status) patch.status = input.status;
    const { data, error } = await sb().from("brands").update(patch).eq("id", id).select("*").single();
    if (error) {
      if (error.code === "23505") fail("Update brand", "A brand with this name or code already exists");
      fail("Update brand", error.message);
    }
    const brand = data as BrandRecord;
    await audit({
      entity_type: "brand",
      entity_id: brand.id,
      action: "update",
      new_values: { name: brand.name, code: brand.brand_code, status: brand.status },
      performed_by: actorId,
      notes: `Updated brand "${brand.name}"`,
    });
    return brand;
  },

  async setStatus(id: string, status: BrandOutletStatus, actorId: string): Promise<BrandRecord> {
    const { data, error } = await sb()
      .from("brands")
      .update({ status, updated_by: actorId, updated_at: nowISO() })
      .eq("id", id)
      .select("*")
      .single();
    if (error) fail("Update brand status", error.message);
    const brand = data as BrandRecord;
    const verb = status === "archived" ? "Archived" : status === "inactive" ? "Deactivated" : "Activated";
    await audit({
      entity_type: "brand",
      entity_id: brand.id,
      action: "update",
      new_values: { status },
      performed_by: actorId,
      notes: `${verb} brand "${brand.name}"`,
    });
    return brand;
  },

  async remove(id: string, actorId: string): Promise<void> {
    const existing = await supabaseBrandsRepo.getById(id);
    const { error } = await sb().from("brands").delete().eq("id", id);
    if (error) {
      if (error.code === "23503") {
        fail("Delete brand", "Cannot delete a brand that still has outlets or recipes. Archive it instead.");
      }
      fail("Delete brand", error.message);
    }
    await audit({
      entity_type: "brand",
      entity_id: id,
      action: "delete",
      performed_by: actorId,
      notes: existing ? `Deleted brand "${existing.name}"` : "Deleted brand",
    });
  },
};
