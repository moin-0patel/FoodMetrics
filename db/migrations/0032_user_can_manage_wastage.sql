-- 0032_user_can_manage_wastage.sql — per-user "Wastage Management" access grant.
--
-- Wastage Management is now Super-Admin-controlled (like Data Import): a Super Admin
-- grants specific users access to view and use the page. Stored on the profile;
-- nullable/default-false so existing users keep no access until granted. Idempotent.

alter table public.user_profiles
  add column if not exists can_manage_wastage boolean not null default false;
