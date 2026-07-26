-- 0005_ingredient_yields.sql
-- Standard yield (preparation-loss) data per ingredient. The full purchase cost
-- is distributed across the USABLE quantity → yield_adjusted_unit_cost. This is
-- the contract the mock/localStorage layer (src/lib/data/mock/yields.ts) mirrors.

create table public.ingredient_yields (
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

create index ingredient_yields_ingredient_idx on public.ingredient_yields (ingredient_id);

alter table public.ingredient_yields enable row level security;
-- Staff (admin/editor) manage yield; everyone authenticated may read.
create policy "ingredient_yields_read" on public.ingredient_yields for select using (true);
