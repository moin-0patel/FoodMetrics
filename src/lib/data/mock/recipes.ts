import type {
  ComponentType,
  Recipe,
  RecipeCostHistory,
  RecipeIngredient,
  RecipeIngredientWithMaterial,
  RecipePackaging,
  RecipePackagingWithItem,
  RecipeVersion,
} from "../types";
import type { ImportSummary } from "../../import/importTypes";
import { delay, getDb, type MockDb, mutate, nowISO, uid } from "./db";
import { cascadeFromPrep, findMaterial, recomputeAndPropagate, recordAudit } from "./recompute";

/** One row of a recipe import (§37) — one ingredient line; many rows per recipe.
 *  Header-level fields (everything except ingredient_name/quantity/unit) are
 *  repeated on every row of a recipe; the importer takes the first non-null. */
export interface ImportRecipeLine {
  recipe_name: string;
  category: string;
  size: "11_INCH" | "15_INCH" | null;
  ingredient_name: string;
  quantity: number;
  unit: string;
  selling_price: number | null;
  packaging_cost: number | null;
  /** Optional dish image (public path or URL). Omitted/null leaves it imageless. */
  image_url?: string | null;
  /** Optional recipe blurb. */
  description?: string | null;
  /** Optional ordered preparation steps. */
  method?: string[] | null;
  /** Optional prep time in minutes. */
  preparation_time?: number | null;
  /** Optional creator label ("Chef Rahul"). The editor requires one, so an
   *  imported recipe without it can't be re-saved until someone types it. */
  created_by_name?: string | null;
}

/** Collapse a recipe's import rows into its optional header fields — first
 *  non-empty value wins, exactly as selling_price/packaging do. Shared by the mock
 *  and Supabase importers so the two can't drift. Null means "column absent",
 *  which callers treat as "leave whatever is already there". */
export function importedHeader(ls: ImportRecipeLine[]): {
  description: string | null;
  method: string[] | null;
  preparation_time: number | null;
  created_by_name: string | null;
} {
  const method = ls.find((l) => l.method?.length)?.method ?? null;
  return {
    description: ls.find((l) => l.description)?.description ?? null,
    method: method?.length ? method : null,
    preparation_time: ls.find((l) => l.preparation_time != null)?.preparation_time ?? null,
    created_by_name: ls.find((l) => l.created_by_name)?.created_by_name ?? null,
  };
}

export interface RecipeHeaderInput {
  recipe_name: string;
  created_by_name?: string | null;
  category: string;
  brand: string;
  description?: string | null;
  method?: string[];
  preparation_time?: number | null;
  serving_size: number;
  selling_price?: number | null;
  packaging_cost?: number;
  wastage_pct?: number;
  is_prep?: boolean;
  yield_quantity?: number;
  yield_unit?: string;
  /** Packaging lines (Pizza Box × qty…). When provided, packaging_cost is derived
   *  from these (sum of qty × master unit price) and the manual field is ignored. */
  packaging?: RecipePackagingInput[];
}

export interface RecipePackagingInput {
  packaging_item_id: string;
  quantity_used: number;
}

export interface RecipeLineInput {
  ingredient_id: string;
  component_type?: ComponentType;
  quantity_used: number;
  unit_used: string;
  /** Recipe-specific wastage % override (§10); null/undefined → standard yield. */
  wastage_override_pct?: number | null;
  /** Selected cut/prep variant; its yield drives the cost when set. */
  cut_type?: string | null;
}

function attachMaterials(
  db: MockDb,
  lines: RecipeIngredient[],
): RecipeIngredientWithMaterial[] {
  return lines
    .slice()
    .sort((a, b) => a.sort_order - b.sort_order)
    .map((l) => ({
      ...l,
      material: l.component_type === "recipe" ? null : findMaterial(db, l.ingredient_id) ?? null,
      subRecipe:
        l.component_type === "recipe"
          ? db.recipes.find((r) => r.id === l.ingredient_id) ?? null
          : null,
    }));
}

function snapshotVersion(
  db: MockDb,
  recipe: Recipe,
  actorId: string | null,
  notes: string,
): void {
  const lines = db.recipe_ingredients.filter((ri) => ri.recipe_id === recipe.id);
  db.recipe_versions.push({
    id: uid(),
    recipe_id: recipe.id,
    version_no: recipe.version_no,
    snapshot: structuredClone({ recipe, lines }),
    notes,
    created_by: actorId,
    created_at: nowISO(),
  });
}

/** Does `startId` (transitively) use `targetId` as a sub-recipe component? */
function recipeReaches(db: MockDb, startId: string, targetId: string, seen = new Set<string>()): boolean {
  if (startId === targetId) return true;
  if (seen.has(startId)) return false;
  seen.add(startId);
  return db.recipe_ingredients.some(
    (ri) =>
      ri.recipe_id === startId &&
      ri.component_type === "recipe" &&
      recipeReaches(db, ri.ingredient_id, targetId, seen),
  );
}

/** Replace a recipe's packaging lines, snapshotting the master unit price, and
 *  return the total packaging cost (sum of qty × unit price). */
function writePackaging(db: MockDb, recipeId: string, lines: RecipePackagingInput[]): number {
  db.recipe_packaging = db.recipe_packaging.filter((rp) => rp.recipe_id !== recipeId);
  let total = 0;
  for (const l of lines) {
    if (!l.packaging_item_id || !(l.quantity_used > 0)) continue;
    const item = db.packaging_items.find((p) => p.id === l.packaging_item_id);
    const price = item?.unit_price ?? 0;
    total += l.quantity_used * price;
    db.recipe_packaging.push({
      id: uid(),
      recipe_id: recipeId,
      packaging_item_id: l.packaging_item_id,
      quantity_used: l.quantity_used,
      unit: item?.unit ?? "Piece",
      unit_price: price,
      created_at: nowISO(),
    });
  }
  return Math.round(total * 100) / 100;
}

function writeLines(db: MockDb, recipeId: string, lines: RecipeLineInput[]): void {
  // §19 circular-reference guard: reject self-links and any sub-recipe that
  // (directly or transitively) already depends on this recipe.
  for (const l of lines) {
    if ((l.component_type ?? "material") !== "recipe") continue;
    if (l.ingredient_id === recipeId || recipeReaches(db, l.ingredient_id, recipeId)) {
      const name = db.recipes.find((r) => r.id === l.ingredient_id)?.recipe_name ?? "that recipe";
      throw new Error(`Circular sub-recipe link: "${name}" already depends on this recipe.`);
    }
  }
  db.recipe_ingredients = db.recipe_ingredients.filter((ri) => ri.recipe_id !== recipeId);
  lines.forEach((line, idx) => {
    db.recipe_ingredients.push({
      id: uid(),
      recipe_id: recipeId,
      ingredient_id: line.ingredient_id,
      component_type: line.component_type ?? "material",
      quantity_used: line.quantity_used,
      unit_used: line.unit_used,
      calculated_cost: null,
      sort_order: idx,
      wastage_override_pct: line.wastage_override_pct ?? null,
      cut_type: line.cut_type ?? null,
    });
  });
}

/** Default a prep's batch yield to the sum of its ingredient grams. */
function defaultYield(lines: RecipeLineInput[]): number {
  const sum = lines.reduce((s, l) => s + (l.quantity_used || 0), 0);
  return sum > 0 ? sum : 1;
}

export const recipesRepo = {
  async list(): Promise<Recipe[]> {
    return delay([...getDb().recipes]);
  },

  async getById(id: string): Promise<Recipe | null> {
    return delay(getDb().recipes.find((r) => r.id === id) ?? null);
  },

  async getWithIngredients(
    id: string,
  ): Promise<{ recipe: Recipe; ingredients: RecipeIngredientWithMaterial[]; packaging: RecipePackagingWithItem[] } | null> {
    const db = getDb();
    const recipe = db.recipes.find((r) => r.id === id);
    if (!recipe) return delay(null);
    const ingredients = attachMaterials(
      db,
      db.recipe_ingredients.filter((ri) => ri.recipe_id === id),
    );
    const packaging: RecipePackagingWithItem[] = db.recipe_packaging
      .filter((rp) => rp.recipe_id === id)
      .map((rp) => ({ ...rp, item: db.packaging_items.find((p) => p.id === rp.packaging_item_id) ?? null }));
    return delay({ recipe: { ...recipe }, ingredients, packaging });
  },

  async create(
    header: RecipeHeaderInput,
    lines: RecipeLineInput[],
    actorId: string,
  ): Promise<Recipe> {
    return delay(
      mutate((db) => {
        if (
          db.recipes.some(
            (r) => r.recipe_name.toLowerCase() === header.recipe_name.toLowerCase(),
          )
        ) {
          throw new Error("A recipe with this name already exists");
        }
        const recipe: Recipe = {
          id: uid(),
          recipe_name: header.recipe_name,
          created_by_name: header.created_by_name?.trim() || null,
          category: header.category,
          brand: header.brand,
          description: header.description ?? null,
          method: header.method ?? [],
          image_url: null,
          preparation_time: header.preparation_time ?? null,
          serving_size: header.serving_size,
          status: "draft",
          total_cost: 0,
          cost_per_portion: 0,
          selling_price: header.selling_price ?? null,
          packaging_cost: header.packaging_cost ?? 0,
          wastage_pct: header.wastage_pct ?? 0,
          is_prep: header.is_prep ?? false,
          yield_quantity: header.yield_quantity ?? defaultYield(lines),
          yield_unit: header.yield_unit ?? "Gram",
          created_by: actorId,
          approved_by: null,
          approved_at: null,
          rejection_note: null,
          version_no: 1,
          created_at: nowISO(),
          updated_at: nowISO(),
          updated_by: actorId,
        };
        db.recipes.push(recipe);
        writeLines(db, recipe.id, lines);
        if (header.packaging) recipe.packaging_cost = writePackaging(db, recipe.id, header.packaging);
        recomputeAndPropagate(db, [recipe.id], actorId, "Recipe created");
        snapshotVersion(db, recipe, actorId, "Initial version");
        recordAudit(db, {
          entity_type: "recipe",
          entity_id: recipe.id,
          action: "create",
          new_values: { name: recipe.recipe_name },
          performed_by: actorId,
          notes: `Created "${recipe.recipe_name}"`,
        });
        return recipe;
      }),
    );
  },

  async update(
    id: string,
    header: RecipeHeaderInput,
    lines: RecipeLineInput[],
    actorId: string,
  ): Promise<Recipe> {
    return delay(
      mutate((db) => {
        const recipe = db.recipes.find((r) => r.id === id);
        if (!recipe) throw new Error("Recipe not found");
        if (
          db.recipes.some(
            (r) =>
              r.id !== id &&
              r.recipe_name.toLowerCase() === header.recipe_name.toLowerCase(),
          )
        ) {
          throw new Error("A recipe with this name already exists");
        }

        recipe.recipe_name = header.recipe_name;
        if (header.created_by_name !== undefined) recipe.created_by_name = header.created_by_name?.trim() || null;
        recipe.category = header.category;
        recipe.brand = header.brand;
        recipe.selling_price = header.selling_price ?? null;
        recipe.packaging_cost = header.packaging_cost ?? 0;
        recipe.wastage_pct = header.wastage_pct ?? 0;
        recipe.description = header.description ?? null;
        recipe.method = header.method ?? [];
        recipe.preparation_time = header.preparation_time ?? null;
        recipe.serving_size = header.serving_size;
        if (header.is_prep !== undefined) recipe.is_prep = header.is_prep;
        recipe.yield_quantity = header.yield_quantity ?? defaultYield(lines);
        recipe.yield_unit = header.yield_unit ?? recipe.yield_unit ?? "Gram";
        recipe.version_no += 1;
        recipe.updated_by = actorId;

        // Editing an approved recipe reverts it to Draft (PRD §3.6 regression).
        const wasApproved = recipe.status === "approved";
        if (wasApproved) {
          recipe.status = "draft";
          recipe.approved_by = null;
          recipe.approved_at = null;
        }

        writeLines(db, recipe.id, lines);
        if (header.packaging) recipe.packaging_cost = writePackaging(db, recipe.id, header.packaging);
        recomputeAndPropagate(db, [recipe.id], actorId, "Recipe edited");
        snapshotVersion(db, recipe, actorId, `Version ${recipe.version_no}`);
        recordAudit(db, {
          entity_type: "recipe",
          entity_id: recipe.id,
          action: "update",
          performed_by: actorId,
          notes: wasApproved
            ? `Edited "${recipe.recipe_name}" (reverted to Draft)`
            : `Edited "${recipe.recipe_name}"`,
        });
        return recipe;
      }),
    );
  },

  /**
   * Bulk recipe import (§37). Rows are grouped by recipe name; rows carrying a
   * Size build a pizza master (15-inch) + an 11-inch variant, otherwise a single
   * recipe. Missing ingredients are created as UNPRICED materials. Costs recompute
   * from priced ingredients afterwards.
   */
  async importRecipes(
    mode: "add" | "update" | "upsert",
    rows: ImportRecipeLine[],
    actorId: string,
    isPrep = false,
    brand = "",
  ): Promise<ImportSummary> {
    return delay(
      mutate((db) => {
        const S: ImportSummary = { total: 0, imported: 0, updated: 0, skipped: 0, failed: 0, errors: [] };
        const matByName = new Map(db.raw_materials.map((m) => [m.ingredient_name.toLowerCase(), m]));
        // In-house preps are addressable by name too, so a menu row can list
        // "Pomodoro Sauce" and get the PREP (component_type "recipe"), not a new
        // priceless material. Kept in sync as preps are created during this run.
        const prepByName = new Map(
          db.recipes.filter((r) => r.is_prep).map((r) => [r.recipe_name.toLowerCase(), r]),
        );

        /** Resolve a line's ingredient name to an existing prep, an existing
         *  material, or a newly-created (unpriced) material as a last resort. */
        const resolveComponent = (
          name: string,
          selfId: string,
        ): { id: string; component_type: ComponentType } => {
          const key = name.toLowerCase();
          const prep = prepByName.get(key);
          // Never let a recipe reference itself — that would be a cost cycle.
          if (prep && prep.id !== selfId) return { id: prep.id, component_type: "recipe" };
          const found = matByName.get(key);
          if (found) return { id: found.id, component_type: "material" };
          const m = {
            id: uid(), ingredient_name: name, category: "Other", notes: null,
            purchase_price: null, purchase_quantity: 1, purchase_unit: "Gram", base_unit: "Gram",
            cost_per_base_unit: null, last_price_update: null, status: "active" as const,
            created_by: actorId, created_at: nowISO(),
          };
          db.raw_materials.push(m);
          matByName.set(key, m);
          return { id: m.id, component_type: "material" };
        };
        const writeRows = (recipeId: string, ls: ImportRecipeLine[]) => {
          db.recipe_ingredients = db.recipe_ingredients.filter((ri) => ri.recipe_id !== recipeId);
          ls.forEach((l, idx) => {
            const c = resolveComponent(l.ingredient_name, recipeId);
            db.recipe_ingredients.push({
              id: uid(), recipe_id: recipeId, ingredient_id: c.id,
              component_type: c.component_type, quantity_used: l.quantity, unit_used: l.unit,
              calculated_cost: null, sort_order: idx, wastage_override_pct: null, cut_type: null,
            });
          });
        };
        const recomputeIds: string[] = [];
        const upsert = (
          name: string, category: string, sizeCode: "11_INCH" | "15_INCH" | null,
          parentId: string | null, ls: ImportRecipeLine[],
        ): { id: string | null; action: "added" | "updated" | "skipped" } => {
          const existing = db.recipes.find(
            (r) => r.recipe_name.toLowerCase() === name.toLowerCase() && (r.size_code ?? null) === sizeCode,
          );
          const selling = ls.find((l) => l.selling_price != null)?.selling_price ?? null;
          const pkg = ls.find((l) => l.packaging_cost != null)?.packaging_cost ?? null;
          const header = importedHeader(ls);
          if (existing) {
            if (mode === "add") return { id: existing.id, action: "skipped" };
            writeRows(existing.id, ls);
            existing.category = category;
            // In-House Prep has no menu price / packaging (Total Cost only).
            if (!isPrep && selling != null) existing.selling_price = selling;
            if (!isPrep && pkg != null) existing.packaging_cost = pkg;
            const img = ls.find((l) => l.image_url)?.image_url ?? null;
            if (img) existing.image_url = img;
            // Optional columns only overwrite when the file supplies them, so a
            // bare re-import never wipes text typed in the editor.
            if (header.description != null) existing.description = header.description;
            if (header.method != null) existing.method = header.method;
            if (header.preparation_time != null) existing.preparation_time = header.preparation_time;
            if (header.created_by_name != null) existing.created_by_name = header.created_by_name;
            existing.updated_at = nowISO();
            existing.updated_by = actorId;
            recomputeIds.push(existing.id);
            return { id: existing.id, action: "updated" };
          }
          if (mode === "update") return { id: null, action: "skipped" };
          const id = uid();
          db.recipes.push({
            id, recipe_name: name, category, brand,
            description: header.description, method: header.method ?? [],
            created_by_name: header.created_by_name,
            parent_recipe_id: parentId, size_code: sizeCode,
            size_label: sizeCode === "11_INCH" ? "11-inch" : sizeCode === "15_INCH" ? "15-inch" : null,
            image_url: ls.find((l) => l.image_url)?.image_url ?? null,
            preparation_time: header.preparation_time, serving_size: 1, status: "draft",
            selling_price: isPrep ? null : selling, packaging_cost: isPrep ? 0 : pkg ?? 0, total_cost: 0, cost_per_portion: 0,
            wastage_pct: 5, is_prep: isPrep,
            yield_quantity: isPrep ? ls.reduce((s, l) => s + (l.quantity || 0), 0) : 0, yield_unit: "Gram",
            created_by: actorId, approved_by: null, approved_at: null, rejection_note: null,
            version_no: 1, created_at: nowISO(), updated_at: nowISO(), updated_by: actorId,
          });
          // Register a new prep by name so later rows in the SAME run can
          // reference it as a sub-recipe.
          if (isPrep) {
            const created = db.recipes[db.recipes.length - 1];
            prepByName.set(name.toLowerCase(), created);
          }
          writeRows(id, ls);
          recomputeIds.push(id);
          return { id, action: "added" };
        };
        const tally = (a: "added" | "updated" | "skipped") => {
          if (a === "added") S.imported++;
          else if (a === "updated") S.updated++;
          else S.skipped++;
        };

        const groups = new Map<string, ImportRecipeLine[]>();
        for (const l of rows) {
          const k = l.recipe_name.trim().toLowerCase();
          const arr = groups.get(k);
          if (arr) arr.push(l);
          else groups.set(k, [l]);
        }
        for (const glines of groups.values()) {
          try {
            const name = glines[0].recipe_name.trim();
            const category = glines[0].category || "Uncategorised";
            if (glines.some((l) => l.size)) {
              const fifteen = glines.filter((l) => l.size === "15_INCH");
              const eleven = glines.filter((l) => l.size === "11_INCH");
              let masterId: string | null = null;
              if (fifteen.length) {
                const r = upsert(name, category, "15_INCH", null, fifteen);
                masterId = r.id;
                tally(r.action);
              }
              if (eleven.length) {
                const mId = masterId ?? db.recipes.find((r) => r.recipe_name.toLowerCase() === name.toLowerCase() && !r.parent_recipe_id)?.id ?? null;
                const r = upsert(name, category, "11_INCH", mId, eleven);
                tally(r.action);
              }
            } else {
              tally(upsert(name, category, null, null, glines).action);
            }
          } catch (e) {
            S.failed++;
            S.errors.push({ row: 0, message: `${glines[0]?.recipe_name}: ${e instanceof Error ? e.message : "failed"}` });
          }
        }
        recomputeAndPropagate(db, [...new Set(recomputeIds)], actorId, "Recipe import");
        S.total = S.imported + S.updated + S.skipped + S.failed;
        recordAudit(db, {
          entity_type: "recipe", entity_id: "import", action: "create",
          new_values: { added: S.imported, updated: S.updated },
          performed_by: actorId, notes: `Imported recipes — ${S.imported} added, ${S.updated} updated`,
        });
        return S;
      }),
    );
  },

  async duplicate(id: string, actorId: string): Promise<Recipe> {
    return delay(
      mutate((db) => {
        const src = db.recipes.find((r) => r.id === id);
        if (!src) throw new Error("Recipe not found");
        let name = `${src.recipe_name} - Copy`;
        let n = 2;
        while (db.recipes.some((r) => r.recipe_name.toLowerCase() === name.toLowerCase())) {
          name = `${src.recipe_name} - Copy ${n++}`;
        }
        const copy: Recipe = {
          ...src,
          id: uid(),
          recipe_name: name,
          status: "draft",
          approved_by: null,
          approved_at: null,
          rejection_note: null,
          version_no: 1,
          created_by: actorId,
          created_at: nowISO(),
          updated_at: nowISO(),
          updated_by: actorId,
        };
        db.recipes.push(copy);
        const srcLines = db.recipe_ingredients.filter((ri) => ri.recipe_id === id);
        writeLines(
          db,
          copy.id,
          srcLines
            .sort((a, b) => a.sort_order - b.sort_order)
            .map((l) => ({
              ingredient_id: l.ingredient_id,
              component_type: l.component_type,
              quantity_used: l.quantity_used,
              unit_used: l.unit_used,
            })),
        );
        recomputeAndPropagate(db, [copy.id], actorId, "Recipe duplicated");
        snapshotVersion(db, copy, actorId, "Duplicated");
        recordAudit(db, {
          entity_type: "recipe",
          entity_id: copy.id,
          action: "create",
          performed_by: actorId,
          notes: `Duplicated "${src.recipe_name}" → "${copy.recipe_name}"`,
        });
        return copy;
      }),
    );
  },

  async submit(id: string, note: string | null, actorId: string): Promise<Recipe> {
    return delay(
      mutate((db) => {
        const recipe = db.recipes.find((r) => r.id === id);
        if (!recipe) throw new Error("Recipe not found");
        recipe.status = "testing";
        recipe.rejection_note = null;
        recipe.updated_at = nowISO();
        recipe.updated_by = actorId;
        recordAudit(db, {
          entity_type: "recipe",
          entity_id: id,
          action: "submit",
          performed_by: actorId,
          notes: note ? `Submitted for testing: ${note}` : `Submitted "${recipe.recipe_name}" for testing`,
        });
        return recipe;
      }),
    );
  },

  async approve(id: string, actorId: string): Promise<Recipe> {
    return delay(
      mutate((db) => {
        const recipe = db.recipes.find((r) => r.id === id);
        if (!recipe) throw new Error("Recipe not found");
        recipe.status = "approved";
        recipe.approved_by = actorId;
        recipe.approved_at = nowISO();
        recipe.rejection_note = null;
        recipe.updated_at = nowISO();
        recipe.updated_by = actorId;
        recordAudit(db, {
          entity_type: "recipe",
          entity_id: id,
          action: "approve",
          performed_by: actorId,
          notes: `Approved "${recipe.recipe_name}"`,
        });
        return recipe;
      }),
    );
  },

  async reject(id: string, note: string, actorId: string): Promise<Recipe> {
    return delay(
      mutate((db) => {
        const recipe = db.recipes.find((r) => r.id === id);
        if (!recipe) throw new Error("Recipe not found");
        recipe.status = "draft";
        recipe.rejection_note = note;
        recipe.updated_at = nowISO();
        recipe.updated_by = actorId;
        recordAudit(db, {
          entity_type: "recipe",
          entity_id: id,
          action: "reject",
          performed_by: actorId,
          notes: `Rejected "${recipe.recipe_name}": ${note}`,
        });
        return recipe;
      }),
    );
  },

  /** Soft-archive: retire a recipe from active lists without deleting it. Its
   *  workflow status, cost history and sub-recipe links are all preserved. */
  async archive(id: string, actorId: string): Promise<Recipe> {
    return delay(
      mutate((db) => {
        const recipe = db.recipes.find((r) => r.id === id);
        if (!recipe) throw new Error("Recipe not found");
        if (recipe.archived_at) return recipe;
        recipe.archived_at = nowISO();
        recipe.archived_by = actorId;
        recipe.updated_at = nowISO();
        recipe.updated_by = actorId;
        recordAudit(db, {
          entity_type: "recipe",
          entity_id: id,
          action: "update",
          performed_by: actorId,
          notes: `Archived "${recipe.recipe_name}"`,
        });
        return recipe;
      }),
    );
  },

  /** Restore a soft-archived recipe back into active lists (status is unchanged). */
  async unarchive(id: string, actorId: string): Promise<Recipe> {
    return delay(
      mutate((db) => {
        const recipe = db.recipes.find((r) => r.id === id);
        if (!recipe) throw new Error("Recipe not found");
        if (!recipe.archived_at) return recipe;
        recipe.archived_at = null;
        recipe.archived_by = null;
        recipe.updated_at = nowISO();
        recipe.updated_by = actorId;
        recordAudit(db, {
          entity_type: "recipe",
          entity_id: id,
          action: "update",
          performed_by: actorId,
          notes: `Restored "${recipe.recipe_name}" from archive`,
        });
        return recipe;
      }),
    );
  },

  /** All cost-history rows across every recipe (for bulk Excel export). */
  async allCostHistory(): Promise<RecipeCostHistory[]> {
    return delay(
      [...getDb().recipe_cost_history].sort((a, b) =>
        b.changed_at.localeCompare(a.changed_at),
      ),
    );
  },

  /** All recipe ingredient rows joined with their material (bulk export). */
  async allIngredients(): Promise<RecipeIngredientWithMaterial[]> {
    const db = getDb();
    return delay(attachMaterials(db, db.recipe_ingredients));
  },

  /** All recipe→packaging link rows (bulk — for brand-scope derivation). */
  async allPackaging(): Promise<RecipePackaging[]> {
    return delay([...getDb().recipe_packaging]);
  },

  async setImage(id: string, imageUrl: string | null, actorId: string): Promise<Recipe> {
    return delay(
      mutate((db) => {
        const recipe = db.recipes.find((r) => r.id === id);
        if (!recipe) throw new Error("Recipe not found");
        recipe.image_url = imageUrl;
        recipe.updated_at = nowISO();
        recipe.updated_by = actorId;
        return recipe;
      }),
    );
  },

  async setSellingPrice(id: string, price: number | null, actorId: string): Promise<Recipe> {
    return delay(
      mutate((db) => {
        const recipe = db.recipes.find((r) => r.id === id);
        if (!recipe) throw new Error("Recipe not found");
        recipe.selling_price = price;
        recipe.updated_at = nowISO();
        recipe.updated_by = actorId;
        recordAudit(db, {
          entity_type: "recipe",
          entity_id: id,
          action: "update",
          performed_by: actorId,
          notes: `Set menu price for "${recipe.recipe_name}" to ${price ?? "—"}`,
        });
        return recipe;
      }),
    );
  },

  /** Record the final weight after cooking (grams). A measured attribute — it does
   *  NOT bump the version or revert an approved recipe to draft. */
  async setCookedWeight(id: string, grams: number | null, actorId: string): Promise<Recipe> {
    return delay(
      mutate((db) => {
        const recipe = db.recipes.find((r) => r.id === id);
        if (!recipe) throw new Error("Recipe not found");
        recipe.cooked_weight_g = grams;
        recipe.updated_at = nowISO();
        recipe.updated_by = actorId;
        // Cooked weight is a prep's pricing basis — recompute every recipe that uses it.
        cascadeFromPrep(db, id, actorId, "Cooked weight updated");
        recordAudit(db, {
          entity_type: "recipe",
          entity_id: id,
          action: "update",
          performed_by: actorId,
          notes: `Set cooked weight for "${recipe.recipe_name}" to ${grams != null ? `${grams} g` : "—"}`,
        });
        return recipe;
      }),
    );
  },

  async costHistory(id: string): Promise<RecipeCostHistory[]> {
    return delay(
      getDb()
        .recipe_cost_history.filter((h) => h.recipe_id === id)
        .sort((a, b) => b.changed_at.localeCompare(a.changed_at)),
    );
  },

  async versions(id: string): Promise<RecipeVersion[]> {
    return delay(
      getDb()
        .recipe_versions.filter((v) => v.recipe_id === id)
        .sort((a, b) => b.version_no - a.version_no),
    );
  },

  /**
   * Permanently delete a recipe (Admin / Super Admin — capability `recipe.delete`).
   * Takes its size-variant children with it, but is BLOCKED if the recipe (or a
   * child) is used as a sub-recipe component elsewhere — that would corrupt the
   * dependent recipe's cost. Wastage rows keep their cost snapshot (link nulled).
   */
  async remove(id: string, actorId: string): Promise<void> {
    return delay(
      mutate((db) => {
        const recipe = db.recipes.find((r) => r.id === id);
        if (!recipe) throw new Error("Recipe not found");
        // The recipe + its pizza size-variant children are deleted together.
        const ids = new Set<string>([
          id,
          ...db.recipes.filter((r) => r.parent_recipe_id === id).map((r) => r.id),
        ]);
        // Block if any of them is a sub-recipe component of a recipe OUTSIDE the set.
        const usedBy = db.recipe_ingredients.filter(
          (ri) => ri.component_type === "recipe" && ids.has(ri.ingredient_id) && !ids.has(ri.recipe_id),
        );
        if (usedBy.length) {
          const names = [
            ...new Set(
              usedBy
                .map((ri) => db.recipes.find((r) => r.id === ri.recipe_id)?.recipe_name)
                .filter(Boolean),
            ),
          ];
          throw new Error(
            `Can't delete — used as a sub-recipe in ${names.slice(0, 3).join(", ")}${names.length > 3 ? "…" : ""}. Remove it there first.`,
          );
        }
        db.recipes = db.recipes.filter((r) => !ids.has(r.id));
        db.recipe_ingredients = db.recipe_ingredients.filter((ri) => !ids.has(ri.recipe_id));
        db.recipe_versions = db.recipe_versions.filter((v) => !ids.has(v.recipe_id));
        db.recipe_cost_history = db.recipe_cost_history.filter((h) => !ids.has(h.recipe_id ?? ""));
        db.user_recipe_views = db.user_recipe_views.filter((v) => !ids.has(v.recipe_id));
        db.recipe_access_links = db.recipe_access_links.filter((l) => !ids.has(l.recipe_id));
        // Wastage keeps its own cost snapshot; just detach the (now-gone) recipe link.
        db.wastage_entries.forEach((w) => {
          if (w.recipe_id && ids.has(w.recipe_id)) w.recipe_id = null;
        });
        recordAudit(db, {
          entity_type: "recipe",
          entity_id: id,
          action: "delete",
          old_values: { name: recipe.recipe_name },
          performed_by: actorId,
          notes: `Deleted "${recipe.recipe_name}"`,
        });
      }),
    );
  },
};
