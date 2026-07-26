// Mock super-admin operations. `wipeCatalog` empties only the operational
// catalog arrays, mirroring the Supabase wipe_catalog() RPC. Users, roles,
// brands, outlets, settings and audit are kept.

import { delay, mutate } from "./db";

export const mockAdminRepo = {
  async wipeCatalog(): Promise<void> {
    return delay(
      mutate((db) => {
        db.recipe_cost_history = [];
        db.ingredient_price_history = [];
        db.recipe_versions = [];
        db.recipe_packaging = [];
        db.recipe_ingredients = [];
        db.user_recipe_views = [];
        db.recipe_access_links = [];
        db.wastage_lines = [];
        db.wastage_entries = [];
        db.export_history = [];
        db.recipes = [];
        db.raw_materials = [];
        db.ingredient_yields = [];
        db.packaging_items = [];
      }),
    );
  },
};
