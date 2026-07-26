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

begin;

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

commit;
