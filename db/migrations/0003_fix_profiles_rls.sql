-- 0003_fix_profiles_rls.sql
-- Patch for projects that ran the FIRST version of 0002 (which had a recursive
-- admin policy → "infinite recursion detected in policy for relation profiles",
-- error 42P17). Run this once in the SQL editor. Idempotent.
--
-- (A clean install of the updated 0002 already includes this fix and does not
--  need to run 0003.)

-- Recursion-safe admin check: SECURITY DEFINER bypasses RLS on its inner select.
create or replace function public.is_admin()
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (select 1 from public.profiles where id = auth.uid() and role = 'admin');
$$;

-- Replace the self-referential admin policy with one that uses the function.
drop policy if exists "profiles_admin_all" on public.profiles;

create policy "profiles_admin_all" on public.profiles
  for all using (public.is_admin());
