-- 0033_remove_seed_data.sql — remove seeded demo/sample data from an OLD project.
--
-- ⚠️  YOU PROBABLY DO NOT NEED THIS FILE.
--
--     It only applies to a Supabase project that was set up with the ORIGINAL
--     RUN_THIS_ON_SUPABASE.sql, which inserted a sample catalog (882 raw
--     materials, ~124 recipes) and two named brands with their outlets.
--
--     If you built your project with SETUP_SUPABASE_CLEAN.sql, no sample data
--     was ever inserted and this script has nothing to do. Running it is
--     harmless — it detects that and exits without changing anything.
--
-- KEEPS: user_profiles, roles, role_capabilities, system_settings, audit_logs.
-- CLEARS: the sample catalog, plus the two seeded brands and their outlets.
--
-- Idempotent and self-guarding: it skips tables that don't exist and exits early
-- when there is no seed data, so it cannot fail on a partial or clean schema.
--
-- ⚠️  DESTRUCTIVE WHEN IT DOES RUN. It deletes recipe and material data that
--     cannot be recovered. Take a Supabase backup first (Database → Backups) if
--     there is any chance the project holds real data you still want.

do $$
declare
  seeded_brands int := 0;
  t text;
  -- Catalog + history tables, child-first. Any that don't exist are skipped.
  targets text[] := array[
    'recipe_cost_history', 'ingredient_price_history', 'recipe_versions',
    'recipe_packaging', 'recipe_ingredients', 'user_recipe_views',
    'recipe_access_links', 'wastage_lines', 'wastage_entries', 'export_history',
    'recipes', 'raw_materials', 'ingredient_yields', 'packaging_items'
  ];
begin
  -- ── 0. Is there anything to do? ────────────────────────────────────────────
  if to_regclass('public.brands') is null then
    raise notice 'Schema not set up (public.brands missing). Run SETUP_SUPABASE_CLEAN.sql first. Nothing done.';
    return;
  end if;

  select count(*) into seeded_brands from public.brands where id in ('capiche', 'aiko');

  if seeded_brands = 0
     and to_regclass('public.raw_materials') is not null
     and not exists (select 1 from public.raw_materials limit 1) then
    raise notice 'No seed data found — this project was set up clean. Nothing to remove.';
    return;
  end if;

  -- ── 1. Rename cost-visibility modes that were named after the two brands ──
  if to_regclass('public.user_recipe_views') is not null then
    update public.user_recipe_views set view_type = 'no_cost'   where view_type = 'capiche';
    update public.user_recipe_views set view_type = 'full_cost' where view_type = 'aiko';
    alter table public.user_recipe_views drop constraint if exists user_recipe_views_view_type_check;
    alter table public.user_recipe_views
      add constraint user_recipe_views_view_type_check
      check (view_type in ('no_cost', 'full_cost'));
  end if;

  -- ── 2. Clear the catalog and its history (skipping absent tables) ─────────
  foreach t in array targets loop
    if to_regclass('public.' || t) is not null then
      execute format('truncate table public.%I restart identity cascade', t);
    end if;
  end loop;

  -- ── 3. Clear user brand/outlet assignments pointing at the seeded records ──
  update public.user_profiles set assigned_brand = null
   where assigned_brand in ('capiche', 'aiko');

  update public.user_profiles set assigned_outlet = null
   where assigned_outlet like 'capiche-%' or assigned_outlet like 'aiko-%';

  update public.user_profiles
     set selected_brand_ids = array(
           select b from unnest(selected_brand_ids) as b where b not in ('capiche', 'aiko'))
   where selected_brand_ids is not null;

  update public.user_profiles
     set accessible_brands = array(
           select b from unnest(accessible_brands) as b where b not in ('capiche', 'aiko'))
   where accessible_brands is not null;

  update public.user_profiles
     set selected_outlet_ids = array(
           select o from unnest(selected_outlet_ids) as o
            where o not like 'capiche-%' and o not like 'aiko-%')
   where selected_outlet_ids is not null;

  -- ── 4. Drop the seeded brands + their outlets (outlets FK to brands) ──────
  if to_regclass('public.outlets') is not null then
    delete from public.outlets where brand_id in ('capiche', 'aiko');
  end if;
  delete from public.brands where id in ('capiche', 'aiko');

  raise notice 'Seed data removed: catalog cleared, % seeded brand(s) and their outlets deleted.', seeded_brands;
end $$;
