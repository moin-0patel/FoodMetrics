import type { Department, RawMaterial, Recipe, WastageEntry, WastageLineWithItem, WastageType } from "../types";
import { round2 } from "../../costing";
import { activeYield, effectiveCostPerBaseUnit } from "../../yield";
import { delay, getDb, type MockDb, mutate, nowISO, uid } from "./db";
import { recordAudit } from "./recompute";

export interface WastageLineInput {
  item_type: "ingredient" | "recipe";
  ingredient_id: string | null;
  recipe_id: string | null;
  quantity: number;
  unit: string;
  unit_cost: number;
}

export interface WastageInput {
  name?: string | null;
  wastage_date: string;
  brand: string;
  outlet_id: string;
  category?: string | null;
  wastage_type: WastageType;
  reason?: string | null;
  department: Department;
  shift?: string | null;
  done_by?: string | null;
  approved_by?: string | null;
  description?: string | null;
  notes?: string | null;
  status?: string | null;
  packaging_cost?: number;
  /** Recipe-style itemised wastage lines (at least one). */
  lines: WastageLineInput[];
}

/** Replace a wastage record's lines; returns the summed ingredient cost. */
function writeWastageLines(db: MockDb, wastageId: string, lines: WastageLineInput[]): number {
  db.wastage_lines = db.wastage_lines.filter((l) => l.wastage_id !== wastageId);
  let total = 0;
  for (const l of lines) {
    const lineTotal = round2((l.quantity || 0) * (l.unit_cost || 0));
    total += lineTotal;
    db.wastage_lines.push({
      id: uid(),
      wastage_id: wastageId,
      item_type: l.item_type,
      ingredient_id: l.item_type === "ingredient" ? l.ingredient_id : null,
      recipe_id: l.item_type === "recipe" ? l.recipe_id : null,
      quantity: l.quantity,
      unit: l.unit,
      unit_cost: l.unit_cost,
      total_cost: lineTotal,
    });
  }
  return round2(total);
}

/**
 * §13 applicable unit cost for a wasted item:
 *  1. finished recipe  → recipe cost per portion
 *  2. ingredient w/ yield → yield-adjusted cost per base unit
 *  3. ingredient (no yield) → standard cost per base unit
 */
export function applicableUnitCost(
  itemType: "ingredient" | "recipe",
  id: string | null,
  materials: RawMaterial[],
  recipes: Recipe[],
  yields: import("../types").IngredientYield[],
): number {
  if (!id) return 0;
  if (itemType === "recipe") {
    return recipes.find((r) => r.id === id)?.cost_per_portion ?? 0;
  }
  const m = materials.find((x) => x.id === id);
  if (!m) return 0;
  return effectiveCostPerBaseUnit(m.cost_per_base_unit, activeYield(yields, id)) ?? 0;
}

export const wastageRepo = {
  async list(): Promise<WastageEntry[]> {
    return delay([...getDb().wastage_entries].sort((a, b) => b.wastage_date.localeCompare(a.wastage_date)));
  },

  async getById(id: string): Promise<WastageEntry | null> {
    return delay(getDb().wastage_entries.find((w) => w.id === id) ?? null);
  },

  /** A wastage record with its itemised lines (joined to item names). */
  async getWithLines(id: string): Promise<{ entry: WastageEntry; lines: WastageLineWithItem[] } | null> {
    const db = getDb();
    const entry = db.wastage_entries.find((w) => w.id === id) ?? null;
    if (!entry) return delay(null);
    const lines: WastageLineWithItem[] = db.wastage_lines
      .filter((l) => l.wastage_id === id)
      .map((l) => ({
        ...l,
        name:
          l.item_type === "recipe"
            ? db.recipes.find((r) => r.id === l.recipe_id)?.recipe_name ?? "—"
            : db.raw_materials.find((m) => m.id === l.ingredient_id)?.ingredient_name ?? "—",
      }));
    return delay({ entry: { ...entry }, lines });
  },

  async create(input: WastageInput, actorId: string): Promise<WastageEntry> {
    return delay(
      mutate((db) => {
        const lines = input.lines ?? [];
        if (lines.length === 0) throw new Error("Add at least one wasted item");
        const first = lines[0];
        const id = uid();
        const entry: WastageEntry = {
          id,
          name: input.name?.trim() || null,
          wastage_date: input.wastage_date,
          brand: input.brand,
          outlet_id: input.outlet_id,
          category: input.category ?? null,
          wastage_type: input.wastage_type,
          item_type: first.item_type,
          ingredient_id: first.item_type === "ingredient" ? first.ingredient_id : null,
          recipe_id: first.item_type === "recipe" ? first.recipe_id : null,
          quantity: first.quantity,
          unit: first.unit,
          unit_cost: first.unit_cost,
          packaging_cost: round2(input.packaging_cost ?? 0),
          total_cost: 0,
          description: input.description ?? null,
          reason: input.reason ?? null,
          department: input.department,
          shift: input.shift ?? null,
          done_by: input.done_by ?? null,
          entered_by: actorId,
          approved_by: input.approved_by || null,
          status: input.status ?? "recorded",
          notes: input.notes ?? null,
          created_at: nowISO(),
          updated_at: nowISO(),
        };
        db.wastage_entries.push(entry);
        const ingTotal = writeWastageLines(db, id, lines);
        entry.total_cost = round2(ingTotal + (input.packaging_cost ?? 0));
        recordAudit(db, {
          entity_type: first.item_type === "recipe" ? "recipe" : "ingredient",
          entity_id: (first.recipe_id || first.ingredient_id) ?? entry.id,
          action: "create",
          new_values: { total_cost: entry.total_cost, outlet: entry.outlet_id },
          performed_by: actorId,
          notes: `Recorded wastage ₹${entry.total_cost} (${entry.wastage_type})`,
        });
        return entry;
      }),
    );
  },

  async update(id: string, input: WastageInput, actorId: string): Promise<WastageEntry> {
    return delay(
      mutate((db) => {
        const w = db.wastage_entries.find((x) => x.id === id);
        if (!w) throw new Error("Wastage entry not found");
        const lines = input.lines ?? [];
        if (lines.length === 0) throw new Error("Add at least one wasted item");
        const first = lines[0];
        const before = { total_cost: w.total_cost };
        const ingTotal = writeWastageLines(db, id, lines);
        Object.assign(w, {
          name: input.name?.trim() || null,
          wastage_date: input.wastage_date,
          brand: input.brand,
          outlet_id: input.outlet_id,
          category: input.category ?? null,
          wastage_type: input.wastage_type,
          item_type: first.item_type,
          ingredient_id: first.item_type === "ingredient" ? first.ingredient_id : null,
          recipe_id: first.item_type === "recipe" ? first.recipe_id : null,
          quantity: first.quantity,
          unit: first.unit,
          unit_cost: first.unit_cost,
          packaging_cost: round2(input.packaging_cost ?? 0),
          total_cost: round2(ingTotal + (input.packaging_cost ?? 0)),
          description: input.description ?? null,
          reason: input.reason ?? null,
          department: input.department,
          shift: input.shift ?? null,
          done_by: input.done_by ?? null,
          approved_by: input.approved_by || null,
          status: input.status ?? w.status ?? "recorded",
          notes: input.notes ?? null,
          updated_at: nowISO(),
        });
        recordAudit(db, {
          entity_type: first.item_type === "recipe" ? "recipe" : "ingredient",
          entity_id: (first.recipe_id || first.ingredient_id) ?? w.id,
          action: "update",
          old_values: before,
          new_values: { total_cost: w.total_cost },
          performed_by: actorId,
          notes: `Updated wastage entry`,
        });
        return w;
      }),
    );
  },

  async remove(id: string, actorId: string): Promise<void> {
    return delay(
      mutate((db) => {
        const w = db.wastage_entries.find((x) => x.id === id);
        if (!w) return;
        db.wastage_entries = db.wastage_entries.filter((x) => x.id !== id);
        db.wastage_lines = db.wastage_lines.filter((l) => l.wastage_id !== id);
        recordAudit(db, {
          entity_type: w.item_type === "recipe" ? "recipe" : "ingredient",
          entity_id: (w.recipe_id || w.ingredient_id) ?? w.id,
          action: "delete",
          performed_by: actorId,
          notes: "Deleted wastage entry",
        });
      }),
    );
  },
};
