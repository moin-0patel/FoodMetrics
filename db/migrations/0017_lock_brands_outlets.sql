-- 0017_lock_brands_outlets.sql — brand & outlet MANAGEMENT removed.
--
-- The fixed Capiche/Aiko brands and their six outlets stay exactly as-is and keep
-- working everywhere (filtering, recipes, wastage, reports, exports, user scopes).
-- This migration only makes them READ-ONLY from the application and drops the
-- brand/outlet management capabilities. No data is deleted; no relationships change.
--
-- Idempotent / re-runnable. Run AFTER 0012–0016.

begin;

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

commit;
