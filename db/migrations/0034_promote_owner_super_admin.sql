-- 0034_promote_owner_super_admin.sql — ensure mspatel05831@gmail.com is Super Admin.
--
-- 0019_owner_transfer.sql already promoted this address, but only for a profile
-- row that existed when 0019 ran. If the account was created afterwards it will
-- be sitting on the default role ('viewer', unapproved), so run this to fix it.
--
-- Safe and idempotent — re-running changes nothing. Not destructive: it only
-- raises this one account's role and never touches anyone else.
--
-- The super-admin cap trigger (prevent_super_admin_limits, 0022) hardcodes this
-- address in its `owners` array, so the promotion is exempt from both the
-- "only a Super Admin can manage Super Admins" check and the 2-active-super cap.
-- No existing Super Admin needs to be demoted first.

do $$
declare
  target text := 'mspatel05831@gmail.com';
  auth_id uuid;
  updated int;
begin
  select id into auth_id from auth.users where lower(email) = target;

  if auth_id is null then
    raise notice '--------------------------------------------------------------';
    raise notice 'No auth user exists for %.', target;
    raise notice 'Sign up / log in once through the app first (this creates the';
    raise notice 'auth user + profile row), then re-run this script.';
    raise notice '--------------------------------------------------------------';
    return;
  end if;

  update public.user_profiles
     set role             = 'super_admin',
         status           = 'active',
         approved         = true,
         email_verified   = true,
         dashboard_access = true,
         last_role_update = now(),
         role_updated_by  = 'migration 0034',
         updated_at       = now()
   where id = auth_id;

  get diagnostics updated = row_count;

  -- An auth user with no profile row (e.g. the signup trigger did not fire).
  if updated = 0 then
    insert into public.user_profiles (id, email, name, role, status, approved, email_verified, dashboard_access)
    values (auth_id, target, 'M S Patel (Owner)', 'super_admin', 'active', true, true, true)
    on conflict (id) do update
      set role = 'super_admin', status = 'active', approved = true,
          email_verified = true, dashboard_access = true, updated_at = now();
    raise notice 'Created a Super Admin profile for % (no profile row existed).', target;
  else
    raise notice '% is now an active, approved Super Admin.', target;
  end if;
end $$;

-- Verify: this should return one row with role = super_admin, status = active.
select email, name, role, status, approved, dashboard_access
  from public.user_profiles
 where lower(email) = 'mspatel05831@gmail.com';
