-- 0016_roles.sql — dynamic, Super-Admin-managed ROLES with custom feature access.
--
-- Makes roles data (like brands/outlets in 0012) instead of a fixed enum: a Super
-- Admin can create custom roles and pick exactly which capabilities they hold.
-- Design: CAPABILITIES stay code-defined; only WHICH role has WHICH capability is
-- data. The built-in roles (super_admin/admin/editor/head_chef/chef/viewer) are
-- seeded with their existing capabilities, so behaviour is unchanged. super_admin
-- and admin stay RESERVED names — the RLS/guards below still key off them, so a
-- custom role can never gain admin/super-admin power.
--
-- Server-side capability grants are ADDITIVE: every capability-gated policy gets
-- `OR public.has_cap(...)`, so the six built-ins behave exactly as before and a
-- custom role gains access only for the capabilities it was granted.
--
-- Idempotent / re-runnable. Run AFTER 0007–0015.

begin;

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

commit;
