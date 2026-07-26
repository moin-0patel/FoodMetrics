import { calculateCostPerBaseUnit } from "../../costing";
import type { IngredientPriceHistory, RawMaterial } from "../types";
import type { ImportSummary } from "../../import/importTypes";
import { delay, getDb, mutate, nowISO, todayISO, uid } from "./db";
import { cascadeFromMaterial, recordAudit } from "./recompute";

export interface MaterialInput {
  ingredient_name: string;
  category: string;
  notes?: string | null;
  purchase_price: number | null;
  purchase_quantity: number;
  purchase_unit: string;
  base_unit: string;
}

function computeCpu(input: {
  purchase_price: number | null;
  purchase_quantity: number;
  purchase_unit: string;
  base_unit: string;
}): number | null {
  if (input.purchase_price === null) return null;
  return calculateCostPerBaseUnit(
    input.purchase_price,
    input.purchase_quantity,
    input.purchase_unit,
    input.base_unit,
  );
}

export const materialsRepo = {
  async list(): Promise<RawMaterial[]> {
    return delay([...getDb().raw_materials]);
  },

  async getById(id: string): Promise<RawMaterial | null> {
    return delay(getDb().raw_materials.find((m) => m.id === id) ?? null);
  },

  async create(input: MaterialInput, actorId: string): Promise<RawMaterial> {
    return delay(
      mutate((db) => {
        if (
          db.raw_materials.some(
            (m) =>
              m.ingredient_name.toLowerCase() === input.ingredient_name.toLowerCase(),
          )
        ) {
          throw new Error("An ingredient with this name already exists");
        }
        const cpu = computeCpu(input);
        const material: RawMaterial = {
          id: uid(),
          ingredient_name: input.ingredient_name,
          category: input.category,
          notes: input.notes ?? null,
          purchase_price: input.purchase_price,
          purchase_quantity: input.purchase_quantity,
          purchase_unit: input.purchase_unit,
          base_unit: input.base_unit,
          cost_per_base_unit: cpu,
          last_price_update: input.purchase_price === null ? null : todayISO(),
          status: "active",
          created_by: actorId,
          created_at: nowISO(),
        };
        db.raw_materials.push(material);
        recordAudit(db, {
          entity_type: "ingredient",
          entity_id: material.id,
          action: "create",
          new_values: { name: material.ingredient_name, price: material.purchase_price },
          performed_by: actorId,
          notes: `Created ingredient ${material.ingredient_name}`,
        });
        return material;
      }),
    );
  },

  async update(id: string, input: MaterialInput, actorId: string): Promise<RawMaterial> {
    return delay(
      mutate((db) => {
        const m = db.raw_materials.find((x) => x.id === id);
        if (!m) throw new Error("Ingredient not found");
        if (
          db.raw_materials.some(
            (x) =>
              x.id !== id &&
              x.ingredient_name.toLowerCase() === input.ingredient_name.toLowerCase(),
          )
        ) {
          throw new Error("An ingredient with this name already exists");
        }

        const oldPrice = m.purchase_price;
        const oldCpu = m.cost_per_base_unit;

        m.ingredient_name = input.ingredient_name;
        m.category = input.category;
        m.notes = input.notes ?? null;
        m.purchase_price = input.purchase_price;
        m.purchase_quantity = input.purchase_quantity;
        m.purchase_unit = input.purchase_unit;
        m.base_unit = input.base_unit;
        const newCpu = computeCpu(input);
        m.cost_per_base_unit = newCpu;

        const priceChanged = oldPrice !== input.purchase_price || oldCpu !== newCpu;
        if (priceChanged) {
          m.last_price_update = input.purchase_price === null ? m.last_price_update : todayISO();
          db.ingredient_price_history.push({
            id: uid(),
            ingredient_id: m.id,
            old_price: oldPrice,
            new_price: input.purchase_price,
            old_cost_per_base_unit: oldCpu,
            new_cost_per_base_unit: newCpu,
            changed_by: actorId,
            changed_at: nowISO(),
          } satisfies IngredientPriceHistory);

          // Price cascade — PRD §4.5.
          cascadeFromMaterial(db, m.id, actorId, "Ingredient price update");
        }

        recordAudit(db, {
          entity_type: "ingredient",
          entity_id: m.id,
          action: "update",
          old_values: { price: oldPrice },
          new_values: { price: input.purchase_price },
          performed_by: actorId,
          notes: priceChanged
            ? `Updated ${m.ingredient_name} price ${oldPrice ?? "—"}→${input.purchase_price ?? "—"}`
            : `Updated ${m.ingredient_name}`,
        });
        return m;
      }),
    );
  },

  /** Bulk import (§35): upsert ingredients by name, then cascade prices to recipes. */
  async importMaterials(
    mode: "add" | "update" | "upsert",
    rows: MaterialInput[],
    actorId: string,
  ): Promise<ImportSummary> {
    return delay(
      mutate((db) => {
        const summary: ImportSummary = { total: rows.length, imported: 0, updated: 0, skipped: 0, failed: 0, errors: [] };
        const byName = new Map(db.raw_materials.map((m) => [m.ingredient_name.toLowerCase(), m]));
        const changed = new Set<string>();
        rows.forEach((input, i) => {
          try {
            const existing = byName.get(input.ingredient_name.toLowerCase());
            if (existing) {
              if (mode === "add") { summary.skipped++; return; }
              existing.category = input.category || existing.category;
              existing.notes = input.notes ?? existing.notes;
              existing.purchase_price = input.purchase_price;
              existing.purchase_quantity = input.purchase_quantity;
              existing.purchase_unit = input.purchase_unit;
              existing.base_unit = input.base_unit;
              existing.cost_per_base_unit = computeCpu(input);
              existing.last_price_update = input.purchase_price === null ? existing.last_price_update : todayISO();
              changed.add(existing.id);
              summary.updated++;
            } else {
              if (mode === "update") { summary.skipped++; return; }
              const material: RawMaterial = {
                id: uid(),
                ingredient_name: input.ingredient_name,
                category: input.category,
                notes: input.notes ?? null,
                purchase_price: input.purchase_price,
                purchase_quantity: input.purchase_quantity,
                purchase_unit: input.purchase_unit,
                base_unit: input.base_unit,
                cost_per_base_unit: computeCpu(input),
                last_price_update: input.purchase_price === null ? null : todayISO(),
                status: "active",
                created_by: actorId,
                created_at: nowISO(),
              };
              db.raw_materials.push(material);
              byName.set(material.ingredient_name.toLowerCase(), material);
              changed.add(material.id);
              summary.imported++;
            }
          } catch (e) {
            summary.failed++;
            summary.errors.push({ row: i + 2, message: e instanceof Error ? e.message : "Failed" });
          }
        });
        for (const id of changed) cascadeFromMaterial(db, id, actorId, "Ingredient import");
        recordAudit(db, {
          entity_type: "ingredient",
          entity_id: "import",
          action: "update",
          new_values: { added: summary.imported, updated: summary.updated },
          performed_by: actorId,
          notes: `Imported ingredients — ${summary.imported} added, ${summary.updated} updated`,
        });
        return summary;
      }),
    );
  },

  /** Reactivate a legacy inactive ingredient (deactivate is replaced by delete). */
  async setStatus(
    id: string,
    status: "active" | "inactive",
    actorId: string,
  ): Promise<RawMaterial> {
    return delay(
      mutate((db) => {
        const m = db.raw_materials.find((x) => x.id === id);
        if (!m) throw new Error("Ingredient not found");
        m.status = status;
        recordAudit(db, {
          entity_type: "ingredient",
          entity_id: m.id,
          action: status === "inactive" ? "delete" : "update",
          performed_by: actorId,
          notes: `${status === "inactive" ? "Deactivated" : "Reactivated"} ${m.ingredient_name}`,
        });
        return m;
      }),
    );
  },

  async bulkSetStatus(
    ids: string[],
    status: "active" | "inactive",
    actorId: string,
  ): Promise<number> {
    return delay(
      mutate((db) => {
        let n = 0;
        for (const id of ids) {
          const m = db.raw_materials.find((x) => x.id === id);
          if (!m || m.status === status) continue;
          m.status = status;
          n++;
          recordAudit(db, {
            entity_type: "ingredient",
            entity_id: m.id,
            action: status === "inactive" ? "delete" : "update",
            performed_by: actorId,
            notes: `${status === "inactive" ? "Deactivated" : "Reactivated"} ${m.ingredient_name} (bulk)`,
          });
        }
        return n;
      }),
    );
  },

  /** Which recipes (names) use this ingredient — used to explain a blocked delete. */
  recipesUsing(db: ReturnType<typeof getDb>, id: string): string[] {
    const lines = db.recipe_ingredients.filter(
      (ri) => ri.component_type === "material" && ri.ingredient_id === id,
    );
    return [
      ...new Set(
        lines.map((ri) => db.recipes.find((r) => r.id === ri.recipe_id)?.recipe_name).filter(Boolean) as string[],
      ),
    ];
  },

  /**
   * Permanently delete an ingredient. BLOCKED while it's used in any recipe (the
   * recipe_ingredients FK cascades, which would silently strip those recipe lines).
   * Deletes its price history + yields; wastage rows keep their snapshot (link nulled).
   */
  async remove(id: string, actorId: string): Promise<void> {
    return delay(
      mutate((db) => {
        const m = db.raw_materials.find((x) => x.id === id);
        if (!m) throw new Error("Ingredient not found");
        const used = this.recipesUsing(db, id);
        if (used.length) {
          throw new Error(
            `Can't delete "${m.ingredient_name}" — it's used in ${used.length} recipe${used.length === 1 ? "" : "s"} (${used.slice(0, 3).join(", ")}${used.length > 3 ? "…" : ""}). Remove it from those recipes first.`,
          );
        }
        db.raw_materials = db.raw_materials.filter((x) => x.id !== id);
        db.ingredient_price_history = db.ingredient_price_history.filter((h) => h.ingredient_id !== id);
        db.ingredient_yields = db.ingredient_yields.filter((y) => y.ingredient_id !== id);
        db.wastage_entries.forEach((w) => {
          if (w.ingredient_id === id) w.ingredient_id = null;
        });
        recordAudit(db, {
          entity_type: "ingredient",
          entity_id: id,
          action: "delete",
          old_values: { name: m.ingredient_name },
          performed_by: actorId,
          notes: `Deleted ${m.ingredient_name}`,
        });
      }),
    );
  },

  /** Bulk delete. Deletes those not in use; returns how many were deleted vs skipped. */
  async bulkRemove(ids: string[], actorId: string): Promise<{ deleted: number; skipped: number }> {
    return delay(
      mutate((db) => {
        let deleted = 0;
        let skipped = 0;
        for (const id of ids) {
          const m = db.raw_materials.find((x) => x.id === id);
          if (!m) continue;
          if (this.recipesUsing(db, id).length) {
            skipped++;
            continue;
          }
          db.raw_materials = db.raw_materials.filter((x) => x.id !== id);
          db.ingredient_price_history = db.ingredient_price_history.filter((h) => h.ingredient_id !== id);
          db.ingredient_yields = db.ingredient_yields.filter((y) => y.ingredient_id !== id);
          db.wastage_entries.forEach((w) => {
            if (w.ingredient_id === id) w.ingredient_id = null;
          });
          deleted++;
          recordAudit(db, {
            entity_type: "ingredient",
            entity_id: id,
            action: "delete",
            performed_by: actorId,
            notes: `Deleted ${m.ingredient_name} (bulk)`,
          });
        }
        return { deleted, skipped };
      }),
    );
  },

  /** All ingredient price-history rows (for bulk Excel export). */
  async allPriceHistory(): Promise<IngredientPriceHistory[]> {
    return delay(
      [...getDb().ingredient_price_history].sort((a, b) =>
        b.changed_at.localeCompare(a.changed_at),
      ),
    );
  },

  /** Most recent price changes across all ingredients (dashboard feed). */
  async recentPriceHistory(limit = 10): Promise<IngredientPriceHistory[]> {
    return delay(
      [...getDb().ingredient_price_history]
        .sort((a, b) => b.changed_at.localeCompare(a.changed_at))
        .slice(0, limit),
    );
  },

  async priceHistory(id: string): Promise<IngredientPriceHistory[]> {
    return delay(
      getDb()
        .ingredient_price_history.filter((h) => h.ingredient_id === id)
        .sort((a, b) => b.changed_at.localeCompare(a.changed_at)),
    );
  },
};
