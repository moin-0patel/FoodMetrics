-- 0019_owner_transfer.sql
-- Ownership transfer: mspatel05831@gmail.com becomes the sole owner / Super Admin.
-- The previous owner emails (moin, reservation, main.1, admin@bookends.app) are
-- removed and de-listed from the auto-promotion + Super-Admin-limit exemptions.
--
-- Run this in the Supabase SQL editor. Idempotent / re-runnable.
--
-- NOTE: mspatel05831@gmail.com must sign up (or already exist) to hold a profile
-- row. Once their email is confirmed, on_sign_in() auto-promotes them to
-- super_admin. If they have not signed up yet, the promotion UPDATE below simply
-- affects 0 rows and the system may briefly have no active Super Admin until they
-- first sign in.

-- ── 1. Re-list the single owner in the auto-promotion routine ────────────────
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

-- ── 2. Re-list the single owner in the Super-Admin count exemption ───────────
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

-- ── 3. Promote mspatel05831 if their profile already exists ──────────────────
update public.user_profiles
   set role = 'super_admin', status = 'active', approved = true
 where lower(email) = 'mspatel05831@gmail.com';

-- ── 4. Remove the four decommissioned accounts ──────────────────────────────
-- Deleting the auth user cascades to user_profiles (FK ON DELETE CASCADE); the
-- explicit profile delete is a safety net in case the cascade is not present.
delete from auth.users
 where lower(email) in (
   'moin.bookends@gmail.com',
   'reservation.bookends@gmail.com',
   'main.1@gmail.com',
   'admin@bookends.app'
 );

delete from public.user_profiles
 where lower(email) in (
   'moin.bookends@gmail.com',
   'reservation.bookends@gmail.com',
   'main.1@gmail.com',
   'admin@bookends.app'
 );
