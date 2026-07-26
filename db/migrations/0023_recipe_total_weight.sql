-- 0023_recipe_total_weight.sql — finished dish weight (grams) on recipes.
--
-- App-maintained column (like total_cost / cost_per_portion): the app recomputes
-- it on every create/edit/price-cascade. This migration adds the column and
-- backfills existing rows so they show a weight immediately, using the same rule
-- as the app: weight units → grams, volume units → millilitres (1:1 with grams),
-- count/piece units → 0 (no intrinsic weight). Idempotent. Safe to re-run.

alter table public.recipes
  add column if not exists total_weight_g numeric;

update public.recipes r
   set total_weight_g = coalesce((
     select round(sum(
       case
         when ri.unit_used = 'KG'    then ri.quantity_used * 1000
         when ri.unit_used = 'Litre' then ri.quantity_used * 1000
         when ri.unit_used in ('Gram', 'ML') then ri.quantity_used
         else 0  -- Piece / Dozen / Packet / Bottle / Can and unknowns: no weight
       end
     ), 2)
     from public.recipe_ingredients ri
     where ri.recipe_id = r.id
   ), 0)
 where total_weight_g is null;
