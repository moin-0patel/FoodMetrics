-- 0018_recipe_archive.sql
-- Soft-archive for recipes: retire a recipe from active lists without deleting it,
-- so its cost history and any sub-recipe links stay intact. Independent of the
-- workflow `status` (which is preserved and restored on un-archive).
-- archived_at IS NULL  → the recipe is active (the default for existing rows).

-- archived_by holds the Supabase auth uid of whoever archived it (no FK — see 0008,
-- which dropped the actor-column FKs).
alter table public.recipes
  add column if not exists archived_at timestamptz,
  add column if not exists archived_by uuid;

-- Fast filtering of active vs archived recipes.
create index if not exists recipes_archived_at_idx on public.recipes (archived_at);
