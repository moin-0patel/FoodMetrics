-- 0004_packaging_cost.sql
-- Adds a per-portion packaging cost to recipes (box/container), layered on top of
-- the food cost when computing food-cost %, margin, and profit. Defaults to 0 so
-- existing recipes and costing are unchanged.

alter table public.recipes
  add column if not exists packaging_cost decimal(10,2) not null default 0
    check (packaging_cost >= 0);
