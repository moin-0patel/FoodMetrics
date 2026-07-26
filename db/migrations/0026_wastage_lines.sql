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
