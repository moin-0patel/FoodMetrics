// Packaging master data (Primary/Secondary/Tertiary cost items). Mirrors the
// Supabase public.packaging_items table. Items are deactivated, never hard-deleted,
// while any recipe still references them (§10) — matching materials/brands.

import type { MaterialStatus, PackagingItem } from "../types";
import { delay, getDb, mutate, nowISO, uid } from "./db";
import { recomputeAndPropagate, recordAudit } from "./recompute";

export interface PackagingInput {
  name: string;
  packaging_type: string;
  unit: string;
  unit_price: number | null;
  status?: MaterialStatus;
  notes?: string | null;
}

const norm = (s: string) => s.toLowerCase().replace(/\s+/g, " ").trim();

export const packagingRepo = {
  async list(): Promise<PackagingItem[]> {
    return delay([...getDb().packaging_items].sort((a, b) => a.name.localeCompare(b.name)));
  },

  async getById(id: string): Promise<PackagingItem | null> {
    return delay(getDb().packaging_items.find((p) => p.id === id) ?? null);
  },

  async create(input: PackagingInput, actorId: string): Promise<PackagingItem> {
    return delay(
      mutate((db) => {
        const nn = norm(input.name);
        if (!nn) throw new Error("Packaging name is required");
        if (db.packaging_items.some((p) => p.normalized_name === nn)) {
          throw new Error("A packaging item with this name already exists");
        }
        const item: PackagingItem = {
          id: uid(),
          name: input.name.trim(),
          normalized_name: nn,
          packaging_type: input.packaging_type || "primary",
          unit: input.unit || "Piece",
          unit_price: input.unit_price ?? null,
          status: input.status ?? "active",
          notes: input.notes ?? null,
          created_by: actorId,
          created_at: nowISO(),
          updated_by: actorId,
          updated_at: nowISO(),
        };
        db.packaging_items.push(item);
        recordAudit(db, {
          entity_type: "packaging",
          entity_id: item.id,
          action: "create",
          new_values: { name: item.name, type: item.packaging_type, unit_price: item.unit_price },
          performed_by: actorId,
          notes: `Created packaging "${item.name}"`,
        });
        return item;
      }),
    );
  },

  async update(id: string, input: PackagingInput, actorId: string): Promise<PackagingItem> {
    return delay(
      mutate((db) => {
        const item = db.packaging_items.find((p) => p.id === id);
        if (!item) throw new Error("Packaging item not found");
        const nn = norm(input.name);
        if (!nn) throw new Error("Packaging name is required");
        if (db.packaging_items.some((p) => p.id !== id && p.normalized_name === nn)) {
          throw new Error("A packaging item with this name already exists");
        }
        const before = { name: item.name, unit_price: item.unit_price, type: item.packaging_type };
        const priceChanged = (input.unit_price ?? null) !== item.unit_price;
        item.name = input.name.trim();
        item.normalized_name = nn;
        item.packaging_type = input.packaging_type || item.packaging_type;
        item.unit = input.unit || item.unit;
        item.unit_price = input.unit_price ?? null;
        if (input.status) item.status = input.status;
        item.notes = input.notes ?? null;
        item.updated_by = actorId;
        item.updated_at = nowISO();
        recordAudit(db, {
          entity_type: "packaging",
          entity_id: item.id,
          action: "update",
          old_values: before,
          new_values: { name: item.name, unit_price: item.unit_price, type: item.packaging_type },
          performed_by: actorId,
          notes: `Updated packaging "${item.name}"`,
        });
        // Cascade: a price change recomputes every recipe that uses this packaging.
        if (priceChanged) {
          const affected = [...new Set(db.recipe_packaging.filter((rp) => rp.packaging_item_id === id).map((rp) => rp.recipe_id))];
          if (affected.length) recomputeAndPropagate(db, affected, actorId, `Packaging "${item.name}" price changed`);
        }
        return item;
      }),
    );
  },

  async setStatus(id: string, status: MaterialStatus, actorId: string): Promise<PackagingItem> {
    return delay(
      mutate((db) => {
        const item = db.packaging_items.find((p) => p.id === id);
        if (!item) throw new Error("Packaging item not found");
        const before = item.status;
        item.status = status;
        item.updated_by = actorId;
        item.updated_at = nowISO();
        recordAudit(db, {
          entity_type: "packaging",
          entity_id: item.id,
          action: "update",
          old_values: { status: before },
          new_values: { status },
          performed_by: actorId,
          notes: `${status === "active" ? "Activated" : "Deactivated"} packaging "${item.name}"`,
        });
        return item;
      }),
    );
  },

  /** Hard delete — blocked while any recipe packaging line still references it. */
  async remove(id: string, actorId: string): Promise<void> {
    return delay(
      mutate((db) => {
        const item = db.packaging_items.find((p) => p.id === id);
        if (!item) throw new Error("Packaging item not found");
        if (db.recipe_packaging.some((rp) => rp.packaging_item_id === id)) {
          throw new Error("Cannot delete a packaging item used by a recipe. Deactivate it instead.");
        }
        db.packaging_items = db.packaging_items.filter((p) => p.id !== id);
        recordAudit(db, {
          entity_type: "packaging",
          entity_id: id,
          action: "delete",
          performed_by: actorId,
          notes: `Deleted packaging "${item.name}"`,
        });
      }),
    );
  },
};
