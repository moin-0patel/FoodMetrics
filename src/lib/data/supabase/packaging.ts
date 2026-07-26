// Supabase packaging master repo. Mirrors the mock packagingRepo. Uniqueness is
// enforced by a DB unique index on normalized_name (23505 → friendly message);
// RLS restricts writes to admins (db/migrations/0025_packaging.sql).

import type { MaterialStatus, PackagingItem } from "../types";
import { audit, fail, sb } from "./helpers";
import { nowISO } from "../mock/db";
import type { PackagingInput } from "../mock/packaging";

const norm = (s: string) => s.toLowerCase().replace(/\s+/g, " ").trim();

export const supabasePackagingRepo = {
  async list(): Promise<PackagingItem[]> {
    const { data, error } = await sb().from("packaging_items").select("*").order("name");
    if (error) fail("Load packaging", error.message);
    return (data ?? []) as PackagingItem[];
  },

  async getById(id: string): Promise<PackagingItem | null> {
    const { data, error } = await sb().from("packaging_items").select("*").eq("id", id).maybeSingle();
    if (error) fail("Load packaging item", error.message);
    return (data as PackagingItem | null) ?? null;
  },

  async create(input: PackagingInput, actorId: string): Promise<PackagingItem> {
    const name = input.name.trim();
    const { data, error } = await sb()
      .from("packaging_items")
      .insert({
        name,
        normalized_name: norm(name),
        packaging_type: input.packaging_type || "primary",
        unit: input.unit || "Piece",
        unit_price: input.unit_price ?? null,
        status: input.status ?? "active",
        notes: input.notes ?? null,
        created_by: actorId,
        updated_by: actorId,
      })
      .select("*")
      .single();
    if (error) {
      if (error.code === "23505") fail("Create packaging", "A packaging item with this name already exists");
      fail("Create packaging", error.message);
    }
    const item = data as PackagingItem;
    await audit({
      entity_type: "packaging",
      entity_id: item.id,
      action: "create",
      new_values: { name: item.name, type: item.packaging_type, unit_price: item.unit_price },
      performed_by: actorId,
      notes: `Created packaging "${item.name}"`,
    });
    return item;
  },

  async update(id: string, input: PackagingInput, actorId: string): Promise<PackagingItem> {
    const name = input.name.trim();
    const patch: Record<string, unknown> = {
      name,
      normalized_name: norm(name),
      packaging_type: input.packaging_type || "primary",
      unit: input.unit || "Piece",
      unit_price: input.unit_price ?? null,
      notes: input.notes ?? null,
      updated_by: actorId,
      updated_at: nowISO(),
    };
    if (input.status) patch.status = input.status;
    const { data, error } = await sb().from("packaging_items").update(patch).eq("id", id).select("*").single();
    if (error) {
      if (error.code === "23505") fail("Update packaging", "A packaging item with this name already exists");
      fail("Update packaging", error.message);
    }
    const item = data as PackagingItem;
    await audit({
      entity_type: "packaging",
      entity_id: item.id,
      action: "update",
      new_values: { name: item.name, unit_price: item.unit_price, type: item.packaging_type },
      performed_by: actorId,
      notes: `Updated packaging "${item.name}"`,
    });
    return item;
  },

  async setStatus(id: string, status: MaterialStatus, actorId: string): Promise<PackagingItem> {
    const { data, error } = await sb()
      .from("packaging_items")
      .update({ status, updated_by: actorId, updated_at: nowISO() })
      .eq("id", id)
      .select("*")
      .single();
    if (error) fail("Update packaging status", error.message);
    const item = data as PackagingItem;
    await audit({
      entity_type: "packaging",
      entity_id: item.id,
      action: "update",
      new_values: { status },
      performed_by: actorId,
      notes: `${status === "active" ? "Activated" : "Deactivated"} packaging "${item.name}"`,
    });
    return item;
  },

  async remove(id: string, actorId: string): Promise<void> {
    const existing = await supabasePackagingRepo.getById(id);
    const { error } = await sb().from("packaging_items").delete().eq("id", id);
    if (error) {
      if (error.code === "23503") {
        fail("Delete packaging", "Cannot delete a packaging item used by a recipe. Deactivate it instead.");
      }
      fail("Delete packaging", error.message);
    }
    await audit({
      entity_type: "packaging",
      entity_id: id,
      action: "delete",
      performed_by: actorId,
      notes: existing ? `Deleted packaging "${existing.name}"` : "Deleted packaging",
    });
  },
};
