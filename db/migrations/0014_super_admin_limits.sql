-- 0014_super_admin_limits.sql — protected Super Admin count (§14–§17).
-- Enforces, race-safely in a single DB transaction, that the system keeps between
-- 1 and 5 ACTIVE super admins. Closes the gap where 0007's prevent_last_admin_removal
-- only guarded role='admin' — super_admin had NO server-side min/max enforcement.
--
-- Owner emails are exempt from the MAX check so an owner is never locked out (they
-- are auto-promoted by on_sign_in). The MIN check has no exemption. Idempotent.

begin;

create or replace function public.prevent_super_admin_limits()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  active_supers int;
  owners text[] := array['reservation.bookends@gmail.com','moin.bookends@gmail.com'];
begin
  -- Serialize concurrent super-admin changes so two promotions can't both pass a
  -- stale count check and produce a 6th (or drop below 1).
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

  -- Becoming an active super admin (promotion or reactivation)?
  if (new.role = 'super_admin' and new.status = 'active' and coalesce(new.approved, true))
     and not (old.role = 'super_admin' and old.status = 'active' and coalesce(old.approved, true))
     and lower(coalesce(new.email, '')) <> all(owners) then
    select count(*) into active_supers from public.user_profiles
      where id <> new.id and role = 'super_admin' and status = 'active' and coalesce(approved, true);
    if active_supers >= 5 then
      raise exception 'A maximum of 5 active Super Admin users is allowed. Remove or demote an existing Super Admin before assigning another.';
    end if;
  end if;

  -- Leaving the active-super-admin set (demotion/disable)? Never drop below 1.
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

commit;
