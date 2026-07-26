// Supabase-backed wastage repository. Mirrors the mock `wastageRepo` 1:1. Backed by
// public.wastage_entries + public.wastage_lines (db/migrations/0006, 0008, 0026);
// outlet-scoped RLS in 0008. Recipe-style: a record has itemised lines and
// total_cost = sum(line qty × unit cost) + packaging_cost.

import type { WastageEntry, WastageLine, WastageLineWithItem } from "../types";
import { round2 } from "../../costing";
import type { WastageInput, WastageLineInput } from "../mock/wastage";
import { applicableUnitCost } from "../mock/wastage";
import { sb, fail, audit } from "./helpers";
import { uid, nowISO } from "../mock/db";

export { applicableUnitCost };
export type { WastageInput };

function lineRows(wastageId: string, lines: WastageLineInput[]) {
  return lines.map((l) => ({
    id: uid(),
    wastage_id: wastageId,
    item_type: l.item_type,
    ingredient_id: l.item_type === "ingredient" ? l.ingredient_id : null,
    recipe_id: l.item_type === "recipe" ? l.recipe_id : null,
    quantity: l.quantity,
    unit: l.unit,
    unit_cost: l.unit_cost,
    total_cost: round2((l.quantity || 0) * (l.unit_cost || 0)),
  }));
}

async function replaceLines(wastageId: string, rows: ReturnType<typeof lineRows>): Promise<void> {
  const c = sb();
  const del = await c.from("wastage_lines").delete().eq("wastage_id", wastageId);
  if (del.error) fail("Save wastage lines", del.error.message);
  if (rows.length) {
    const ins = await c.from("wastage_lines").insert(rows);
    if (ins.error) fail("Save wastage lines", ins.error.message);
  }
}

export const supabaseWastageRepo = {
  async list(): Promise<WastageEntry[]> {
    const { data, error } = await sb()
      .from("wastage_entries")
      .select("*")
      .order("wastage_date", { ascending: false });
    if (error) fail("Load wastage", error.message);
    return (data ?? []) as WastageEntry[];
  },

  async getById(id: string): Promise<WastageEntry | null> {
    const { data, error } = await sb().from("wastage_entries").select("*").eq("id", id).maybeSingle();
    if (error) fail("Load wastage entry", error.message);
    return (data as WastageEntry | null) ?? null;
  },

  async getWithLines(id: string): Promise<{ entry: WastageEntry; lines: WastageLineWithItem[] } | null> {
    const c = sb();
    const entryRes = await c.from("wastage_entries").select("*").eq("id", id).maybeSingle();
    if (entryRes.error) fail("Load wastage entry", entryRes.error.message);
    if (!entryRes.data) return null;
    const entry = entryRes.data as WastageEntry;

    const linesRes = await c.from("wastage_lines").select("*").eq("wastage_id", id);
    if (linesRes.error) fail("Load wastage lines", linesRes.error.message);
    const lines = (linesRes.data ?? []) as WastageLine[];

    const matIds = lines.filter((l) => l.item_type === "ingredient" && l.ingredient_id).map((l) => l.ingredient_id!);
    const recIds = lines.filter((l) => l.item_type === "recipe" && l.recipe_id).map((l) => l.recipe_id!);
    const [matsRes, recsRes] = await Promise.all([
      matIds.length ? c.from("raw_materials").select("id,ingredient_name").in("id", matIds) : Promise.resolve({ data: [], error: null }),
      recIds.length ? c.from("recipes").select("id,recipe_name").in("id", recIds) : Promise.resolve({ data: [], error: null }),
    ]);
    const matName = new Map(((matsRes.data ?? []) as { id: string; ingredient_name: string }[]).map((m) => [m.id, m.ingredient_name]));
    const recName = new Map(((recsRes.data ?? []) as { id: string; recipe_name: string }[]).map((r) => [r.id, r.recipe_name]));
    const withItem: WastageLineWithItem[] = lines.map((l) => ({
      ...l,
      name: l.item_type === "recipe" ? recName.get(l.recipe_id ?? "") ?? "—" : matName.get(l.ingredient_id ?? "") ?? "—",
    }));
    return { entry, lines: withItem };
  },

  async create(input: WastageInput, actorId: string): Promise<WastageEntry> {
    const lines = input.lines ?? [];
    if (lines.length === 0) fail("Record wastage", "Add at least one wasted item");
    const first = lines[0];
    const rows = lineRows("", lines);
    const ingTotal = round2(rows.reduce((s, r) => s + r.total_cost, 0));
    const total_cost = round2(ingTotal + (input.packaging_cost ?? 0));
    const id = uid();
    const row = {
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
      total_cost,
      description: input.description ?? null,
      reason: input.reason ?? null,
      department: input.department,
      shift: input.shift ?? null,
      done_by: input.done_by ?? null,
      entered_by: actorId,
      approved_by: input.approved_by || null,
      status: input.status ?? "recorded",
      notes: input.notes ?? null,
    };
    const { data, error } = await sb().from("wastage_entries").insert(row).select("*").single();
    if (error) fail("Record wastage", error.message);
    const entry = data as WastageEntry;
    await replaceLines(entry.id, rows.map((r) => ({ ...r, wastage_id: entry.id })));
    await audit({
      entity_type: first.item_type === "recipe" ? "recipe" : "ingredient",
      entity_id: (first.recipe_id || first.ingredient_id) ?? entry.id,
      action: "create",
      new_values: { total_cost: entry.total_cost, outlet: entry.outlet_id },
      performed_by: actorId,
      notes: `Recorded wastage ₹${entry.total_cost} (${entry.wastage_type})`,
    });
    return entry;
  },

  async update(id: string, input: WastageInput, actorId: string): Promise<WastageEntry> {
    const c = sb();
    const priorRes = await c.from("wastage_entries").select("*").eq("id", id).maybeSingle();
    if (priorRes.error) fail("Load wastage entry", priorRes.error.message);
    if (!priorRes.data) fail("Update wastage", "Wastage entry not found");
    const before = { total_cost: (priorRes.data as WastageEntry).total_cost };

    const lines = input.lines ?? [];
    if (lines.length === 0) fail("Update wastage", "Add at least one wasted item");
    const first = lines[0];
    const rows = lineRows(id, lines);
    const ingTotal = round2(rows.reduce((s, r) => s + r.total_cost, 0));
    const total_cost = round2(ingTotal + (input.packaging_cost ?? 0));
    const row = {
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
      total_cost,
      description: input.description ?? null,
      reason: input.reason ?? null,
      department: input.department,
      shift: input.shift ?? null,
      done_by: input.done_by ?? null,
      approved_by: input.approved_by || null,
      status: input.status ?? null,
      notes: input.notes ?? null,
      updated_at: nowISO(),
    };
    const { data, error } = await c.from("wastage_entries").update(row).eq("id", id).select("*").single();
    if (error) fail("Update wastage", error.message);
    const entry = data as WastageEntry;
    await replaceLines(id, rows);
    await audit({
      entity_type: first.item_type === "recipe" ? "recipe" : "ingredient",
      entity_id: (first.recipe_id || first.ingredient_id) ?? entry.id,
      action: "update",
      old_values: before,
      new_values: { total_cost: entry.total_cost },
      performed_by: actorId,
      notes: `Updated wastage entry`,
    });
    return entry;
  },

  async remove(id: string, actorId: string): Promise<void> {
    const c = sb();
    const existing = await c.from("wastage_entries").select("*").eq("id", id).maybeSingle();
    if (existing.error) fail("Load wastage entry", existing.error.message);
    if (!existing.data) return;
    const w = existing.data as WastageEntry;
    await c.from("wastage_lines").delete().eq("wastage_id", id);
    const { error } = await c.from("wastage_entries").delete().eq("id", id);
    if (error) fail("Delete wastage", error.message);
    await audit({
      entity_type: w.item_type === "recipe" ? "recipe" : "ingredient",
      entity_id: (w.recipe_id || w.ingredient_id) ?? w.id,
      action: "delete",
      performed_by: actorId,
      notes: "Deleted wastage entry",
    });
  },
};
