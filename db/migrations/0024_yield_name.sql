-- 0024_yield_name.sql — optional label for a yield record.
-- Nullable; the UI falls back to "<Ingredient> Yield" when blank. Idempotent.

alter table public.ingredient_yields
  add column if not exists name text;
