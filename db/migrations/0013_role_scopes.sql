-- 0013_role_scopes.sql — per-user brand & outlet access scopes (§19–§20).
-- Generalises the legacy accessible_brands / assigned_brand grants. Unset (null)
-- scope columns preserve the existing role-based behaviour, so existing users are
-- unaffected. Idempotent; run AFTER the base setup + 0012.

begin;

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

commit;
