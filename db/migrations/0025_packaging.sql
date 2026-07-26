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
