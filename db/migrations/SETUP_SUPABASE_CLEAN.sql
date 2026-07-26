-- SETUP_SUPABASE_CLEAN.sql - full schema, ZERO sample data.
--
-- Generated from RUN_THIS_ON_SUPABASE.sql with every dummy-catalog INSERT
-- removed. Creates all tables, enums, RLS policies, triggers and functions,
-- and seeds ONLY the six built-in roles + their capabilities (structural).
--
-- It does NOT insert: raw_materials, recipes, recipe_ingredients,
-- ingredient_yields, brands, outlets. The app starts empty, matching
-- buildSeed() in src/lib/data/seed.ts.
--
-- Run this ONCE on a fresh Supabase project (SQL Editor), then run
-- 0034_promote_owner_super_admin.sql after the owner has signed up once.

-- RUN_THIS_ON_SUPABASE.sql — COMPLETE one-shot Supabase setup (auth + data + catalogue).
-- Safe to run on ANY state: fresh project, half-migrated, or already set up.
-- Idempotent (if-not-exists + drop-then-create) and wrapped in ONE transaction.
-- Do NOT run the numbered 0001..0011 files separately; this file replaces them.
-- Prerequisite: Supabase Dashboard > Authentication > Providers > Email = ON.

begin;
-- Recipe Costing & Food Cost Management System — initial schema.
-- Mirrors PRD §9.2 table specs and §9.3 RLS policies. Authored now as the
-- contract the mock data layer mirrors; executed when the Supabase backend is
-- wired in (see plan "Supabase Swap"). Not run against any DB yet.

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------
create table if not exists users (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  email       text not null unique,
  role        text not null check (role in ('super_admin','admin','editor','head_chef','chef','viewer')),
  status      text not null default 'active' check (status in ('active','inactive')),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create table if not exists raw_materials (
  id                 uuid primary key default gen_random_uuid(),
  ingredient_name    text not null unique,
  category           text not null,
  supplier_name      text,
  purchase_price     decimal(10,2) check (purchase_price >= 0),
  purchase_quantity  decimal(10,3) not null check (purchase_quantity > 0),
  purchase_unit      text not null,
  base_unit          text not null,
  -- cost_per_base_unit is GENERATED ALWAYS in Postgres; the mock computes it
  -- in calculateCostPerBaseUnit(). Stored as a plain column here for clarity.
  cost_per_base_unit decimal(10,4),
  last_price_update  date,
  status             text not null default 'active' check (status in ('active','inactive')),
  created_by         uuid references users(id),
  created_at         timestamptz not null default now()
);

create table if not exists recipes (
  id               uuid primary key default gen_random_uuid(),
  -- NOT globally unique: pizzas share a name across size variants (11"/15").
  -- New-recipe name uniqueness is enforced at the app layer, which excludes variants.
  recipe_name      text not null,
  category         text not null,
  brand            text not null check (brand in ('capiche','aiko')),
  description      text,
  image_url        text,
  preparation_time integer check (preparation_time > 0),
  serving_size     integer not null check (serving_size > 0),
  status           text not null default 'draft' check (status in ('draft','testing','approved','rejected')),
  total_cost       decimal(10,2),
  cost_per_portion decimal(10,2),
  selling_price    decimal(10,2),
  wastage_pct      decimal(5,2) not null default 0,
  is_prep          boolean not null default false,
  yield_quantity   decimal(10,3) not null default 1,
  yield_unit       text not null default 'Gram',
  created_by       uuid references users(id),
  approved_by      uuid references users(id),
  approved_at      timestamptz,
  rejection_note   text,
  version_no       integer not null default 1,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  updated_by       uuid references users(id)
);

create table if not exists recipe_ingredients (
  id              uuid primary key default gen_random_uuid(),
  recipe_id       uuid not null references recipes(id) on delete cascade,
  -- component_type 'material' → ingredient_id references raw_materials(id);
  -- 'recipe' → it references recipes(id) (an in-house prep used as a component).
  ingredient_id   uuid not null,
  component_type  text not null default 'material' check (component_type in ('material','recipe')),
  -- Allow 0 (optional/garnish lines are seeded with 0 quantity; the app permits it).
  quantity_used   decimal(10,3) not null check (quantity_used >= 0),
  unit_used       text not null,
  calculated_cost decimal(10,2),
  sort_order      integer not null default 0
);

create table if not exists recipe_cost_history (
  id                   uuid primary key default gen_random_uuid(),
  recipe_id            uuid references recipes(id) on delete cascade,
  old_total_cost       decimal(10,2),
  new_total_cost       decimal(10,2),
  old_cost_per_portion decimal(10,2),
  new_cost_per_portion decimal(10,2),
  change_reason        text,
  changed_by           uuid references users(id),
  changed_at           timestamptz not null default now()
);

create table if not exists ingredient_price_history (
  id                     uuid primary key default gen_random_uuid(),
  ingredient_id          uuid references raw_materials(id) on delete cascade,
  old_price              decimal(10,2),
  new_price              decimal(10,2),
  old_cost_per_base_unit decimal(10,4),
  new_cost_per_base_unit decimal(10,4),
  changed_by             uuid references users(id),
  changed_at             timestamptz not null default now()
);

create table if not exists recipe_versions (
  id          uuid primary key default gen_random_uuid(),
  recipe_id   uuid references recipes(id) on delete cascade,
  version_no  integer not null,
  snapshot    jsonb,
  notes       text,
  created_by  uuid references users(id),
  created_at  timestamptz not null default now()
);

create table if not exists user_recipe_views (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references users(id) on delete cascade,
  recipe_id   uuid not null references recipes(id) on delete cascade,
  view_type   text not null check (view_type in ('capiche','aiko')),
  assigned_by uuid references users(id),
  assigned_at timestamptz not null default now(),
  unique (user_id, recipe_id)
);

create table if not exists audit_logs (
  id           uuid primary key default gen_random_uuid(),
  entity_type  text not null,
  entity_id    uuid not null,
  action       text not null,
  old_values   jsonb,
  new_values   jsonb,
  performed_by uuid references users(id),
  performed_at timestamptz not null default now(),
  notes        text
);

create table if not exists system_settings (
  id         uuid primary key default gen_random_uuid(),
  key        text not null unique,
  value      text,
  updated_by uuid references users(id),
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Row Level Security (PRD §9.3) — replicated client-side in permissions.ts
-- ---------------------------------------------------------------------------
alter table recipes enable row level security;
alter table raw_materials enable row level security;
alter table audit_logs enable row level security;

-- Drop-then-create so re-running this bundle never hits "policy already exists".
drop policy if exists viewer_recipe_access on recipes;
drop policy if exists editor_ingredient_access on raw_materials;
drop policy if exists admin_only_audit on audit_logs;

-- Viewers see only approved recipes assigned to them.
create policy viewer_recipe_access on recipes
  for select using (
    auth.uid() in (
      select user_id from user_recipe_views where recipe_id = recipes.id
    ) and status = 'approved'
  );

-- Raw materials: only admin/editor.
create policy editor_ingredient_access on raw_materials
  for all using (
    (select role from users where id = auth.uid()) in ('admin','editor')
  );

-- Audit logs: admin only.
create policy admin_only_audit on audit_logs
  for select using (
    (select role from users where id = auth.uid()) = 'admin'
  );
-- 0004_packaging_cost.sql
-- Adds a per-portion packaging cost to recipes (box/container), layered on top of
-- the food cost when computing food-cost %, margin, and profit. Defaults to 0 so
-- existing recipes and costing are unchanged.

alter table public.recipes
  add column if not exists packaging_cost decimal(10,2) not null default 0
    check (packaging_cost >= 0);
-- 0005_ingredient_yields.sql
-- Standard yield (preparation-loss) data per ingredient. The full purchase cost
-- is distributed across the USABLE quantity → yield_adjusted_unit_cost. This is
-- the contract the mock/localStorage layer (src/lib/data/mock/yields.ts) mirrors.

create table if not exists public.ingredient_yields (
  id                       uuid primary key default gen_random_uuid(),
  ingredient_id            uuid not null references raw_materials(id) on delete cascade,
  purchase_cost            decimal(10,2) not null check (purchase_cost >= 0),
  purchase_quantity        decimal(10,3) not null check (purchase_quantity > 0),
  purchase_unit            text not null,
  raw_quantity             decimal(12,3) not null check (raw_quantity > 0),
  raw_unit                 text not null,
  wastage_quantity         decimal(12,3) not null check (wastage_quantity >= 0),
  wastage_unit             text not null,
  usable_quantity          decimal(12,3) not null check (usable_quantity > 0),
  wastage_percentage       decimal(5,2)  not null,
  yield_percentage         decimal(5,2)  not null,
  original_unit_cost       decimal(12,6) not null,
  yield_adjusted_unit_cost decimal(12,6) not null,
  effective_from           date not null default current_date,
  notes                    text,
  created_by               uuid references users(id),
  created_at               timestamptz not null default now(),
  updated_at               timestamptz not null default now(),
  -- Wastage can never reach or exceed the raw quantity (usable must stay > 0).
  constraint wastage_below_raw check (wastage_quantity < raw_quantity),
  -- One yield record per ingredient per effective date.
  unique (ingredient_id, effective_from)
);

create index if not exists ingredient_yields_ingredient_idx on public.ingredient_yields (ingredient_id);

alter table public.ingredient_yields enable row level security;
-- Staff (admin/editor) manage yield; everyone authenticated may read.
drop policy if exists "ingredient_yields_read" on public.ingredient_yields;
create policy "ingredient_yields_read" on public.ingredient_yields for select using (true);
-- 0006_wastage.sql
-- Operational wastage tracking across outlets (§11–§14). Kept SEPARATE from the
-- Yield Management master data. Mirrors src/lib/data/mock/wastage.ts + the OUTLETS
-- constant in src/lib/data/types.ts.

create table if not exists public.outlets (
  id    text primary key,
  brand text not null check (brand in ('capiche','aiko')),
  name  text not null
);

create table if not exists public.wastage_entries (
  id            uuid primary key default gen_random_uuid(),
  wastage_date  date not null,
  brand         text not null check (brand in ('capiche','aiko')),
  outlet_id     text not null references outlets(id),
  wastage_type  text not null,
  item_type     text not null check (item_type in ('ingredient','recipe')),
  ingredient_id uuid references raw_materials(id) on delete set null,
  recipe_id     uuid references recipes(id) on delete set null,
  quantity      decimal(12,3) not null check (quantity > 0),
  unit          text not null,
  unit_cost     decimal(12,4) not null check (unit_cost >= 0),
  total_cost    decimal(12,2) not null check (total_cost >= 0),
  reason        text,
  department    text not null,
  shift         text,
  entered_by    uuid references users(id),
  approved_by   uuid references users(id),
  notes         text,
  attachment_url text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index if not exists wastage_outlet_date_idx on public.wastage_entries (outlet_id, wastage_date);
create index if not exists wastage_brand_date_idx  on public.wastage_entries (brand, wastage_date);

alter table public.wastage_entries enable row level security;
drop policy if exists "wastage_read" on public.wastage_entries;
create policy "wastage_read" on public.wastage_entries for select using (true);
-- 0007_user_profiles.sql — user profiles for SUPABASE AUTH (Phase 1).
--
-- Auth is Supabase (email/password). Each profile row is keyed on auth.users(id),
-- so RLS uses the native auth.uid(). A row is auto-created on sign-up by the
-- handle_new_user trigger (role 'viewer', approved=false → pending). The on_sign_in()
-- RPC stamps last_login, mirrors email-verification from auth.users, and promotes
-- VERIFIED owner emails to Admin. Re-runnable.
--
-- PREREQUISITES (Supabase dashboard, once):
--   • Authentication → Providers → Email = enabled.
--   • (Optional) turn "Confirm email" on/off per your preference.
--   • Run 0001..0006 if you want the rest of the schema; this file is self-contained
--     for the users feature (only needs auth + gen_random_uuid).
--
-- This supersedes the legacy public.profiles (0002); that table is left untouched/unused.

do $$ begin
  create type app_role as enum ('super_admin','admin','editor','head_chef','chef','viewer');
exception when duplicate_object then null; end $$;
-- Existing DBs (enum already created without super_admin): add the value. Safe/idempotent.
-- NOTE: if this file is run inside a single transaction on an OLD database, run this one
-- line by itself FIRST (Postgres can't use a newly-added enum value later in the same tx).
alter type app_role add value if not exists 'super_admin';

do $$ begin
  create type app_account_status as enum ('active','inactive');
exception when duplicate_object then null; end $$;

create table if not exists public.user_profiles (
  id                uuid primary key references auth.users(id) on delete cascade,
  email             text not null,
  name              text not null default '',
  role              app_role not null default 'viewer',
  status            app_account_status not null default 'active',
  approved          boolean not null default false,   -- self sign-ups start unapproved
  email_verified    boolean not null default false,
  phone             text,
  avatar_url        text,
  assigned_brand    text check (assigned_brand in ('capiche','aiko')),
  assigned_outlet   text,
  accessible_brands text[],
  show_cost         boolean,
  dashboard_access  boolean not null default false,
  theme_pref        text,
  last_login        timestamptz,
  last_role_update  timestamptz,
  role_updated_by   text,
  created_by        text,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

alter table public.user_profiles enable row level security;

-- Recursion-safe admin check.
create or replace function public.is_app_admin()
returns boolean language sql security definer stable
set search_path = public as $$
  select exists (
    select 1 from public.user_profiles
    where id = auth.uid() and role = 'admin' and status = 'active'
  )
$$;

-- ── RLS ──
drop policy if exists user_profiles_select        on public.user_profiles;
drop policy if exists user_profiles_insert_admin  on public.user_profiles;
drop policy if exists user_profiles_update_admin  on public.user_profiles;
drop policy if exists user_profiles_update_own    on public.user_profiles;
drop policy if exists user_profiles_no_delete     on public.user_profiles;

create policy user_profiles_select on public.user_profiles
  for select to authenticated
  using (id = auth.uid() or public.is_app_admin());

create policy user_profiles_insert_admin on public.user_profiles
  for insert to authenticated
  with check (public.is_app_admin());

create policy user_profiles_update_admin on public.user_profiles
  for update to authenticated
  using (public.is_app_admin()) with check (public.is_app_admin());

-- NOTE: there is intentionally NO broad "update your own row" policy. A non-admin
-- editing their profile goes through update_own_profile() (safe columns only), so
-- role/status/approval/scope can never be touched on a self-update at the RLS layer
-- — not merely caught by a trigger after the fact.

-- No client deletes (deactivate via status='inactive').
create policy user_profiles_no_delete on public.user_profiles
  for delete to authenticated using (false);

-- ── Guard triggers (§28) ──

-- A non-admin cannot escalate their own role/status/approval/scope.
create or replace function public.prevent_profile_self_escalation()
returns trigger language plpgsql security definer
set search_path = public as $$
begin
  -- Defense-in-depth behind update_own_profile(): a non-admin can never change any
  -- privileged field on their own row, even if a future policy exposes the table.
  if new.id = auth.uid() and not public.is_app_admin()
     and row(new.role, new.status, new.approved, new.assigned_brand, new.assigned_outlet, new.dashboard_access)
         is distinct from
         row(old.role, old.status, old.approved, old.assigned_brand, old.assigned_outlet, old.dashboard_access) then
    raise exception 'cannot change your own role/status/approval/scope';
  end if;
  return new;
end $$;

drop trigger if exists trg_user_profiles_no_self_escalation on public.user_profiles;
create trigger trg_user_profiles_no_self_escalation
  before update on public.user_profiles
  for each row execute function public.prevent_profile_self_escalation();

-- Never demote/disable the last active Admin (advisory-locked against races).
create or replace function public.prevent_last_admin_removal()
returns trigger language plpgsql security definer
set search_path = public as $$
begin
  if old.role = 'admin' and old.status = 'active'
     and (new.role <> 'admin' or new.status <> 'active') then
    perform pg_advisory_xact_lock(hashtext('user_profiles_last_admin'));
    if (select count(*) from public.user_profiles where role = 'admin' and status = 'active') <= 1 then
      raise exception 'cannot remove the last remaining Admin';
    end if;
  end if;
  return new;
end $$;

drop trigger if exists trg_user_profiles_last_admin on public.user_profiles;
create trigger trg_user_profiles_last_admin
  before update on public.user_profiles
  for each row execute function public.prevent_last_admin_removal();

-- Touch updated_at + stamp role-change history.
create or replace function public.user_profiles_touch()
returns trigger language plpgsql
set search_path = public as $$
begin
  new.updated_at = now();
  if new.role is distinct from old.role then
    new.last_role_update = now();
  end if;
  return new;
end $$;

drop trigger if exists trg_user_profiles_touch on public.user_profiles;
create trigger trg_user_profiles_touch
  before update on public.user_profiles
  for each row execute function public.user_profiles_touch();

-- ── Auto-create a profile when a Supabase auth user is created ──
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer
set search_path = public as $$
begin
  insert into public.user_profiles (id, email, name, email_verified)
  values (
    new.id,
    coalesce(new.email, ''),
    coalesce(new.raw_user_meta_data ->> 'name', split_part(coalesce(new.email,''), '@', 1)),
    coalesce(new.email_confirmed_at is not null, false)
  )
  on conflict (id) do nothing;
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ── Sign-in RPC ──
-- Called by the app after a successful sign-in. Reads the trusted email +
-- confirmation from auth.users (SECURITY DEFINER), stamps last_login, mirrors
-- email_verified, auto-promotes a VERIFIED owner email to Admin, and self-heals a
-- missing profile row. Returns the profile.
create or replace function public.on_sign_in()
returns public.user_profiles
language plpgsql security definer set search_path = public as $$
declare
  v_email     text;
  v_confirmed boolean;
  v_owner     boolean;
  v_row       public.user_profiles;
begin
  if auth.uid() is null then raise exception 'not authenticated'; end if;
  -- Serialize concurrent sign-ins for the same user (owner promotion + stamping).
  perform pg_advisory_xact_lock(hashtext('on_sign_in_' || auth.uid()::text));
  select email, (email_confirmed_at is not null) into v_email, v_confirmed
    from auth.users where id = auth.uid();
  v_owner := coalesce(v_confirmed,false) and lower(coalesce(v_email,'')) in
    ('reservation.bookends@gmail.com','moin.bookends@gmail.com');

  update public.user_profiles set
    last_login     = now(),
    email_verified = coalesce(v_confirmed,false),
    role           = case when v_owner then 'super_admin'::app_role else role end,
    approved       = case when v_owner then true else approved end
  where id = auth.uid()
  returning * into v_row;

  if not found then
    insert into public.user_profiles (id, email, name, role, approved, email_verified, last_login)
    values (
      auth.uid(), coalesce(v_email,''), split_part(coalesce(v_email,''), '@', 1),
      case when v_owner then 'super_admin'::app_role else 'viewer'::app_role end,
      v_owner, coalesce(v_confirmed,false), now()
    )
    returning * into v_row;
  end if;

  if v_row.status = 'inactive' then
    raise exception 'Your account has been disabled. Please contact an administrator.';
  end if;
  return v_row;
end $$;

grant execute on function public.on_sign_in() to authenticated;

-- ── Safe self-edit RPC ──
-- The only way a non-admin can write to their own row: updates display fields only
-- (name/phone/avatar/theme). Role/status/approval/scope are untouchable here.
create or replace function public.update_own_profile(
  p_name       text default null,
  p_phone      text default null,
  p_avatar_url text default null,
  p_theme_pref text default null
)
returns public.user_profiles
language plpgsql security definer set search_path = public as $$
declare v_row public.user_profiles;
begin
  if auth.uid() is null then raise exception 'not authenticated'; end if;
  update public.user_profiles set
    name       = coalesce(p_name, name),
    phone      = coalesce(p_phone, phone),
    avatar_url = coalesce(p_avatar_url, avatar_url),
    theme_pref = coalesce(p_theme_pref, theme_pref)
  where id = auth.uid()
  returning * into v_row;
  if not found then raise exception 'profile not found'; end if;
  return v_row;
end $$;

grant execute on function public.update_own_profile(text, text, text, text) to authenticated;

-- ── One-time bootstrap (optional) ──
-- Owners auto-promote (once their email is confirmed) via on_sign_in(). To promote
-- anyone else: update public.user_profiles set role='admin', approved=true,
--   status='active' where lower(email)='someone@example.com';
-- 0008_data_layer.sql — Phase 2: bring the data tables in line with the current app
-- and move authorization onto Supabase RLS keyed to public.user_profiles (0007).
--
-- Run AFTER 0001, 0004, 0005, 0006 and 0007. Re-runnable. Assumes Supabase Auth
-- (0007). The legacy public.users table from 0001 is no longer used — actor columns
-- (created_by/updated_by/etc.) now hold the Supabase auth uid, so we drop their FKs
-- to public.users.

-- ── 1. Schema alignment (columns added this session) ───────────────────────
alter table public.recipes
  add column if not exists method            text[] not null default '{}',
  add column if not exists parent_recipe_id  uuid references public.recipes(id) on delete set null,
  add column if not exists size_code         text check (size_code in ('11_INCH','15_INCH')),
  add column if not exists size_label        text;

-- recipe_name is intentionally NOT globally unique — pizza size variants (11"/15")
-- share a name. Drop the legacy unique constraint from 0001 on existing databases.
alter table public.recipes drop constraint if exists recipes_recipe_name_key;

alter table public.raw_materials
  add column if not exists notes text;

alter table public.recipe_ingredients
  add column if not exists wastage_override_pct decimal(5,2),
  add column if not exists cut_type             text;

-- recipe_ingredients.quantity_used may be 0 (optional/garnish lines). Relax the
-- legacy CHECK (> 0) from 0001 to (>= 0) on existing databases.
alter table public.recipe_ingredients drop constraint if exists recipe_ingredients_quantity_used_check;
alter table public.recipe_ingredients add constraint recipe_ingredients_quantity_used_check check (quantity_used >= 0);

alter table public.wastage_entries
  add column if not exists done_by text;

-- audit_logs.entity_id holds app entity ids INCLUDING non-uuid markers (e.g. the
-- literal 'import' for bulk operations), so it must be text, not uuid.
alter table public.audit_logs alter column entity_id type text using entity_id::text;

create index if not exists recipes_parent_idx on public.recipes (parent_recipe_id);

-- ── 2. Drop legacy FKs to public.users (actor columns now hold auth uids) ───
do $$
declare r record;
begin
  for r in
    select conname, conrelid::regclass as tbl
    from pg_constraint
    where contype = 'f'
      and confrelid = 'public.users'::regclass
  loop
    execute format('alter table %s drop constraint if exists %I', r.tbl, r.conname);
  end loop;
exception when undefined_table then
  null; -- public.users may not exist on a fresh Supabase project
end $$;

-- ── 3. Authorization helpers (SECURITY DEFINER → no RLS recursion) ─────────
create or replace function public.app_role()
returns text language sql security definer stable set search_path = public as $$
  select role::text from public.user_profiles where id = auth.uid()
$$;

-- Materials + yields (pricing) are admin/editor only.
create or replace function public.can_write_catalog()
returns boolean language sql security definer stable set search_path = public as $$
  select public.app_role() in ('super_admin','admin','editor')
$$;

-- Recipes may also be edited by Head Chef (not ingredient pricing).
create or replace function public.can_edit_recipes()
returns boolean language sql security definer stable set search_path = public as $$
  select public.app_role() in ('super_admin','admin','editor','head_chef')
$$;

-- Operational (wastage) data: admin/editor/head_chef.
create or replace function public.can_access_outlet(p_outlet text)
returns boolean language sql security definer stable set search_path = public as $$
  select public.app_role() in ('super_admin','admin','editor','head_chef')
$$;

-- Brands a viewer may see (mirrors viewerBrands()): null accessible_brands = all.
create or replace function public.viewer_can_see_brand(p_brand text)
returns boolean language sql security definer stable set search_path = public as $$
  select exists (
    select 1 from public.user_profiles up
    where up.id = auth.uid()
      and (up.accessible_brands is null or p_brand = any(up.accessible_brands))
  )
$$;

-- ── 4. RLS: raw_materials ──────────────────────────────────────────────────
alter table public.raw_materials enable row level security;
drop policy if exists editor_ingredient_access on public.raw_materials;
drop policy if exists raw_materials_read  on public.raw_materials;
drop policy if exists raw_materials_write on public.raw_materials;
create policy raw_materials_read  on public.raw_materials for select to authenticated using (true);
create policy raw_materials_write on public.raw_materials for all    to authenticated
  using (public.can_write_catalog()) with check (public.can_write_catalog());

-- ── 5. RLS: recipes ────────────────────────────────────────────────────────
alter table public.recipes enable row level security;
drop policy if exists viewer_recipe_access on public.recipes;
drop policy if exists recipes_read  on public.recipes;
drop policy if exists recipes_write on public.recipes;
-- Staff roles see everything; viewer/chef see only approved recipes in their brands.
create policy recipes_read on public.recipes for select to authenticated using (
  public.app_role() in ('super_admin','admin','editor','head_chef')
  or (public.app_role() in ('viewer','chef') and status = 'approved' and public.viewer_can_see_brand(brand))
);
create policy recipes_write on public.recipes for all to authenticated
  using (public.can_edit_recipes()) with check (public.can_edit_recipes());

-- ── 6. RLS: recipe_ingredients (follow the parent recipe's authority) ──────
alter table public.recipe_ingredients enable row level security;
drop policy if exists recipe_ingredients_read  on public.recipe_ingredients;
drop policy if exists recipe_ingredients_write on public.recipe_ingredients;
create policy recipe_ingredients_read on public.recipe_ingredients for select to authenticated using (true);
create policy recipe_ingredients_write on public.recipe_ingredients for all to authenticated
  using (public.can_edit_recipes()) with check (public.can_edit_recipes());

-- ── 7. RLS: ingredient_yields ──────────────────────────────────────────────
alter table public.ingredient_yields enable row level security;
drop policy if exists "ingredient_yields_read" on public.ingredient_yields;
drop policy if exists ingredient_yields_read   on public.ingredient_yields;
drop policy if exists ingredient_yields_write  on public.ingredient_yields;
create policy ingredient_yields_read  on public.ingredient_yields for select to authenticated using (true);
create policy ingredient_yields_write on public.ingredient_yields for all to authenticated
  using (public.can_write_catalog()) with check (public.can_write_catalog());

-- ── 8. RLS: outlets (master data — read-only to clients) ───────────────────
alter table public.outlets enable row level security;
drop policy if exists outlets_read on public.outlets;
create policy outlets_read on public.outlets for select to authenticated using (true);

-- ── 9. RLS: wastage_entries (outlet-scoped) ────────────────────────────────
alter table public.wastage_entries enable row level security;
drop policy if exists "wastage_read" on public.wastage_entries;
drop policy if exists wastage_read    on public.wastage_entries;
drop policy if exists wastage_insert  on public.wastage_entries;
drop policy if exists wastage_update  on public.wastage_entries;
drop policy if exists wastage_delete  on public.wastage_entries;
create policy wastage_read   on public.wastage_entries for select to authenticated
  using (public.can_access_outlet(outlet_id));
create policy wastage_insert on public.wastage_entries for insert to authenticated
  with check (public.app_role() in ('super_admin','admin','editor','head_chef'));
create policy wastage_update on public.wastage_entries for update to authenticated
  using (public.can_access_outlet(outlet_id)) with check (public.can_access_outlet(outlet_id));
create policy wastage_delete on public.wastage_entries for delete to authenticated
  using (public.app_role() in ('super_admin','admin','editor'));

-- ── 10. RLS: history / versions / audit / settings ─────────────────────────
alter table public.recipe_cost_history     enable row level security;
alter table public.ingredient_price_history enable row level security;
alter table public.recipe_versions          enable row level security;
alter table public.audit_logs                enable row level security;
alter table public.system_settings           enable row level security;
alter table public.user_recipe_views         enable row level security;

drop policy if exists recipe_cost_history_rw on public.recipe_cost_history;
create policy recipe_cost_history_rw on public.recipe_cost_history for all to authenticated
  using (true) with check (public.can_edit_recipes());

drop policy if exists ingredient_price_history_rw on public.ingredient_price_history;
create policy ingredient_price_history_rw on public.ingredient_price_history for all to authenticated
  using (true) with check (public.can_write_catalog());

drop policy if exists recipe_versions_rw on public.recipe_versions;
create policy recipe_versions_rw on public.recipe_versions for all to authenticated
  using (true) with check (public.can_edit_recipes());

drop policy if exists admin_only_audit on public.audit_logs;
drop policy if exists audit_read   on public.audit_logs;
drop policy if exists audit_insert on public.audit_logs;
-- Admins read the audit trail; any authenticated action may append to it.
create policy audit_read   on public.audit_logs for select to authenticated using (public.app_role() in ('super_admin','admin'));
create policy audit_insert on public.audit_logs for insert to authenticated with check (true);

drop policy if exists settings_read  on public.system_settings;
drop policy if exists settings_write on public.system_settings;
create policy settings_read  on public.system_settings for select to authenticated using (true);
create policy settings_write on public.system_settings for all to authenticated
  using (public.app_role() in ('super_admin','admin')) with check (public.app_role() in ('super_admin','admin'));

drop policy if exists user_recipe_views_read  on public.user_recipe_views;
drop policy if exists user_recipe_views_write on public.user_recipe_views;
create policy user_recipe_views_read on public.user_recipe_views for select to authenticated
  using (user_id = auth.uid() or public.can_edit_recipes());
create policy user_recipe_views_write on public.user_recipe_views for all to authenticated
  using (public.can_edit_recipes()) with check (public.can_edit_recipes());
-- 0010_export_history.sql
-- §9 Export audit: one row per successful PDF / Excel / CSV export. Exporter identity
-- and timestamp are snapshotted at export time. Mirrors src/lib/data/types.ts
-- (ExportHistory) + src/lib/data/mock/exports.ts. The id is client-generated so the
-- app can upsert idempotently (ignore duplicates) and never log the same export twice.

create table if not exists public.export_history (
  id                      uuid primary key,
  exported_by_user_id     uuid references users(id) on delete set null,
  exporter_name_snapshot  text not null,
  exporter_email_snapshot text,
  exporter_role_snapshot  text not null check (exporter_role_snapshot in ('super_admin','admin','editor','head_chef','chef','viewer')),
  export_type             text not null,
  entity_type             text not null check (entity_type in ('recipe','report')),
  entity_id               uuid,
  recipe_name_snapshot    text,
  report_name             text,
  brand_id                text check (brand_id in ('capiche','aiko')),
  outlet_id               text,
  filters_used            text,
  file_format             text not null check (file_format in ('pdf','csv','xlsx')),
  exported_at             timestamptz not null default now(),
  timezone                text not null default 'Asia/Kolkata',
  status                  text not null default 'success' check (status in ('success','failed'))
);

create index if not exists export_history_exported_at_idx on public.export_history (exported_at desc);
create index if not exists export_history_user_idx        on public.export_history (exported_by_user_id);

alter table public.export_history enable row level security;
-- Any authenticated user may insert their own export rows; admins read all.
drop policy if exists "export_history_insert" on public.export_history;
create policy "export_history_insert" on public.export_history
  for insert with check (auth.uid() = exported_by_user_id or exported_by_user_id is null);
-- Admins read all; every user may read their own export rows.
drop policy if exists "export_history_read_admin" on public.export_history;
create policy "export_history_read_admin" on public.export_history
  for select using (
    exported_by_user_id = auth.uid()
    or exists (select 1 from public.user_profiles p where p.id = auth.uid() and p.role = 'admin')
  );
-- 0011_recipe_access_links.sql
-- §11–§19 Temporary, read-only recipe share links. Only the SHA-256 hash of the token
-- is stored (never the raw token). Expiry (30 min) + revocation must be enforced when
-- the token is resolved. Mirrors src/lib/data/types.ts (RecipeAccessLink) +
-- src/lib/data/mock/accessLinks.ts.
--
-- Public resolution (an unauthenticated visitor opening /share/:token) must go through
-- a SECURITY DEFINER function / edge function that: looks the row up by token_hash,
-- rejects expired/revoked links, strips all financial columns, increments access_count,
-- and returns only the recipe payload. Direct table SELECT stays admin-only via RLS.

create table if not exists public.recipe_access_links (
  id                   uuid primary key,
  token_hash           text not null unique,
  recipe_id            uuid not null references recipes(id) on delete cascade,
  granted_by_user_id   uuid references users(id) on delete set null,
  granted_by_name      text not null,
  granted_by_role      text not null check (granted_by_role in ('super_admin','admin','editor','head_chef','chef','viewer')),
  granted_to_user_id   uuid references users(id) on delete set null,
  granted_to_email     text,
  granted_to_role      text check (granted_to_role in ('super_admin','admin','editor','head_chef','chef','viewer')),
  granted_to_brand_id  text check (granted_to_brand_id in ('capiche','aiko')),
  granted_to_outlet_id text,
  access_type          text not null check (access_type in ('READ_ONLY','DOWNLOAD_PDF','VIEW_AND_DOWNLOAD')),
  created_at           timestamptz not null default now(),
  expires_at           timestamptz not null,
  revoked_at           timestamptz,
  revoked_by_user_id   uuid references users(id) on delete set null,
  last_accessed_at     timestamptz,
  access_count         integer not null default 0,
  status               text not null default 'ACTIVE' check (status in ('ACTIVE','EXPIRED','REVOKED'))
);

create index if not exists access_links_token_idx  on public.recipe_access_links (token_hash);
create index if not exists access_links_recipe_idx on public.recipe_access_links (recipe_id);

alter table public.recipe_access_links enable row level security;
-- Direct reads are admin-only (public visitors go through the resolver function, not SELECT).
drop policy if exists "access_links_admin_read" on public.recipe_access_links;
create policy "access_links_admin_read" on public.recipe_access_links
  for select using (
    exists (select 1 from public.user_profiles p where p.id = auth.uid() and p.role = 'admin')
  );
drop policy if exists "access_links_grantor_manage" on public.recipe_access_links;
create policy "access_links_grantor_manage" on public.recipe_access_links
  for all using (auth.uid() = granted_by_user_id) with check (auth.uid() = granted_by_user_id);

-- Server-side token resolver. A SECURITY DEFINER function is the ONLY way a public
-- (anon) visitor reads a shared recipe: it hashes the raw token, enforces expiry +
-- revocation on the server, strips every financial column, increments the access
-- counter, and returns just the read-only recipe payload. Direct SELECT stays blocked
-- by RLS, so expiry can never be bypassed from the client.
create extension if not exists pgcrypto;

create or replace function public.resolve_share_link(p_token text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_hash   text := encode(digest(p_token, 'sha256'), 'hex');
  v_link   public.recipe_access_links%rowtype;
  v_recipe public.recipes%rowtype;
  v_status text;
begin
  select * into v_link from public.recipe_access_links where token_hash = v_hash;
  if not found then
    return jsonb_build_object('status', 'REVOKED'); -- unknown/tampered token → unusable
  end if;

  if v_link.revoked_at is not null then
    v_status := 'REVOKED';
  elsif v_link.expires_at <= now() then
    v_status := 'EXPIRED';
  else
    v_status := 'ACTIVE';
  end if;

  update public.recipe_access_links set status = v_status where id = v_link.id;
  if v_status <> 'ACTIVE' then
    return jsonb_build_object('status', v_status);
  end if;

  select * into v_recipe from public.recipes where id = v_link.recipe_id;
  if not found then
    return jsonb_build_object('status', 'REVOKED');
  end if;

  update public.recipe_access_links
     set access_count = access_count + 1, last_accessed_at = now()
   where id = v_link.id;

  return jsonb_build_object(
    'status', 'ACTIVE',
    'access_type', v_link.access_type,
    'granted_by_name', v_link.granted_by_name,
    'brand', v_recipe.brand,
    -- Strip financial + costing columns server-side — they never leave the database.
    'recipe', (to_jsonb(v_recipe) - 'total_cost' - 'cost_per_portion' - 'packaging_cost' - 'selling_price' - 'wastage_pct'),
    'ingredients', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', ri.id,
        'component_type', ri.component_type,
        'quantity_used', ri.quantity_used,
        'unit_used', ri.unit_used,
        'sub_recipe', (ri.component_type = 'recipe'),
        'ingredient_name', case when ri.component_type = 'recipe' then sr.recipe_name else rm.ingredient_name end
      ) order by ri.sort_order)
      from public.recipe_ingredients ri
      left join public.raw_materials rm on rm.id = ri.ingredient_id and ri.component_type <> 'recipe'
      left join public.recipes sr on sr.id = ri.ingredient_id and ri.component_type = 'recipe'
      where ri.recipe_id = v_recipe.id
    ), '[]'::jsonb)
  );
end;
$$;

grant execute on function public.resolve_share_link(text) to anon, authenticated;
-- (Sample-catalog seed removed: no raw materials, recipes, yields, brands
--  or outlets are inserted. The app starts empty and users create their own.)






-- ===========================================================================
-- 0012_brands_outlets.sql — dynamic Brands & Outlets (Super-Admin managed).
-- Spliced into the one-shot setup so a fresh project gets brands/outlets too.
-- ===========================================================================

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

alter table public.outlets drop constraint if exists outlets_brand_check;
alter table public.outlets alter column brand drop not null;
alter table public.outlets drop constraint if exists outlets_status_check;
alter table public.outlets add constraint outlets_status_check check (status in ('active','inactive','archived'));

update public.outlets set brand_id        = brand                        where brand_id is null;
update public.outlets set normalized_name = lower(name)                  where normalized_name is null;
update public.outlets set outlet_code     = upper(replace(id, '-', '_')) where outlet_code is null or outlet_code = '';

alter table public.outlets drop constraint if exists outlets_brand_id_fkey;
alter table public.outlets add constraint outlets_brand_id_fkey
  foreign key (brand_id) references public.brands(id) on delete restrict;
create index if not exists outlets_brand_idx  on public.outlets (brand_id);
create index if not exists outlets_status_idx on public.outlets (status);

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

alter table public.user_recipe_views drop constraint if exists user_recipe_views_view_type_check;

alter table public.brands enable row level security;
drop policy if exists brands_read  on public.brands;
drop policy if exists brands_write on public.brands;
create policy brands_read  on public.brands for select to authenticated using (true);
create policy brands_write on public.brands for all to authenticated
  using (public.app_role() = 'super_admin') with check (public.app_role() = 'super_admin');

alter table public.outlets enable row level security;
drop policy if exists outlets_write on public.outlets;
create policy outlets_write on public.outlets for all to authenticated
  using (public.app_role() = 'super_admin') with check (public.app_role() = 'super_admin');

-- ===========================================================================
-- 0013_role_scopes.sql — per-user brand & outlet access scopes (§19–§20).
-- ===========================================================================
alter table public.user_profiles
  add column if not exists brand_scope         text,
  add column if not exists selected_brand_ids  text[],
  add column if not exists outlet_scope         text,
  add column if not exists selected_outlet_ids  text[];

alter table public.user_profiles drop constraint if exists user_profiles_brand_scope_check;
alter table public.user_profiles add constraint user_profiles_brand_scope_check
  check (brand_scope is null or brand_scope in ('ALL_BRANDS','SELECTED_BRANDS','ASSIGNED_BRAND'));

alter table public.user_profiles drop constraint if exists user_profiles_outlet_scope_check;
alter table public.user_profiles add constraint user_profiles_outlet_scope_check
  check (outlet_scope is null or outlet_scope in ('ALL_OUTLETS','ALL_OUTLETS_IN_BRAND','SELECTED_OUTLETS','ASSIGNED_OUTLET','NO_OUTLET_ACCESS'));

-- ===========================================================================
-- 0014_super_admin_limits.sql — protected Super Admin count (§14–§17).
-- ===========================================================================
create or replace function public.prevent_super_admin_limits()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  active_supers int;
  owners text[] := array['reservation.bookends@gmail.com','moin.bookends@gmail.com'];
begin
  perform pg_advisory_xact_lock(hashtext('user_profiles_super_admin_limit'));

  if TG_OP = 'INSERT' then
    if new.role = 'super_admin' and new.status = 'active' and coalesce(new.approved, true)
       and lower(coalesce(new.email, '')) <> all(owners) then
      select count(*) into active_supers from public.user_profiles
        where role = 'super_admin' and status = 'active' and coalesce(approved, true);
      if active_supers >= 5 then
        raise exception 'A maximum of 5 active Super Admin users is allowed. Remove or demote an existing Super Admin before assigning another.';
      end if;
    end if;
    return new;
  end if;

  if (new.role = 'super_admin' and new.status = 'active' and coalesce(new.approved, true))
     and not (old.role = 'super_admin' and old.status = 'active' and coalesce(old.approved, true))
     and lower(coalesce(new.email, '')) <> all(owners) then
    select count(*) into active_supers from public.user_profiles
      where id <> new.id and role = 'super_admin' and status = 'active' and coalesce(approved, true);
    if active_supers >= 5 then
      raise exception 'A maximum of 5 active Super Admin users is allowed. Remove or demote an existing Super Admin before assigning another.';
    end if;
  end if;

  if (old.role = 'super_admin' and old.status = 'active' and coalesce(old.approved, true))
     and not (new.role = 'super_admin' and new.status = 'active' and coalesce(new.approved, true)) then
    select count(*) into active_supers from public.user_profiles
      where id <> new.id and role = 'super_admin' and status = 'active' and coalesce(approved, true);
    if active_supers < 1 then
      raise exception 'This action cannot be completed because the system must retain at least one active Super Admin.';
    end if;
  end if;

  return new;
end $$;

drop trigger if exists trg_user_profiles_super_admin_limits on public.user_profiles;
create trigger trg_user_profiles_super_admin_limits
  before insert or update on public.user_profiles
  for each row execute function public.prevent_super_admin_limits();

-- ===========================================================================
-- 0015_rbac_and_integrity_fixes.sql — RBAC (super_admin) + integrity fixes.
-- (create-or-replace overrides the earlier definitions in this transaction.)
-- ===========================================================================
create or replace function public.is_app_admin()
returns boolean language sql security definer stable set search_path = public as $$
  select exists (
    select 1 from public.user_profiles
    where id = auth.uid() and role in ('admin','super_admin') and status = 'active'
  )
$$;

create or replace function public.is_app_super_admin()
returns boolean language sql security definer stable set search_path = public as $$
  select exists (
    select 1 from public.user_profiles
    where id = auth.uid() and role = 'super_admin' and status = 'active'
  )
$$;

create or replace function public.prevent_super_admin_limits()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  active_supers int;
  owners text[] := array['reservation.bookends@gmail.com','moin.bookends@gmail.com'];
  target_is_owner boolean;
begin
  perform pg_advisory_xact_lock(hashtext('user_profiles_super_admin_limit'));
  target_is_owner := lower(coalesce(new.email, '')) = any(owners);

  if TG_OP = 'INSERT' then
    if new.role = 'super_admin' then
      if not target_is_owner and not public.is_app_super_admin() then
        raise exception 'Only a Super Admin can manage Super Admin users';
      end if;
      if new.status = 'active' and coalesce(new.approved, true) and not target_is_owner then
        select count(*) into active_supers from public.user_profiles
          where role = 'super_admin' and status = 'active' and coalesce(approved, true);
        if active_supers >= 5 then
          raise exception 'A maximum of 5 active Super Admin users is allowed. Remove or demote an existing Super Admin before assigning another.';
        end if;
      end if;
    end if;
    return new;
  end if;

  if not target_is_owner
     and (new.role = 'super_admin'
          or (old.role = 'super_admin'
              and row(new.role, new.status, new.approved) is distinct from row(old.role, old.status, old.approved)))
     and not public.is_app_super_admin() then
    raise exception 'Only a Super Admin can manage Super Admin users';
  end if;

  if (new.role = 'super_admin' and new.status = 'active' and coalesce(new.approved, true))
     and not (old.role = 'super_admin' and old.status = 'active' and coalesce(old.approved, true))
     and not target_is_owner then
    select count(*) into active_supers from public.user_profiles
      where id <> new.id and role = 'super_admin' and status = 'active' and coalesce(approved, true);
    if active_supers >= 5 then
      raise exception 'A maximum of 5 active Super Admin users is allowed. Remove or demote an existing Super Admin before assigning another.';
    end if;
  end if;

  if (old.role = 'super_admin' and old.status = 'active' and coalesce(old.approved, true))
     and not (new.role = 'super_admin' and new.status = 'active' and coalesce(new.approved, true)) then
    select count(*) into active_supers from public.user_profiles
      where id <> new.id and role = 'super_admin' and status = 'active' and coalesce(approved, true);
    if active_supers < 1 then
      raise exception 'This action cannot be completed because the system must retain at least one active Super Admin.';
    end if;
  end if;

  return new;
end $$;

drop trigger if exists trg_user_profiles_super_admin_limits on public.user_profiles;
create trigger trg_user_profiles_super_admin_limits
  before insert or update on public.user_profiles
  for each row execute function public.prevent_super_admin_limits();

create unique index if not exists outlets_outlet_code_key    on public.outlets (outlet_code);
create unique index if not exists outlets_brand_normname_key on public.outlets (brand_id, normalized_name);

create or replace function public.resolve_share_link(p_token text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_hash   text := encode(digest(p_token, 'sha256'), 'hex');
  v_link   public.recipe_access_links%rowtype;
  v_recipe public.recipes%rowtype;
  v_status text;
begin
  select * into v_link from public.recipe_access_links where token_hash = v_hash;
  if not found then return jsonb_build_object('status', 'REVOKED'); end if;
  if v_link.revoked_at is not null then v_status := 'REVOKED';
  elsif v_link.expires_at <= now() then v_status := 'EXPIRED';
  else v_status := 'ACTIVE'; end if;
  update public.recipe_access_links set status = v_status where id = v_link.id;
  if v_status <> 'ACTIVE' then return jsonb_build_object('status', v_status); end if;
  select * into v_recipe from public.recipes where id = v_link.recipe_id;
  if not found then return jsonb_build_object('status', 'REVOKED'); end if;
  update public.recipe_access_links set access_count = access_count + 1, last_accessed_at = now() where id = v_link.id;
  return jsonb_build_object(
    'status', 'ACTIVE',
    'access_type', v_link.access_type,
    'granted_by_name', v_link.granted_by_name,
    'brand', coalesce((select display_name from public.brands where id = v_recipe.brand),
                      (select name from public.brands where id = v_recipe.brand),
                      v_recipe.brand),
    'recipe', (to_jsonb(v_recipe) - 'total_cost' - 'cost_per_portion' - 'packaging_cost' - 'selling_price' - 'wastage_pct'),
    'ingredients', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', ri.id,
        'component_type', ri.component_type,
        'quantity_used', ri.quantity_used,
        'unit_used', ri.unit_used,
        'sub_recipe', (ri.component_type = 'recipe'),
        'ingredient_name', case when ri.component_type = 'recipe' then sr.recipe_name else rm.ingredient_name end
      ) order by ri.sort_order)
      from public.recipe_ingredients ri
      left join public.raw_materials rm on rm.id = ri.ingredient_id and ri.component_type <> 'recipe'
      left join public.recipes sr on sr.id = ri.ingredient_id and ri.component_type = 'recipe'
      where ri.recipe_id = v_recipe.id
    ), '[]'::jsonb)
  );
end;
$$;


-- ===================================================================
-- 0016_roles.sql — dynamic custom roles + capability RLS (spliced)
-- ===================================================================
-- ── 1. Tables ───────────────────────────────────────────────────────────────
create table if not exists public.roles (
  key         text primary key,
  label       text not null,
  description text,
  is_system   boolean not null default false,
  protected   boolean not null default false,
  sort_order  int not null default 100,
  created_by  text,
  created_at  timestamptz not null default now(),
  updated_by  text,
  updated_at  timestamptz not null default now()
);

create table if not exists public.role_capabilities (
  role_key   text not null references public.roles(key) on delete cascade,
  capability text not null,
  primary key (role_key, capability)
);

-- ── 2. Seed the six built-in roles + their capabilities (matches permissions.ts) ─
insert into public.roles (key, label, description, is_system, protected, sort_order) values
  ('super_admin', 'Super Admin', 'Full system control, incl. roles, brands & outlets. Protected.', true, true, 10),
  ('admin',       'Admin',       'Manage users, recipes, materials, pricing, approvals & reports.',  true, true, 20),
  ('editor',      'Editor',      'Create/edit recipes, materials, pricing, yield & wastage.',        true, false, 30),
  ('head_chef',   'Head Chef',   'Edit recipes, record wastage & grant viewer access (no pricing).', true, false, 40),
  ('chef',        'Chef',        'Read-only access to approved recipes.',                            true, false, 50),
  ('viewer',      'Viewer',      'Read-only access to approved recipes in their brands.',            true, false, 60)
on conflict (key) do nothing;

insert into public.role_capabilities (role_key, capability)
select 'super_admin', c from (values
  ('user.manage'),('material.view'),('material.edit'),('yield.manage'),('wastage.create'),
  ('recipe.create'),('recipe.editAll'),('recipe.delete'),('recipe.duplicate'),('recipe.submit'),
  ('recipe.approve'),('recipe.viewAll'),('viewer.assign'),('settings.manage'),('report.excel'),
  ('audit.view'),('role.manage'),('brand.create'),('brand.edit'),('brand.archive'),
  ('outlet.create'),('outlet.edit'),('outlet.change_brand'),('outlet.archive')
) as t(c)
on conflict do nothing;

insert into public.role_capabilities (role_key, capability)
select 'admin', c from (values
  ('user.manage'),('material.view'),('material.edit'),('yield.manage'),('wastage.create'),
  ('recipe.create'),('recipe.editAll'),('recipe.delete'),('recipe.duplicate'),('recipe.submit'),
  ('recipe.approve'),('recipe.viewAll'),('viewer.assign'),('settings.manage'),('report.excel'),('audit.view')
) as t(c)
on conflict do nothing;

insert into public.role_capabilities (role_key, capability)
select 'editor', c from (values
  ('material.view'),('material.edit'),('yield.manage'),('wastage.create'),('recipe.create'),
  ('recipe.editAll'),('recipe.duplicate'),('recipe.submit'),('recipe.viewAll'),('viewer.assign'),('report.excel')
) as t(c)
on conflict do nothing;

insert into public.role_capabilities (role_key, capability)
select 'head_chef', c from (values
  ('material.view'),('yield.manage'),('wastage.create'),('recipe.create'),('recipe.editAll'),
  ('recipe.duplicate'),('recipe.submit'),('recipe.viewAll'),('viewer.assign'),('report.excel')
) as t(c)
on conflict do nothing;
-- chef + viewer: no capabilities (read-only), so no rows.

-- ── 3. Guard triggers: built-in roles are read-only from the app ────────────
-- (Gated on auth.uid() so the migration itself — run as postgres, uid null — can
-- seed system-role rows; app writes carry a uid and are blocked.)
create or replace function public.prevent_system_role_change()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then return coalesce(new, old); end if; -- migration/service context
  if TG_OP = 'DELETE' then
    if old.is_system then raise exception 'Built-in roles cannot be deleted'; end if;
    return old;
  end if;
  if old.is_system and (new.key is distinct from old.key
      or new.is_system is distinct from old.is_system
      or new.protected is distinct from old.protected) then
    raise exception 'Built-in roles cannot be modified';
  end if;
  return new;
end $$;

drop trigger if exists trg_roles_protect on public.roles;
create trigger trg_roles_protect
  before update or delete on public.roles
  for each row execute function public.prevent_system_role_change();

create or replace function public.prevent_system_role_caps_change()
returns trigger language plpgsql security definer set search_path = public as $$
declare k text := coalesce(new.role_key, old.role_key);
begin
  if auth.uid() is not null
     and exists (select 1 from public.roles where key = k and is_system) then
    raise exception 'Built-in role capabilities cannot be changed';
  end if;
  return coalesce(new, old);
end $$;

drop trigger if exists trg_role_caps_protect on public.role_capabilities;
create trigger trg_role_caps_protect
  before insert or update or delete on public.role_capabilities
  for each row execute function public.prevent_system_role_caps_change();

-- ── 4. RLS: read to any authenticated user (needed to hydrate the capability
--        map); writes to Super Admins only (system power stays reserved) ──────
alter table public.roles enable row level security;
alter table public.role_capabilities enable row level security;

drop policy if exists roles_read on public.roles;
create policy roles_read on public.roles for select to authenticated using (true);
drop policy if exists roles_write on public.roles;
create policy roles_write on public.roles for all to authenticated
  using (public.is_app_super_admin()) with check (public.is_app_super_admin());

drop policy if exists role_caps_read on public.role_capabilities;
create policy role_caps_read on public.role_capabilities for select to authenticated using (true);
drop policy if exists role_caps_write on public.role_capabilities;
create policy role_caps_write on public.role_capabilities for all to authenticated
  using (public.is_app_super_admin()) with check (public.is_app_super_admin());

-- ── 5. user_profiles.role: relax the enum → text + FK to roles(key) ─────────
-- Two policies reference user_profiles.role DIRECTLY (in a subquery), which
-- Postgres tracks as a dependency and refuses to alter the column type while
-- they exist. Drop them here and recreate them via is_app_admin() in section 7
-- (function-based → no direct dependency, and it also lets super_admin + a
-- custom role granted audit.view read — which the old 'admin'-only check didn't).
drop policy if exists "export_history_read_admin" on public.export_history;
drop policy if exists "access_links_admin_read"  on public.recipe_access_links;

alter table public.user_profiles alter column role drop default;
alter table public.user_profiles alter column role type text using role::text;
alter table public.user_profiles alter column role set default 'viewer';
do $$ begin
  alter table public.user_profiles
    add constraint user_profiles_role_fkey foreign key (role) references public.roles(key);
exception when duplicate_object then null; end $$;

-- on_sign_in() used 'super_admin'::app_role casts — recreate with text now that
-- role is a text column (owners still auto-promote to super_admin on sign-in).
create or replace function public.on_sign_in()
returns public.user_profiles
language plpgsql security definer set search_path = public as $$
declare
  v_email     text;
  v_confirmed boolean;
  v_owner     boolean;
  v_row       public.user_profiles;
begin
  if auth.uid() is null then raise exception 'not authenticated'; end if;
  perform pg_advisory_xact_lock(hashtext('on_sign_in_' || auth.uid()::text));
  select email, (email_confirmed_at is not null) into v_email, v_confirmed
    from auth.users where id = auth.uid();
  v_owner := coalesce(v_confirmed,false) and lower(coalesce(v_email,'')) in
    ('reservation.bookends@gmail.com','moin.bookends@gmail.com');

  update public.user_profiles set
    last_login     = now(),
    email_verified = coalesce(v_confirmed,false),
    role           = case when v_owner then 'super_admin' else role end,
    approved       = case when v_owner then true else approved end
  where id = auth.uid()
  returning * into v_row;

  if not found then
    insert into public.user_profiles (id, email, name, role, approved, email_verified, last_login)
    values (
      auth.uid(), coalesce(v_email,''), split_part(coalesce(v_email,''), '@', 1),
      case when v_owner then 'super_admin' else 'viewer' end,
      v_owner, coalesce(v_confirmed,false), now()
    )
    returning * into v_row;
  end if;

  if v_row.status = 'inactive' then
    raise exception 'Your account has been disabled. Please contact an administrator.';
  end if;
  return v_row;
end $$;

-- ── 6. Capability check used by RLS: does the current user's role hold p_cap? ─
create or replace function public.has_cap(p_cap text)
returns boolean language sql security definer stable set search_path = public as $$
  select public.is_app_super_admin() or exists (
    select 1
    from public.role_capabilities rc
    join public.user_profiles up on up.id = auth.uid()
    where rc.role_key = up.role and rc.capability = p_cap
  )
$$;
grant execute on function public.has_cap(text) to authenticated;

-- ── 6b. Atomic role upsert — row + capability replace in ONE transaction ─────
-- The app calls this RPC instead of separate table writes, so a role is never
-- left capability-less on a partial failure. Super-Admin-only; built-in roles
-- can't be edited; reserved capabilities are dropped (they're a no-op server-side).
create or replace function public.upsert_role(
  p_key text, p_label text, p_description text, p_caps text[], p_is_create boolean
) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_app_super_admin() then
    raise exception 'Only a Super Admin can manage roles';
  end if;
  if p_is_create then
    insert into public.roles (key, label, description, is_system, protected, sort_order, created_by, updated_by)
    values (p_key, p_label, p_description, false, false, 100, auth.uid()::text, auth.uid()::text);
  else
    if exists (select 1 from public.roles where key = p_key and is_system) then
      raise exception 'Built-in roles cannot be edited';
    end if;
    update public.roles
      set label = p_label, description = p_description, updated_by = auth.uid()::text, updated_at = now()
      where key = p_key;
    if not found then raise exception 'Role not found'; end if;
  end if;
  delete from public.role_capabilities where role_key = p_key;
  insert into public.role_capabilities (role_key, capability)
    select p_key, c from unnest(coalesce(p_caps, '{}'::text[])) as c
    where c not in (
      'user.manage','role.manage',
      'brand.create','brand.edit','brand.archive',
      'outlet.create','outlet.edit','outlet.change_brand','outlet.archive'
    );
end $$;
grant execute on function public.upsert_role(text, text, text, text[], boolean) to authenticated;

-- ── 7. Additive capability grants on existing RLS (built-ins unchanged) ──────
drop policy if exists raw_materials_write on public.raw_materials;
create policy raw_materials_write on public.raw_materials for all to authenticated
  using (public.can_write_catalog() or public.has_cap('material.edit'))
  with check (public.can_write_catalog() or public.has_cap('material.edit'));

drop policy if exists recipes_read on public.recipes;
create policy recipes_read on public.recipes for select to authenticated using (
  public.app_role() in ('super_admin','admin','editor','head_chef')
  or public.has_cap('recipe.viewAll')
  or (public.app_role() in ('viewer','chef') and status = 'approved' and public.viewer_can_see_brand(brand))
);
drop policy if exists recipes_write on public.recipes;
create policy recipes_write on public.recipes for all to authenticated
  using (public.can_edit_recipes() or public.has_cap('recipe.editAll'))
  with check (public.can_edit_recipes() or public.has_cap('recipe.editAll'));

drop policy if exists recipe_ingredients_write on public.recipe_ingredients;
create policy recipe_ingredients_write on public.recipe_ingredients for all to authenticated
  using (public.can_edit_recipes() or public.has_cap('recipe.editAll'))
  with check (public.can_edit_recipes() or public.has_cap('recipe.editAll'));

drop policy if exists ingredient_yields_write on public.ingredient_yields;
create policy ingredient_yields_write on public.ingredient_yields for all to authenticated
  using (public.can_write_catalog() or public.has_cap('yield.manage'))
  with check (public.can_write_catalog() or public.has_cap('yield.manage'));

drop policy if exists wastage_read on public.wastage_entries;
create policy wastage_read on public.wastage_entries for select to authenticated
  using (public.can_access_outlet(outlet_id) or public.has_cap('wastage.create'));
drop policy if exists wastage_insert on public.wastage_entries;
create policy wastage_insert on public.wastage_entries for insert to authenticated
  with check (public.app_role() in ('super_admin','admin','editor','head_chef') or public.has_cap('wastage.create'));
drop policy if exists wastage_update on public.wastage_entries;
create policy wastage_update on public.wastage_entries for update to authenticated
  using (public.can_access_outlet(outlet_id) or public.has_cap('wastage.create'))
  with check (public.can_access_outlet(outlet_id) or public.has_cap('wastage.create'));

drop policy if exists audit_read on public.audit_logs;
create policy audit_read on public.audit_logs for select to authenticated
  using (public.app_role() in ('super_admin','admin') or public.has_cap('audit.view'));

drop policy if exists settings_write on public.system_settings;
create policy settings_write on public.system_settings for all to authenticated
  using (public.app_role() in ('super_admin','admin') or public.has_cap('settings.manage'))
  with check (public.app_role() in ('super_admin','admin') or public.has_cap('settings.manage'));

drop policy if exists recipe_cost_history_rw on public.recipe_cost_history;
create policy recipe_cost_history_rw on public.recipe_cost_history for all to authenticated
  using (true) with check (public.can_edit_recipes() or public.has_cap('recipe.editAll'));

drop policy if exists ingredient_price_history_rw on public.ingredient_price_history;
create policy ingredient_price_history_rw on public.ingredient_price_history for all to authenticated
  using (true) with check (public.can_write_catalog() or public.has_cap('material.edit'));

drop policy if exists recipe_versions_rw on public.recipe_versions;
create policy recipe_versions_rw on public.recipe_versions for all to authenticated
  using (true) with check (public.can_edit_recipes() or public.has_cap('recipe.editAll'));

drop policy if exists user_recipe_views_read on public.user_recipe_views;
create policy user_recipe_views_read on public.user_recipe_views for select to authenticated
  using (user_id = auth.uid() or public.can_edit_recipes() or public.has_cap('recipe.editAll'));
drop policy if exists user_recipe_views_write on public.user_recipe_views;
create policy user_recipe_views_write on public.user_recipe_views for all to authenticated
  using (public.can_edit_recipes() or public.has_cap('recipe.editAll'))
  with check (public.can_edit_recipes() or public.has_cap('recipe.editAll'));

-- Recreate the two policies dropped in section 5 — now dependency-free (they call
-- is_app_admin() instead of referencing user_profiles.role), recognising
-- super_admin and any custom role granted audit.view.
drop policy if exists "export_history_read_admin" on public.export_history;
create policy "export_history_read_admin" on public.export_history
  for select using (
    exported_by_user_id = auth.uid() or public.is_app_admin() or public.has_cap('audit.view')
  );

drop policy if exists "access_links_admin_read" on public.recipe_access_links;
create policy "access_links_admin_read" on public.recipe_access_links
  for select using (public.is_app_admin() or public.has_cap('audit.view'));

-- ── 8. Relax role-snapshot CHECKs so a custom role can export / share ────────
-- These columns store the actor's role NAME historically; keep them as tolerant
-- text (the UI resolves unknown keys via roleLabel()). Not FK'd — deleting a
-- custom role must never break old audit/snapshot rows.
alter table public.export_history      drop constraint if exists export_history_exporter_role_snapshot_check;
alter table public.recipe_access_links drop constraint if exists recipe_access_links_granted_by_role_check;
alter table public.recipe_access_links drop constraint if exists recipe_access_links_granted_to_role_check;


-- ===================================================================
-- 0017_lock_brands_outlets.sql — brands/outlets read-only (spliced)
-- ===================================================================
-- ── 1. Application writes to brands/outlets are rejected with a clear message ──
-- Gated on auth.uid() so migrations / service-role seeding (uid IS NULL) still run
-- and re-runs of the setup bundle are safe; any authenticated app write is blocked.
create or replace function public.prevent_brand_outlet_writes()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is not null then
    raise exception 'Brand and outlet management is not available in this application.';
  end if;
  return coalesce(new, old);
end $$;

drop trigger if exists trg_brands_readonly on public.brands;
create trigger trg_brands_readonly
  before insert or update or delete on public.brands
  for each row execute function public.prevent_brand_outlet_writes();

drop trigger if exists trg_outlets_readonly on public.outlets;
create trigger trg_outlets_readonly
  before insert or update or delete on public.outlets
  for each row execute function public.prevent_brand_outlet_writes();

-- ── 2. Drop the removed brand/outlet management capabilities from every role ───
-- (They no longer exist in the app; this stops them lingering in role_capabilities
--  and ensures has_cap() can never grant them.)
delete from public.role_capabilities
 where capability in (
   'brand.create', 'brand.edit', 'brand.archive',
   'outlet.create', 'outlet.edit', 'outlet.change_brand', 'outlet.archive'
 );


-- ===================================================================
-- 0018_recipe_archive.sql — soft-archive for recipes (spliced)
-- ===================================================================
-- Retire a recipe from active lists without deleting it, so its cost history and
-- any sub-recipe links stay intact. Independent of the workflow `status` (which is
-- preserved and restored on un-archive). archived_at IS NULL → active.
-- archived_by holds the Supabase auth uid (no FK — see 0008).
alter table public.recipes
  add column if not exists archived_at timestamptz,
  add column if not exists archived_by uuid;
create index if not exists recipes_archived_at_idx on public.recipes (archived_at);


-- ===================================================================
-- 0019_owner_transfer.sql — mspatel05831 becomes sole owner (spliced)
-- ===================================================================
-- Re-list the single owner in on_sign_in() auto-promotion + Super-Admin exemption,
-- promote mspatel if present, and remove the four decommissioned accounts. These
-- create-or-replace/DML statements run last so they override the earlier owner
-- lists spliced above.
create or replace function public.on_sign_in()
returns public.user_profiles
language plpgsql security definer set search_path = public as $$
declare
  v_email     text;
  v_confirmed boolean;
  v_owner     boolean;
  v_row       public.user_profiles;
begin
  if auth.uid() is null then raise exception 'not authenticated'; end if;
  perform pg_advisory_xact_lock(hashtext('on_sign_in_' || auth.uid()::text));
  select email, (email_confirmed_at is not null) into v_email, v_confirmed
    from auth.users where id = auth.uid();
  v_owner := coalesce(v_confirmed,false) and lower(coalesce(v_email,'')) in
    ('mspatel05831@gmail.com');

  update public.user_profiles set
    last_login     = now(),
    email_verified = coalesce(v_confirmed,false),
    role           = case when v_owner then 'super_admin' else role end,
    approved       = case when v_owner then true else approved end
  where id = auth.uid()
  returning * into v_row;

  if not found then
    insert into public.user_profiles (id, email, name, role, approved, email_verified, last_login)
    values (
      auth.uid(), coalesce(v_email,''), split_part(coalesce(v_email,''), '@', 1),
      case when v_owner then 'super_admin' else 'viewer' end,
      v_owner, coalesce(v_confirmed,false), now()
    )
    returning * into v_row;
  end if;

  if v_row.status = 'inactive' then
    raise exception 'Your account has been disabled. Please contact an administrator.';
  end if;
  return v_row;
end $$;

create or replace function public.prevent_super_admin_limits()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  active_supers int;
  owners text[] := array['mspatel05831@gmail.com'];
  target_is_owner boolean;
begin
  perform pg_advisory_xact_lock(hashtext('user_profiles_super_admin_limit'));
  target_is_owner := lower(coalesce(new.email, '')) = any(owners);

  if TG_OP = 'INSERT' then
    if new.role = 'super_admin' then
      if not target_is_owner and not public.is_app_super_admin() then
        raise exception 'Only a Super Admin can manage Super Admin users';
      end if;
      if new.status = 'active' and coalesce(new.approved, true) and not target_is_owner then
        select count(*) into active_supers from public.user_profiles
          where role = 'super_admin' and status = 'active' and coalesce(approved, true);
        if active_supers >= 5 then
          raise exception 'A maximum of 5 active Super Admin users is allowed. Remove or demote an existing Super Admin before assigning another.';
        end if;
      end if;
    end if;
    return new;
  end if;

  if not target_is_owner
     and (new.role = 'super_admin'
          or (old.role = 'super_admin'
              and row(new.role, new.status, new.approved) is distinct from row(old.role, old.status, old.approved)))
     and not public.is_app_super_admin() then
    raise exception 'Only a Super Admin can manage Super Admin users';
  end if;

  if (new.role = 'super_admin' and new.status = 'active' and coalesce(new.approved, true))
     and not (old.role = 'super_admin' and old.status = 'active' and coalesce(old.approved, true))
     and not target_is_owner then
    select count(*) into active_supers from public.user_profiles
      where id <> new.id and role = 'super_admin' and status = 'active' and coalesce(approved, true);
    if active_supers >= 5 then
      raise exception 'A maximum of 5 active Super Admin users is allowed. Remove or demote an existing Super Admin before assigning another.';
    end if;
  end if;

  if (old.role = 'super_admin' and old.status = 'active' and coalesce(old.approved, true))
     and not (new.role = 'super_admin' and new.status = 'active' and coalesce(new.approved, true)) then
    select count(*) into active_supers from public.user_profiles
      where id <> new.id and role = 'super_admin' and status = 'active' and coalesce(approved, true);
    if active_supers < 1 then
      raise exception 'This action cannot be completed because the system must retain at least one active Super Admin.';
    end if;
  end if;

  return new;
end $$;

update public.user_profiles
   set role = 'super_admin', status = 'active', approved = true
 where lower(email) = 'mspatel05831@gmail.com';

delete from auth.users
 where lower(email) in (
   'moin.bookends@gmail.com','reservation.bookends@gmail.com','main.1@gmail.com','admin@bookends.app'
 );
delete from public.user_profiles
 where lower(email) in (
   'moin.bookends@gmail.com','reservation.bookends@gmail.com','main.1@gmail.com','admin@bookends.app'
 );


-- ===================================================================
-- 0020_fix_share_link_digest.sql — share links: fix digest() lookup (spliced)
-- ===================================================================
-- pgcrypto's digest() lives in the `extensions` schema on Supabase; add it to the
-- resolver's search_path so token hashing works (was failing with
-- "function digest(text, unknown) does not exist").
create extension if not exists pgcrypto with schema extensions;

create or replace function public.resolve_share_link(p_token text)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_hash   text := encode(digest(p_token, 'sha256'), 'hex');
  v_link   public.recipe_access_links%rowtype;
  v_recipe public.recipes%rowtype;
  v_status text;
begin
  select * into v_link from public.recipe_access_links where token_hash = v_hash;
  if not found then
    return jsonb_build_object('status', 'REVOKED');
  end if;

  if v_link.revoked_at is not null then
    v_status := 'REVOKED';
  elsif v_link.expires_at <= now() then
    v_status := 'EXPIRED';
  else
    v_status := 'ACTIVE';
  end if;

  update public.recipe_access_links set status = v_status where id = v_link.id;
  if v_status <> 'ACTIVE' then
    return jsonb_build_object('status', v_status);
  end if;

  select * into v_recipe from public.recipes where id = v_link.recipe_id;
  if not found then
    return jsonb_build_object('status', 'REVOKED');
  end if;

  update public.recipe_access_links
     set access_count = access_count + 1, last_accessed_at = now()
   where id = v_link.id;

  return jsonb_build_object(
    'status', 'ACTIVE',
    'access_type', v_link.access_type,
    'granted_by_name', v_link.granted_by_name,
    'brand', v_recipe.brand,
    'recipe', (to_jsonb(v_recipe) - 'total_cost' - 'cost_per_portion' - 'packaging_cost' - 'selling_price' - 'wastage_pct'),
    'ingredients', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', ri.id,
        'component_type', ri.component_type,
        'quantity_used', ri.quantity_used,
        'unit_used', ri.unit_used,
        'sub_recipe', (ri.component_type = 'recipe'),
        'ingredient_name', case when ri.component_type = 'recipe' then sr.recipe_name else rm.ingredient_name end
      ) order by ri.sort_order)
      from public.recipe_ingredients ri
      left join public.raw_materials rm on rm.id = ri.ingredient_id and ri.component_type <> 'recipe'
      left join public.recipes sr on sr.id = ri.ingredient_id and ri.component_type = 'recipe'
      where ri.recipe_id = v_recipe.id
    ), '[]'::jsonb)
  );
end;
$$;
grant execute on function public.resolve_share_link(text) to anon, authenticated;

-- ── 0028_wipe_catalog.sql — Super-Admin "wipe all catalog data" RPC ──────────
-- Deletes the entire operational catalog (recipes / prep, ingredient lines, raw
-- materials, yields, packaging, wastage, cost/price history). KEEPS user_profiles,
-- roles, role_capabilities, brands, outlets, system_settings, audit_logs.
create or replace function public.wipe_catalog()
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_app_super_admin() then
    raise exception 'Only a Super Admin can wipe catalog data';
  end if;

  truncate table
    public.recipe_cost_history,
    public.ingredient_price_history,
    public.recipe_versions,
    public.recipe_packaging,
    public.recipe_ingredients,
    public.user_recipe_views,
    public.recipe_access_links,
    public.wastage_lines,
    public.wastage_entries,
    public.export_history,
    public.recipes,
    public.raw_materials,
    public.ingredient_yields,
    public.packaging_items
    restart identity cascade;

  begin
    insert into public.audit_logs (entity_type, entity_id, action, performed_by, notes)
    values ('system', auth.uid(), 'delete', auth.uid(),
            'Wiped all catalog data (recipes, materials, yields, packaging, wastage)');
  exception when others then null;
  end;
end;
$$;
revoke all on function public.wipe_catalog() from public, anon;
grant execute on function public.wipe_catalog() to authenticated;

-- ── 0029_recipe_cooked_weight.sql — final weight after cooking (manual) ──────
alter table public.recipes
  add column if not exists cooked_weight_g numeric;

-- ── 0030_user_can_import.sql — per-user Data Import access grant ─────────────
alter table public.user_profiles
  add column if not exists can_import boolean not null default false;

-- ── 0032_user_can_manage_wastage.sql — per-user Wastage Management access grant ─
alter table public.user_profiles
  add column if not exists can_manage_wastage boolean not null default false;

-- ── 0031_share_link_sub_recipes.sql — sub-recipe breakdown in shared payload ─
create or replace function public.resolve_share_link(p_token text)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_hash   text := encode(digest(p_token, 'sha256'), 'hex');
  v_link   public.recipe_access_links%rowtype;
  v_recipe public.recipes%rowtype;
  v_status text;
begin
  select * into v_link from public.recipe_access_links where token_hash = v_hash;
  if not found then
    return jsonb_build_object('status', 'REVOKED');
  end if;

  if v_link.revoked_at is not null then
    v_status := 'REVOKED';
  elsif v_link.expires_at <= now() then
    v_status := 'EXPIRED';
  else
    v_status := 'ACTIVE';
  end if;

  update public.recipe_access_links set status = v_status where id = v_link.id;
  if v_status <> 'ACTIVE' then
    return jsonb_build_object('status', v_status);
  end if;

  select * into v_recipe from public.recipes where id = v_link.recipe_id;
  if not found then
    return jsonb_build_object('status', 'REVOKED');
  end if;

  update public.recipe_access_links
     set access_count = access_count + 1, last_accessed_at = now()
   where id = v_link.id;

  return jsonb_build_object(
    'status', 'ACTIVE',
    'access_type', v_link.access_type,
    'granted_by_name', v_link.granted_by_name,
    'brand', v_recipe.brand,
    'recipe', (to_jsonb(v_recipe) - 'total_cost' - 'cost_per_portion' - 'packaging_cost' - 'selling_price' - 'wastage_pct'),
    'ingredients', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', ri.id,
        'component_type', ri.component_type,
        'quantity_used', ri.quantity_used,
        'unit_used', ri.unit_used,
        'sub_recipe', (ri.component_type = 'recipe'),
        'ingredient_name', case when ri.component_type = 'recipe' then sr.recipe_name else rm.ingredient_name end
      ) order by ri.sort_order)
      from public.recipe_ingredients ri
      left join public.raw_materials rm on rm.id = ri.ingredient_id and ri.component_type <> 'recipe'
      left join public.recipes sr on sr.id = ri.ingredient_id and ri.component_type = 'recipe'
      where ri.recipe_id = v_recipe.id
    ), '[]'::jsonb),
    'sub_recipes', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', sr.id,
        'recipe_name', sr.recipe_name,
        'yield_quantity', sr.yield_quantity,
        'yield_unit', sr.yield_unit,
        'ingredients', coalesce((
          select jsonb_agg(jsonb_build_object(
            'id', sri.id,
            'component_type', sri.component_type,
            'quantity_used', sri.quantity_used,
            'unit_used', sri.unit_used,
            'sub_recipe', (sri.component_type = 'recipe'),
            'ingredient_name', case when sri.component_type = 'recipe' then ssr.recipe_name else srm.ingredient_name end
          ) order by sri.sort_order)
          from public.recipe_ingredients sri
          left join public.raw_materials srm on srm.id = sri.ingredient_id and sri.component_type <> 'recipe'
          left join public.recipes ssr on ssr.id = sri.ingredient_id and sri.component_type = 'recipe'
          where sri.recipe_id = sr.id
        ), '[]'::jsonb))
        order by sr.recipe_name)
      from (select distinct ri.ingredient_id as sid
            from public.recipe_ingredients ri
            where ri.recipe_id = v_recipe.id and ri.component_type = 'recipe') s
      join public.recipes sr on sr.id = s.sid
    ), '[]'::jsonb)
  );
end;
$$;
grant execute on function public.resolve_share_link(text) to anon, authenticated;


-- ============================================================================
-- Migrations 0021-0032 — MISSING from the original RUN_THIS_ON_SUPABASE.sql,
-- which only consolidated 0001-0020. Without these the schema lacks
-- packaging_items / recipe_packaging (0025), wastage_lines (0026), the dish
-- weight + cooked weight columns, created_by_name, the wipe_catalog RPC and
-- several permission flags. Appended here so this file is the COMPLETE schema.
-- Each is idempotent; inner begin/commit stripped so the whole file stays one
-- atomic transaction.
-- ============================================================================

-- ---------------------------------------------------------------- 0021_normalize_material_pricing.sql
-- 0021_normalize_material_pricing.sql
-- Simplified raw-material purchase model: the price is per ONE automatic purchase
-- unit — 1 kg (weight), 1 litre (volume), 1 piece (count) — so purchase_quantity is
-- always 1 and users never pick a unit. This migration normalizes existing rows.
--
-- COST-PRESERVING: cost_per_base_unit is a plain, app-maintained column (see 0001)
-- and is left untouched. We only rewrite purchase_price to "per 1 canonical unit"
-- (= cost_per_base_unit × base-units-per-unit) and set purchase_quantity = 1 with
-- the canonical unit. Re-computing from these gives back the SAME cost_per_base_unit,
-- so no recipe is re-costed and no data is corrupted.
--
-- ⚠ TAKE A SUPABASE BACKUP BEFORE RUNNING (Dashboard → Database → Backups, or pg_dump).
-- Idempotent: re-running against already-normalized rows is a no-op.

-- Weight (base Gram) → 1 kg
update public.raw_materials set
  purchase_price    = case when cost_per_base_unit is null then purchase_price
                           else round(cost_per_base_unit * 1000, 2) end,
  purchase_quantity = 1,
  purchase_unit     = 'KG',
  base_unit         = 'Gram'
where base_unit = 'Gram';

-- Volume (base ML) → 1 litre
update public.raw_materials set
  purchase_price    = case when cost_per_base_unit is null then purchase_price
                           else round(cost_per_base_unit * 1000, 2) end,
  purchase_quantity = 1,
  purchase_unit     = 'Litre',
  base_unit         = 'ML'
where base_unit = 'ML';

-- Count (already piece-based) → 1 piece
update public.raw_materials set
  purchase_price    = case when cost_per_base_unit is null then purchase_price
                           else round(cost_per_base_unit, 2) end,
  purchase_quantity = 1,
  purchase_unit     = 'Piece',
  base_unit         = 'Piece'
where base_unit = 'Piece';

-- NOTE: rows with base_unit Packet/Bottle/Can are intentionally left as-is — they
-- don't map cleanly onto 1 piece and are still costed correctly with their existing
-- purchase_quantity/unit. Convert them by hand if you want them on the piece model.

-- ---------------------------------------------------------------- 0022_super_admin_limit_2.sql
-- 0022_super_admin_limit_2.sql — lower the active Super Admin cap from 5 to 2.
--
-- Recreates prevent_super_admin_limits() exactly as in 0019 but with the maximum
-- set to 2 (both the INSERT path and the promotion/reactivation path). The
-- owner-email exemption and the "keep at least one active Super Admin" rule are
-- unchanged. Idempotent — run AFTER 0019. Safe to re-run.


create or replace function public.prevent_super_admin_limits()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  active_supers int;
  owners text[] := array['mspatel05831@gmail.com'];
  target_is_owner boolean;
begin
  perform pg_advisory_xact_lock(hashtext('user_profiles_super_admin_limit'));
  target_is_owner := lower(coalesce(new.email, '')) = any(owners);

  if TG_OP = 'INSERT' then
    if new.role = 'super_admin' then
      if not target_is_owner and not public.is_app_super_admin() then
        raise exception 'Only a Super Admin can manage Super Admin users';
      end if;
      if new.status = 'active' and coalesce(new.approved, true) and not target_is_owner then
        select count(*) into active_supers from public.user_profiles
          where role = 'super_admin' and status = 'active' and coalesce(approved, true);
        if active_supers >= 2 then
          raise exception 'A maximum of 2 active Super Admin users is allowed. Remove or demote an existing Super Admin before assigning another.';
        end if;
      end if;
    end if;
    return new;
  end if;

  if not target_is_owner
     and (new.role = 'super_admin'
          or (old.role = 'super_admin'
              and row(new.role, new.status, new.approved) is distinct from row(old.role, old.status, old.approved)))
     and not public.is_app_super_admin() then
    raise exception 'Only a Super Admin can manage Super Admin users';
  end if;

  if (new.role = 'super_admin' and new.status = 'active' and coalesce(new.approved, true))
     and not (old.role = 'super_admin' and old.status = 'active' and coalesce(old.approved, true))
     and not target_is_owner then
    select count(*) into active_supers from public.user_profiles
      where id <> new.id and role = 'super_admin' and status = 'active' and coalesce(approved, true);
    if active_supers >= 2 then
      raise exception 'A maximum of 2 active Super Admin users is allowed. Remove or demote an existing Super Admin before assigning another.';
    end if;
  end if;

  if (old.role = 'super_admin' and old.status = 'active' and coalesce(old.approved, true))
     and not (new.role = 'super_admin' and new.status = 'active' and coalesce(new.approved, true)) then
    select count(*) into active_supers from public.user_profiles
      where id <> new.id and role = 'super_admin' and status = 'active' and coalesce(approved, true);
    if active_supers < 1 then
      raise exception 'This action cannot be completed because the system must retain at least one active Super Admin.';
    end if;
  end if;

  return new;
end $$;


-- ---------------------------------------------------------------- 0023_recipe_total_weight.sql
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

-- ---------------------------------------------------------------- 0023_unlock_brands_outlets.sql
-- 0023_unlock_brands_outlets.sql — RE-ENABLE Super-Admin brand & outlet management.
--
-- ROOT CAUSE of "Super Admin cannot create a new brand":
-- Migration 0017_lock_brands_outlets.sql made public.brands / public.outlets
-- READ-ONLY by installing a BEFORE INSERT/UPDATE/DELETE trigger
-- (prevent_brand_outlet_writes) that raises an exception on every write where
-- auth.uid() IS NOT NULL — i.e. every write from a logged-in app user. Brand &
-- outlet management has since been restored to the application (Super-Admin-gated
-- BrandsOutletsPage / BrandForm / OutletForm), so that trigger now blocks the
-- legitimate feature: the insert reaches Postgres and is rejected, surfacing as a
-- failed/silent save in the UI.
--
-- This migration removes the blanket write-block and restores the ORIGINAL
-- Super-Admin-only Row Level Security from 0012 (authenticated users read; only
-- app_role() = 'super_admin' may write). It also restores the brand/outlet
-- management capabilities 0017 deleted from every role.
--
-- Idempotent / re-runnable. Run AFTER 0012 and 0017. No data is modified.


-- ── 1. Drop the read-only write-block triggers + function from 0017 ───────────
drop trigger if exists trg_brands_readonly  on public.brands;
drop trigger if exists trg_outlets_readonly on public.outlets;
drop function if exists public.prevent_brand_outlet_writes();

-- ── 2. Re-affirm the correct Super-Admin-only RLS write policy (from 0012) ────
-- Authenticated users may read every brand; only a Super Admin may insert/update/
-- delete. Recreated idempotently so the control is correct regardless of history.
alter table public.brands enable row level security;
drop policy if exists brands_read  on public.brands;
drop policy if exists brands_write on public.brands;
create policy brands_read  on public.brands for select to authenticated using (true);
create policy brands_write on public.brands for all to authenticated
  using (public.app_role() = 'super_admin') with check (public.app_role() = 'super_admin');

alter table public.outlets enable row level security;
drop policy if exists outlets_write on public.outlets;
create policy outlets_write on public.outlets for all to authenticated
  using (public.app_role() = 'super_admin') with check (public.app_role() = 'super_admin');

-- ── 3. Restore the brand/outlet management capabilities 0017 removed ──────────
-- Cleanup only: the app gates brand/outlet management by ROLE (the RLS above and
-- the Super-Admin-only route), not by these capabilities — so writes already work
-- after steps 1–2. This re-adds the rows 0017 deleted for any has_cap()-driven
-- check. Guarded on the table + the super_admin role row existing (role_capabilities
-- keys on role_key → roles(key)); a no-op on schemas without them.
do $$
begin
  if to_regclass('public.role_capabilities') is not null
     and exists (select 1 from public.roles where key = 'super_admin') then
    insert into public.role_capabilities (role_key, capability)
    select 'super_admin', c
      from (values
        ('brand.create'), ('brand.edit'), ('brand.archive'),
        ('outlet.create'), ('outlet.edit'), ('outlet.change_brand'), ('outlet.archive')
      ) as caps(c)
    on conflict (role_key, capability) do nothing;
  end if;
end $$;


-- ---------------------------------------------------------------- 0024_yield_name.sql
-- 0024_yield_name.sql — optional label for a yield record.
-- Nullable; the UI falls back to "<Ingredient> Yield" when blank. Idempotent.

alter table public.ingredient_yields
  add column if not exists name text;

-- ---------------------------------------------------------------- 0025_packaging.sql
-- 0025_packaging.sql — Packaging master + recipe packaging lines.
--
-- packaging_items: master cost items (Pizza Box, Sauce Cup…) with a unit price.
-- recipe_packaging: per-recipe lines (how many of an item a recipe uses), with a
-- snapshotted unit price so historic recipe costs stay stable.
-- RLS: any authenticated user can read; admins (is_app_admin) manage. Idempotent.

create table if not exists public.packaging_items (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  normalized_name text not null,
  packaging_type text not null default 'primary',
  unit text not null default 'Piece',
  unit_price numeric,
  status text not null default 'active',
  notes text,
  created_by uuid references public.user_profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_by uuid references public.user_profiles(id) on delete set null,
  updated_at timestamptz not null default now()
);
create unique index if not exists packaging_items_norm_name_uidx
  on public.packaging_items (normalized_name);

create table if not exists public.recipe_packaging (
  id uuid primary key default gen_random_uuid(),
  recipe_id uuid not null references public.recipes(id) on delete cascade,
  packaging_item_id uuid not null references public.packaging_items(id) on delete restrict,
  quantity_used numeric not null default 1,
  unit text not null default 'Piece',
  unit_price numeric not null default 0,
  created_at timestamptz not null default now()
);
create index if not exists recipe_packaging_recipe_idx on public.recipe_packaging (recipe_id);

alter table public.packaging_items enable row level security;
alter table public.recipe_packaging enable row level security;

-- Read for any authenticated user; writes limited to admins.
drop policy if exists packaging_items_read on public.packaging_items;
create policy packaging_items_read on public.packaging_items
  for select to authenticated using (true);
drop policy if exists packaging_items_write on public.packaging_items;
create policy packaging_items_write on public.packaging_items
  for all to authenticated using (public.is_app_admin()) with check (public.is_app_admin());

drop policy if exists recipe_packaging_read on public.recipe_packaging;
create policy recipe_packaging_read on public.recipe_packaging
  for select to authenticated using (true);
drop policy if exists recipe_packaging_write on public.recipe_packaging;
create policy recipe_packaging_write on public.recipe_packaging
  for all to authenticated using (public.is_app_admin()) with check (public.is_app_admin());

-- Seed the standard packaging master items (idempotent by normalized_name).
insert into public.packaging_items (name, normalized_name, packaging_type, unit, unit_price)
values
  ('Pizza Box',   'pizza box',   'primary',   'Piece', 4.50),
  ('Burger Box',  'burger box',  'primary',   'Piece', 3.50),
  ('Paper Bag',   'paper bag',   'secondary', 'Piece', 2.00),
  ('Sauce Cup',   'sauce cup',   'primary',   'Piece', 1.50),
  ('Dessert Box', 'dessert box', 'primary',   'Piece', 5.00),
  ('Cup',         'cup',         'primary',   'Piece', 2.50),
  ('Lid',         'lid',         'primary',   'Piece', 1.00),
  ('Sticker',     'sticker',     'tertiary',  'Piece', 0.50),
  ('Fork',        'fork',        'secondary', 'Piece', 0.80),
  ('Spoon',       'spoon',       'secondary', 'Piece', 0.80)
on conflict (normalized_name) do nothing;

-- ---------------------------------------------------------------- 0026_wastage_lines.sql
-- 0026_wastage_lines.sql — recipe-style multi-line wastage.
--
-- Adds header fields (name/category/description/status/packaging_cost) to
-- wastage_entries and a wastage_lines child table (one row per wasted item).
-- Existing single-item records are backfilled into wastage_lines so nothing is
-- lost. RLS inherits the same outlet-scoped access as wastage_entries.
-- Idempotent. Safe to re-run.

alter table public.wastage_entries
  add column if not exists name text,
  add column if not exists category text,
  add column if not exists description text,
  add column if not exists status text default 'recorded',
  add column if not exists packaging_cost numeric default 0;

create table if not exists public.wastage_lines (
  id uuid primary key default gen_random_uuid(),
  wastage_id uuid not null references public.wastage_entries(id) on delete cascade,
  item_type text not null,
  ingredient_id uuid references public.raw_materials(id) on delete set null,
  recipe_id uuid references public.recipes(id) on delete set null,
  quantity numeric not null default 0,
  unit text not null default 'Gram',
  unit_cost numeric not null default 0,
  total_cost numeric not null default 0
);
create index if not exists wastage_lines_wastage_idx on public.wastage_lines (wastage_id);

alter table public.wastage_lines enable row level security;

-- Read/write follow the parent wastage record's access (outlet-scoped in 0008):
-- a user can touch a line iff they can touch its wastage_entries row.
drop policy if exists wastage_lines_all on public.wastage_lines;
create policy wastage_lines_all on public.wastage_lines
  for all to authenticated
  using (exists (select 1 from public.wastage_entries w where w.id = wastage_id))
  with check (exists (select 1 from public.wastage_entries w where w.id = wastage_id));

-- Backfill: one line per existing single-item wastage record that has none yet.
insert into public.wastage_lines (wastage_id, item_type, ingredient_id, recipe_id, quantity, unit, unit_cost, total_cost)
select w.id, w.item_type, w.ingredient_id, w.recipe_id, w.quantity, w.unit, w.unit_cost, w.total_cost
from public.wastage_entries w
where not exists (select 1 from public.wastage_lines l where l.wastage_id = w.id);

-- ---------------------------------------------------------------- 0027_recipe_created_by_name.sql
-- 0027_recipe_created_by_name.sql — manually-typed recipe creator label.
--
-- Distinct from created_by (the system user id): a free-text creator name entered
-- by the user (e.g. "Chef Rahul", "Central Kitchen"). Nullable so existing recipes
-- remain valid and stay blank until edited. Idempotent.

alter table public.recipes
  add column if not exists created_by_name text;

-- ---------------------------------------------------------------- 0028_wipe_catalog.sql
-- 0028_wipe_catalog.sql — Super-Admin "wipe all catalog data" RPC.
--
-- Deletes the entire operational catalog (recipes / in-house prep, ingredient
-- lines, raw materials, yields, packaging, wastage, and their cost/price
-- history) so a super admin can start fresh. KEEPS user_profiles, roles,
-- role_capabilities, brands, outlets, system_settings and audit_logs.
--
-- SECURITY DEFINER runs as the table owner (bypasses RLS) and is gated to
-- super-admins via is_app_super_admin() (0015). TRUNCATE ... CASCADE handles FK
-- order atomically in one transaction. Idempotent (safe to re-run).

create or replace function public.wipe_catalog()
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_app_super_admin() then
    raise exception 'Only a Super Admin can wipe catalog data';
  end if;

  truncate table
    public.recipe_cost_history,
    public.ingredient_price_history,
    public.recipe_versions,
    public.recipe_packaging,
    public.recipe_ingredients,
    public.user_recipe_views,
    public.recipe_access_links,
    public.wastage_lines,
    public.wastage_entries,
    public.export_history,
    public.recipes,
    public.raw_materials,
    public.ingredient_yields,
    public.packaging_items
    restart identity cascade;

  begin
    insert into public.audit_logs (entity_type, entity_id, action, performed_by, notes)
    values ('system', auth.uid(), 'delete', auth.uid(),
            'Wiped all catalog data (recipes, materials, yields, packaging, wastage)');
  exception when others then null;  -- never fail the wipe on an audit-insert quirk
  end;
end;
$$;

revoke all on function public.wipe_catalog() from public, anon;
grant execute on function public.wipe_catalog() to authenticated;

-- ---------------------------------------------------------------- 0029_recipe_cooked_weight.sql
-- 0029_recipe_cooked_weight.sql — final weight after cooking (manual).
--
-- total_weight_g is the RAW dish weight, auto-summed from ingredient quantities.
-- cooked_weight_g is the finished weight after cooking, measured and entered by
-- hand (nullable until recorded). The app derives cooking-loss % from the two.
-- Idempotent.

alter table public.recipes
  add column if not exists cooked_weight_g numeric;

-- ---------------------------------------------------------------- 0030_user_can_import.sql
-- 0030_user_can_import.sql — per-user "Data Import" access grant.
--
-- Super Admins can allow specific users to open the Import Data hub. Stored on the
-- profile; nullable/default-false so existing users keep no import access. The app
-- only lets a Super Admin change it (UI gate); the admin update RLS policy already
-- governs who can write user_profiles. Idempotent.

alter table public.user_profiles
  add column if not exists can_import boolean not null default false;

-- ---------------------------------------------------------------- 0031_share_link_sub_recipes.sql
-- 0031_share_link_sub_recipes.sql — include each direct sub-recipe's own ingredients
-- in the shared-recipe payload, so a temporary link shows the "Sub-Recipe Breakdown"
-- on the page and in the downloaded PDF. Financial fields are still stripped (share
-- links never expose costs). Idempotent (create or replace) — safe to re-run.

create or replace function public.resolve_share_link(p_token text)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_hash   text := encode(digest(p_token, 'sha256'), 'hex');
  v_link   public.recipe_access_links%rowtype;
  v_recipe public.recipes%rowtype;
  v_status text;
begin
  select * into v_link from public.recipe_access_links where token_hash = v_hash;
  if not found then
    return jsonb_build_object('status', 'REVOKED');
  end if;

  if v_link.revoked_at is not null then
    v_status := 'REVOKED';
  elsif v_link.expires_at <= now() then
    v_status := 'EXPIRED';
  else
    v_status := 'ACTIVE';
  end if;

  update public.recipe_access_links set status = v_status where id = v_link.id;
  if v_status <> 'ACTIVE' then
    return jsonb_build_object('status', v_status);
  end if;

  select * into v_recipe from public.recipes where id = v_link.recipe_id;
  if not found then
    return jsonb_build_object('status', 'REVOKED');
  end if;

  update public.recipe_access_links
     set access_count = access_count + 1, last_accessed_at = now()
   where id = v_link.id;

  return jsonb_build_object(
    'status', 'ACTIVE',
    'access_type', v_link.access_type,
    'granted_by_name', v_link.granted_by_name,
    'brand', v_recipe.brand,
    'recipe', (to_jsonb(v_recipe) - 'total_cost' - 'cost_per_portion' - 'packaging_cost' - 'selling_price' - 'wastage_pct'),
    'ingredients', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', ri.id,
        'component_type', ri.component_type,
        'quantity_used', ri.quantity_used,
        'unit_used', ri.unit_used,
        'sub_recipe', (ri.component_type = 'recipe'),
        'ingredient_name', case when ri.component_type = 'recipe' then sr.recipe_name else rm.ingredient_name end
      ) order by ri.sort_order)
      from public.recipe_ingredients ri
      left join public.raw_materials rm on rm.id = ri.ingredient_id and ri.component_type <> 'recipe'
      left join public.recipes sr on sr.id = ri.ingredient_id and ri.component_type = 'recipe'
      where ri.recipe_id = v_recipe.id
    ), '[]'::jsonb),
    -- Each DIRECT sub-recipe of this recipe, with its own ingredients (one level).
    'sub_recipes', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', sr.id,
        'recipe_name', sr.recipe_name,
        'yield_quantity', sr.yield_quantity,
        'yield_unit', sr.yield_unit,
        'ingredients', coalesce((
          select jsonb_agg(jsonb_build_object(
            'id', sri.id,
            'component_type', sri.component_type,
            'quantity_used', sri.quantity_used,
            'unit_used', sri.unit_used,
            'sub_recipe', (sri.component_type = 'recipe'),
            'ingredient_name', case when sri.component_type = 'recipe' then ssr.recipe_name else srm.ingredient_name end
          ) order by sri.sort_order)
          from public.recipe_ingredients sri
          left join public.raw_materials srm on srm.id = sri.ingredient_id and sri.component_type <> 'recipe'
          left join public.recipes ssr on ssr.id = sri.ingredient_id and sri.component_type = 'recipe'
          where sri.recipe_id = sr.id
        ), '[]'::jsonb))
        order by sr.recipe_name)
      from (select distinct ri.ingredient_id as sid
            from public.recipe_ingredients ri
            where ri.recipe_id = v_recipe.id and ri.component_type = 'recipe') s
      join public.recipes sr on sr.id = s.sid
    ), '[]'::jsonb)
  );
end;
$$;
grant execute on function public.resolve_share_link(text) to anon, authenticated;

-- ---------------------------------------------------------------- 0032_user_can_manage_wastage.sql
-- 0032_user_can_manage_wastage.sql — per-user "Wastage Management" access grant.
--
-- Wastage Management is now Super-Admin-controlled (like Data Import): a Super Admin
-- grants specific users access to view and use the page. Stored on the profile;
-- nullable/default-false so existing users keep no access until granted. Idempotent.

alter table public.user_profiles
  add column if not exists can_manage_wastage boolean not null default false;

commit;
