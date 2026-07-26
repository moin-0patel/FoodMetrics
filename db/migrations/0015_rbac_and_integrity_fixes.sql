-- 0015_rbac_and_integrity_fixes.sql — fixes surfaced by the security review.
--  1. is_app_admin() must recognise super_admin, else the top role (owners are
--     auto-promoted to super_admin, NOT admin) cannot manage users at all.
--  2. is_app_super_admin() + an actor gate in the super-admin trigger: only a
--     super admin may assign/mutate a super_admin (mirrors the mock). Owner rows
--     stay exempt so on_sign_in auto-promotion is never blocked.
--  3. Unique outlet code + (brand_id, normalized_name) so Supabase rejects the
--     duplicates the mock already forbids.
--  4. Share-link resolver returns the brand DISPLAY NAME (public visitors can't
--     read the brands table), so shared recipes never show a raw brand id.
-- Idempotent. Run AFTER 0012–0014.

begin;

-- ── 1. Admin gate recognises super_admin ────────────────────────────────────
create or replace function public.is_app_admin()
returns boolean language sql security definer stable set search_path = public as $$
  select exists (
    select 1 from public.user_profiles
    where id = auth.uid() and role in ('admin','super_admin') and status = 'active'
  )
$$;

-- ── 2a. Super-admin actor helper ────────────────────────────────────────────
create or replace function public.is_app_super_admin()
returns boolean language sql security definer stable set search_path = public as $$
  select exists (
    select 1 from public.user_profiles
    where id = auth.uid() and role = 'super_admin' and status = 'active'
  )
$$;

-- ── 2b. Trigger: actor gate + min-1/max-5 (race-safe) ───────────────────────
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

  -- Actor gate: assigning super_admin, or mutating an existing super_admin's
  -- role/status/approved, requires a super-admin actor (owner rows exempt).
  if not target_is_owner
     and (new.role = 'super_admin'
          or (old.role = 'super_admin'
              and row(new.role, new.status, new.approved) is distinct from row(old.role, old.status, old.approved)))
     and not public.is_app_super_admin() then
    raise exception 'Only a Super Admin can manage Super Admin users';
  end if;

  -- Becoming an active super admin (promotion or reactivation)?
  if (new.role = 'super_admin' and new.status = 'active' and coalesce(new.approved, true))
     and not (old.role = 'super_admin' and old.status = 'active' and coalesce(old.approved, true))
     and not target_is_owner then
    select count(*) into active_supers from public.user_profiles
      where id <> new.id and role = 'super_admin' and status = 'active' and coalesce(approved, true);
    if active_supers >= 5 then
      raise exception 'A maximum of 5 active Super Admin users is allowed. Remove or demote an existing Super Admin before assigning another.';
    end if;
  end if;

  -- Leaving the active-super set (demotion/disable)? Never drop below 1.
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

-- ── 3. Outlet uniqueness (matches the mock; seeded rows have distinct values) ─
create unique index if not exists outlets_outlet_code_key    on public.outlets (outlet_code);
create unique index if not exists outlets_brand_normname_key on public.outlets (brand_id, normalized_name);

-- ── 4. Share resolver returns the brand display name ────────────────────────
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

commit;
