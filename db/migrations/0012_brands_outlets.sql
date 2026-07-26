-- 0012_brands_outlets.sql — dynamic Brands & Outlets (Super-Admin managed).
-- Adds a first-class public.brands table and evolves the existing public.outlets
-- table (0006) to reference it by brand_id, so a Super Admin can add restaurants
-- and outlets from the app with no code change. The two known brands + six
-- outlets reuse their legacy ids so every existing reference keeps resolving.
--
-- The real blocker to a 3rd brand isn't the app — it's the hard-coded
-- CHECK (brand in ('capiche','aiko')) constraints scattered across the schema.
-- This migration drops each and replaces the genuine brand references with a
-- foreign key to brands(id): any new brand id is valid, integrity still holds.
--
-- Run AFTER the base setup (RUN_THIS_ON_SUPABASE.sql). Idempotent / re-runnable.

begin;

-- ── 1. brands ───────────────────────────────────────────────────────────────
create table if not exists public.brands (
  id               text primary key default gen_random_uuid()::text,
  name             text not null,
  normalized_name  text not null,
  brand_code       text not null,
  display_name     text not null default '',
  accent_color     text,
  logo_url         text,
  status           text not null default 'active' check (status in ('active','inactive','archived')),
  notes            text,
  created_by       text,
  created_at       timestamptz not null default now(),
  updated_by       text,
  updated_at       timestamptz not null default now()
);
create unique index if not exists brands_normalized_name_key on public.brands (normalized_name);
create unique index if not exists brands_brand_code_key      on public.brands (brand_code);
create index        if not exists brands_status_idx          on public.brands (status);

-- Seed the two known brands, preserving the legacy ids used across the schema.
insert into public.brands (id, name, normalized_name, brand_code, display_name, accent_color, status, created_at, updated_at) values
  ('capiche', 'Capiche', 'capiche', 'CAP',  'Capiche', '#ed1c24', 'active', now(), now()),
  ('aiko',    'Aiko',    'aiko',    'AIKO', 'Aiko',    '#d4a017', 'active', now(), now())
on conflict (id) do nothing;

-- ── 2. evolve outlets (0006) → brand_id + rich fields + status ───────────────
alter table public.outlets
  add column if not exists brand_id        text,
  add column if not exists normalized_name text,
  add column if not exists outlet_code     text,
  add column if not exists city            text,
  add column if not exists state           text,
  add column if not exists address         text,
  add column if not exists phone           text,
  add column if not exists email           text,
  add column if not exists opening_date    date,
  add column if not exists timezone        text not null default 'Asia/Kolkata',
  add column if not exists status          text not null default 'active',
  add column if not exists manager_user_id text,
  add column if not exists notes           text,
  add column if not exists created_by      text,
  add column if not exists created_at      timestamptz not null default now(),
  add column if not exists updated_by      text,
  add column if not exists updated_at      timestamptz not null default now();

-- The legacy brand CHECK blocks a 3rd brand — drop it; brand becomes optional.
alter table public.outlets drop constraint if exists outlets_brand_check;
alter table public.outlets alter column brand drop not null;

alter table public.outlets drop constraint if exists outlets_status_check;
alter table public.outlets add constraint outlets_status_check check (status in ('active','inactive','archived'));

-- Backfill the new columns from the legacy data for the six seeded outlets.
update public.outlets set brand_id        = brand                        where brand_id is null;
update public.outlets set normalized_name = lower(name)                  where normalized_name is null;
update public.outlets set outlet_code     = upper(replace(id, '-', '_')) where outlet_code is null or outlet_code = '';

alter table public.outlets drop constraint if exists outlets_brand_id_fkey;
alter table public.outlets add constraint outlets_brand_id_fkey
  foreign key (brand_id) references public.brands(id) on delete restrict;

create index if not exists outlets_brand_idx  on public.outlets (brand_id);
create index if not exists outlets_status_idx on public.outlets (status);

-- ── 3. Replace hard-coded brand CHECKs with FKs → brands(id) ─────────────────
-- Each of these CHECK (brand in ('capiche','aiko')) constraints HARD-blocks a new
-- brand. Drop it and, where the column is a genuine brand reference, add an FK.
alter table public.recipes drop constraint if exists recipes_brand_check;
alter table public.recipes drop constraint if exists recipes_brand_fkey;
alter table public.recipes add constraint recipes_brand_fkey
  foreign key (brand) references public.brands(id) on delete restrict;

alter table public.wastage_entries drop constraint if exists wastage_entries_brand_check;
alter table public.wastage_entries drop constraint if exists wastage_entries_brand_fkey;
alter table public.wastage_entries add constraint wastage_entries_brand_fkey
  foreign key (brand) references public.brands(id) on delete restrict;

alter table public.user_profiles drop constraint if exists user_profiles_assigned_brand_check;
alter table public.user_profiles drop constraint if exists user_profiles_assigned_brand_fkey;
alter table public.user_profiles add constraint user_profiles_assigned_brand_fkey
  foreign key (assigned_brand) references public.brands(id) on delete set null;

alter table public.export_history drop constraint if exists export_history_brand_id_check;
alter table public.export_history drop constraint if exists export_history_brand_id_fkey;
alter table public.export_history add constraint export_history_brand_id_fkey
  foreign key (brand_id) references public.brands(id) on delete set null;

alter table public.recipe_access_links drop constraint if exists recipe_access_links_granted_to_brand_id_check;
alter table public.recipe_access_links drop constraint if exists recipe_access_links_granted_to_brand_id_fkey;
alter table public.recipe_access_links add constraint recipe_access_links_granted_to_brand_id_fkey
  foreign key (granted_to_brand_id) references public.brands(id) on delete set null;

-- view_type is a cost-visibility mode (not a brand reference). Just drop the
-- blocking check so a viewer can be scoped to a future brand's recipes.
alter table public.user_recipe_views drop constraint if exists user_recipe_views_view_type_check;

-- ── 4. RLS: Super-Admin-only writes; every authenticated user reads ──────────
alter table public.brands enable row level security;
drop policy if exists brands_read  on public.brands;
drop policy if exists brands_write on public.brands;
create policy brands_read  on public.brands for select to authenticated using (true);
create policy brands_write on public.brands for all to authenticated
  using (public.app_role() = 'super_admin') with check (public.app_role() = 'super_admin');

-- outlets already has RLS + a read policy (0008). Add Super-Admin write.
alter table public.outlets enable row level security;
drop policy if exists outlets_write on public.outlets;
create policy outlets_write on public.outlets for all to authenticated
  using (public.app_role() = 'super_admin') with check (public.app_role() = 'super_admin');

commit;
