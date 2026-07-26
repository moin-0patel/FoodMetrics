-- 0029_recipe_cooked_weight.sql — final weight after cooking (manual).
--
-- total_weight_g is the RAW dish weight, auto-summed from ingredient quantities.
-- cooked_weight_g is the finished weight after cooking, measured and entered by
-- hand (nullable until recorded). The app derives cooking-loss % from the two.
-- Idempotent.

alter table public.recipes
  add column if not exists cooked_weight_g numeric;
