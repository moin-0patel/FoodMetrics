-- 0022_super_admin_limit_2.sql — lower the active Super Admin cap from 5 to 2.
--
-- Recreates prevent_super_admin_limits() exactly as in 0019 but with the maximum
-- set to 2 (both the INSERT path and the promotion/reactivation path). The
-- owner-email exemption and the "keep at least one active Super Admin" rule are
-- unchanged. Idempotent — run AFTER 0019. Safe to re-run.

begin;

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
        if active_supers >= 2 then
          raise exception 'A maximum of 2 active Super Admin users is allowed. Remove or demote an existing Super Admin before assigning another.';
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
    if active_supers >= 2 then
      raise exception 'A maximum of 2 active Super Admin users is allowed. Remove or demote an existing Super Admin before assigning another.';
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

commit;
