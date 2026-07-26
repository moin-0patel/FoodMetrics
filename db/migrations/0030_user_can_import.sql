-- 0030_user_can_import.sql — per-user "Data Import" access grant.
--
-- Super Admins can allow specific users to open the Import Data hub. Stored on the
-- profile; nullable/default-false so existing users keep no import access. The app
-- only lets a Super Admin change it (UI gate); the admin update RLS policy already
-- governs who can write user_profiles. Idempotent.

alter table public.user_profiles
  add column if not exists can_import boolean not null default false;
