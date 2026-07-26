-- 0027_recipe_created_by_name.sql — manually-typed recipe creator label.
--
-- Distinct from created_by (the system user id): a free-text creator name entered
-- by the user (e.g. "Chef Rahul", "Central Kitchen"). Nullable so existing recipes
-- remain valid and stay blank until edited. Idempotent.

alter table public.recipes
  add column if not exists created_by_name text;
